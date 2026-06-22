'use client'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Download, Eye, RefreshCw, Upload, Users, CalendarClock, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react'
import ImportPatientListModal from './ImportPatientListModal'
import { clientGroupKey, sharedClientGroupName } from '@/lib/client-group'

interface PatientListRow {
  id: string
  client_id: string
  client_name: string
  sheet_link: string
  name_column: string | null
  email_column: string | null
  total_patients: number
  new_patients: number
  last_campaign_ran: string | null
  last_imported_at: string | null
  last_fetched_at: string | null
}

interface ClientOption {
  id: string
  name: string
}

interface Props {
  initialLists: PatientListRow[]
  initialAvailableClients: ClientOption[]
  role: string
}

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleDateString()
}

export default function PatientListsView({ initialLists, initialAvailableClients, role }: Props) {
  const canDelete = role === 'super_admin'
  const [lists, setLists] = useState(initialLists)
  const [availableClients, setAvailableClients] = useState(initialAvailableClients)
  const [showImport, setShowImport] = useState(false)
  const [mappingList, setMappingList] = useState<PatientListRow | null>(null)
  const [refetching, setRefetching] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const res = await fetch('/api/patient-lists')
    const data = await res.json()
    if (data.success) {
      setLists(data.data)
      setAvailableClients(data.available_clients)
    }
  }, [])

  function handleImported() {
    setShowImport(false)
    setMappingList(null)
    refresh()
  }

  async function handleRefetch(id: string) {
    setRefetching(id)
    setMessage(null)

    try {
      const res = await fetch(`/api/patient-lists/${id}/refetch`, { method: 'POST' })
      const data = await res.json()
      setMessage({ id, ok: data.success, text: data.message || data.error || 'Done' })
      if (data.success) await refresh()
      if (!data.success && data.needs_mapping) {
        const list = lists.find(item => item.id === id)
        if (list) setMappingList(list)
      }
    } catch {
      setMessage({ id, ok: false, text: 'Refetch failed' })
    }

    setRefetching(null)
    setTimeout(() => setMessage(null), 3500)
  }

  async function handleDelete(list: PatientListRow) {
    if (!window.confirm(`Delete the patient list for ${list.client_name}? This will also remove imported patients for this list.`)) return

    setDeleting(list.id)
    setMessage(null)

    try {
      const res = await fetch(`/api/patient-lists/${list.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Delete failed')
      await refresh()
    } catch (e: any) {
      setMessage({ id: list.id, ok: false, text: e.message || 'Delete failed' })
    }

    setDeleting(null)
  }

  const totalPatients = lists.reduce((sum, list) => sum + Number(list.total_patients || 0), 0)
  const newPatients = lists.reduce((sum, list) => sum + Number(list.new_patients || 0), 0)
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()
  const groupMap = new Map<string, { key: string; name: string; lists: PatientListRow[] }>()
  const knownClientNames = lists.map(list => list.client_name)

  lists
    .filter(list => list.client_name.toLocaleLowerCase().includes(normalizedSearch))
    .forEach(list => {
      const name = sharedClientGroupName(list.client_name, knownClientNames)
      const key = clientGroupKey(name)
      const group = groupMap.get(key)
      if (group) group.lists.push(list)
      else groupMap.set(key, { key, name, lists: [list] })
    })

  const displayListGroups = Array.from(groupMap.values())
    .map(group => ({
      ...group,
      lists: group.lists.sort((a, b) => a.client_name.localeCompare(b.client_name, undefined, { sensitivity: 'base' })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  function toggleGroup(key: string) {
    setExpandedGroups(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 p-5 pb-0">
        {[
          { label: 'Connected lists', value: lists.length, icon: Users, bg: 'bg-indigo-50', ic: 'text-indigo-600', bar: 'bg-indigo-500', pct: 100 },
          { label: 'Total patients', value: totalPatients, icon: Users, bg: 'bg-blue-50', ic: 'text-blue-600', bar: 'bg-blue-500', pct: 80 },
          { label: 'New patients', value: newPatients, icon: CalendarClock, bg: 'bg-green-50', ic: 'text-green-600', bar: 'bg-green-500', pct: totalPatients ? Math.round((newPatients / totalPatients) * 100) : 0, vc: 'text-green-600' },
        ].map(metric => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${metric.bg}`}>
                <Icon size={17} className={metric.ic} />
              </div>
              <div className={`text-2xl font-bold font-mono tracking-tight ${metric.vc || 'text-gray-900'}`}>{metric.value}</div>
              <div className="text-[11px] text-gray-400 font-medium mt-1">{metric.label}</div>
              <div className="mt-2.5 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${metric.bar}`} style={{ width: `${metric.pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mx-5 mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-800">
            Client patient lists
            <span className="ml-2 text-[11px] font-normal text-gray-400">{lists.length} connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search client name"
                aria-label="Search patient lists by client name"
                className="w-full h-8 pl-8 pr-3 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
              />
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-all"
            >
              <Upload size={12} /> Import client patient list
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1.5fr_1.8fr_0.9fr_0.9fr_1fr_1.7fr] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <span>Client name</span>
          <span>Client&apos;s sheet link</span>
          <span>Total patients</span>
          <span>New patients</span>
          <span>Last campaign ran</span>
          <span>Action</span>
        </div>

        <div className="divide-y divide-gray-50">
          {displayListGroups.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users size={20} className="text-gray-300" />
              </div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                {lists.length === 0 ? 'No patient lists yet' : 'No matching clients'}
              </div>
              <div className="text-xs text-gray-400">
                {lists.length === 0 ? 'Import a Google Sheet to connect one.' : 'Try a different client name'}
              </div>
            </div>
          ) : displayListGroups.map(group => {
            const expanded = Boolean(normalizedSearch) || expandedGroups.has(group.key)
            const groupPatients = group.lists.reduce((sum, list) => sum + Number(list.total_patients || 0), 0)
            const groupNewPatients = group.lists.reduce((sum, list) => sum + Number(list.new_patients || 0), 0)

            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={expanded}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50/80 hover:bg-gray-100 border-b border-gray-100 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {expanded ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                    <span className="text-xs font-semibold text-gray-800 truncate">{group.name}</span>
                  </span>
                  <span className="text-[10px] font-medium text-gray-400">
                    {group.lists.length} {group.lists.length === 1 ? 'list' : 'lists'} · {groupPatients} patients
                    {groupNewPatients > 0 ? ` · ${groupNewPatients} new` : ''}
                  </span>
                </button>

                {expanded && <div className="divide-y divide-gray-50">
                  {group.lists.map(list => {
            const isRefetching = refetching === list.id
            const isDeleting = deleting === list.id
            const rowMessage = message?.id === list.id ? message : null

            return (
              <div
                key={list.id}
                className="grid grid-cols-[1.5fr_1.8fr_0.9fr_0.9fr_1fr_1.7fr] gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors items-center"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{list.client_name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Fetched {formatDate(list.last_fetched_at)}</div>
                </div>

                <a
                  href={list.sheet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 truncate"
                  title={list.sheet_link}
                >
                  {list.sheet_link}
                </a>

                <div className="text-xs font-mono text-gray-700">{list.total_patients}</div>

                <div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    list.new_patients > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {list.new_patients}
                  </span>
                </div>

                <div className="text-[11px] text-gray-400 font-mono">{formatDate(list.last_campaign_ran)}</div>

                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/patient-lists/${list.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      <Eye size={11} /> View
                    </Link>
                    {list.new_patients > 0 ? (
                      <a
                        href={`/api/patient-lists/${list.id}/export`}
                        onClick={() => setTimeout(() => refresh(), 1500)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-[11px] font-medium hover:bg-green-100 transition-all"
                      >
                        <Download size={11} /> Export new
                      </a>
                    ) : (
                      <span
                        title="No new patients to export"
                        aria-disabled="true"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-300 text-[11px] font-medium cursor-not-allowed"
                      >
                        <Download size={11} /> Export new
                      </span>
                    )}
                    {canDelete && <button
                      onClick={() => handleRefetch(list.id)}
                      disabled={isRefetching}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-medium hover:bg-indigo-100 disabled:opacity-50 transition-all"
                    >
                      <RefreshCw size={11} className={isRefetching ? 'animate-spin' : ''} />
                      Refetch
                    </button>}
                    <button
                      onClick={() => handleDelete(list)}
                      disabled={isDeleting}
                      title="Delete patient list"
                      aria-label={`Delete patient list for ${list.client_name}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {rowMessage && (
                    <span className={`text-[10px] font-medium ${rowMessage.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {rowMessage.text}
                    </span>
                  )}
                </div>
              </div>
            )
                  })}
                </div>}
              </div>
            )
          })}
        </div>
      </div>

      {showImport && (
        <ImportPatientListModal
          clients={availableClients}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

      {mappingList && (
        <ImportPatientListModal
          clients={[]}
          existingList={mappingList}
          onClose={() => setMappingList(null)}
          onImported={handleImported}
        />
      )}
    </>
  )
}
