import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description, price, duration_minutes, is_package, lesson_count } = await request.json()

    if (is_package) {
        const count = parseInt(lesson_count)
        if (!count || count < 2) {
            return NextResponse.json({ error: 'Package must have at least 2 lessons.' }, { status: 400 })
        }
        if (duration_minutes % count !== 0) {
            return NextResponse.json({
                error: `Total duration (${duration_minutes} mins) must divide evenly by lesson count (${count}). Each session would be ${duration_minutes / count} mins — not a whole number.`
            }, { status: 400 })
        }
    }

    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('lessons')
        .insert({
            title,
            description,
            price,
            duration_minutes,
            is_package: !!is_package,
            lesson_count: is_package ? parseInt(lesson_count) : 1,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
