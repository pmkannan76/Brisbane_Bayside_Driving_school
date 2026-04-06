import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServiceRoleClient } from '@/lib/supabase'
import { createSessionToken, setSessionCookie } from '@/lib/session'

export async function POST(request: NextRequest) {
    const { email, password } = await request.json()

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const db = getServiceRoleClient()

    const { data: user } = await db
        .from('users')
        .select('id, email, full_name, password_hash')
        .eq('email', email.toLowerCase())
        .maybeSingle()

    if (!user || !user.password_hash) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    const token = await createSessionToken({ id: user.id, email: user.email, full_name: user.full_name })
    const response = NextResponse.json({ user: { id: user.id, email: user.email, full_name: user.full_name } })
    setSessionCookie(response, token)
    return response
}
