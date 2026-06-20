import Link from 'next/link'
import { Bell } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import LogoutButton from '@/components/dashboard/LogoutButton'

interface TopbarProps {
  title: string
  subtitle: string
  alertCount?: number
}

export default async function Topbar({ title, subtitle, alertCount = 0 }: TopbarProps) {
  const user = await getCurrentUser()
  const fallback = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase()

  return (
    <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 flex-shrink-0">
      <div>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {alertCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium">
            <Bell size={13} /> {alertCount} alerts
          </div>
        )}
        <Link
          href="/profile"
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors min-w-0"
          title="Profile"
        >
          <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {fallback}
          </span>
          <span className="hidden sm:block text-left min-w-0">
            <span className="block text-xs font-semibold text-gray-800 truncate max-w-36">{user?.name || 'Profile'}</span>
            <span className="block text-[10px] text-gray-400 truncate max-w-36">{user?.email || 'Manage account'}</span>
          </span>
        </Link>
        <LogoutButton />
      </div>
    </div>
  )
}
