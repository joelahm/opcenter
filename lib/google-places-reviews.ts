import { NormalizedReview } from '@/lib/review-sync'

export async function fetchGooglePlacesReviewSnapshot(placeId: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_MAPS_API_KEY for Places fallback')

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,reviews,place_id')
  url.searchParams.set('reviews_sort', 'newest')
  url.searchParams.set('key', apiKey)

  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json()

  if (!response.ok || payload.status !== 'OK') {
    throw new Error(payload.error_message || payload.status || 'Google Places sync failed')
  }

  const place = payload.result || {}
  const reviews: NormalizedReview[] = (Array.isArray(place.reviews) ? place.reviews : [])
    .map((review: any) => ({
      reviewer: review.author_name || 'Google user',
      stars: Number(review.rating || 0),
      text: review.text || null,
      reviewDate: review.time ? new Date(review.time * 1000) : new Date(),
      replied: false,
      replyText: null,
    }))
    .filter((review: NormalizedReview) => review.stars > 0)

  return { place, reviews }
}
