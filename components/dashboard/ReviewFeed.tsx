'use client'
import { useState } from 'react'
import Image from 'next/image'

const AVATARS = [
  'https://i.pravatar.cc/40?img=1','https://i.pravatar.cc/40?img=2','https://i.pravatar.cc/40?img=3',
  'https://i.pravatar.cc/40?img=5','https://i.pravatar.cc/40?img=6','https://i.pravatar.cc/40?img=7',
]

function Stars({ n }: { n: number }) {
  return (
    <span className="text-xs tracking-wider">
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= n ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
    </span>
  )
}

function SentimentBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    positive: 'bg-green-100 text-green-700',
    negative: 'bg-red-100 text-red-600',
    neutral:  'bg-amber-100 text-amber-700',
  }
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${map[s] || map.neutral}`}>{s}</span>
}

const filters = ['all', 'unreplied', 'negative', 'positive'] as const

export default function ReviewFeed({ initialReviews }: { initialReviews: any[] }) {
  const [active, setActive]   = useState<typeof filters[number]>('all')
  const [reviews, setReviews] = useState(initialReviews)
  const [loading, setLoading] = useState(false)

  async function applyFilter(f: typeof filters[number]) {
    setActive(f)
    setLoading(true)
    try {
      const res  = await fetch(`/api/reviews?filter=${f}`)
      const data = await res.json()
      setReviews(data.data || [])
    } catch {}
    setLoading(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <span className="text-gray-400">⚡</span> Live review feed
        </div>
        <div className="flex gap-1.5">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => applyFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all ${
                active === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-50 px-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No reviews found</div>
        ) : reviews.map((r: any, i: number) => (
          <div key={r.id || i} className="flex gap-3 py-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-indigo-100">
              <Image
                src={AVATARS[i % AVATARS.length]}
                alt={r.reviewer}
                width={32} height={32}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-xs font-semibold text-gray-900">{r.reviewer}</span>
                <Stars n={r.stars} />
                <span className="text-[11px] text-gray-400">{r.location_name}</span>
              </div>
              <div className="text-xs text-gray-500 truncate max-w-xs">{r.review_text}</div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <SentimentBadge s={r.sentiment} />
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${r.replied ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'}`}>
                  {r.replied ? 'Replied' : 'Unreplied'}
                </span>
                {r.campaign && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-indigo-100 text-indigo-600">
                    {r.campaign}
                  </span>
                )}
                <span className="text-[10px] text-gray-400 font-mono ml-auto">
                  {r.review_date ? new Date(r.review_date).toLocaleDateString() : ''}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
