'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function ReviewsChart({ data }: { data: any[] }) {
  const chartData = data.map((d: any) => ({
    day:   new Date(d.day).toLocaleDateString('en', { weekday: 'short' }),
    count: Number(d.count),
  }))

  // Pad with zeros if less than 7 days
  while (chartData.length < 7) {
    chartData.unshift({ day: '–', count: 0 })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">Reviews over time</span>
        <div className="flex gap-1.5">
          <button className="px-2 py-1 rounded text-[11px] font-medium bg-indigo-600 text-white">7d</button>
          <button className="px-2 py-1 rounded text-[11px] font-medium bg-gray-100 text-gray-500 hover:bg-gray-200">30d</button>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: 'JetBrains Mono' }}
              labelStyle={{ color: '#6b7280' }}
            />
            <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3, fill: '#4f46e5' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
