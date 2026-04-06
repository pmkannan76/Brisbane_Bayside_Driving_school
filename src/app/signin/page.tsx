'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, LogIn, Chrome, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function SignInPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [redirect, setRedirect] = React.useState('/dashboard')

    React.useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const errorParam = searchParams.get('error')
        const redirectParam = searchParams.get('redirect')
        if (redirectParam) setRedirect(redirectParam)
        if (errorParam) {
            if (errorParam === 'GoogleAuthFailed') {
                setError('Google sign-in failed. Please try again.')
            } else {
                setError(errorParam)
            }
        }
    }, [])

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to sign in')
            router.push(redirect)
            router.refresh()
        } catch (err: any) {
            setError(err.message || 'Failed to sign in')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignIn = () => {
        window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirect)}`
    }

    return (
        <div className="min-h-[90vh] flex items-center justify-center p-4 bg-muted/30">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full bg-card border border-border p-8 md:p-12 rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck className="w-32 h-32 text-primary" />
                </div>

                <div className="text-center space-y-2 relative">
                    <h1 className="text-3xl font-bold font-outfit">Welcome Back</h1>
                    <p className="text-muted-foreground">Sign in to manage your driving journey</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="space-y-4 relative">
                    <Button
                        onClick={handleGoogleSignIn}
                        variant="outline"
                        className="w-full h-14 rounded-xl gap-3 bg-white hover:bg-muted text-foreground border-border shadow-sm"
                    >
                        <Chrome className="w-5 h-5 text-accent" />
                        Continue with Google
                    </Button>

                    <div className="relative flex items-center py-4">
                        <div className="flex-grow border-t border-border"></div>
                        <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Or email</span>
                        <div className="flex-grow border-t border-border"></div>
                    </div>

                    <form onSubmit={handleEmailSignIn} className="space-y-6">
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
                            <div className="flex justify-between items-center px-1">
                                <label className="text-sm font-bold uppercase tracking-wider text-foreground/60">Password</label>
                            </div>
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
                        </div>

                        <Button type="submit" size="lg" className="w-full h-14 rounded-xl gap-2" isLoading={loading}>
                            Sign In <LogIn className="w-5 h-5" />
                        </Button>
                    </form>
                </div>

                <div className="text-center pt-4 relative">
                    <p className="text-sm text-muted-foreground">
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className="text-accent font-bold hover:underline inline-flex items-center gap-1">
                            Create account <ArrowRight className="w-4 h-4" />
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
