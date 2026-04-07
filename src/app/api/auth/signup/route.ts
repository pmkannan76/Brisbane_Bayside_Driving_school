import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServiceRoleClient } from '@/lib/supabase'
import { createSessionToken, setSessionCookie } from '@/lib/session'

export async function POST(request: NextRequest) {
    const {
        email,
        password,
        full_name,
        phone,
        address,
        licence_number,
        licence_type,
        licence_expiry,
        gender,
        date_of_birth,
    } = await request.json()

    if (!email || !password || !full_name) {
        return NextResponse.json({ error: 'Email, password, and full name are required.' }, { status: 400 })
    }
    if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const db = getServiceRoleClient()

    const { data: existing } = await db.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle()
    if (existing) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 12)

    const { data: user, error } = await db
        .from('users')
        .insert({
            email: email.toLowerCase(),
            password_hash,
            full_name,
            phone: phone || null,
            address: address || null,
            licence_number: licence_number || null,
            licence_type: licence_type || null,
            licence_expiry: licence_expiry || null,
            gender: gender || null,
            date_of_birth: date_of_birth || null,
        })
        .select('id, email, full_name')
        .single()

    if (error || !user) {
        console.error('Signup error:', error?.message)
        return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
    }

    const token = await createSessionToken({ id: user.id, email: user.email, full_name: user.full_name })
    const response = NextResponse.json({ user: { id: user.id, email: user.email, full_name: user.full_name } }, { status: 201 })
    setSessionCookie(response, token)
    return response
}
