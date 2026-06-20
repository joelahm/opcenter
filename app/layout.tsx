import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/dashboard/Sidebar'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'OpCenter — Fritzie Dashboard',
  description: 'Campaign Intelligence Dashboard',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <Sidebar role={user?.role || null} />
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
