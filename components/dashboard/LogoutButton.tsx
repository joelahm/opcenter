'use client'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <button
      onClick={logout}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
      title="Logout"
    >
      <LogOut size={16} />
    </button>
  )
}
