import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const db = getServiceRoleClient()

    if (body.action === 'adjust_credits') {
        const { data: user } = await db
            .from('users')
            .select('credits_remaining')
            .eq('id', id)
            .single()

        const newCredits = Math.max(0, (user?.credits_remaining || 0) + body.amount)
        const { data, error } = await db
            .from('users')
            .update({ credits_remaining: newCredits })
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    const { action, ...updatePayload } = body
    const { data, error } = await db.from('users').update(updatePayload).eq('id', id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const db = getServiceRoleClient()
    const { error } = await db.from('users').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
}
