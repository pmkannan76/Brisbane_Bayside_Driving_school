'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Mail, Lock, User, UserPlus, Chrome, LogIn, AlertCircle,
    ChevronRight, ChevronLeft, CheckCircle2, Phone, MapPin,
    Calendar, CreditCard, Shield, Eye, EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

const STEPS = ['Name', 'Licence', 'Gender', 'Contact', 'Password']

const LICENCE_TYPES = [
    { value: 'learner', label: 'Learner (L)', description: 'Currently on your learner permit' },
    { value: 'p1', label: 'Provisional 1 (P1)', description: 'Red P plates' },
    { value: 'p2', label: 'Provisional 2 (P2)', description: 'Green P plates' },
    { value: 'open', label: 'Open', description: 'Full unrestricted licence' },
    { value: 'none', label: 'No Licence Yet', description: 'Haven\'t obtained a licence yet' },
]

const GENDER_OPTIONS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export default function SignUpPage() {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [redirect, setRedirect] = useState('/dashboard')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // Form state
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        licenceNumber: '',
        licenceType: '',
        licenceExpiry: '',
        gender: '',
        dateOfBirth: '',
        email: '',
        phone: '',
        address: '',
        password: '',
        confirmPassword: '',
    })

    React.useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const errorParam = searchParams.get('error')
        const redirectParam = searchParams.get('redirect')
        if (redirectParam) setRedirect(redirectParam)
        if (errorParam) setError(errorParam)
    }, [])

    const updateForm = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        setError(null)
    }

    const validateStep = (): boolean => {
        switch (step) {
            case 0:
                if (!form.firstName.trim()) { setError('First name is required.'); return false }
                if (!form.lastName.trim()) { setError('Last name is required.'); return false }
                return true
            case 1:
                if (!form.licenceType) { setError('Please select your licence type.'); return false }
                return true
            case 2:
                if (!form.gender) { setError('Please select a gender option.'); return false }
                if (!form.dateOfBirth) { setError('Date of birth is required.'); return false }
                // Must be at least 16
                const age = Math.floor((Date.now() - new Date(form.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                if (age < 16) { setError('You must be at least 16 years old to register.'); return false }
                return true
            case 3:
                if (!form.email.trim()) { setError('Email is required.'); return false }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Please enter a valid email address.'); return false }
                if (!form.phone.trim()) { setError('Phone number is required.'); return false }
                return true
            case 4:
                if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return false }
                if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return false }
                return true
            default:
                return true
        }
    }

    const handleNext = () => {
        if (validateStep()) {
            setError(null)
            setStep(prev => Math.min(prev + 1, STEPS.length - 1))
        }
    }

    const handleBack = () => {
        setError(null)
        setStep(prev => Math.max(prev - 1, 0))
    }

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateStep()) return

        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                    full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
                    phone: form.phone,
                    address: form.address,
                    licence_number: form.licenceNumber || null,
                    licence_type: form.licenceType,
                    licence_expiry: form.licenceExpiry || null,
                    gender: form.gender,
                    date_of_birth: form.dateOfBirth,
                }),
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

    const progressPercent = ((step + 1) / STEPS.length) * 100

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
                                <User className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold font-outfit">What&apos;s your name?</h2>
                            <p className="text-sm text-muted-foreground">We&apos;ll use this for your booking confirmations</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">First Name</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={form.firstName}
                                    onChange={(e) => updateForm('firstName', e.target.value)}
                                    placeholder="Jane"
                                    className="w-full bg-muted/50 border-border border rounded-xl px-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Last Name</label>
                                <input
                                    type="text"
                                    required
                                    value={form.lastName}
                                    onChange={(e) => updateForm('lastName', e.target.value)}
                                    placeholder="Smith"
                                    className="w-full bg-muted/50 border-border border rounded-xl px-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none text-lg"
                                />
                            </div>
                        </div>
                    </div>
                )

            case 1:
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
                                <CreditCard className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold font-outfit">Licence Details</h2>
                            <p className="text-sm text-muted-foreground">Tell us about your current licence status</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Licence Type</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {LICENCE_TYPES.map(lt => (
                                        <button
                                            key={lt.value}
                                            type="button"
                                            onClick={() => updateForm('licenceType', lt.value)}
                                            className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${form.licenceType === lt.value
                                                ? 'border-accent bg-accent/5 ring-1 ring-accent'
                                                : 'border-border bg-muted/30 hover:border-accent/40'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${form.licenceType === lt.value ? 'border-accent bg-accent' : 'border-muted-foreground/30'}`}>
                                                {form.licenceType === lt.value && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{lt.label}</p>
                                                <p className="text-xs text-muted-foreground">{lt.description}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.licenceType && form.licenceType !== 'none' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Licence Number (optional)</label>
                                        <input
                                            type="text"
                                            value={form.licenceNumber}
                                            onChange={(e) => updateForm('licenceNumber', e.target.value)}
                                            placeholder="e.g. 12345678"
                                            className="w-full bg-muted/50 border-border border rounded-xl px-5 py-3.5 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Licence Expiry Date (optional)</label>
                                        <input
                                            type="date"
                                            value={form.licenceExpiry}
                                            onChange={(e) => updateForm('licenceExpiry', e.target.value)}
                                            className="w-full bg-muted/50 border-border border rounded-xl px-5 py-3.5 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                )

            case 2:
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
                                <Shield className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold font-outfit">About You</h2>
                            <p className="text-sm text-muted-foreground">This helps us personalise your experience</p>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Gender</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {GENDER_OPTIONS.map(g => (
                                        <button
                                            key={g.value}
                                            type="button"
                                            onClick={() => updateForm('gender', g.value)}
                                            className={`p-3.5 rounded-xl border-2 text-sm font-bold transition-all ${form.gender === g.value
                                                ? 'border-accent bg-accent text-white shadow-lg shadow-accent/20'
                                                : 'border-border bg-muted/30 text-foreground hover:border-accent/40'
                                                }`}
                                        >
                                            {g.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Date of Birth</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="date"
                                        required
                                        value={form.dateOfBirth}
                                        onChange={(e) => updateForm('dateOfBirth', e.target.value)}
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().split('T')[0]}
                                        className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground px-1">You must be at least 16 years old.</p>
                            </div>
                        </div>
                    </div>
                )

            case 3:
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
                                <Mail className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold font-outfit">Contact Details</h2>
                            <p className="text-sm text-muted-foreground">How we&apos;ll reach you about your lessons</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="email"
                                        required
                                        value={form.email}
                                        onChange={(e) => updateForm('email', e.target.value)}
                                        placeholder="jane@example.com"
                                        className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="tel"
                                        required
                                        value={form.phone}
                                        onChange={(e) => updateForm('phone', e.target.value)}
                                        placeholder="04xx xxx xxx"
                                        className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Address (optional)</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={form.address}
                                        onChange={(e) => updateForm('address', e.target.value)}
                                        placeholder="Your suburb or full address"
                                        className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-5 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground px-1">Used as default pickup location for lessons.</p>
                            </div>
                        </div>
                    </div>
                )

            case 4:
                return (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
                                <Lock className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold font-outfit">Set Your Password</h2>
                            <p className="text-sm text-muted-foreground">Secure your account with a strong password</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={form.password}
                                        onChange={(e) => updateForm('password', e.target.value)}
                                        placeholder="Minimum 8 characters"
                                        className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-12 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {/* Password strength indicator */}
                                {form.password && (
                                    <div className="space-y-1 px-1">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(i => {
                                                const strength = form.password.length >= 12 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? 4
                                                    : form.password.length >= 10 && /[A-Z]/.test(form.password) ? 3
                                                    : form.password.length >= 8 ? 2 : 1
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`h-1 flex-1 rounded-full transition-colors ${i <= strength
                                                            ? strength >= 4 ? 'bg-green-500'
                                                                : strength >= 3 ? 'bg-accent'
                                                                : strength >= 2 ? 'bg-yellow-500'
                                                                : 'bg-red-400'
                                                            : 'bg-muted'
                                                            }`}
                                                    />
                                                )
                                            })}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {form.password.length < 8 ? 'Too short' : form.password.length >= 12 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) ? 'Strong' : form.password.length >= 8 ? 'Good' : ''}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        required
                                        value={form.confirmPassword}
                                        onChange={(e) => updateForm('confirmPassword', e.target.value)}
                                        placeholder="Re-enter your password"
                                        className="w-full bg-muted/50 border-border border rounded-xl pl-12 pr-12 py-4 focus:ring-2 focus:ring-accent focus:bg-white transition-all outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {form.confirmPassword && form.password !== form.confirmPassword && (
                                    <p className="text-xs text-red-500 px-1 font-medium">Passwords do not match</p>
                                )}
                                {form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 8 && (
                                    <p className="text-xs text-green-600 px-1 font-medium flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Passwords match
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Summary card */}
                        <div className="bg-muted/50 border border-border rounded-2xl p-5 space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registration Summary</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div className="text-muted-foreground">Name</div>
                                <div className="font-medium">{form.firstName} {form.lastName}</div>
                                <div className="text-muted-foreground">Email</div>
                                <div className="font-medium truncate">{form.email}</div>
                                <div className="text-muted-foreground">Phone</div>
                                <div className="font-medium">{form.phone}</div>
                                <div className="text-muted-foreground">Licence</div>
                                <div className="font-medium capitalize">{LICENCE_TYPES.find(l => l.value === form.licenceType)?.label || '-'}</div>
                                <div className="text-muted-foreground">DOB</div>
                                <div className="font-medium">{form.dateOfBirth ? new Date(form.dateOfBirth + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</div>
                            </div>
                        </div>
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="min-h-[90vh] flex items-center justify-center p-4 bg-muted/30">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full bg-card border border-border p-8 md:p-12 rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden"
            >
                {/* Progress bar */}
                <div className="space-y-4">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-accent rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        />
                    </div>
                    <div className="flex justify-between">
                        {STEPS.map((s, i) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => { if (i < step) { setStep(i); setError(null) } }}
                                className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${i === step
                                    ? 'text-accent'
                                    : i < step
                                        ? 'text-green-600 cursor-pointer hover:underline'
                                        : 'text-muted-foreground/40'
                                    }`}
                            >
                                {i < step ? <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> {s}</span> : s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="text-center">
                    <h1 className="text-3xl font-bold font-outfit">Join Brisbane Bayside</h1>
                    <p className="text-muted-foreground text-sm mt-1">Step {step + 1} of {STEPS.length}</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Google signup - only on first step */}
                {step === 0 && (
                    <div className="space-y-4">
                        <Button
                            onClick={handleGoogleSignUp}
                            variant="outline"
                            className="w-full h-14 rounded-xl gap-3 bg-white hover:bg-muted text-foreground border-border shadow-sm"
                        >
                            <Chrome className="w-5 h-5 text-accent" />
                            Sign up with Google
                        </Button>

                        <div className="relative flex items-center py-1">
                            <div className="flex-grow border-t border-border"></div>
                            <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Or fill in your details</span>
                            <div className="flex-grow border-t border-border"></div>
                        </div>
                    </div>
                )}

                <form onSubmit={step === STEPS.length - 1 ? handleSignUp : (e) => { e.preventDefault(); handleNext() }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }}
                        >
                            {renderStep()}
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex gap-3 mt-8">
                        {step > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl gap-2 h-14 px-6"
                                onClick={handleBack}
                            >
                                <ChevronLeft className="w-4 h-4" /> Back
                            </Button>
                        )}
                        {step < STEPS.length - 1 ? (
                            <Button
                                type="submit"
                                size="lg"
                                className="flex-1 h-14 rounded-xl gap-2"
                            >
                                Continue <ChevronRight className="w-5 h-5" />
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                size="lg"
                                className="flex-1 h-14 rounded-xl gap-2 shadow-xl shadow-accent/20"
                                isLoading={loading}
                            >
                                Create Account <UserPlus className="w-5 h-5" />
                            </Button>
                        )}
                    </div>
                </form>

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
