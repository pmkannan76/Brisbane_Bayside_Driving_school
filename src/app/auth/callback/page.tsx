'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// This route is no longer used — Google OAuth now goes through /api/auth/google/callback
export default function AuthCallback() {
    const router = useRouter()
    useEffect(() => { router.replace('/dashboard') }, [router])
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
    )
}
