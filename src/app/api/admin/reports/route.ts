import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

function toCSV(rows: Record<string, any>[]): string {
    if (!rows.length) return ''
    const headers = Object.keys(rows[0])
    const escape = (v: any) => {
        const s = v == null ? '' : String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    return [
        headers.join(','),
        ...rows.map(r => headers.map(h => escape(r[h])).join(','))
    ].join('\n')
}

function csvResponse(csv: string, filename: string) {
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}

export async function GET(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'bookings' | 'earnings' | 'packages'
    const from = searchParams.get('from') // YYYY-MM-DD
    const to = searchParams.get('to')     // YYYY-MM-DD

    const db = getServiceRoleClient()
    const fromDate = from ? new Date(from).toISOString() : new Date('2000-01-01').toISOString()
    const toDate = to ? new Date(to + 'T23:59:59').toISOString() : new Date().toISOString()

    if (type === 'bookings') {
        const { data, error } = await db
            .from('bookings')
            .select(`
                id, start_time, end_time, status, payment_status, pickup_address,
                vehicle_type, transmission_type, credits_used, created_at,
                student:users!bookings_student_id_fkey(full_name, email, phone),
                instructor:instructors!instructor_id(full_name, email),
                lesson:lessons!lesson_id(title, price, duration_minutes)
            `)
            .gte('start_time', fromDate)
            .lte('start_time', toDate)
            .order('start_time', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const rows = (data || []).map(b => ({
            'Booking ID': b.id,
            'Date': new Date(b.start_time).toLocaleDateString('en-AU'),
            'Time': new Date(b.start_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
            'Student Name': (b.student as any)?.full_name ?? '',
            'Student Email': (b.student as any)?.email ?? '',
            'Student Phone': (b.student as any)?.phone ?? '',
            'Instructor': (b.instructor as any)?.full_name ?? '',
            'Lesson': (b.lesson as any)?.title ?? '',
            'Duration (mins)': (b.lesson as any)?.duration_minutes ?? '',
            'Price ($)': (b.lesson as any)?.price ?? '',
            'Status': b.status,
            'Payment Status': b.payment_status,
            'Vehicle': b.vehicle_type,
            'Transmission': b.transmission_type ?? '',
            'Pickup Address': b.pickup_address ?? '',
            'Credits Used': b.credits_used ?? 0,
            'Booked At': new Date(b.created_at).toLocaleDateString('en-AU'),
        }))

        const dateTag = `${from ?? 'all'}_to_${to ?? 'today'}`
        return csvResponse(toCSV(rows), `bookings_${dateTag}.csv`)
    }

    if (type === 'earnings') {
        const { data, error } = await db
            .from('bookings')
            .select(`
                start_time, payment_status, credits_used,
                instructor:instructors!instructor_id(full_name),
                lesson:lessons!lesson_id(title, price)
            `)
            .gte('start_time', fromDate)
            .lte('start_time', toDate)
            .in('payment_status', ['paid', 'pay_in_person'])
            .order('start_time', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Aggregate by instructor
        const byInstructor: Record<string, { name: string; lessons: number; revenue: number; credits: number }> = {}
        for (const b of data || []) {
            const name = (b.instructor as any)?.full_name ?? 'Unknown'
            if (!byInstructor[name]) byInstructor[name] = { name, lessons: 0, revenue: 0, credits: 0 }
            byInstructor[name].lessons += 1
            byInstructor[name].revenue += (b.lesson as any)?.price ?? 0
            byInstructor[name].credits += b.credits_used ?? 0
        }

        const rows = Object.values(byInstructor).map(r => ({
            'Instructor': r.name,
            'Total Lessons': r.lessons,
            'Total Revenue ($)': r.revenue.toFixed(2),
            'Credit Lessons': r.credits,
            'Cash/Card Lessons': r.lessons - r.credits,
        }))

        // Append totals row
        const totalRevenue = rows.reduce((s, r) => s + parseFloat(r['Total Revenue ($)']), 0)
        const totalLessons = rows.reduce((s, r) => s + r['Total Lessons'], 0)
        rows.push({
            'Instructor': 'TOTAL',
            'Total Lessons': totalLessons,
            'Total Revenue ($)': totalRevenue.toFixed(2),
            'Credit Lessons': rows.reduce((s, r) => s + r['Credit Lessons'], 0),
            'Cash/Card Lessons': rows.reduce((s, r) => s + r['Cash/Card Lessons'], 0),
        })

        const dateTag = `${from ?? 'all'}_to_${to ?? 'today'}`
        return csvResponse(toCSV(rows), `earnings_by_instructor_${dateTag}.csv`)
    }

    if (type === 'packages') {
        const { data, error } = await db
            .from('package_purchases')
            .select(`
                id, package_type, amount, credits_added, created_at,
                student:users!package_purchases_student_id_fkey(full_name, email, phone, credits_remaining, package_expiry)
            `)
            .gte('created_at', fromDate)
            .lte('created_at', toDate)
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const rows = (data || []).map(p => {
            const student = p.student as any
            return {
                'Purchase ID': p.id,
                'Date': new Date(p.created_at).toLocaleDateString('en-AU'),
                'Student Name': student?.full_name ?? '',
                'Student Email': student?.email ?? '',
                'Student Phone': student?.phone ?? '',
                'Package Type': p.package_type,
                'Amount Paid ($)': p.amount,
                'Credits Added': p.credits_added,
                'Credits Remaining': student?.credits_remaining ?? '',
                'Package Expiry': student?.package_expiry ? new Date(student.package_expiry).toLocaleDateString('en-AU') : '',
            }
        })

        const dateTag = `${from ?? 'all'}_to_${to ?? 'today'}`
        return csvResponse(toCSV(rows), `package_sales_${dateTag}.csv`)
    }

    return NextResponse.json({ error: 'Invalid report type. Use: bookings | earnings | packages' }, { status: 400 })
}
