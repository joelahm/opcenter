'use client'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Search, X, Star } from 'lucide-react'
import ReviewsChart from '@/components/dashboard/ReviewsChart'
import RatingBreakdown from '@/components/dashboard/RatingBreakdown'

interface LocationItem {
  id: string
  name: string
  address: string | null
  gbp_connected: boolean
  last_synced: string | null
}

interface ReviewItem {
  id: string
  reviewer: string | null
  stars: number
  review_text: string | null
  sentiment: string
  replied: boolean
  campaign: string | null
  review_date: string | null
  created_at: string
}

interface GbpReviewData {
  locations: LocationItem[]
  selected: LocationItem | null
  stats: any
  reviews: ReviewItem[]
  chartData: any[]
}

interface RefetchResult {
  message: string
  total_review_count: number
  stored_review_count: number
  new_review_count: number
  google_reviews_fetched: number
  serpapi_reviews_fetched: number
  serpapi_reviews_added: number
  api_calls_used: number
  quota_remaining: number | null
  pages_fetched: number
  backfill_complete: boolean
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-xs tracking-wider whitespace-nowrap">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= count ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </span>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const classes: Record<string, string> = {
    positive: 'bg-green-100 text-green-700',
    neutral:  'bg-amber-100 text-amber-700',
    negative: 'bg-red-100 text-red-600',
  }

  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${classes[sentiment] || classes.neutral}`}>
      {sentiment}
    </span>
  )
}

function SearchModal({
  locations,
  query,
  setQuery,
  onClose,
  onSelect,
}: {
  locations: LocationItem[]
  query: string
  setQuery: (value: string) => void
  onClose: () => void
  onSelect: (location: LocationItem) => void
}) {
  const filtered = locations.filter(location => {
    const text = `${location.name} ${location.address || ''}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 pt-24"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="text-sm font-semibold text-gray-900">Search client location</div>
            <div className="text-xs text-gray-400 mt-0.5">Select a location to view its GBP reviews</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              placeholder="Search client or location..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No client locations found</div>
          ) : filtered.map(location => (
            <button
              key={location.id}
              onClick={() => onSelect(location)}
              className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">{location.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{location.address || 'No location address'}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RefetchResultModal({ result, onClose }: { result: RefetchResult; onClose: () => void }) {
  const metrics = [
    ['Total reviews', result.total_review_count],
    ['Stored reviews', result.stored_review_count],
    ['New reviews', result.new_review_count],
    ['SerpApi calls', result.api_calls_used],
    ['Pages fetched', result.pages_fetched],
    ['Quota remaining', result.quota_remaining ?? 'Unavailable'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Review refetch complete</div>
            <div className="mt-1 text-xs text-gray-500">{result.message}</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <div className="font-mono text-lg font-semibold text-gray-900">{value}</div>
              <div className="mt-0.5 text-[11px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <div className="text-xs text-gray-500">
            Google: {result.google_reviews_fetched} fetched · SerpApi: {result.serpapi_reviews_fetched} fetched, {result.serpapi_reviews_added} added
          </div>
          <span className={`text-[10px] font-bold uppercase ${result.backfill_complete ? 'text-green-600' : 'text-amber-600'}`}>
            {result.backfill_complete ? 'Backfill complete' : 'Partial backfill'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function GbpReviewsView({ initialData }: { initialData: GbpReviewData }) {
  const [data, setData] = useState(initialData)
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [refetchResult, setRefetchResult] = useState<RefetchResult | null>(null)

  const selectedIndex = useMemo(() => {
    if (!data.selected) return -1
    return data.locations.findIndex(location => location.id === data.selected?.id)
  }, [data.locations, data.selected])

  async function loadLocation(locationId: string) {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/gbp-reviews?locationId=${encodeURIComponent(locationId)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to load client')
      setData(json.data)
    } catch (e: any) {
      setMessage(e.message || 'Failed to load client')
    }

    setLoading(false)
  }

  async function refetchReviews() {
    if (!data.selected) return

    setLoading(true)
    setMessage(null)
    setRefetchResult(null)

    try {
      const res = await fetch(`/api/gbp-reviews/${data.selected.id}/refetch`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Refetch failed')
      await loadLocation(data.selected.id)
      setMessage(json.message || 'Reviews refetched')
      setRefetchResult(json)
    } catch (e: any) {
      setMessage(e.message || 'Refetch failed')
      setLoading(false)
    }
  }

  function move(offset: number) {
    if (selectedIndex === -1 || data.locations.length === 0) return
    const nextIndex = (selectedIndex + offset + data.locations.length) % data.locations.length
    loadLocation(data.locations[nextIndex].id)
  }

  const avgRating = parseFloat(String(data.stats.avg_rating || 0)).toFixed(1)

  if (!data.selected) {
    return (
      <div className="p-5">
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
          No client locations found.
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-2">
              <button
                onClick={() => move(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                title="Previous client"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setShowSearch(true)}
                className="min-w-0 text-left px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base font-semibold text-gray-900 truncate">{data.selected.name}</span>
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                </div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{data.selected.address || 'No location address'}</div>
              </button>
              <button
                onClick={() => move(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                title="Next client"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full font-mono ${
                data.selected.gbp_connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {data.selected.gbp_connected ? 'GBP connected' : 'Not linked'}
              </span>
              <button
                onClick={refetchReviews}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refetch reviews
              </button>
            </div>
          </div>
          {message && <div className="text-xs text-gray-500 mt-2">{message}</div>}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold font-mono text-gray-900">{data.stats.total_reviews}</div>
            <div className="text-[11px] text-gray-400 font-medium mt-1">Total reviews</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold font-mono text-green-600">{avgRating}</div>
            <div className="text-[11px] text-gray-400 font-medium mt-1">Avg rating</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold font-mono text-red-600">{data.stats.unreplied}</div>
            <div className="text-[11px] text-gray-400 font-medium mt-1">Needs reply</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold font-mono text-gray-900">{data.reviews.filter(r => r.stars <= 3).length}</div>
            <div className="text-[11px] text-gray-400 font-medium mt-1">Low ratings</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ReviewsChart data={data.chartData} />
          <RatingBreakdown stats={data.stats} />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Reviews for this location</span>
            <span className="text-[11px] text-gray-400 font-mono">{data.reviews.length} rows</span>
          </div>

          <div className="grid grid-cols-[1.1fr_0.8fr_2.2fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>Reviewer</span>
            <span>Rating</span>
            <span>Review</span>
            <span>Sentiment</span>
            <span>Status</span>
            <span>Date</span>
          </div>

          <div className="divide-y divide-gray-50">
            {data.reviews.length === 0 ? (
              <div className="py-14 text-center">
                <Star size={20} className="text-gray-300 mx-auto mb-2" />
                <div className="text-sm text-gray-400">No reviews for this client location.</div>
              </div>
            ) : data.reviews.map(review => (
              <div
                key={review.id}
                className="grid grid-cols-[1.1fr_0.8fr_2.2fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-3 items-start hover:bg-gray-50/70 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 truncate">{review.reviewer || 'Google user'}</span>
                <Stars count={review.stars} />
                <p className="min-w-0 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap break-words">
                  {review.review_text || 'No review text'}
                </p>
                <SentimentBadge sentiment={review.sentiment} />
                <span className={`w-fit text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  review.replied ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'
                }`}>
                  {review.replied ? 'Replied' : 'Unreplied'}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  {review.review_date ? new Date(review.review_date).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSearch && (
        <SearchModal
          locations={data.locations}
          query={query}
          setQuery={setQuery}
          onClose={() => setShowSearch(false)}
          onSelect={location => {
            setShowSearch(false)
            setQuery('')
            loadLocation(location.id)
          }}
        />
      )}

      {refetchResult && (
        <RefetchResultModal result={refetchResult} onClose={() => setRefetchResult(null)} />
      )}
    </>
  )
}
