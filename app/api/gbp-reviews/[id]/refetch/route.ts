import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { isAdmin, requireUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { getSetting, setSetting } from '@/lib/app-settings'
import { fetchGooglePlacesReviewSnapshot } from '@/lib/google-places-reviews'
import { calculateNewReviewCount } from '@/lib/gbp-review-delta'
import { deduplicateLocationReviews, saveNormalizedReviews, SavedReview } from '@/lib/review-sync'
import { fetchSerpApiReviews } from '@/lib/serpapi'

function reviewsAfterSync(reviews: SavedReview[], lastSynced: Date | null) {
  if (!lastSynced) return []
  return reviews.filter(review => new Date(review.review_date) > lastSynced)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireUser()
    if (!isAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    if (!process.env.SERPAPI_API_KEY?.trim()) {
      return NextResponse.json(
        { success: false, error: 'SERPAPI_API_KEY is missing or empty on the server' },
        { status: 503 }
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
      return NextResponse.json({ success: false, error: 'Client location not found' }, { status: 404 })
    }
    if (!client.gbpConnected || !client.gbpId) {
      return NextResponse.json({ success: false, error: 'Client location is not connected to GBP' }, { status: 400 })
    }

    const rate = checkRateLimit(`serpapi-refetch:${currentUser.id}:${client.id}`, 5, 60 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'SerpApi refetch is limited to five attempts per location per hour' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const googleSnapshot = await fetchGooglePlacesReviewSnapshot(client.gbpId)
    const googleSaved = await saveNormalizedReviews(client.id, googleSnapshot.reviews, {})
    const googleTotal = Number(googleSnapshot.place?.user_ratings_total || googleSnapshot.reviews.length)

    const mapSettingKey = `serpapi_review_id_map_${client.id}`
    const dataIdSettingKey = `serpapi_data_id_${client.id}`
    const backfillSettingKey = `serpapi_backfill_complete_${client.id}`
    const savedMap = await getSetting(mapSettingKey)
    const savedDataId = await getSetting(dataIdSettingKey)
    const savedBackfillComplete = await getSetting(backfillSettingKey)
    let reviewIdMap: Record<string, string> = {}
    if (savedMap) {
      try {
        reviewIdMap = JSON.parse(savedMap)
      } catch {
        reviewIdMap = {}
      }
    }
    const duplicatesRemovedBeforeSync = await deduplicateLocationReviews(client.id, reviewIdMap)

    const serpResult = await fetchSerpApiReviews({
      placeId: client.gbpId,
      dataId: savedDataId,
      targetTotal: googleTotal,
      knownReviewIds: new Set(Object.keys(reviewIdMap)),
      backfill: savedBackfillComplete !== 'true',
    })
    const serpSaved = await saveNormalizedReviews(client.id, serpResult.reviews, reviewIdMap)
    const duplicatesRemoved = duplicatesRemovedBeforeSync
      + await deduplicateLocationReviews(client.id, reviewIdMap)
    await Promise.all([
      setSetting(mapSettingKey, JSON.stringify(reviewIdMap)),
      setSetting(dataIdSettingKey, serpResult.dataId),
    ])

    const storedReviewCount = await prisma.review.count({ where: { locationId: client.id } })
    const reportedTotal = Number(serpResult.placeInfo.reviews || googleTotal || storedReviewCount)
    const newDetails = [
      ...reviewsAfterSync(googleSaved.newReviews, client.lastSynced),
      ...reviewsAfterSync(serpSaved.newReviews, client.lastSynced),
    ]
    const uniqueNewDetails = Array.from(new Map(
      newDetails.map(review => [`${review.reviewer}:${review.review_date}`, review])
    ).values())
    const newReviewCount = calculateNewReviewCount({
      hadPreviousSync: Boolean(client.lastSynced),
      previousTotal: Number(client.gbpReviewCount || 0),
      currentTotal: reportedTotal,
      newDetailsCount: uniqueNewDetails.length,
    })
    const backfillComplete = reportedTotal > 0 && storedReviewCount >= reportedTotal
    await setSetting(backfillSettingKey, String(backfillComplete))

    const synced = await prisma.location.update({
      where: { id: client.id },
      data: {
        name: serpResult.placeInfo.title || googleSnapshot.place?.name || client.name,
        address: serpResult.placeInfo.address || googleSnapshot.place?.formatted_address || undefined,
        phone: googleSnapshot.place?.formatted_phone_number || undefined,
        website: googleSnapshot.place?.website || undefined,
        gbpRating: Number(serpResult.placeInfo.rating || googleSnapshot.place?.rating || 0) || undefined,
        gbpReviewCount: reportedTotal,
        gbpNewReviewCount: newReviewCount,
        lastSynced: new Date(),
      },
      select: { name: true, gbpReviewCount: true, gbpNewReviewCount: true, lastSynced: true },
    })

    console.info('[serpapi-reviews]', JSON.stringify({
      event: 'refetch.succeeded',
      locationId: client.id,
      reportedTotal,
      storedReviewCount,
      newReviewCount,
      callsUsed: serpResult.callsUsed,
      quotaRemaining: serpResult.quotaRemaining,
      backfillComplete,
    }))

    return NextResponse.json({
      success: true,
      source: 'serpapi',
      message: backfillComplete
        ? `Refetched ${synced.name}: ${storedReviewCount} reviews stored`
        : `Refetched ${synced.name}: partial backfill, ${storedReviewCount} of ${reportedTotal} reviews stored${serpResult.partialError ? `. ${serpResult.partialError}` : ''}`,
      total_review_count: reportedTotal,
      stored_review_count: storedReviewCount,
      new_review_count: newReviewCount,
      new_reviews: uniqueNewDetails,
      google_reviews_fetched: googleSnapshot.reviews.length,
      serpapi_reviews_fetched: serpResult.reviews.length,
      serpapi_reviews_added: serpSaved.newReviews.length,
      duplicates_updated: serpSaved.updatedCount,
      duplicates_removed: duplicatesRemoved,
      api_calls_used: serpResult.callsUsed,
      quota_remaining: serpResult.quotaRemaining,
      pages_fetched: serpResult.pagesFetched,
      backfill_complete: backfillComplete,
      partial_error: serpResult.partialError,
      synced_at: synced.lastSynced?.toISOString(),
    })
  } catch (error: any) {
    console.error('SerpApi GBP reviews refetch error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to refetch GBP reviews' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
