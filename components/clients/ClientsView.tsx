'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Upload, UserPlus, Link2, Eye, Users,
  RefreshCw, CheckCircle, XCircle, Star, MessageCircle, Clock, Wifi, WifiOff,
  Trash2, X, MapPin, Phone, Globe, Loader2, ExternalLink, Search, AlertCircle
} from 'lucide-react'
import AddClientModal from './AddClientModal'
import ImportModal    from './ImportModal'
import { countUniqueClients, sharedClientGroupName } from '@/lib/client-group'

interface Client {
  id: string
  name: string
  address: string
  phone: string
  website: string
  gbp_id: string
  status: string
  gbp_connected: boolean
  gbp_rating?: number | null
  gbp_review_count?: number | null
  gbp_new_review_count?: number | null
  patient_list_id?: string | null
  last_synced: string | null
  total_reviews: number
  avg_rating: number
  replied_count: number
  unreplied_count: number
}

interface ClientDetails extends Client {
  reviews: {
    id: string
    reviewer: string | null
    stars: number
    reviewText: string | null
    sentiment: string
    replied: boolean
    reviewDate: string | null
  }[]
}

interface SyncResult {
  clientName: string
  source: 'google_business_profile' | 'places_fallback'
  warning: string | null
  new_review_count: number
  fetched_review_count: number
  previous_review_count: number
  total_review_count: number
  review_count_change: number
  new_reviews: {
    reviewer: string
    stars: number
    text: string | null
    review_date: string
  }[]
}

interface Props {
  initialClients: Client[]
  role: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Never'
  return new Date(value).toLocaleDateString()
}

function displayGbpReviewCount(client: Client) {
  if (client.gbp_connected && client.gbp_review_count != null) {
    return Number(client.gbp_review_count) || 0
  }
  return Number(client.total_reviews) || 0
}

export default function ClientsView({ initialClients, role }: Props) {
  const canManage = role === 'super_admin' || role === 'admin'
  const canDelete = role === 'super_admin'
  const [clients, setClients]       = useState<Client[]>(initialClients)
  const [showAdd, setShowAdd]       = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [linkClient, setLinkClient] = useState<Client | null>(null)
  const [details, setDetails]       = useState<ClientDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [syncing, setSyncing]       = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [syncMsg, setSyncMsg]       = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [missingPatientListClient, setMissingPatientListClient] = useState<Client | null>(null)

  const refresh = useCallback(async () => {
    const res  = await fetch('/api/clients')
    const data = await res.json()
    if (data.success) setClients(data.data)
  }, [])

  function handleAdded() {
    setShowAdd(false)
    refresh()
  }

  function handleImported() {
    setShowImport(false)
    refresh()
  }

  function handleLinked() {
    setLinkClient(null)
    refresh()
  }

  async function handleGbpAction(client: Client) {
    if (!client.gbp_connected) {
      setLinkClient(client)
      return
    }
    setSyncing(client.id)
    setSyncMsg(null)
    try {
      const res  = await fetch(`/api/clients/${client.id}/sync`, { method: 'POST' })
      const data = await res.json()
      setSyncMsg({ id: client.id, ok: data.success, text: data.message || data.error || 'Done' })
      if (data.success) {
        setSyncResult({
          clientName: client.name,
          source: data.source,
          warning: data.warning || null,
          new_review_count: data.new_review_count || 0,
          fetched_review_count: data.fetched_review_count || 0,
          previous_review_count: data.previous_review_count || 0,
          total_review_count: data.total_review_count || 0,
          review_count_change: data.review_count_change || 0,
          new_reviews: data.new_reviews || [],
        })
        await refresh()
      }
    } catch {
      setSyncMsg({ id: client.id, ok: false, text: 'Sync failed' })
    }
    setSyncing(null)
    setTimeout(() => setSyncMsg(null), 3000)
  }

  async function openDetails(client: Client) {
    setDetails(null)
    setLoadingDetails(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to load client details')
      setDetails(data.client)
    } catch {
      setSyncMsg({ id: client.id, ok: false, text: 'Failed to load details' })
    }
    setLoadingDetails(false)
  }

  async function handleDelete(client: Client) {
    if (!window.confirm(`Delete ${client.name}? This will remove the client and disconnect related records.`)) return

    setDeleting(client.id)
    setSyncMsg(null)
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Delete failed')
      if (details?.id === client.id) setDetails(null)
      await refresh()
    } catch (e: any) {
      setSyncMsg({ id: client.id, ok: false, text: e.message || 'Delete failed' })
    }
    setDeleting(null)
  }

  const connected   = clients.filter(c => c.gbp_connected).length
  const needsAtt    = clients.filter(c => c.status === 'needs_attention').length
  const totalReviews = clients.reduce((sum, client) => sum + displayGbpReviewCount(client), 0)
  const uniqueClientCount = countUniqueClients(clients.map(client => client.name))
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()
  const knownClientNames = clients.map(client => client.name)
  const displayClients = clients
    .filter(client => client.name.toLocaleLowerCase().includes(normalizedSearch))
    .sort((a, b) => {
      const groupComparison = sharedClientGroupName(a.name, knownClientNames).localeCompare(
        sharedClientGroupName(b.name, knownClientNames),
        undefined,
        { sensitivity: 'base' }
      )
      return groupComparison
        || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        || (a.address || '').localeCompare(b.address || '', undefined, { sensitivity: 'base' })
    })

  return (
    <>
      {/* ── Metric strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 p-5 pb-0">
        {[
          { label: 'Total clients',    value: uniqueClientCount, icon: UserPlus,   bg: 'bg-indigo-50', ic: 'text-indigo-600', bar: 'bg-indigo-500', pct: 100 },
          { label: 'GBP connected',    value: connected,      icon: Wifi,          bg: 'bg-green-50',  ic: 'text-green-600',  bar: 'bg-green-500',  pct: clients.length ? Math.round((connected/clients.length)*100) : 0, vc: 'text-green-600' },
          { label: 'Needs attention',  value: needsAtt,       icon: Clock,         bg: 'bg-red-50',    ic: 'text-red-600',    bar: 'bg-red-500',    pct: clients.length ? Math.round((needsAtt/clients.length)*100) : 0, vc: needsAtt ? 'text-red-600' : undefined },
          { label: 'Total reviews',    value: totalReviews,   icon: MessageCircle, bg: 'bg-blue-50',   ic: 'text-blue-600',   bar: 'bg-blue-500',   pct: 70 },
        ].map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${m.bg}`}>
                <Icon size={17} className={m.ic} />
              </div>
              <div className={`text-2xl font-bold font-mono tracking-tight ${m.vc || 'text-gray-900'}`}>{m.value}</div>
              <div className="text-[11px] text-gray-400 font-medium mt-1">{m.label}</div>
              <div className="mt-2.5 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${m.pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Table card ─────────────────────────────────────────────── */}
      <div className="mx-5 mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-800">
            All clients
            <span className="ml-2 text-[11px] font-normal text-gray-400">{clients.length} locations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search client name"
                aria-label="Search clients by name"
                className="w-full h-8 pl-8 pr-3 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
            </div>
          {canManage && <>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all"
            >
              <Upload size={12} /> Import CSV
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-all"
            >
              <UserPlus size={12} /> Add client
            </button>
          </>}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_0.9fr_0.7fr_0.8fr_0.7fr_0.9fr_1.4fr] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <span>Client</span>
          <span>Patient lists</span>
          <span>GBP Status</span>
          <span>Total reviews</span>
          <span>New reviews</span>
          <span>Rating</span>
          <span>Last synced</span>
          <span>Actions</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {displayClients.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <UserPlus size={20} className="text-gray-300" />
              </div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                {clients.length === 0 ? 'No clients yet' : 'No matching clients'}
              </div>
              <div className="text-xs text-gray-400">
                {clients.length === 0 ? 'Add one manually or import a CSV' : 'Try a different client name'}
              </div>
            </div>
          ) : displayClients.map(c => {
            const total     = displayGbpReviewCount(c)
            const rating    = Number(c.gbp_rating ?? c.avg_rating ?? 0).toFixed(1)
            const isSyncing = syncing === c.id
            const isDeleting = deleting === c.id
            const msg       = syncMsg?.id === c.id ? syncMsg : null

            return (
              <div
                key={c.id}
                className="grid grid-cols-[2fr_1fr_0.9fr_0.7fr_0.8fr_0.7fr_0.9fr_1.4fr] gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors items-center"
              >
                {/* Name + address */}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                  {c.address && (
                    <div className="text-[11px] text-gray-400 truncate mt-0.5">{c.address}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
                      c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {c.status === 'active' ? 'Active' : 'Needs attention'}
                    </span>
                  </div>
                </div>

                {/* Patient lists */}
                <div>
                  {canManage ? (
                    c.patient_list_id ? (
                      <Link
                        href={`/patient-lists/${c.patient_list_id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-medium hover:bg-blue-100 transition-all"
                      >
                        <Users size={11} /> List
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMissingPatientListClient(c)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500 text-[11px] font-medium hover:bg-gray-100 transition-all"
                      >
                        <Users size={11} /> List
                      </button>
                    )
                  ) : <span className="text-[11px] text-gray-300">Restricted</span>}
                </div>

                {/* GBP status */}
                <div>
                  {c.gbp_connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono bg-green-100 text-green-700">
                      <Wifi size={9} /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono bg-gray-100 text-gray-500">
                      <WifiOff size={9} /> Not linked
                    </span>
                  )}
                </div>

                {/* Reviews */}
                <div className="text-xs font-mono text-gray-700">
                  {total}
                </div>

                {/* New reviews from the most recent sync */}
                <div className={`text-xs font-mono ${Number(c.gbp_new_review_count || 0) > 0 ? 'font-semibold text-green-600' : 'text-gray-400'}`}>
                  {Number(c.gbp_new_review_count || 0)}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1">
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-mono text-gray-700">{rating}</span>
                </div>

                {/* Last synced */}
                <div className="text-[11px] text-gray-400 font-mono">
                  {c.last_synced
                    ? new Date(c.last_synced).toLocaleDateString()
                    : <span className="text-gray-300">Never</span>
                  }
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage && <button
                      onClick={() => handleGbpAction(c)}
                      disabled={isSyncing}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        c.gbp_connected
                          ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      } disabled:opacity-50`}
                      title={c.gbp_connected ? 'Sync linked GBP reviews' : 'Link GBP account'}
                    >
                      {c.gbp_connected ? (
                        <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                      ) : (
                        <Link2 size={11} />
                      )}
                      {c.gbp_connected ? (isSyncing ? 'Syncing' : 'Sync GBP') : 'Link GBP'}
                    </button>}
                    {canDelete && <button
                      onClick={() => openDetails(c)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      <Eye size={11} />
                      View
                    </button>}
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={isDeleting}
                      title="Delete client"
                      aria-label={`Delete ${c.name}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {msg && (
                    <span className={`text-[10px] font-medium flex items-center gap-1 ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {msg.ok ? <CheckCircle size={9} /> : <XCircle size={9} />}
                      {msg.text}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {showAdd    && <AddClientModal onClose={() => setShowAdd(false)}    onAdded={handleAdded} />}
      {showImport && <ImportModal    onClose={() => setShowImport(false)}  onImported={handleImported} />}
      {linkClient && (
        <AddClientModal
          mode="link"
          client={linkClient}
          onClose={() => setLinkClient(null)}
          onLinked={handleLinked}
        />
      )}

      {missingPatientListClient && (
        <div
          className="fixed inset-0 z-[60] bg-black/35 flex items-center justify-center p-4"
          onClick={() => setMissingPatientListClient(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 p-5">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
                <AlertCircle size={17} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">No patient list</div>
                <div className="text-xs text-gray-500 leading-relaxed mt-1">
                  No patient list is configured or added for {missingPatientListClient.name}.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setMissingPatientListClient(null)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <Link
                href="/patient-lists"
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
              >
                Add patient list
              </Link>
            </div>
          </div>
        </div>
      )}

      {(loadingDetails || details) && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={() => { setDetails(null); setLoadingDetails(false) }}>
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-900">GBP details</div>
                <div className="text-xs text-gray-400 mt-0.5">Synced Google Business Profile data</div>
              </div>
              <button
                onClick={() => { setDetails(null); setLoadingDetails(false) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin mr-2" /> Loading details
              </div>
            ) : details && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-gray-900">{details.name}</div>
                      <div className="text-[11px] text-gray-400 mt-1">Place ID: {details.gbp_id || 'Not linked'}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                      details.gbp_connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {details.gbp_connected ? 'Connected' : 'Not linked'}
                    </span>
                  </div>

                  {details.address && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <span>{details.address}</span>
                    </div>
                  )}
                  {details.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Phone size={13} className="text-gray-400 flex-shrink-0" />
                      <span>{details.phone}</span>
                    </div>
                  )}
                  {details.website && (
                    <a
                      href={details.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Globe size={13} className="flex-shrink-0" />
                      <span className="truncate">{details.website}</span>
                    </a>
                  )}
                  {details.gbp_id && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(details.gbp_id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <ExternalLink size={13} className="flex-shrink-0" />
                      Open GBP on Google
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="border border-gray-200 rounded-xl p-3">
                    <Star size={14} className="text-amber-400 fill-amber-400 mb-2" />
                    <div className="text-lg font-bold font-mono text-gray-900">{Number(details.gbp_rating ?? details.avg_rating ?? 0).toFixed(1)}</div>
                    <div className="text-[10px] text-gray-400">GBP rating</div>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3">
                    <MessageCircle size={14} className="text-blue-500 mb-2" />
                    <div className="text-lg font-bold font-mono text-gray-900">{displayGbpReviewCount(details)}</div>
                    <div className="text-[10px] text-gray-400">GBP reviews</div>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3">
                    <Clock size={14} className="text-gray-400 mb-2" />
                    <div className="text-xs font-mono text-gray-700">{formatDate(details.last_synced)}</div>
                    <div className="text-[10px] text-gray-400">Last sync</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-700">Latest synced reviews</div>
                    <span className="text-[10px] text-gray-400">{details.total_reviews} stored</span>
                  </div>
                  <div className="space-y-2">
                    {details.reviews.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-400 border border-gray-100 rounded-xl">
                        No reviews synced yet.
                      </div>
                    ) : details.reviews.map(review => (
                      <div key={review.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-xs font-semibold text-gray-800 truncate">{review.reviewer || 'Google user'}</div>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star
                                key={idx}
                                size={10}
                                className={idx < review.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                              />
                            ))}
                          </div>
                        </div>
                        {review.reviewText && (
                          <div className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap break-words">{review.reviewText}</div>
                        )}
                        <div className="text-[10px] text-gray-300 mt-2">{formatDate(review.reviewDate)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {syncResult && (
        <div className="fixed inset-0 z-[60] bg-black/35 flex items-center justify-center p-4" onClick={() => setSyncResult(null)}>
          <div
            className="bg-white w-full max-w-lg max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-900">Review sync complete</div>
                <div className="text-xs text-gray-400 mt-0.5">{syncResult.clientName}</div>
              </div>
              <button
                onClick={() => setSyncResult(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-lg font-bold font-mono text-gray-900">{syncResult.new_review_count}</div>
                  <div className="text-[10px] text-gray-400">New reviews</div>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-lg font-bold font-mono text-gray-900">{syncResult.total_review_count}</div>
                  <div className="text-[10px] text-gray-400">Total GBP</div>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-lg font-bold font-mono text-gray-900">{syncResult.fetched_review_count}</div>
                  <div className="text-[10px] text-gray-400">Details fetched</div>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className={`text-xs font-semibold mt-1 ${
                    syncResult.source === 'google_business_profile' ? 'text-green-700' : 'text-amber-700'
                  }`}>
                    {syncResult.source === 'google_business_profile' ? 'GBP API' : 'Fallback'}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Source</div>
                </div>
              </div>

              {syncResult.warning && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {syncResult.warning}
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  New review details
                  {syncResult.new_review_count > 0 && (
                    <span className="ml-1 font-normal text-gray-400">
                      ({syncResult.new_reviews.length} of {syncResult.new_review_count} available)
                    </span>
                  )}
                </div>
                {syncResult.new_reviews.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 border border-gray-100 rounded-lg">
                    {syncResult.new_review_count > 0
                      ? `Google reports ${syncResult.new_review_count} new review${syncResult.new_review_count === 1 ? '' : 's'}, but review details were not available from this sync.`
                      : 'No new reviews since the previous sync.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {syncResult.new_reviews.map((review, index) => (
                      <div key={`${review.reviewer}-${review.review_date}-${index}`} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold text-gray-800 truncate">{review.reviewer}</div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <Star
                                key={starIndex}
                                size={10}
                                className={starIndex < review.stars ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                              />
                            ))}
                          </div>
                        </div>
                        {review.text && <div className="text-xs text-gray-500 leading-relaxed mt-1.5">{review.text}</div>}
                        <div className="text-[10px] text-gray-300 mt-2">{new Date(review.review_date).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
