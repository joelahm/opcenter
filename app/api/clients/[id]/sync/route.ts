import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { ReviewSentiment } from '@prisma/client'
import {
  fetchAllGbpReviews,
  findManagedLocationByPlaceId,
  getGbpAccessToken,
  getGbpOAuthSettings,
  getSetting,
  setSetting,
} from '@/lib/gbp-oauth'
import { checkRateLimit } from '@/lib/rate-limit'

interface NormalizedReview {
  externalId?: string
  reviewer: string
  stars: number
  text: string | null
  reviewDate: Date
  replied: boolean
  replyText: string | null
}

const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

function sentimentFromRating(rating: number): ReviewSentiment {
  if (rating >= 4) return 'positive'
  if (rating === 3) return 'neutral'
  return 'negative'
}

function formatAddress(address: any) {
  if (!address) return undefined
  const lines = Array.isArray(address.addressLines) ? address.addressLines : []
  return [lines.join(', '), address.locality, address.administrativeArea, address.postalCode, address.regionCode]
    .filter(Boolean)
    .join(', ')
}

async function fetchPlacesFallback(placeId: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_MAPS_API_KEY for Places fallback')

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,reviews,place_id')
  url.searchParams.set('reviews_sort', 'newest')
  url.searchParams.set('key', apiKey)

  const response = await fetch(url)
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

async function saveReviews(locationId: string, reviews: NormalizedReview[], reviewIdMap: Record<string, string>) {
  const newReviews: Array<{ reviewer: string; stars: number; text: string | null; review_date: string }> = []

  for (const review of reviews) {
    const mappedReviewId = review.externalId ? reviewIdMap[review.externalId] : ''
    const existingById = mappedReviewId
      ? await prisma.review.findUnique({ where: { id: mappedReviewId } })
      : null
    const existing = existingById || await prisma.review.findFirst({
      where: {
        locationId,
        reviewer: review.reviewer,
        reviewDate: review.reviewDate,
      },
    })

    const data = {
      reviewer: review.reviewer,
      stars: review.stars,
      reviewText: review.text,
      sentiment: sentimentFromRating(review.stars),
      replied: review.replied,
      replyText: review.replyText,
      reviewDate: review.reviewDate,
    }

    if (existing) {
      await prisma.review.update({ where: { id: existing.id }, data })
      if (review.externalId) reviewIdMap[review.externalId] = existing.id
      continue
    }

    const created = await prisma.review.create({ data: { locationId, ...data } })
    if (review.externalId) reviewIdMap[review.externalId] = created.id
    newReviews.push({
      reviewer: review.reviewer,
      stars: review.stars,
      text: review.text,
      review_date: review.reviewDate.toISOString(),
    })
  }

  return newReviews
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rate = checkRateLimit(`gbp-sync:${req.headers.get('x-user-id') || 'unknown'}:${params.id}`, 10, 10 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many GBP sync requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }
    const client = await prisma.location.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        gbpId: true,
        gbpConnected: true,
      },
    })

    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    if (!client.gbpConnected || !client.gbpId) {
      return NextResponse.json({ success: false, error: 'Client is not connected to a GBP account' }, { status: 400 })
    }

    let source: 'google_business_profile' | 'places_fallback' = 'places_fallback'
    let warning = ''
    let normalizedReviews: NormalizedReview[] = []
    let managedDetails: any = null
    const savedMapping = await getSetting(`gbp_location_mapping_${client.id}`)
    let accountName = ''
    let locationName = ''
    if (savedMapping) {
      try {
        const parsed = JSON.parse(savedMapping)
        accountName = parsed.accountName || ''
        locationName = parsed.locationName || ''
      } catch {
        // Invalid cached mapping is rediscovered below.
      }
    }

    const oauth = await getGbpOAuthSettings()
    if (oauth.enabled && oauth.connected) {
      try {
        const accessToken = await getGbpAccessToken()

        if (!accountName || !locationName) {
          const managedLocation = await findManagedLocationByPlaceId(client.gbpId, accessToken)
          if (!managedLocation) throw new Error('No managed GBP location matches this Place ID')

          accountName = managedLocation.accountName
          locationName = managedLocation.locationName
          managedDetails = managedLocation.details

          await setSetting(`gbp_location_mapping_${client.id}`, JSON.stringify({ accountName, locationName }))
        }

        const reviews = await fetchAllGbpReviews(accountName, locationName, accessToken)
        normalizedReviews = reviews.map((review: any) => ({
          externalId: review.reviewId,
          reviewer: review.reviewer?.displayName || 'Google user',
          stars: STAR_VALUES[review.starRating] || 0,
          text: review.comment || null,
          reviewDate: new Date(review.createTime || review.updateTime || Date.now()),
          replied: Boolean(review.reviewReply),
          replyText: review.reviewReply?.comment || null,
        })).filter((review: NormalizedReview) => review.stars > 0)
        source = 'google_business_profile'
      } catch (error: any) {
        warning = `GBP API unavailable: ${error?.message || 'unknown error'}. Used Places fallback.`
      }
    } else {
      warning = 'GBP OAuth is not connected. Used Places fallback (maximum five review samples).'
    }

    let place: any = null
    try {
      const fallback = await fetchPlacesFallback(client.gbpId)
      place = fallback.place
      if (source === 'places_fallback') normalizedReviews = fallback.reviews
    } catch (error: any) {
      if (source === 'places_fallback') throw error
      warning = warning || `Places details unavailable: ${error?.message || 'unknown error'}`
    }

    const savedReviewMap = await getSetting(`gbp_review_id_map_${client.id}`)
    let reviewIdMap: Record<string, string> = {}
    if (savedReviewMap) {
      try {
        reviewIdMap = JSON.parse(savedReviewMap)
      } catch {
        reviewIdMap = {}
      }
    }

    const newReviews = await saveReviews(client.id, normalizedReviews, reviewIdMap)
    if (source === 'google_business_profile') {
      await setSetting(`gbp_review_id_map_${client.id}`, JSON.stringify(reviewIdMap))
    }
    const gbpReviewCount = source === 'google_business_profile'
      ? normalizedReviews.length
      : Number(place?.user_ratings_total || normalizedReviews.length)
    const managedPhone = managedDetails?.phoneNumbers?.primaryPhone
    const managedAddress = formatAddress(managedDetails?.storefrontAddress)

    const synced = await prisma.location.update({
      where: { id: client.id },
      data: {
        name: managedDetails?.title || place?.name || client.name,
        address: managedAddress || place?.formatted_address || undefined,
        phone: managedPhone || place?.formatted_phone_number || undefined,
        website: managedDetails?.websiteUri || place?.website || undefined,
        gbpRating: place?.rating ? Number(place.rating) : undefined,
        gbpReviewCount,
        lastSynced: new Date(),
      },
      select: { name: true, lastSynced: true, gbpRating: true, gbpReviewCount: true },
    })

    return NextResponse.json({
      success: true,
      source,
      fallback: source === 'places_fallback',
      warning: warning || null,
      new_review_count: newReviews.length,
      new_reviews: newReviews,
      fetched_review_count: normalizedReviews.length,
      message: `Synced ${synced.name} - ${newReviews.length} new review${newReviews.length === 1 ? '' : 's'}`,
      synced_at: synced.lastSynced?.toISOString(),
      details: { rating: synced.gbpRating, review_count: synced.gbpReviewCount },
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Sync failed' }, { status: 500 })
  }
}
