import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import {
  fetchAllGbpReviews,
  findManagedLocationByPlaceId,
  getGbpAccessToken,
  getGbpOAuthSettings,
  getSetting,
  setSetting,
} from '@/lib/gbp-oauth'
import { checkRateLimit } from '@/lib/rate-limit'
import { calculateNewReviewCount } from '@/lib/gbp-review-delta'
import { fetchGooglePlacesReviewSnapshot } from '@/lib/google-places-reviews'
import { NormalizedReview, saveNormalizedReviews } from '@/lib/review-sync'

const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

function formatAddress(address: any) {
  if (!address) return undefined
  const lines = Array.isArray(address.addressLines) ? address.addressLines : []
  return [lines.join(', '), address.locality, address.administrativeArea, address.postalCode, address.regionCode]
    .filter(Boolean)
    .join(', ')
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
        gbpReviewCount: true,
        lastSynced: true,
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
      const fallback = await fetchGooglePlacesReviewSnapshot(client.gbpId)
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

    const { newReviews: savedNewReviews } = await saveNormalizedReviews(client.id, normalizedReviews, reviewIdMap)
    if (source === 'google_business_profile') {
      await setSetting(`gbp_review_id_map_${client.id}`, JSON.stringify(reviewIdMap))
    }
    const gbpReviewCount = source === 'google_business_profile'
      ? normalizedReviews.length
      : Number(place?.user_ratings_total || normalizedReviews.length)
    const hadPreviousSync = Boolean(client.lastSynced)
    const previousReviewCount = Number(client.gbpReviewCount || 0)
    const reviewCountIncrease = hadPreviousSync
      ? Math.max(0, gbpReviewCount - previousReviewCount)
      : 0
    const newReviews = hadPreviousSync
      ? savedNewReviews.filter(review => new Date(review.review_date) > client.lastSynced!)
      : []
    const newReviewCount = calculateNewReviewCount({
      hadPreviousSync,
      previousTotal: previousReviewCount,
      currentTotal: gbpReviewCount,
      newDetailsCount: newReviews.length,
    })

    if (newReviewCount > newReviews.length) {
      const detailWarning = `Google reports ${newReviewCount} new review${newReviewCount === 1 ? '' : 's'}, but this sync returned details for ${newReviews.length}.`
      warning = [warning, detailWarning].filter(Boolean).join(' ')
    }
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
        gbpNewReviewCount: newReviewCount,
        lastSynced: new Date(),
      },
      select: { name: true, lastSynced: true, gbpRating: true, gbpReviewCount: true, gbpNewReviewCount: true },
    })

    return NextResponse.json({
      success: true,
      source,
      fallback: source === 'places_fallback',
      warning: warning || null,
      new_review_count: newReviewCount,
      new_reviews: newReviews,
      fetched_review_count: normalizedReviews.length,
      previous_review_count: previousReviewCount,
      total_review_count: synced.gbpReviewCount,
      review_count_change: reviewCountIncrease,
      message: `Synced ${synced.name} - ${newReviewCount} new review${newReviewCount === 1 ? '' : 's'}`,
      synced_at: synced.lastSynced?.toISOString(),
      details: {
        rating: synced.gbpRating,
        review_count: synced.gbpReviewCount,
        new_review_count: synced.gbpNewReviewCount,
      },
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Sync failed' }, { status: 500 })
  }
}
