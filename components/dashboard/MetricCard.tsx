import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'warn'
  period?: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  barColor: string
  barPct: number
  valueColor?: string
}

export default function MetricCard({
  label, value, change, changeType = 'up', period,
  icon: Icon, iconBg, iconColor, barColor, barPct, valueColor
}: MetricCardProps) {
  const changeColors = {
    up:   'bg-green-100 text-green-700',
    down: 'bg-red-100 text-red-600',
    warn: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon size={17} className={iconColor} />
      </div>
      <div className={`text-2xl font-bold font-mono tracking-tight ${valueColor || 'text-gray-900'}`}>
        {value}
      </div>
      <div className="text-[11px] text-gray-400 font-medium mt-1">{label}</div>
      {(change || period) && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {change && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded font-mono ${changeColors[changeType]}`}>
              {change}
            </span>
          )}
          {period && <span className="text-[11px] text-gray-400">{period}</span>}
        </div>
      )}
      <div className="mt-2.5 h-0.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  )
}
