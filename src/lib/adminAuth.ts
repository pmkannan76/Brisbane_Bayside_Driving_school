import { NextRequest } from 'next/server'

export function verifyAdminSession(request: NextRequest): boolean {
    const adminSession = request.cookies.get('admin_session')?.value
    const expectedToken = Buffer.from(process.env.ADMIN_SECRET || '').toString('base64')
    return !!(adminSession && adminSession === expectedToken)
}
