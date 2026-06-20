'use client'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Copy, ExternalLink, Loader2, LogOut, Mail, Send, UserPlus } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  status: string
  lastLoginAt: string | null
  createdAt: string
}

interface InviteRow {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
}

interface SettingsData {
  current_user_id: string
  users: UserRow[]
  invites: InviteRow[]
  summary: {
    discord_webhook_url: string
    daily_summary_enabled: boolean
    daily_summary_time: string
  }
  gmail: {
    enabled: boolean
    user: string
    client_id: string
    has_client_secret: boolean
    connected: boolean
    redirect_uri: string
  }
  gbp: {
    enabled: boolean
    user: string
    client_id: string
    has_client_secret: boolean
    connected: boolean
    redirect_uri: string
  }
}

export default function SettingsView({ initialData }: { initialData: SettingsData }) {
  const [users, setUsers] = useState(initialData.users)
  const [invites, setInvites] = useState(initialData.invites)
  const [summary, setSummary] = useState(initialData.summary)
  const [gmail, setGmail] = useState(initialData.gmail)
  const [gmailClientSecret, setGmailClientSecret] = useState('')
  const [gbp, setGbp] = useState(initialData.gbp)
  const [gbpClientSecret, setGbpClientSecret] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLink, setInviteLink] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    const socket = io({ path: '/socket.io' })
    socket.on('daily-summary:status', payload => {
      setStatus(`${payload.status}: ${payload.message || payload.source || ''}`)
    })
    return () => {
      socket.disconnect()
    }
  }, [])

  async function refreshUsersAndInvites() {
    const [usersRes, invitesRes] = await Promise.all([
      fetch('/api/settings/users'),
      fetch('/api/settings/invites'),
    ])
    const [usersData, invitesData] = await Promise.all([usersRes.json(), invitesRes.json()])
    if (usersData.success) setUsers(usersData.data)
    if (invitesData.success) setInvites(invitesData.data)
  }

  async function updateUser(userId: string, role: string, userStatus: string) {
    setLoading(`user-${userId}`)
    setStatus('')
    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, status: userStatus }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'User update failed')
      await refreshUsersAndInvites()
      setStatus('User access updated')
    } catch (e: any) {
      setStatus(e.message || 'User update failed')
      await refreshUsersAndInvites()
    }
    setLoading(null)
  }

  async function revokeInvite(inviteId: string) {
    setLoading(`invite-${inviteId}`)
    setStatus('')
    try {
      const res = await fetch(`/api/settings/invites/${inviteId}`, { method: 'PATCH' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Invite revoke failed')
      await refreshUsersAndInvites()
      setStatus('Invite revoked')
    } catch (e: any) {
      setStatus(e.message || 'Invite revoke failed')
    }
    setLoading(null)
  }

  async function createInvite() {
    setLoading('invite')
    setStatus('')

    try {
      const res = await fetch('/api/settings/invites', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Invite failed')
      setInviteLink(data.data.invite_link)
      setInviteEmail('')
      await refreshUsersAndInvites()
    } catch (e: any) {
      setStatus(e.message || 'Invite failed')
    }

    setLoading(null)
  }

  async function saveSummary() {
    setLoading('summary')
    setStatus('')

    try {
      const res = await fetch('/api/settings/daily-summary', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(summary),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Save failed')
      setStatus('Daily summary settings saved')
    } catch (e: any) {
      setStatus(e.message || 'Save failed')
    }

    setLoading(null)
  }

  async function sendSummary() {
    setLoading('send')
    setStatus('Sending daily summary...')

    try {
      const res = await fetch('/api/settings/daily-summary/send', { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Send failed')
      setStatus('Daily summary sent')
    } catch (e: any) {
      setStatus(e.message || 'Send failed')
    }

    setLoading(null)
  }

  async function saveGmail() {
    setLoading('gmail')
    setStatus('')

    try {
      const res = await fetch('/api/settings/email/oauth', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user:          gmail.user,
          client_id:     gmail.client_id,
          client_secret: gmailClientSecret,
          enabled:       gmail.enabled,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Save failed')
      setGmail(data.data)
      setGmailClientSecret('')
      setStatus('Gmail OAuth settings saved')
    } catch (e: any) {
      setStatus(e.message || 'Save failed')
    }

    setLoading(null)
  }

  async function connectGmail() {
    setLoading('gmail-connect')
    setStatus('')

    try {
      const res = await fetch('/api/settings/email/oauth/authorize')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Could not start Google OAuth')
      window.location.href = data.url
    } catch (e: any) {
      setStatus(e.message || 'Could not start Google OAuth')
      setLoading(null)
    }
  }

  async function sendEmailTest() {
    setLoading('gmail-test')
    setStatus('')

    try {
      const res = await fetch('/api/settings/email/test', { method: 'POST' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Email test failed')
      setStatus(data.delivered ? 'Test email sent' : 'Dev email logged to server console')
    } catch (e: any) {
      setStatus(e.message || 'Email test failed')
    }

    setLoading(null)
  }

  async function saveGbp() {
    setLoading('gbp')
    setStatus('')

    try {
      const res = await fetch('/api/settings/gbp/oauth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: gbp.user,
          client_id: gbp.client_id,
          client_secret: gbpClientSecret,
          enabled: gbp.enabled,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Save failed')
      setGbp(data.data)
      setGbpClientSecret('')
      setStatus('Google Business Profile OAuth settings saved')
    } catch (e: any) {
      setStatus(e.message || 'Save failed')
    }

    setLoading(null)
  }

  async function connectGbp() {
    setLoading('gbp-connect')
    setStatus('')

    try {
      const res = await fetch('/api/settings/gbp/oauth/authorize')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Could not start GBP OAuth')
      window.location.href = data.url
    } catch (e: any) {
      setStatus(e.message || 'Could not start GBP OAuth')
      setLoading(null)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex justify-end">
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50"
        >
          <LogOut size={12} /> Logout
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-800">Invite user</div>
            <div className="text-xs text-gray-400 mt-0.5">Invite links expire after 24 hours</div>
          </div>
          <div className="p-4 space-y-3">
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={createInvite}
              disabled={loading === 'invite'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading === 'invite' ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
              Create invite
            </button>
            {inviteLink && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-[11px] text-gray-400 mb-1">Invite link</div>
                <div className="flex items-center gap-2">
                  <input value={inviteLink} readOnly className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600" />
                  <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="p-2 rounded-lg border border-gray-200 hover:bg-white">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-800">Discord daily summary</div>
            <div className="text-xs text-gray-400 mt-0.5">Sends review/task/patient summary to Discord</div>
          </div>
          <div className="p-4 space-y-3">
            <input
              value={summary.discord_webhook_url}
              onChange={e => setSummary(prev => ({ ...prev, discord_webhook_url: e.target.value }))}
              placeholder="Discord webhook URL"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={summary.daily_summary_enabled}
                  onChange={e => setSummary(prev => ({ ...prev, daily_summary_enabled: e.target.checked }))}
                />
                Enabled
              </label>
              <input
                type="time"
                value={summary.daily_summary_time}
                onChange={e => setSummary(prev => ({ ...prev, daily_summary_time: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveSummary}
                disabled={loading === 'summary'}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Save settings
              </button>
              <button
                onClick={sendSummary}
                disabled={loading === 'send'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading === 'send' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Send test
              </button>
            </div>
            {status && <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{status}</div>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-800">Gmail OAuth email sender</div>
          <div className="text-xs text-gray-400 mt-0.5">Connect Gmail to send OTP and dashboard emails without SMTP passwords</div>
        </div>
        <div className="p-4 grid grid-cols-[1.2fr_1fr] gap-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={gmail.user}
                onChange={e => setGmail(prev => ({ ...prev, user: e.target.value }))}
                placeholder="Gmail address"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
              <input
                value={gmail.client_id}
                onChange={e => setGmail(prev => ({ ...prev, client_id: e.target.value }))}
                placeholder="Google OAuth Client ID"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
            </div>
            <input
              value={gmailClientSecret}
              onChange={e => setGmailClientSecret(e.target.value)}
              placeholder={gmail.has_client_secret ? 'Client secret saved - enter only to replace' : 'Google OAuth Client Secret'}
              type="password"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={gmail.enabled}
                onChange={e => setGmail(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Use Gmail OAuth for app emails
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={saveGmail}
                disabled={loading === 'gmail'}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Save Gmail settings
              </button>
              <button
                onClick={connectGmail}
                disabled={loading === 'gmail-connect'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading === 'gmail-connect' ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                Connect Gmail
              </button>
              <button
                onClick={sendEmailTest}
                disabled={loading === 'gmail-test'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 disabled:opacity-50"
              >
                {loading === 'gmail-test' ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                Send test email
              </button>
            </div>
            <div className={`text-xs border rounded-lg px-3 py-2 ${
              gmail.connected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {gmail.connected ? `Connected as ${gmail.user}` : 'Not connected yet. Save credentials, then connect Gmail.'}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-2">
            <div className="font-semibold text-gray-700">Google Cloud setup</div>
            <div>1. Create an OAuth Client ID for a Web application.</div>
            <div>2. Add this authorized redirect URI:</div>
            <input
              readOnly
              value={gmail.redirect_uri}
              className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-mono text-gray-600"
            />
            <div>3. Save the client ID and secret here.</div>
            <div>4. Click Connect Gmail and approve the Gmail permission.</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-800">Google Business Profile OAuth</div>
          <div className="text-xs text-gray-400 mt-0.5">Connect the Google account that manages client locations to sync all reviews</div>
        </div>
        <div className="p-4 grid grid-cols-[1.2fr_1fr] gap-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={gbp.user}
                onChange={e => setGbp(prev => ({ ...prev, user: e.target.value }))}
                placeholder="GBP manager Google account"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
              <input
                value={gbp.client_id}
                onChange={e => setGbp(prev => ({ ...prev, client_id: e.target.value }))}
                placeholder="Google OAuth Client ID"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
            </div>
            <input
              value={gbpClientSecret}
              onChange={e => setGbpClientSecret(e.target.value)}
              placeholder={gbp.has_client_secret ? 'Client secret saved - enter only to replace' : 'Google OAuth Client Secret'}
              type="password"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={gbp.enabled}
                onChange={e => setGbp(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Use Business Profile API for review sync
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={saveGbp}
                disabled={loading === 'gbp'}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Save GBP settings
              </button>
              <button
                onClick={connectGbp}
                disabled={loading === 'gbp-connect'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading === 'gbp-connect' ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                Connect GBP
              </button>
            </div>
            <div className={`text-xs border rounded-lg px-3 py-2 ${
              gbp.connected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {gbp.connected ? `Connected as ${gbp.user}` : 'Not connected. Sync GBP will use the five-review Places fallback.'}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-2">
            <div className="font-semibold text-gray-700">Google Cloud setup</div>
            <div>1. Request access to the Google Business Profile APIs.</div>
            <div>2. Enable Account Management, Business Information, and Google My Business APIs.</div>
            <div>3. Add this authorized redirect URI:</div>
            <input
              readOnly
              value={gbp.redirect_uri}
              className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-mono text-gray-600"
            />
            <div>4. Save the OAuth client credentials, then connect the manager account.</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-800">Users</div>
          <div className="divide-y divide-gray-50">
            {users.map(user => (
              <div key={user.id} className="grid grid-cols-[1.4fr_0.8fr_0.8fr] gap-3 px-4 py-3 items-center">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                  <div className="text-xs text-gray-400 truncate">{user.email}</div>
                </div>
                <select
                  value={user.role}
                  disabled={user.id === initialData.current_user_id || loading === `user-${user.id}`}
                  onChange={e => updateUser(user.id, e.target.value, user.status)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </select>
                <select
                  value={user.status}
                  disabled={user.id === initialData.current_user_id || loading === `user-${user.id}`}
                  onChange={e => updateUser(user.id, user.role, e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-800">Recent invites</div>
          <div className="divide-y divide-gray-50">
            {invites.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No invites yet</div>
            ) : invites.map(invite => (
              <div key={invite.id} className="grid grid-cols-[1.4fr_0.6fr_1fr] gap-3 px-4 py-3 items-center">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{invite.email}</div>
                  <div className="text-xs text-gray-400">Expires {new Date(invite.expires_at).toLocaleString()}</div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-gray-100 text-gray-600 w-fit">{invite.role}</span>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono w-fit ${
                    invite.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>{invite.status}</span>
                  {invite.status === 'pending' && (
                    <button
                      onClick={() => revokeInvite(invite.id)}
                      disabled={loading === `invite-${invite.id}`}
                      className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
