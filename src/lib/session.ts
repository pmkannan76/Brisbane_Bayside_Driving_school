import { SignJWT, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'user_session'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

export interface SessionUser {
    id: string
    email: string
    full_name: string | null
}

function getSecret() {
    return new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-change-in-production-32chars')
}

export async function createSessionToken(user: SessionUser): Promise<string> {
    return await new SignJWT({ id: user.id, email: user.email, full_name: user.full_name })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(getSecret())
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    if (!token) return null
    try {
        const { payload } = await jwtVerify(token, getSecret())
        return { id: payload.id as string, email: payload.email as string, full_name: payload.full_name as string | null }
    } catch {
        return null
    }
}

export function setSessionCookie(response: NextResponse, token: string): void {
    response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        path: '/',
        maxAge: SESSION_MAX_AGE,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    })
}

export function clearSessionCookie(response: NextResponse): void {
    response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
    })
}
