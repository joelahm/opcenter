'use client'
import { useMemo, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { DatePickerInput } from '@mantine/dates'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { currentMonthRange, currentWeekRange, parseDateInput, toDateInput } from '@/lib/date-ranges'

interface ChartRow {
  day: string | Date
  count: number
}

type Preset = 'week' | 'month' | 'custom'

function rowDateKey(value: string | Date) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  return toDateInput(new Date(value))
}

export default function ReviewsChart({ data }: { data: ChartRow[] }) {
  const initialRange = currentWeekRange()
  const [range, setRange] = useState(initialRange)
  const [preset, setPreset] = useState<Preset>('week')
  const [pickerValue, setPickerValue] = useState<[string | null, string | null]>([
    initialRange.from,
    initialRange.to,
  ])

  const chartData = useMemo(() => {
    const counts = new Map(data.map(row => [rowDateKey(row.day), Number(row.count || 0)]))
    const from = parseDateInput(range.from)
    const to = parseDateInput(range.to)
    const rows: Array<{ day: string; fullDate: string; count: number }> = []

    for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      const key = toDateInput(cursor)
      rows.push({
        day: cursor.toLocaleDateString('en', range.from === range.to
          ? { month: 'short', day: 'numeric' }
          : { month: 'short', day: 'numeric' }),
        fullDate: cursor.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        count: counts.get(key) || 0,
      })
    }

    return rows
  }, [data, range])

  function applyPreset(nextPreset: Exclude<Preset, 'custom'>) {
    const nextRange = nextPreset === 'week' ? currentWeekRange() : currentMonthRange()
    setRange(nextRange)
    setPickerValue([nextRange.from, nextRange.to])
    setPreset(nextPreset)
  }

  function selectCustomRange(nextRange: [string | null, string | null]) {
    setPickerValue(nextRange)
    const [from, to] = nextRange
    if (!from || !to) return
    setRange({ from, to })
    setPreset('custom')
  }

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-800 flex-shrink-0">Reviews over time</div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => applyPreset('week')}
            title="Current week, Monday through Sunday"
            className={`px-2 py-1 rounded text-[11px] font-medium ${preset === 'week' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            7d
          </button>
          <button
            type="button"
            onClick={() => applyPreset('month')}
            title="Current calendar month"
            className={`px-2 py-1 rounded text-[11px] font-medium ${preset === 'month' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            30d
          </button>
          <DatePickerInput
            type="range"
            value={pickerValue}
            onChange={selectCustomRange}
            leftSection={<CalendarRange size={13} />}
            valueFormat="MMM D, YYYY"
            labelSeparator=" - "
            firstDayOfWeek={1}
            numberOfColumns={1}
            size="xs"
            radius="md"
            w={205}
            aria-label="Choose a custom date range"
            popoverProps={{ position: 'bottom-end', withinPortal: true, shadow: 'md', zIndex: 70 }}
            styles={{
              input: {
                height: 28,
                minHeight: 28,
                paddingLeft: 28,
                fontSize: 10,
                fontWeight: 500,
                color: preset === 'custom' ? '#4338ca' : '#6b7280',
                borderColor: preset === 'custom' ? '#c7d2fe' : '#e5e7eb',
                background: preset === 'custom' ? '#eef2ff' : '#ffffff',
              },
              section: { width: 28, color: preset === 'custom' ? '#4f46e5' : '#9ca3af' },
            }}
          />
        </div>
      </div>

      <div className="p-4">
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" minTickGap={20} tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
            <Tooltip
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullDate || ''}
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: 'JetBrains Mono' }}
              labelStyle={{ color: '#6b7280' }}
            />
            <Line type="monotone" dataKey="count" name="Reviews" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3, fill: '#4f46e5' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
