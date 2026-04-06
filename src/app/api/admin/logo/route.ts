import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/adminAuth'
import { getServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    if (!verifyAdminSession(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const fileExt = file.name.split('.').pop()
    const fileName = `logo_${Date.now()}.${fileExt}`
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const db = getServiceRoleClient()

    const { error: uploadError } = await db.storage
        .from('assets')
        .upload(fileName, buffer, { contentType: file.type, cacheControl: '3600', upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = db.storage.from('assets').getPublicUrl(fileName)

    const { error: settingsError } = await db.from('settings').upsert({ key: 'logo_url', value: publicUrl })
    if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

    return NextResponse.json({ url: publicUrl })
}
