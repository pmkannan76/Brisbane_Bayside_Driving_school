import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { instructorId, lessonId, date, time, status, paymentStatus, pickupAddress, vehicleType, transmissionType } = await request.json()
    const db = getServiceRoleClient()

    // Fetch lesson duration to recalculate end_time
    const { data: lesson } = await db.from('lessons').select('duration_minutes').eq('id', lessonId).single()
    if (!lesson) return NextResponse.json({ error: 'Lesson not found.' }, { status: 400 })

    const startTime = new Date(`${date}T${time}`)
    const endTime = new Date(startTime.getTime() + lesson.duration_minutes * 60000)

    // Double-booking check — exclude the booking being edited
    if (status === 'scheduled') {
        const { data: conflicts } = await db
            .from('bookings')
            .select('id, start_time')
            .eq('instructor_id', instructorId)
            .neq('id', id)
            .in('status', ['scheduled'])
            .lt('start_time', endTime.toISOString())
            .gt('end_time', startTime.toISOString())

        if (conflicts && conflicts.length > 0) {
            const clash = new Date(conflicts[0].start_time)
            return NextResponse.json({
                error: `Instructor already has a booking on ${clash.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} at ${clash.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}.`
            }, { status: 409 })
        }
    }

    const { data, error } = await db
        .from('bookings')
        .update({
            instructor_id: instructorId,
            lesson_id: lessonId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status,
            payment_status: paymentStatus,
            pickup_address: pickupAddress,
            vehicle_type: vehicleType,
            transmission_type: vehicleType === 'truck' ? null : transmissionType,
        })
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const db = getServiceRoleClient()
    const { error } = await db.from('bookings').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
}
