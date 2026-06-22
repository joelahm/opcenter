import { NormalizedReview } from '@/lib/review-sync'

interface SerpApiAccount {
  plan_name?: string
  searches_per_month?: number
  total_searches_left?: number
  plan_searches_left?: number
  this_month_usage?: number
  account_rate_limit_per_hour?: number
}

interface FetchSerpApiReviewsInput {
  placeId: string
  dataId?: string | null
  targetTotal: number
  knownReviewIds: Set<string>
  backfill?: boolean
}

export interface SerpApiReviewResult {
  reviews: NormalizedReview[]
  callsUsed: number
  pagesFetched: number
  quotaRemaining: number | null
  fetchedAll: boolean
  dataId: string
  partialError: string | null
  placeInfo: {
    title?: string
    address?: string
    rating?: number
    reviews?: number
  }
}

function configuredInteger(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function requestTimeoutMs() {
  return Math.max(5_000, configuredInteger('SERPAPI_TIMEOUT_MS', 30_000))
}

function pollTimeoutMs() {
  return Math.max(30_000, configuredInteger('SERPAPI_POLL_TIMEOUT_MS', 120_000))
}

function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export function estimateSerpApiReviewCalls(totalReviews: number) {
  if (totalReviews <= 0) return 0
  return 1 + Math.ceil(Math.max(0, totalReviews - 8) / 20)
}

export function serpApiReviewSort(isBackfill: boolean) {
  return isBackfill ? 'qualityScore' : 'newestFirst'
}

export function shouldContinueSerpApiPagination({
  isBackfill,
  fetchedCount,
  targetTotal,
  pageHasKnownReview,
  hasNextPage,
  pagesFetched,
  maxPages,
}: {
  isBackfill: boolean
  fetchedCount: number
  targetTotal: number
  pageHasKnownReview: boolean
  hasNextPage: boolean
  pagesFetched: number
  maxPages: number
}) {
  if (!hasNextPage || pagesFetched >= maxPages) return false
  if (isBackfill) return targetTotal <= 0 || fetchedCount < targetTotal
  return !pageHasKnownReview
}

async function fetchSerpApiJson(url: URL, context: string) {
  let response: Response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(requestTimeoutMs()),
    })
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error(`${context} timed out after ${requestTimeoutMs() / 1000} seconds`)
    }
    throw error
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.error) {
    const searchId = payload?.search_metadata?.id
    const detail = payload?.error || `request failed (${response.status})`
    throw new Error(`${context}: ${detail}${searchId ? ` (SerpApi search ${searchId})` : ''}`)
  }

  return payload
}

async function runSerpApiSearch(url: URL, apiKey: string, context: string) {
  url.searchParams.set('async', 'true')
  const submitted = await fetchSerpApiJson(url, context)
  if (submitted?.search_metadata?.status === 'Success') return submitted

  const searchId = submitted?.search_metadata?.id
  if (!searchId) throw new Error(`${context} returned no SerpApi search ID`)

  const deadline = Date.now() + pollTimeoutMs()
  while (Date.now() < deadline) {
    await sleep(2_000)
    const archiveUrl = new URL(`https://serpapi.com/searches/${encodeURIComponent(searchId)}.json`)
    archiveUrl.searchParams.set('api_key', apiKey)
    const result = await fetchSerpApiJson(archiveUrl, `${context} archive lookup`)
    const status = result?.search_metadata?.status
    if (status === 'Success') return result
    if (status && !['Queued', 'Processing'].includes(status)) {
      throw new Error(`${context} failed with status ${status} (SerpApi search ${searchId})`)
    }
  }

  throw new Error(`${context} was still processing after ${pollTimeoutMs() / 1000} seconds (SerpApi search ${searchId})`)
}

async function runSerpApiSearchWithRetry(url: URL, apiKey: string, context: string) {
  const retries = configuredInteger('SERPAPI_PAGE_RETRIES', 1)
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await runSerpApiSearch(new URL(url), apiKey, context)
    } catch (error) {
      lastError = error
      if (attempt < retries) await sleep(2_000)
    }
  }

  throw lastError
}

export async function getSerpApiAccount(apiKey: string): Promise<SerpApiAccount> {
  const url = new URL('https://serpapi.com/account.json')
  url.searchParams.set('api_key', apiKey)
  return fetchSerpApiJson(url, 'SerpApi account lookup')
}

export function extractSerpApiDataId(payload: any, placeId: string) {
  if (payload?.place_results?.data_id) return String(payload.place_results.data_id)

  const matchingResult = (Array.isArray(payload?.local_results) ? payload.local_results : [])
    .find((result: any) => result?.place_id === placeId && result?.data_id)
  return matchingResult?.data_id ? String(matchingResult.data_id) : null
}

async function resolveSerpApiDataId(placeId: string, apiKey: string) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_maps')
  url.searchParams.set('place_id', placeId)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('api_key', apiKey)

  const payload = await fetchSerpApiJson(url, 'SerpApi Maps identifier lookup')
  const dataId = extractSerpApiDataId(payload, placeId)
  if (!dataId) {
    const searchId = payload?.search_metadata?.id
    throw new Error(
      `SerpApi Maps identifier lookup returned no data_id${searchId ? ` (SerpApi search ${searchId})` : ''}`
    )
  }
  return dataId
}

function normalizeSerpApiReview(review: any): NormalizedReview | null {
  const stars = Number(review.rating || 0)
  if (!stars) return null

  const reviewDate = new Date(review.iso_date || review.iso_date_of_last_edit || Date.now())
  if (Number.isNaN(reviewDate.getTime())) return null

  return {
    externalId: review.review_id ? String(review.review_id) : undefined,
    reviewer: review.user?.name || 'Google user',
    stars,
    text: review.extracted_snippet?.original || review.snippet || null,
    reviewDate,
    replied: Boolean(review.response),
    replyText: review.response?.extracted_snippet?.original || review.response?.snippet || null,
  }
}

export async function fetchSerpApiReviews({
  placeId,
  dataId: savedDataId,
  targetTotal,
  knownReviewIds,
  backfill,
}: FetchSerpApiReviewsInput): Promise<SerpApiReviewResult> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim()
  if (!apiKey) throw new Error('SERPAPI_API_KEY is missing or empty')

  const maxPages = configuredInteger('SERPAPI_MAX_PAGES_PER_REFETCH', 25)
  const creditReserve = configuredInteger('SERPAPI_MIN_CREDIT_RESERVE', 10)
  if (maxPages < 1) throw new Error('SERPAPI_MAX_PAGES_PER_REFETCH must be at least 1')

  const account = await getSerpApiAccount(apiKey)
  const quotaAvailable = Number(account.total_searches_left ?? account.plan_searches_left)
  const quotaRemaining = Number.isFinite(quotaAvailable) ? quotaAvailable : null
  const isBackfill = backfill ?? knownReviewIds.size === 0
  const sortBy = serpApiReviewSort(isBackfill)
  const reviewCalls = isBackfill ? Math.min(maxPages, estimateSerpApiReviewCalls(targetTotal) || 1) : 1
  const estimatedCalls = reviewCalls + (savedDataId ? 0 : 1)

  if (quotaRemaining != null && quotaRemaining - estimatedCalls < creditReserve) {
    throw new Error(
      `SerpApi quota is too low: ${quotaRemaining} searches remain, ${estimatedCalls} are estimated, and ${creditReserve} are reserved`
    )
  }

  const reviews: NormalizedReview[] = []
  const fetchedIds = new Set<string>()
  const dataId = savedDataId || await resolveSerpApiDataId(placeId, apiKey)
  let nextPageToken = ''
  let nextPageUrl = ''
  let callsUsed = savedDataId ? 0 : 1
  let pagesFetched = 0
  let fetchedAll = false
  let partialError: string | null = null
  let placeInfo: SerpApiReviewResult['placeInfo'] = {}

  do {
    if (quotaRemaining != null && quotaRemaining - callsUsed - 1 < creditReserve) break

    const url = nextPageUrl
      ? new URL(nextPageUrl)
      : new URL('https://serpapi.com/search.json')
    if (url.hostname !== 'serpapi.com') {
      throw new Error('SerpApi returned an invalid pagination URL')
    }
    if (!nextPageUrl) {
      url.searchParams.set('engine', 'google_maps_reviews')
      url.searchParams.set('data_id', dataId)
      url.searchParams.set('sort_by', sortBy)
      url.searchParams.set('hl', 'en')
    }
    url.searchParams.set('api_key', apiKey)

    let payload: any
    callsUsed += 1
    try {
      payload = await runSerpApiSearchWithRetry(url, apiKey, `SerpApi reviews page ${pagesFetched + 1}`)
    } catch (error: any) {
      if (pagesFetched === 0) throw error
      partialError = error?.message || 'A SerpApi review page failed'
      break
    }
    pagesFetched += 1
    if (pagesFetched === 1) placeInfo = payload.place_info || {}

    const pageReviews = (Array.isArray(payload.reviews) ? payload.reviews : [])
      .map(normalizeSerpApiReview)
      .filter((review: NormalizedReview | null): review is NormalizedReview => Boolean(review))
    const pageHasKnownReview = pageReviews.some(
      (review: NormalizedReview) => Boolean(review.externalId && knownReviewIds.has(review.externalId))
    )

    for (const review of pageReviews) {
      const dedupeKey = review.externalId || `${review.reviewer}:${review.reviewDate.toISOString()}`
      if (fetchedIds.has(dedupeKey)) continue
      fetchedIds.add(dedupeKey)
      reviews.push(review)
    }

    nextPageToken = payload.serpapi_pagination?.next_page_token || ''
    nextPageUrl = payload.serpapi_pagination?.next || ''
    if (nextPageToken && !nextPageUrl) {
      const fallbackNextUrl = new URL('https://serpapi.com/search.json')
      fallbackNextUrl.searchParams.set('engine', 'google_maps_reviews')
      fallbackNextUrl.searchParams.set('data_id', dataId)
      fallbackNextUrl.searchParams.set('sort_by', sortBy)
      fallbackNextUrl.searchParams.set('hl', 'en')
      fallbackNextUrl.searchParams.set('next_page_token', nextPageToken)
      nextPageUrl = fallbackNextUrl.toString()
    }
    const currentTarget = Number(placeInfo.reviews || targetTotal || 0)
    const continuePaging = shouldContinueSerpApiPagination({
      isBackfill,
      fetchedCount: reviews.length,
      targetTotal: currentTarget,
      pageHasKnownReview,
      hasNextPage: Boolean(nextPageToken),
      pagesFetched,
      maxPages,
    })

    if (!continuePaging) {
      fetchedAll = !nextPageToken || currentTarget <= 0 || reviews.length >= currentTarget || (!isBackfill && pageHasKnownReview)
      break
    }
  } while (true)

  return {
    reviews,
    callsUsed,
    pagesFetched,
    quotaRemaining: quotaRemaining == null ? null : Math.max(0, quotaRemaining - callsUsed),
    fetchedAll,
    dataId,
    partialError,
    placeInfo,
  }
}
