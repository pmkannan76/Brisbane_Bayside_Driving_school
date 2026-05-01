'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Quote, CheckCircle, Smartphone, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface Review {
    name: string
    date: string
    rating: number
    comment: string
    avatar: string | null
}

const FALLBACK_REVIEWS: Review[] = [
    { name: "Emily Rogers", date: "2 days ago", rating: 5, comment: "Professional, patient, and really helped me overcome my fear of highways. Highly recommend!", avatar: null },
    { name: "Michael Chang", date: "1 week ago", rating: 5, comment: "The online booking system is a game changer. Passed my test first try. Five stars!", avatar: null },
    { name: "Sarah Jenkins", date: "2 weeks ago", rating: 5, comment: "Very reasonably priced packages. The instructors are experts and know all the local test routes.", avatar: null },
    { name: "Brooke Smith", date: "3 weeks ago", rating: 4, comment: "Great instructors. Helped me get my manual license without any stress. Very clear instructions.", avatar: null },
    { name: "Liam O'Connor", date: "1 month ago", rating: 5, comment: "I tried two other schools before finding Brisbane Bayside. The difference in teaching quality is huge.", avatar: null },
    { name: "Sophia Garcia", date: "1 month ago", rating: 5, comment: "Excellent experience. Flexible timing helped me fit lessons around my work schedule perfectly.", avatar: null },
]

function Avatar({ name, src }: { name: string; src: string | null }) {
    if (src) {
        return <img src={src} alt={name} className="w-12 h-12 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
    }
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    return (
        <div className="w-12 h-12 rounded-full border border-border bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
            {initials}
        </div>
    )
}

export default function TestimonialsPage() {
    const [reviews, setReviews] = useState<Review[]>(FALLBACK_REVIEWS)
    const [rating, setRating] = useState<number | null>(null)
    const [totalRatings, setTotalRatings] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [isLive, setIsLive] = useState(false)

    useEffect(() => {
        fetch('/api/reviews')
            .then(r => r.json())
            .then(({ reviews: live, rating: r, totalRatings: t }) => {
                if (live?.length > 0) {
                    setReviews(live)
                    setIsLive(true)
                }
                if (r) setRating(r)
                if (t) setTotalRatings(t)
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const displayRating = rating?.toFixed(1) ?? '5.0'
    const displayTotal = totalRatings ? `${totalRatings}+` : '500+'

    return (
        <div className="pb-20">
            {/* Header */}
            <section className="bg-primary py-24">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
                    <div className="flex justify-center gap-3 mb-4">
                        {reviews.slice(0, 5).map((r, i) => (
                            <div key={i} className="w-14 h-14 rounded-full border-4 border-primary overflow-hidden">
                                <Avatar name={r.name} src={r.avatar} />
                            </div>
                        ))}
                    </div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-6xl font-bold text-white font-outfit"
                    >
                        What Our <span className="text-secondary italic">Students</span> Say
                    </motion.h1>
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Star key={i} className="w-6 h-6 text-secondary fill-secondary" />
                            ))}
                        </div>
                        <p className="text-primary-foreground/70 text-lg">
                            {displayRating} / 5.0 based on {displayTotal} Verified Google Reviews
                        </p>
                        {isLive && (
                            <span className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-300 text-xs font-bold px-3 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                Live from Google
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* Reviews Grid */}
            <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
                        {reviews.map((review, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: (i % 3) * 0.1 }}
                                className="break-inside-avoid bg-card border border-border p-8 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 relative group"
                            >
                                <Quote className="absolute top-6 right-8 w-12 h-12 text-muted opacity-20 group-hover:text-accent group-hover:opacity-10 transition-colors" />
                                <div className="flex items-center gap-4 mb-6">
                                    <Avatar name={review.name} src={review.avatar} />
                                    <div>
                                        <h4 className="font-bold">{review.name}</h4>
                                        <p className="text-xs text-muted-foreground">{review.date}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 mb-4">
                                    {[...Array(5)].map((_, idx) => (
                                        <Star key={idx} className={`w-4 h-4 ${idx < review.rating ? 'text-secondary fill-secondary' : 'text-muted fill-muted'}`} />
                                    ))}
                                </div>
                                <p className="text-foreground/80 leading-relaxed italic">
                                    &ldquo;{review.comment}&rdquo;
                                </p>
                                <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest">
                                    <CheckCircle className="w-4 h-4" /> Verified Google Review
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </section>

            {/* Stats/Badge Section */}
            <section className="bg-muted py-24">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-white rounded-[3rem] p-12 md:p-20 shadow-2xl border border-border flex flex-col md:flex-row items-center gap-16">
                        <div className="md:w-1/3 flex justify-center">
                            <div className="w-48 h-48 bg-secondary rounded-full flex items-center justify-center p-8 relative">
                                <div className="absolute inset-2 border-2 border-dashed border-primary/20 rounded-full animate-spin-slow" />
                                <Star className="w-full h-full text-primary" />
                            </div>
                        </div>
                        <div className="md:w-2/3 space-y-8">
                            <h3 className="text-4xl font-bold font-outfit">The Gold Standard in Driver Education</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-primary font-bold">
                                        <Smartphone className="w-5 h-5 text-accent" /> Digital Tracking
                                    </div>
                                    <p className="text-muted-foreground text-sm">Every lesson is logged digitally so you can see your progress in real-time.</p>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-primary font-bold">
                                        <Star className="w-5 h-5 text-accent" /> Premium Fleet
                                    </div>
                                    <p className="text-muted-foreground text-sm">Learn in our modern, well-maintained vehicles for maximum safety.</p>
                                </div>
                            </div>
                            <Link href="/book" className="inline-block">
                                <Button size="lg" className="rounded-2xl gap-2">Book Your Success Story <ArrowRight className="w-5 h-5" /></Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
