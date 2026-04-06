import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('driving_packages')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, number_of_classes, class_duration_hours, price } = await request.json()

    if (!name || !number_of_classes || !class_duration_hours || !price) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('driving_packages')
        .insert({ name, number_of_classes, class_duration_hours, price })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
