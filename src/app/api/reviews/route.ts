import { NextResponse } from 'next/server'

const PLACE_ID = process.env.GOOGLE_PLACE_ID
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY

export async function GET() {
    if (!PLACE_ID || !MAPS_API_KEY) {
        console.warn('GOOGLE_PLACE_ID or GOOGLE_MAPS_API_KEY not set — returning empty reviews')
        return NextResponse.json({ reviews: [], rating: null, totalRatings: null })
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=rating,user_ratings_total,reviews&reviews_sort=newest&key=${MAPS_API_KEY}`

        const res = await fetch(url, { next: { revalidate: 3600 } }) // cache 1 hour
        const data = await res.json()

        if (data.status !== 'OK') {
            console.error('Google Places API error:', data.status, data.error_message)
            return NextResponse.json({ reviews: [], rating: null, totalRatings: null })
        }

        const { rating, user_ratings_total, reviews } = data.result

        const mapped = (reviews || []).map((r: any) => ({
            name: r.author_name,
            avatar: r.profile_photo_url,
            rating: r.rating,
            date: r.relative_time_description,
            comment: r.text,
        }))

        return NextResponse.json({ reviews: mapped, rating, totalRatings: user_ratings_total })
    } catch (err: any) {
        console.error('Failed to fetch Google reviews:', err.message)
        return NextResponse.json({ reviews: [], rating: null, totalRatings: null })
    }
}
