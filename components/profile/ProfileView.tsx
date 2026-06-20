'use client'
import { useState } from 'react'
import { Eye, EyeOff, Loader2, Mail, Save, X } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  status: string
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={visible ? 'text' : 'password'}
        className="w-full px-3 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
      />
      <button
        type="button"
        onClick={() => setVisible(prev => !prev)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

export default function ProfileView({ user }: { user: UserProfile }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [savedEmail, setSavedEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submitProfile(code?: string) {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          current_password: currentPassword,
          new_password: newPassword,
          otp_code: code,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Update failed')
      setSavedEmail(data.data.email)
      setCurrentPassword('')
      setNewPassword('')
      setOtpCode('')
      setShowOtpModal(false)
      setMessage({ ok: true, text: 'Profile updated' })
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || 'Update failed' })
    }

    setLoading(false)
  }

  async function requestOtp() {
    setSendingOtp(true)
    setMessage(null)
    setDevCode('')

    try {
      const res = await fetch('/api/profile/email-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to send verification code')
      setDevCode(data.dev_code || '')
      setShowOtpModal(true)
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || 'Failed to send verification code' })
    }

    setSendingOtp(false)
  }

  async function save() {
    if (email.trim().toLowerCase() !== savedEmail.trim().toLowerCase()) {
      await requestOtp()
      return
    }

    await submitProfile()
  }

  return (
    <div className="p-5 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-900">Profile</div>
          <div className="text-xs text-gray-400 mt-0.5">Update your name, email, and password</div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
              <div className="px-3 py-2.5 border border-gray-100 bg-gray-50 rounded-xl text-sm text-gray-500 font-mono">{user.role}</div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
              <div className="px-3 py-2.5 border border-gray-100 bg-gray-50 rounded-xl text-sm text-gray-500 font-mono">{user.status}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="text-sm font-semibold text-gray-800 mb-2">Change password</div>
            <div className="grid grid-cols-2 gap-3">
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="Current password" />
              <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="New password" />
            </div>
            <div className="text-[11px] text-gray-400 mt-1.5">Leave password fields empty to keep your current password.</div>
          </div>

          {message && (
            <div className={`text-xs border rounded-lg px-3 py-2 ${
              message.ok ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={save}
            disabled={loading || sendingOtp}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading || sendingOtp ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {email.trim().toLowerCase() !== savedEmail.trim().toLowerCase() ? 'Verify email' : 'Save profile'}
          </button>
        </div>
      </div>

      {showOtpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowOtpModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-900">Verify new email</div>
                <div className="text-xs text-gray-400 mt-0.5">Enter the code sent to {email}</div>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm tracking-[0.35em] font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
                />
              </div>
              {devCode && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Dev code: <span className="font-mono font-bold">{devCode}</span>
                </div>
              )}
              <div className="text-[11px] text-gray-400">Codes expire after 10 minutes.</div>
            </div>

            <div className="px-5 pb-5 flex gap-2.5">
              <button
                onClick={() => setShowOtpModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submitProfile(otpCode)}
                disabled={loading || otpCode.length !== 6}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
