'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, User, UserPlus, Chrome, LogIn, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function SignUpPage() {
    const router = useRouter()
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [redirect, setRedirect] = useState('/dashboard')

    React.useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const errorParam = searchParams.get('error')
        const redirectParam = searchParams.get('redirect')
        if (redirectParam) setRedirect(redirectParam)
        if (errorParam) setError(errorParam)
    }, [])

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, full_name: fullName }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create account')
            router.push(redirect)
            router.refresh()
        } catch (err: any) {
            setError(err.message || 'Failed to create account')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignUp = () => {
        window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirect)}`
    }

    return (
        <div className="min-h-[90vh] flex items-center justify-center p-4 bg-muted/30">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full bg-card border border-border p-8 md:p-12 rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden"
            >
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold font-outfit">Join Brisbane Bayside</h1>
                    <p className="text-muted-foreground">Start your journey to becoming a confident driver</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="space-y-6">
                    <Button
                        onClick={handleGoogleSignUp}
                        variant="outline"
                        className="w-full h-14 rounded-xl gap-3 bg-white hover:bg-muted text-foreground border-border shadow-sm"
                    >
                        <Chrome className="w-5 h-5 text-accent" />
                        Sign up with Google
                    </Button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-border"></div>
                        <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Or use email</span>
                        <div className="flex-grow border-t border-border"></div>
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-foreground/60 px-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Jane Doe"
                                    className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-foreground/60 px-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-foreground/60 px-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground px-1">Minimum 8 characters.</p>
                        </div>

                        <Button type="submit" size="lg" className="w-full h-14 rounded-xl gap-2" isLoading={loading}>
                            Create Account <UserPlus className="w-5 h-5" />
                        </Button>
                    </form>
                </div>

                <div className="text-center relative">
                    <p className="text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/signin" className="text-accent font-bold hover:underline inline-flex items-center gap-1">
                            Sign in <LogIn className="w-4 h-4 ml-1" />
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
