'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, Clock, User, CheckCircle2, Star, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import CheckoutForm from '@/components/CheckoutForm'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null

const steps = ['Lesson', 'Instructor', 'Schedule', 'Confirm']

function BookingPage() {
    const searchParams = useSearchParams()

    const { user, loading: authLoading } = useAuth()
    const [currentStep, setCurrentStep] = useState(() => {
        // Pre-set step based on URL params to avoid flash of lesson selection
        if (searchParams.get('lessonId') && searchParams.get('instructorId')) return 2
        if (searchParams.get('lessonId')) return 1
        return 0
    })
    const [selectedLesson, setSelectedLesson] = useState<any>(null)
    const [selectedInstructor, setSelectedInstructor] = useState<any>(null)
    const [selectedSlots, setSelectedSlots] = useState<any[]>([])
    const [lessons, setLessons] = useState<any[]>([])
    const [instructors, setInstructors] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [isBookingComplete, setIsBookingComplete] = useState(false)
    const [instructorAvailability, setInstructorAvailability] = useState<any[]>([])
    const [instructorBookings, setInstructorBookings] = useState<any[]>([])
    const [availabilityLoading, setAvailabilityLoading] = useState(false)
    const [pickupAddress, setPickupAddress] = useState('')
    const [vehicleType, setVehicleType] = useState<'car' | 'truck'>('car')
    const [transmissionType, setTransmissionType] = useState<'auto' | 'manual'>('auto')
    const [creditsRemaining, setCreditsRemaining] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [paymentMethod, setPaymentMethod] = useState<'online' | 'in-person' | null>(null)
    const [payInPersonLoading, setPayInPersonLoading] = useState(false)

    useEffect(() => {
        if (!loading && lessons.length > 0 && instructors.length > 0) {
            const lessonId = searchParams.get('lessonId')
            const instructorId = searchParams.get('instructorId')

            if (lessonId) {
                const lesson = lessons.find(l => l.id === lessonId)
                if (lesson) {
                    setSelectedLesson(lesson)
                    // Only advance to instructor step if still at step 0 (initial load)
                    if (!instructorId) setCurrentStep(prev => prev === 0 ? 1 : prev)
                }
            }

            if (instructorId) {
                const instructor = instructors.find(i => i.id === instructorId)
                if (instructor) {
                    setSelectedInstructor(instructor)
                    fetchInstructorAvailability(instructorId)
                    // Only advance to schedule step if still at steps 0 or 1 (initial load)
                    if (lessonId) setCurrentStep(prev => prev <= 1 ? 2 : prev)
                }
            }
        }
    }, [loading, lessons, instructors, searchParams])
    const [packageExpiry, setPackageExpiry] = useState<string | null>(null)
    const [isBookingWithCredit, setIsBookingWithCredit] = useState(false)
    const [bufferMins, setBufferMins] = useState(30)

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        if (!user) return
        setCreditsRemaining(user.credits_remaining || 0)
        setPackageExpiry(user.package_expiry ?? null)
    }, [user])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Lessons
            const { data: lessonsData } = await supabase
                .from('lessons')
                .select('*')
                .eq('is_active', true)

            if (lessonsData) setLessons(lessonsData)

            // Fetch Instructors from instructors table
            const { data: instructorsData, error: instError } = await supabase
                .from('instructors')
                .select('*')
                .eq('is_active', true)
                .order('full_name')

            if (instError) {
                console.error("Instructors fetch error:", instError)
            } else if (instructorsData) {
                setInstructors(instructorsData)
            }

} catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchInstructorAvailability = async (instructorId: string) => {
        setAvailabilityLoading(true)
        setInstructorAvailability([])
        setInstructorBookings([])
        try {
            // Fetch weekly availability windows
            const { data: availabilityData } = await supabase
                .from('availability')
                .select('*')
                .eq('instructor_id', instructorId)
                .eq('is_active', true)

            if (availabilityData) setInstructorAvailability(availabilityData)

            // Fetch existing bookings + Google Calendar busy slots
            try {
                const studentParam = user?.id ? `&studentId=${user.id}` : ''
                const res = await fetch(`/api/calendar/busy?instructorId=${instructorId}${studentParam}`)
                const data = await res.json()
                if (data.busySlots) setInstructorBookings(data.busySlots)
                if (data.bufferMins != null) setBufferMins(data.bufferMins)
            } catch (pollErr) {
                console.error("Failed to fetch busy slots API:", pollErr)
            }
        } catch (err) {
            console.error('Error fetching instructor availability:', err)
        } finally {
            setAvailabilityLoading(false)
        }
    }

    const handleNext = () => {
        if (currentStep === 2) {
            // Just advance to step 3 — booking is created there after details are collected
            setCurrentStep(3)
            return
        }
        if (currentStep === 0 && instructors.length === 1) {
            setSelectedInstructor(instructors[0])
            fetchInstructorAvailability(instructors[0].id)
            setCurrentStep(2)
            return
        }
        setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    }

    // Creates the booking with full details + initiates payment (called at step 3 for non-credit users)
    const handleConfirmBooking = async () => {
        if (!user) {
            window.location.href = '/signup?redirect=/book'
            return
        }
        if (!pickupAddress.trim()) {
            setErrorMsg('Please enter your pickup address.')
            return
        }
        setLoading(true)
        setErrorMsg(null)
        try {
            const slots = selectedSlots.map(slot => ({
                start_time: slot.startStr,
                end_time: slot.endStr,
            }))

            console.log('[handleConfirmBooking]', { lessonId: selectedLesson?.id, studentId: user?.id, instructorId: selectedInstructor?.id, slots })

            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lessonId: selectedLesson.id,
                    studentId: user?.id,
                    instructorId: selectedInstructor.id,
                    slots,
                    pickupAddress,
                    vehicleType,
                    transmissionType: vehicleType === 'truck' ? null : transmissionType,
                }),
            })
            const data = await response.json()

            if (data.bypassStripe) {
                setIsBookingComplete(true)
            } else if (data.clientSecret) {
                setClientSecret(data.clientSecret)
            } else {
                throw new Error(data.error || 'Payment setup failed')
            }
        } catch (err: any) {
            setErrorMsg('Booking failed: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handlePayInPerson = async () => {
        if (!user) { window.location.href = '/signup?redirect=/book'; return }
        if (!pickupAddress.trim()) { setErrorMsg('Please enter your pickup address.'); return }
        setPayInPersonLoading(true)
        setErrorMsg(null)
        try {
            const slots = selectedSlots.map(slot => ({
                start_time: slot.startStr,
                end_time: slot.endStr,
            }))
            const res = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lessonId: selectedLesson.id,
                    studentId: user?.id,
                    instructorId: selectedInstructor.id,
                    slots,
                    pickupAddress,
                    vehicleType,
                    transmissionType: vehicleType === 'truck' ? null : transmissionType,
                    paymentMethod: 'in-person',
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Booking failed')
            setIsBookingComplete(true)
        } catch (err: any) {
            setErrorMsg('Booking failed: ' + err.message)
        } finally {
            setPayInPersonLoading(false)
        }
    }

    const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 0))

    const handleDateClick = (info: any) => {
        if (info.allDay) return

        const isPackageLessonType = selectedLesson?.is_package === true
        const perSessionMins = isPackageLessonType
            ? Math.floor(selectedLesson.duration_minutes / selectedLesson.lesson_count)
            : (selectedLesson?.duration_minutes || 60)
        const durationMins = perSessionMins

        const slotStart = info.date
        const slotEnd = new Date(slotStart.getTime() + durationMins * 60 * 1000)

        const slot = {
            startStr: slotStart.toISOString(),
            endStr: slotEnd.toISOString(),
        }

        // Availability window check
        if (instructorAvailability.length > 0) {
            const dayOfWeek = slotStart.getDay()
            const slotStartHHMM = slotStart.toTimeString().slice(0, 5)
            const slotEndHHMM = slotEnd.toTimeString().slice(0, 5)

            const withinAvailability = instructorAvailability.some(a => {
                if (a.day_of_week !== dayOfWeek) return false
                const avStart = a.start_time.slice(0, 5)
                const avEnd = a.end_time.slice(0, 5)
                return slotStartHHMM >= avStart && slotEndHHMM <= avEnd
            })

            if (!withinAvailability) {
                setErrorMsg("Selected time is outside this instructor's available hours. Please click within the highlighted hours.")
                return
            }
        }

        // Conflict check — extend busy period by bufferMins for different-user bookings
        const isConflict = instructorBookings.some(booking => {
            if (booking.extendedProps?.isBuffer) return false // buffer slots are visual only; real check is below
            const bStart = new Date(booking.start).getTime()
            const isSameStudent = booking.extendedProps?.studentId === user?.id
            // Same student: allow back-to-back; different student: add travel buffer
            const effectiveEnd = isSameStudent
                ? new Date(booking.end).getTime()
                : new Date(booking.end).getTime() + bufferMins * 60 * 1000
            return slotStart.getTime() < effectiveEnd && slotEnd.getTime() > bStart
        })

        if (isConflict) {
            setErrorMsg(`This slot is unavailable — a ${bufferMins}-min travel buffer is required between lessons. Please choose a later time.`)
            return
        }

        // Block past slots
        if (slotStart < new Date()) {
            setErrorMsg('You cannot book a slot in the past. Please choose a future date and time.')
            return
        }

        const isPackageLessonType2 = selectedLesson?.is_package === true
        // Package lesson: exactly lesson_count slots; credit users: up to their remaining credits; else: 1
        const maxSlots = isPackageLessonType2
            ? selectedLesson.lesson_count
            : creditsRemaining > 0
                ? creditsRemaining
                : 1

        const newSlots = [...selectedSlots]
        if (newSlots.length >= maxSlots) {
            setErrorMsg(
                isPackageLessonType2
                    ? `You can only select ${maxSlots} slot(s) for this lesson.`
                    : `You only have ${creditsRemaining} credit(s) remaining.`
            )
            return
        }

        newSlots.push(slot)
        setSelectedSlots(newSlots)
        setErrorMsg(null)
    }

    const handleBookWithCredit = async () => {
        if (!user || creditsRemaining <= 0) return

        setIsBookingWithCredit(true)
        try {
            const res = await fetch('/api/book-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: user.id,
                    instructorId: selectedInstructor.id,
                    lessonId: selectedLesson.id,
                    slots: selectedSlots.map((s: any) => ({ start_time: s.startStr, end_time: s.endStr })),
                    pickupAddress,
                    transmissionType
                })
            })

            const data = await res.json()
            if (data.success) {
                setIsBookingComplete(true)
            } else {
                alert(data.error || 'Failed to book lesson.')
            }
        } catch (err) {
            console.error('Error booking with credit:', err)
            alert('An unexpected error occurred.')
        } finally {
            setIsBookingWithCredit(false)
        }
    }

    const renderStepContent = () => {
        if (isBookingComplete) {
            const isPaidOnline = paymentMethod === 'online'
            return (
                <div className="max-w-md mx-auto text-center space-y-6 py-12 animate-in fade-in zoom-in-95">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isPaidOnline ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold">{isPaidOnline ? 'Booking Confirmed!' : 'Request Received!'}</h2>
                        <p className="text-muted-foreground">
                            {isPaidOnline
                                ? 'Payment successful. You\'ll receive a confirmation email with your lesson details shortly.'
                                : 'Your booking request has been received. Bayside Driving School will contact you to confirm your lesson. Payment is due on the day of your class.'}
                        </p>
                    </div>
                    {!isPaidOnline && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700 text-left space-y-1">
                            <p className="font-bold">What happens next?</p>
                            <p>• We'll call or SMS you to confirm the booking</p>
                            <p>• Pay ${selectedLesson?.price} directly to your instructor on the day</p>
                        </div>
                    )}
                    <div className="pt-4">
                        <Button onClick={() => window.location.href = '/dashboard'} className="rounded-xl w-full">Go to Dashboard</Button>
                    </div>
                </div>
            )
        }

        if (!loading && lessons.length === 0 && currentStep === 0) {
            return (
                <div className="max-w-2xl mx-auto bg-card border border-border p-12 rounded-[2.5rem] shadow-xl text-center space-y-8 animate-in fade-in zoom-in-95">
                    <div className="bg-amber-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-amber-600">
                        <AlertCircle className="w-12 h-12" />
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-bold font-outfit">Setup Required</h2>
                        <p className="text-muted-foreground">To see the booking flow, you need to complete the following steps:</p>
                    </div>
                    <div className="text-left space-y-4 max-w-md mx-auto bg-muted/50 p-6 rounded-2xl border border-border">
                        <div className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            <p className="text-sm">Put your Supabase keys in <code>.env.local</code></p>
                        </div>
                        <div className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            <p className="text-sm">Run <code>supabase/schema.sql</code> in your Supabase SQL Editor</p>
                        </div>
                        <div className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            <p className="text-sm">Restart the development server with <code>npm run dev</code></p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">Refer to walkthrough.md for the full guide.</p>
                </div>
            )
        }

        switch (currentStep) {
            case 0:
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                        {lessons.map(lesson => (
                            <button
                                key={lesson.id}
                                onClick={() => { setSelectedLesson(lesson); handleNext(); }}
                                className={`p-8 rounded-[2rem] border-2 text-left transition-all space-y-4 ${selectedLesson?.id === lesson.id ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border bg-card hover:border-accent/40'}`}
                            >
                                <div className="bg-accent/10 w-12 h-12 rounded-xl flex items-center justify-center text-accent">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold">{lesson.title}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{lesson.description}</p>
                                </div>
                                <div className="pt-4 flex justify-between items-center">
                                    <span className="text-2xl font-bold">${lesson.price}</span>
                                    <span className="text-xs font-bold text-accent uppercase tracking-widest">{lesson.duration_minutes}m sesssion</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )
            case 1:
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4">
                        {instructors.map(inst => (
                            <button
                                key={inst.id}
                                onClick={() => {
                                    setSelectedInstructor(inst);
                                    fetchInstructorAvailability(inst.id);
                                    handleNext();
                                }}
                                className={`p-8 rounded-[2.5rem] border-2 text-left transition-all flex items-center gap-8 ${selectedInstructor?.id === inst.id ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border bg-card hover:border-accent/40'}`}
                            >
                                {inst.avatar_url ? (
                                    <img src={inst.avatar_url} alt={inst.full_name} className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover" />
                                ) : (
                                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-accent/10 flex items-center justify-center text-accent text-2xl font-bold">
                                        {inst.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-bold">{inst.full_name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-secondary font-bold">
                                            <Star className="w-4 h-4 fill-secondary" /> {inst.rating || '5.0'} • {inst.experience_years || '0'} exp
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{inst.bio}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )
            case 2: {
                const isPackageLesson = selectedLesson?.is_package === true
                const maxSlots = isPackageLesson
                    ? selectedLesson.lesson_count
                    : creditsRemaining > 0 ? creditsRemaining : 1
                const perSessionMins2 = isPackageLesson
                    ? Math.floor(selectedLesson.duration_minutes / selectedLesson.lesson_count)
                    : (selectedLesson?.duration_minutes || 60)
                const selectedEvents = selectedSlots.map((s: any, i: number) => ({
                    start: s.startStr,
                    end: s.endStr,
                    title: `Session ${i + 1}${maxSlots > 1 ? `/${maxSlots}` : ''}`,
                    backgroundColor: '#3b82f6',
                    className: 'selected-slot'
                }))
                const businessHours = instructorAvailability.map(a => ({
                    daysOfWeek: [a.day_of_week],
                    startTime: a.start_time.slice(0, 5),
                    endTime: a.end_time.slice(0, 5),
                }))
                const allSlotsSelected = selectedSlots.length === maxSlots
                const showTracker = isPackageLesson || (creditsRemaining > 0 && maxSlots > 1)

                const calendarBlock = (
                    <>
                        {availabilityLoading ? (
                            <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
                                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm font-medium">Loading availability...</span>
                            </div>
                        ) : instructorAvailability.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                                <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center text-amber-600">
                                    <CalendarIcon className="w-8 h-8" />
                                </div>
                                <p className="font-bold text-lg">No availability set</p>
                                <p className="text-sm text-muted-foreground">This instructor hasn't set their schedule yet.</p>
                                <Button variant="outline" className="rounded-xl" onClick={() => { setCurrentStep(1); setSelectedInstructor(null) }}>
                                    Choose Another Instructor
                                </Button>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Click a start time to book a{' '}
                                    <span className="font-bold text-accent">{perSessionMins2}-min session</span>.
                                    {' '}Available hours are highlighted.
                                </p>
                                <FullCalendar
                                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                                    initialView="timeGridWeek"
                                    locale="en-au"
                                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }}
                                    dayHeaderFormat={{ weekday: 'short', day: '2-digit', month: '2-digit', omitCommas: true }}
                                    titleFormat={{ day: '2-digit', month: '2-digit', year: 'numeric' }}
                                    slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                                    allDaySlot={false}
                                    slotMinTime="06:00:00"
                                    slotMaxTime="21:00:00"
                                    height="auto"
                                    dateClick={handleDateClick}
                                    editable={true}
                                    eventDrop={(info: any) => {
                                        // Only allow moving selected slots, not booked ones
                                        if (info.event.classNames.includes('selected-slot')) {
                                            const idx = selectedSlots.findIndex((s: any) => s.startStr === info.oldEvent.startStr)
                                            if (idx !== -1) {
                                                const newStart = info.event.start!
                                                const newEnd = info.event.end!
                                                // Validate within availability
                                                if (instructorAvailability.length > 0) {
                                                    const dayOfWeek = newStart.getDay()
                                                    const startHHMM = newStart.toTimeString().slice(0, 5)
                                                    const endHHMM = newEnd.toTimeString().slice(0, 5)
                                                    const withinAvail = instructorAvailability.some(a => {
                                                        if (a.day_of_week !== dayOfWeek) return false
                                                        return startHHMM >= a.start_time.slice(0, 5) && endHHMM <= a.end_time.slice(0, 5)
                                                    })
                                                    if (!withinAvail) {
                                                        info.revert()
                                                        setErrorMsg("Can't move here - outside instructor's available hours.")
                                                        return
                                                    }
                                                }
                                                // Conflict check
                                                const isConflict = instructorBookings.some((booking: any) => {
                                                    if (booking.extendedProps?.isBuffer) return false
                                                    const bStart = new Date(booking.start).getTime()
                                                    const bEnd = new Date(booking.end).getTime()
                                                    return newStart.getTime() < bEnd && newEnd.getTime() > bStart
                                                })
                                                if (isConflict) {
                                                    info.revert()
                                                    setErrorMsg('Slot conflicts with an existing booking.')
                                                    return
                                                }
                                                if (newStart < new Date()) {
                                                    info.revert()
                                                    setErrorMsg('Cannot move a slot to the past.')
                                                    return
                                                }
                                                setSelectedSlots(prev => prev.map((s: any, i: number) =>
                                                    i === idx ? { startStr: newStart.toISOString(), endStr: newEnd.toISOString() } : s
                                                ))
                                                setErrorMsg(null)
                                            }
                                        } else {
                                            info.revert()
                                        }
                                    }}
                                    eventStartEditable={true}
                                    eventDurationEditable={false}
                                    events={[...instructorBookings, ...selectedEvents.map((e: any) => ({ ...e, editable: true }))]}
                                    businessHours={businessHours}
                                    eventContent={(arg) => {
                                        if (arg.event.extendedProps?.isBuffer) {
                                            return (
                                                <div style={{ background: 'repeating-linear-gradient(45deg,#f97316,#f97316 4px,#fed7aa 4px,#fed7aa 10px)', height: '100%', width: '100%', borderLeft: '3px solid #ea580c', display: 'flex', alignItems: 'center', paddingLeft: '6px', gap: '4px', overflow: 'hidden' }}>
                                                    <span style={{ fontSize: '10px' }}>🚗</span>
                                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#7c2d12', whiteSpace: 'nowrap' }}>{arg.event.title}</span>
                                                </div>
                                            )
                                        }
                                        return (
                                            <div style={{ padding: '2px 4px', height: '100%', overflow: 'hidden' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 600 }}>{arg.event.title}</span>
                                            </div>
                                        )
                                    }}
                                />
                            </>
                        )}
                    </>
                )

                // Sessions tracker sidebar (used for package & multi-credit bookings)
                const trackerPanel = showTracker && (
                    <div className="flex flex-col gap-3 lg:sticky lg:top-4">
                        <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-base font-outfit">
                                    {isPackageLesson ? `${selectedLesson.title}` : 'Your Sessions'}
                                </h4>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${allSlotsSelected ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent'}`}>
                                    {selectedSlots.length}/{maxSlots}
                                </span>
                            </div>

                            {isPackageLesson && (
                                <p className="text-xs text-muted-foreground">
                                    {perSessionMins2} min · {selectedLesson.lesson_count} sessions · with {selectedInstructor?.full_name}
                                </p>
                            )}

                            {/* Progress bar */}
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent rounded-full transition-all duration-500"
                                    style={{ width: `${(selectedSlots.length / maxSlots) * 100}%` }}
                                />
                            </div>

                            <div className="space-y-2">
                                {Array.from({ length: maxSlots }).map((_, i) => {
                                    const slot = selectedSlots[i]
                                    return slot ? (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-accent/5 border border-accent/20 rounded-xl">
                                            <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold truncate">
                                                    {new Date(slot.startStr).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {new Date(slot.startStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    {' – '}
                                                    {new Date(slot.endStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedSlots(prev => prev.filter((_: any, idx: number) => idx !== i))}
                                                className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-1"
                                                title="Remove"
                                            >
                                                <ChevronLeft className="w-3 h-3 rotate-180" style={{ transform: 'rotate(45deg)' }} />
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div key={i} className="flex items-center gap-3 p-3 border border-dashed border-border rounded-xl text-muted-foreground">
                                            <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0 border border-border">{i + 1}</span>
                                            <p className="text-xs italic">
                                                {i === selectedSlots.length ? 'Click calendar to add →' : 'Not yet selected'}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>

                            {allSlotsSelected ? (
                                <Button
                                    onClick={() => setCurrentStep(3)}
                                    className="w-full rounded-xl gap-2 font-bold shadow-lg shadow-accent/20"
                                >
                                    Continue to Payment <CheckCircle2 className="w-4 h-4" />
                                </Button>
                            ) : (
                                <p className="text-xs text-center text-muted-foreground">
                                    {maxSlots - selectedSlots.length} more session{maxSlots - selectedSlots.length !== 1 ? 's' : ''} to go
                                </p>
                            )}

                            {selectedSlots.length > 0 && (
                                <button onClick={() => setSelectedSlots([])} className="text-xs text-muted-foreground underline w-full text-center hover:text-red-500 transition-colors">
                                    Clear all selections
                                </button>
                            )}
                        </div>
                    </div>
                )

                return (
                    <div className="bg-card border border-border p-8 rounded-[2.5rem] shadow-xl animate-in fade-in zoom-in-95 overflow-hidden">
                        {errorMsg && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="text-sm font-bold">{errorMsg}</p>
                            </div>
                        )}

                        {/* Single lesson: original layout */}
                        {!showTracker ? (
                            <>
                                {calendarBlock}
                                {selectedSlots.length > 0 && (
                                    <div className="mt-6 p-6 bg-accent/5 border border-accent/30 rounded-2xl space-y-4">
                                        <div className="flex justify-between items-center">
                                            <p className="text-xs font-bold uppercase tracking-wider text-accent">Confirm your selection</p>
                                            <p className="text-xs text-muted-foreground">with {selectedInstructor?.full_name}</p>
                                        </div>
                                        <div className="bg-white rounded-xl px-4 py-3 border border-border flex items-center justify-between">
                                            <span className="font-bold text-sm">
                                                {new Date(selectedSlots[0].startStr).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(selectedSlots[0].startStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                {' – '}
                                                {new Date(selectedSlots[0].endStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </span>
                                        </div>
                                        <div className="flex gap-3">
                                            <Button onClick={() => setCurrentStep(3)} className="flex-1 rounded-xl gap-2 font-bold shadow-lg shadow-accent/20">
                                                Continue to Details <CheckCircle2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" onClick={() => setSelectedSlots([])} className="rounded-xl">Clear</Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Package / multi-credit: two-column layout */
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">{calendarBlock}</div>
                                <div>{trackerPanel}</div>
                            </div>
                        )}
                    </div>
                )
            }
            case 3:
                return (
                    <div className="max-w-2xl mx-auto bg-card border border-border p-8 md:p-12 rounded-[2.5rem] shadow-2xl space-y-10 animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <ShieldCheck className="w-48 h-48 text-primary" />
                        </div>

                        <div className="space-y-6 relative">
                            <h2 className="text-3xl font-bold font-outfit">Booking Confirmation</h2>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-muted rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-lg"><Clock className="w-4 h-4 text-accent" /></div>
                                        <span className="font-medium">{selectedLesson?.title}</span>
                                    </div>
                                    <span className="font-bold">${selectedLesson?.price}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-muted rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white p-2 rounded-lg"><User className="w-4 h-4 text-accent" /></div>
                                        <span className="font-medium">Instructor: {selectedInstructor?.full_name}</span>
                                    </div>
                                </div>
                                {selectedSlots.map((slot: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-4 bg-muted rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 rounded-lg relative">
                                                <CalendarIcon className="w-4 h-4 text-accent" />
                                                {selectedSlots.length > 1 && (
                                                    <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                                                )}
                                            </div>
                                            <span className="font-medium">
                                                {new Date(slot.startStr).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                <br />
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(slot.startStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                    {' – '}
                                                    {new Date(slot.endStr).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-lg font-outfit">Additional Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pickup Address</label>
                                        <input
                                            type="text"
                                            required
                                            value={pickupAddress}
                                            onChange={(e) => setPickupAddress(e.target.value)}
                                            placeholder="Enter your pickup location"
                                            className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vehicle Type</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setVehicleType('car')}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${vehicleType === 'car' ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-muted text-muted-foreground border-border'}`}
                                            >
                                                🚗 Car
                                            </button>
                                            <button
                                                onClick={() => { setVehicleType('truck'); setTransmissionType('auto') }}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${vehicleType === 'truck' ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-muted text-muted-foreground border-border'}`}
                                            >
                                                🚛 Truck
                                            </button>
                                        </div>
                                    </div>
                                    {vehicleType === 'car' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transmission</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setTransmissionType('auto')}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${transmissionType === 'auto' ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-muted text-muted-foreground border-border'}`}
                                            >
                                                Automatic
                                            </button>
                                            <button
                                                onClick={() => setTransmissionType('manual')}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${transmissionType === 'manual' ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' : 'bg-muted text-muted-foreground border-border'}`}
                                            >
                                                Manual
                                            </button>
                                        </div>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-border space-y-6 relative">
                            {creditsRemaining > 0 ? (
                                <div className="space-y-6">
                                    {packageExpiry && new Date() > new Date(packageExpiry) ? (
                                        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center gap-3 text-red-600">
                                            <AlertCircle className="w-5 h-5 shrink-0" />
                                            <div>
                                                <p className="font-bold text-sm">Package Expired</p>
                                                <p className="text-xs">Your credits expired on {new Date(packageExpiry).toLocaleDateString()}. Please purchase a new pack.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-accent/5 border border-accent/20 p-6 rounded-2xl space-y-4">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Available Credits</span>
                                                    <span className="font-bold text-accent">{creditsRemaining} Lessons</span>
                                                </div>
                                                {packageExpiry && (
                                                    <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                                        <span>Package Expires</span>
                                                        <span>{new Date(packageExpiry).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                onClick={handleBookWithCredit}
                                                isLoading={isBookingWithCredit}
                                                size="lg"
                                                className="w-full h-16 rounded-2xl text-xl gap-2 shadow-xl shadow-accent/20"
                                            >
                                                <span>Use {selectedSlots.length} Credit{selectedSlots.length !== 1 ? 's' : ''} to Book {selectedSlots.length} Lesson{selectedSlots.length !== 1 ? 's' : ''}</span>
                                                <CheckCircle2 className="w-6 h-6" />
                                            </Button>
                                            <p className="text-center text-xs text-muted-foreground">
                                                {selectedSlots.length} credit{selectedSlots.length !== 1 ? 's' : ''} will be deducted. You'll have {creditsRemaining - selectedSlots.length} remaining.
                                            </p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {errorMsg && (
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600">
                                            <AlertCircle className="w-5 h-5 shrink-0" />
                                            <p className="text-sm font-bold">{errorMsg}</p>
                                        </div>
                                    )}

                                    {loading || payInPersonLoading ? (
                                        <div className="flex justify-center p-8">
                                            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : clientSecret ? (
                                        <>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                <CreditCard className="w-4 h-4" /> Secure payment with Stripe
                                            </div>
                                            <Elements stripe={stripePromise} options={{ clientSecret }}>
                                                <CheckoutForm amount={selectedLesson.price} onSuccess={() => setIsBookingComplete(true)} />
                                            </Elements>
                                        </>
                                    ) : (
                                        <div className="space-y-4">
                                            <h3 className="font-bold text-lg font-outfit">How would you like to pay?</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <button
                                                    onClick={() => setPaymentMethod('online')}
                                                    className={`p-6 rounded-2xl border-2 text-left transition-all space-y-3 ${paymentMethod === 'online' ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border bg-muted/30 hover:border-accent/40'}`}
                                                >
                                                    <div className="bg-accent/10 w-10 h-10 rounded-xl flex items-center justify-center text-accent">
                                                        <CreditCard className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold">Pay Online</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Secure card payment via Stripe. Booking confirmed instantly.</p>
                                                    </div>
                                                    <p className="text-xl font-bold text-accent">${selectedLesson?.price}</p>
                                                </button>
                                                <button
                                                    onClick={() => setPaymentMethod('in-person')}
                                                    className={`p-6 rounded-2xl border-2 text-left transition-all space-y-3 ${paymentMethod === 'in-person' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-muted/30 hover:border-primary/40'}`}
                                                >
                                                    <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                                                        <ShieldCheck className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold">Pay During Class</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Pay your instructor on the day. We'll confirm your booking by phone.</p>
                                                    </div>
                                                    <p className="text-xs font-bold text-primary uppercase tracking-wider">No upfront payment</p>
                                                </button>
                                            </div>

                                            {paymentMethod === 'online' && (
                                                <Button
                                                    onClick={handleConfirmBooking}
                                                    size="lg"
                                                    className="w-full h-14 rounded-2xl gap-2 shadow-xl shadow-accent/20"
                                                >
                                                    Pay ${selectedLesson?.price} with Stripe <CreditCard className="w-5 h-5" />
                                                </Button>
                                            )}
                                            {paymentMethod === 'in-person' && (
                                                <Button
                                                    onClick={handlePayInPerson}
                                                    size="lg"
                                                    variant="outline"
                                                    className="w-full h-14 rounded-2xl gap-2 border-primary text-primary hover:bg-primary/5"
                                                >
                                                    Confirm Booking — Pay on the Day <CheckCircle2 className="w-5 h-5" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    if (authLoading) return null

    return (
        <div className="max-w-7xl mx-auto px-4 py-20 space-y-12 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold font-outfit">Book Your <span className="text-accent underline decoration-secondary">Lesson</span></h1>
                    <p className="text-muted-foreground">Follow the simple steps to schedule your session.</p>
                </div>

                {/* Stepper */}
                <div className="flex gap-4">
                    {steps.map((step, i) => (
                        <div key={step} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${i <= currentStep ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-muted text-muted-foreground'}`}>
                                {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                            </div>
                            <span className={`hidden sm:block text-xs font-bold uppercase tracking-widest ${i <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>{step}</span>
                            {i < steps.length - 1 && <div className="hidden sm:block w-4 h-px bg-border" />}
                        </div>
                    ))}
                </div>
            </div>

            <div className="relative pt-12">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderStepContent()}
                    </motion.div>
                </AnimatePresence>

                {currentStep > 0 && currentStep < 3 && (
                    <div className="flex justify-start pt-12">
                        <Button variant="outline" className="rounded-xl gap-2 h-12" onClick={handleBack}>
                            <ChevronLeft className="w-4 h-4" /> Previous Step
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function BookingPageWrapper() {
    return (
        <Suspense>
            <BookingPage />
        </Suspense>
    )
}
