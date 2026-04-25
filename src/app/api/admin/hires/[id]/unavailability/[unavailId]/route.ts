import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; unavailId: string }> }) {
    if (!verifyAdminSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { unavailId } = await params
    const db = getServiceRoleClient()
    const { error } = await db.from('hire_unavailability').delete().eq('id', unavailId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
}
