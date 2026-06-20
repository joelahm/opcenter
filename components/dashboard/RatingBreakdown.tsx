'use client'
import Image from 'next/image'

// ─── Rating Breakdown ───────────────────────────────────────────────────────
export function RatingBreakdown({ stats }: { stats: any }) {
  const total = Number(stats.total_reviews) || 1
  const bars = [
    { label: '★ 5', val: Number(stats.s5)||0, color: 'bg-green-500' },
    { label: '★ 4', val: Number(stats.s4)||0, color: 'bg-lime-500' },
    { label: '★ 3', val: Number(stats.s3)||0, color: 'bg-amber-500' },
    { label: '★ 2', val: Number(stats.s2)||0, color: 'bg-orange-500' },
    { label: '★ 1', val: Number(stats.s1)||0, color: 'bg-red-500' },
  ]
  const avg = parseFloat(stats.avg_rating || 0).toFixed(1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-800">Rating breakdown</div>
      <div className="p-4 flex items-center gap-4">
        <div className="flex-shrink-0 text-center">
          <div className="text-3xl font-bold font-mono text-gray-900">{avg}</div>
          <div className="text-xs text-gray-400 mt-0.5">avg rating</div>
        </div>
        <div className="flex-1 space-y-1.5">
          {bars.map(b => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[11px] text-amber-500 w-7">{b.label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.round((b.val/total)*100)}%` }} />
              </div>
              <span className="text-[11px] text-gray-400 font-mono w-7 text-right">{Math.round((b.val/total)*100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Alert Panel ─────────────────────────────────────────────────────────────
export function AlertPanel({ reviews }: { reviews: any[] }) {
  const colors: Record<number, string> = { 1: 'bg-red-100 text-red-600', 2: 'bg-red-50 text-red-500', 3: 'bg-amber-50 text-amber-600' }
  const icons: Record<number, string>  = { 1: '🔴', 2: '🟠', 3: '🟡' }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">Priority alerts</span>
        <span className="text-[10px] text-indigo-600 font-medium cursor-pointer hover:underline">View all</span>
      </div>
      <div className="p-3 space-y-2">
        {reviews.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">No alerts 🎉</div>
        ) : reviews.map((r: any, i: number) => (
          <div key={r.id || i} className="flex gap-2.5 items-start p-2.5 bg-gray-50 border border-gray-100 rounded-lg hover:border-indigo-200 cursor-pointer transition-all">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${colors[r.stars] || 'bg-gray-100'}`}>
              {icons[r.stars] || '⚪'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-800">{r.stars}★ · {r.location_name}</div>
              <div className="text-[11px] text-gray-400 truncate mt-0.5">Unreplied · &quot;{r.review_text?.slice(0,40)}...&quot;</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Top Locations ────────────────────────────────────────────────────────────
const LOC_IMGS = [
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=60&h=60&fit=crop',
  'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=60&h=60&fit=crop',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=60&h=60&fit=crop',
  'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=60&h=60&fit=crop',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=60&h=60&fit=crop',
]

export function TopLocations({ locations }: { locations: any[] }) {
  const max = Math.max(...locations.map((l: any) => Number(l.total_reviews) || 0), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">Top locations</span>
        <span className="text-[10px] text-indigo-600 font-medium cursor-pointer hover:underline">All 54</span>
      </div>
      <div className="divide-y divide-gray-50 px-4">
        {locations.map((l: any, i: number) => {
          const ct  = Number(l.total_reviews) || 0
          const avg = parseFloat(l.avg_rating || 0).toFixed(1)
          const pct = Math.round((ct / max) * 100)
          return (
            <div key={l.id || i} className="flex items-center gap-2.5 py-2.5 hover:opacity-75 cursor-pointer transition-opacity">
              <Image
                src={LOC_IMGS[i % LOC_IMGS.length]}
                alt={l.name}
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-100"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{l.name}</div>
                <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="text-[11px] text-gray-400 font-mono">{ct}</div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-amber-100 text-amber-700">{avg}★</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RatingBreakdown
