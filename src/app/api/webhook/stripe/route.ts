import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase, getServiceRoleClient } from '@/lib/supabase'
import { sendPackagePurchaseEmail, sendBookingConfirmationEmail } from '@/lib/email'
import { addGoogleCalendarEvent } from '@/lib/calendar'

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string

function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

export async function POST(req: Request) {
    const body = await req.text()
    const sig = (await headers()).get('stripe-signature') as string

    let event: Stripe.Event

    try {
        event = getStripe().webhooks.constructEvent(body, sig, endpointSecret)
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`)
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object as Stripe.PaymentIntent
            const { bookingId, bookingIds, studentId, isPackage, creditsAdded, packageId } = paymentIntent.metadata

            const adminClient = getServiceRoleClient()

            if (isPackage === 'true' && studentId) {
                // 1. Update Profile Credits & Expiry (90 days)
                const expiryDate = new Date()
                expiryDate.setDate(expiryDate.getDate() + 90)

                const { error: profileError } = await adminClient.rpc('increment_student_credits', {
                    p_student_id: studentId,
                    p_credits: parseInt(creditsAdded),
                    p_expiry: expiryDate.toISOString()
                })

                if (profileError) {
                    console.error('Error incrementing credits:', profileError.message)
                }

                // 2. Log Package Purchase
                const { error: purchaseError } = await adminClient
                    .from('package_purchases')
                    .insert({
                        student_id: studentId,
                        package_type: creditsAdded === '5' ? '5-pack' : '10-pack',
                        amount: paymentIntent.amount / 100,
                        credits_added: parseInt(creditsAdded)
                    })

                if (purchaseError) {
                    console.error('Error logging purchase:', purchaseError.message)
                } else {
                    try {
                        const { data: studentUser } = await adminClient
                            .from('users')
                            .select('email, full_name')
                            .eq('id', studentId)
                            .single()

                        if (studentUser?.email) {
                            await sendPackagePurchaseEmail({
                                studentEmail: studentUser.email,
                                studentName: studentUser.full_name || 'Student',
                                packageName: `${creditsAdded}-pack`,
                                amount: paymentIntent.amount / 100,
                                creditsAdded: parseInt(creditsAdded)
                            })
                        }
                    } catch (e) {
                        console.error('Failed to send package receipt email:', e)
                    }
                }
            } else if (bookingIds || bookingId) {
                // Update booking status for individual lessons (or multiple if package booked at once)
                const idsArray = bookingIds ? bookingIds.split(',') : [bookingId];
                
                const { data: bookings, error } = await adminClient
                    .from('bookings')
                    .update({ payment_status: 'paid' })
                    .in('id', idsArray)
                    .select(`
                        id, start_time, end_time, pickup_address, transmission_type, student_id, instructor_id, lesson_id,
                        student:users!bookings_student_id_fkey(full_name, email)
                    `)

                if (error) {
                    console.error('Error updating booking status:', error.message)
                } else if (bookings && bookings.length > 0) {
                    // Send confirmation for the FIRST booking as a representative email, 
                    // or ideally loop over them. For now we just use the first booking data
                    // with a note about multiple sessions if length > 1
                    const firstBooking = bookings[0];
                    try {
                        const [
                            { data: instructorProfile },
                            { data: lesson }
                        ] = await Promise.all([
                            adminClient.from('instructors').select('full_name, email').eq('id', firstBooking.instructor_id).single(),
                            adminClient.from('lessons').select('title').eq('id', firstBooking.lesson_id).single()
                        ])

                        const studentData = Array.isArray(firstBooking.student)
                            ? firstBooking.student[0]
                            : (firstBooking.student as any)
                        const studentEmail = studentData?.email
                        const studentName = studentData?.full_name || 'Student'

                        if (studentEmail) {
                            await sendBookingConfirmationEmail({
                                studentEmail,
                                studentName,
                                instructorEmail: instructorProfile?.email,
                                instructorName: instructorProfile?.full_name,
                                lessonTitle: (lesson?.title || 'Driving Lesson') + (bookings.length > 1 ? ` (1 of ${bookings.length})` : ''),
                                startTime: firstBooking.start_time,
                                pickupAddress: firstBooking.pickup_address,
                                transmissionType: firstBooking.transmission_type
                            })

                            // Bulk Google Calendar Sync
                            for (const b of bookings) {
                                await addGoogleCalendarEvent({
                                    startTime: b.start_time,
                                    endTime: b.end_time || (new Date(new Date(b.start_time).getTime() + 60 * 60 * 1000).toISOString()),
                                    studentName,
                                    studentEmail,
                                    pickupAddress: b.pickup_address,
                                    lessonTitle: lesson?.title || 'Driving Lesson'
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Failed to send single booking confirmation email:', e)
                    }
                }
            }
            break

        case 'payment_intent.payment_failed': {
            const pi = event.data.object as Stripe.PaymentIntent
            const { bookingIds: failedBookingIds, bookingId: failedBookingId } = pi.metadata
            const idsToFail = failedBookingIds ? failedBookingIds.split(',') : failedBookingId ? [failedBookingId] : []
            if (idsToFail.length > 0) {
                const { error } = await getServiceRoleClient()
                    .from('bookings')
                    .update({ payment_status: 'failed', status: 'cancelled' })
                    .in('id', idsToFail)
                if (error) console.error('Failed to mark bookings as failed:', error.message)
                else console.log(`Marked ${idsToFail.length} booking(s) as failed/cancelled`)
            }
            break
        }

        default:
            console.log(`Unhandled event type ${event.type}`)
    }

    return NextResponse.json({ received: true })
}
