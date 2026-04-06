import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Allow access to the login page without auth
    if (pathname === '/admin/login') {
        return NextResponse.next()
    }

    const adminSession = request.cookies.get('admin_session')?.value
    const expectedToken = Buffer.from(process.env.ADMIN_SECRET || '').toString('base64')

    if (!adminSession || adminSession !== expectedToken) {
        const loginUrl = new URL('/admin/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/admin', '/admin/:path*'],
}
