import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { getServiceRoleClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    const session = await getSessionUser(request)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('bookings')
        .select(`
            *,
            instructor:instructors!instructor_id(full_name, phone),
            lesson:lessons(*)
        `)
        .eq('student_id', session.id)
        .order('start_time', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bookings: data || [] })
}

export async function PATCH(request: NextRequest) {
    const session = await getSessionUser(request)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()
    const db = getServiceRoleClient()

    if (action === 'confirm_payment') {
        // Mark pending bookings as paid after Stripe redirect
        const { error } = await db
            .from('bookings')
            .update({ payment_status: 'paid' })
            .eq('student_id', session.id)
            .eq('payment_status', 'pending')

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
