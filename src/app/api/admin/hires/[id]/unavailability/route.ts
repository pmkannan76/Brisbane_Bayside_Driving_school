import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('hire_unavailability')
        .select('*')
        .eq('hire_id', id)
        .order('start_time', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const { start_time, end_time, reason } = await request.json()
    if (!start_time || !end_time) return NextResponse.json({ error: 'start_time and end_time required' }, { status: 400 })
    const db = getServiceRoleClient()
    const { data, error } = await db
        .from('hire_unavailability')
        .insert({ hire_id: id, start_time, end_time, reason: reason || null })
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
