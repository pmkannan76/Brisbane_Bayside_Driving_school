import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    const { username, password } = await request.json()

    if (
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD
    ) {
        const token = Buffer.from(process.env.ADMIN_SECRET || '').toString('base64')
        const response = NextResponse.json({ success: true })
        response.cookies.set('admin_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        })
        return response
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}
