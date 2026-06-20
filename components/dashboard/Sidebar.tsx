'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Star, MapPin, CheckSquare, Users,
  Settings
} from 'lucide-react'

const nav = [
  {
    section: 'Overview',
    items: [
      { label: 'GBP Reviews', href: '/dashboard',  icon: Star },
      { label: 'Clients',     href: '/clients',    icon: MapPin },
      { label: 'Patient Lists', href: '/patient-lists', icon: Users },
    ]
  },
  {
    section: 'Work',
    items: [
      { label: 'Tasks', href: '/tasks', icon: CheckSquare },
    ]
  },
  {
    section: 'Settings',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
    ]
  },
]

export default function Sidebar({ role }: { role: string | null }) {
  const path = usePathname()

  if (path === '/login' || path.startsWith('/register')) return null

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          O
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900 leading-tight">OpCenter</div>
          <div className="text-[10px] text-gray-400 leading-tight">Campaign Intelligence</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {nav.map((group) => {
          const items = group.items.filter(item => {
            if (item.href === '/settings') return role === 'super_admin'
            if (item.href === '/patient-lists') return role === 'super_admin' || role === 'admin'
            return true
          })
          if (items.length === 0) return null
          return (
          <div key={group.section} className="mb-2">
            <div className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase px-3 py-2">
              {group.section}
            </div>
            {items.map((item) => {
              const Icon = item.icon
              const active = path === item.href || (item.href !== '/dashboard' && path.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                    active
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              )
            })}
          </div>
          )
        })}
      </nav>
    </aside>
  )
}
