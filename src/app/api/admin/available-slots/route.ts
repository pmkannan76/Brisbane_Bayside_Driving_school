import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

// Returns available start times for an instructor on a specific date,
// given a lesson duration, excluding already-booked slots (+ travel buffer).
export async function GET(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const instructorId = searchParams.get('instructorId')
    const date = searchParams.get('date')           // YYYY-MM-DD
    const durationMins = parseInt(searchParams.get('durationMins') || '60')
    const excludeBookingId = searchParams.get('excludeBookingId') || ''

    if (!instructorId || !date) {
        return NextResponse.json({ error: 'instructorId and date are required' }, { status: 400 })
    }

    const db = getServiceRoleClient()

    // Day of week for the selected date (0 = Sunday)
    const selectedDate = new Date(date + 'T00:00:00')
    const dayOfWeek = selectedDate.getDay()

    // 1. Fetch availability windows for this instructor on this day
    const { data: windows } = await db
        .from('availability')
        .select('start_time, end_time')
        .eq('instructor_id', instructorId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)

    if (!windows || windows.length === 0) {
        return NextResponse.json({ slots: [], message: 'Instructor is not available on this day.' })
    }

    // 2. Fetch buffer setting
    const { data: bufferSetting } = await db
        .from('settings')
        .select('value')
        .eq('key', 'instructor_buffer_mins')
        .single()
    const bufferMins = parseInt(bufferSetting?.value || '30', 10)

    // 3. Fetch existing bookings on this date (excluding the booking being edited)
    const dayStart = date + 'T00:00:00.000Z'
    const dayEnd = date + 'T23:59:59.999Z'
    let query = db
        .from('bookings')
        .select('id, start_time, end_time')
        .eq('instructor_id', instructorId)
        .in('status', ['scheduled', 'completed'])
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd)

    const { data: existingBookings } = await query

    const bookedSlots = (existingBookings || [])
        .filter(b => b.id !== excludeBookingId)
        .map(b => ({
            start: new Date(b.start_time).getTime(),
            // Add buffer to the end so we don't book too close
            end: new Date(b.end_time).getTime() + bufferMins * 60 * 1000,
        }))

    // 4. Generate candidate slots every 30 mins within each availability window
    const available: { label: string; value: string }[] = []

    for (const window of windows) {
        // Parse HH:MM into minutes-since-midnight
        const [startH, startM] = window.start_time.slice(0, 5).split(':').map(Number)
        const [endH, endM] = window.end_time.slice(0, 5).split(':').map(Number)
        const windowStartMins = startH * 60 + startM
        const windowEndMins = endH * 60 + endM

        for (let mins = windowStartMins; mins + durationMins <= windowEndMins; mins += 30) {
            const slotStartMs = selectedDate.getTime() + mins * 60 * 1000
            const slotEndMs = slotStartMs + durationMins * 60 * 1000

            // Check against all existing bookings
            const hasConflict = bookedSlots.some(b => slotStartMs < b.end && slotEndMs > b.start)
            if (hasConflict) continue

            const hh = String(Math.floor(mins / 60)).padStart(2, '0')
            const mm = String(mins % 60).padStart(2, '0')
            const endMins = mins + durationMins
            const ehh = String(Math.floor(endMins / 60)).padStart(2, '0')
            const emm = String(endMins % 60).padStart(2, '0')

            available.push({
                value: `${hh}:${mm}`,
                label: `${hh}:${mm} – ${ehh}:${emm}`,
            })
        }
    }

    return NextResponse.json({ slots: available })
}
