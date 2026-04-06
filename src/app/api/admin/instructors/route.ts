import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('instructors')
        .select('*')
        .order('full_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { full_name, email, phone, bio, experience_years, car_model, languages, rating } = await request.json()

    if (!full_name) {
        return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }

    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('instructors')
        .insert({ full_name, email, phone, bio, experience_years, car_model, languages, rating })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
