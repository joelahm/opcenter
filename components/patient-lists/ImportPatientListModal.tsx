'use client'
import { useState } from 'react'
import { X, Link2, Loader2, Users, Table2 } from 'lucide-react'

interface ClientOption {
  id: string
  name: string
}

interface Props {
  clients: ClientOption[]
  onClose: () => void
  onImported: () => void
  existingList?: {
    id: string
    client_name: string
    sheet_link: string
    name_column: string | null
    email_column: string | null
  } | null
}

interface SheetPreview {
  headers: string[]
  rows: string[][]
  totalRows: number
}

function guessColumn(headers: string[], candidates: string[]) {
  const normalized = headers.map(header => header.trim().toLowerCase())
  const index = normalized.findIndex(header => candidates.includes(header))
  return index === -1 ? '' : headers[index]
}

export default function ImportPatientListModal({ clients, onClose, onImported, existingList }: Props) {
  const editing = Boolean(existingList)
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [sheetLink, setSheetLink] = useState(existingList?.sheet_link || '')
  const [preview, setPreview] = useState<SheetPreview | null>(null)
  const [mapping, setMapping] = useState({
    name:  existingList?.name_column || '',
    email: existingList?.email_column || '',
  })
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const invalidMapping = Boolean(mapping.name && mapping.email && mapping.name === mapping.email)

  function resetPreview(nextLink: string) {
    setSheetLink(nextLink)
    setPreview(null)
    setMapping({ name: '', email: '' })
    setError('')
  }

  async function handlePreview() {
    setPreviewing(true)
    setError('')

    try {
      const res = await fetch('/api/patient-lists/preview', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sheet_link: sheetLink }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Preview failed')

      const headers = data.headers || []
      setPreview({
        headers,
        rows:      data.rows || [],
        totalRows: data.totalRows || 0,
      })
      setMapping({
        name:  headers.includes(mapping.name) ? mapping.name : guessColumn(headers, ['name', 'patient name', 'full name']),
        email: headers.includes(mapping.email) ? mapping.email : guessColumn(headers, ['email', 'email address', 'e-mail']),
      })
    } catch (e: any) {
      setPreview(null)
      setMapping({ name: '', email: '' })
      setError(e.message || 'Preview failed')
    }

    setPreviewing(false)
  }

  async function handleImport() {
    setSaving(true)
    setError('')

    try {
      const res = await fetch(editing ? `/api/patient-lists/${existingList?.id}` : '/api/patient-lists', {
        method:  editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId, sheet_link: sheetLink, mapping }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Import failed')
      onImported()
    } catch (e: any) {
      setError(e.message || 'Import failed')
    }

    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-gray-900">{editing ? 'Update patient list mapping' : 'Import patient list'}</div>
            <div className="text-xs text-gray-400 mt-0.5">{editing ? 'Map columns and refetch this sheet' : 'Connect a client to a Google Sheet'}</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {!editing && clients.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users size={20} className="text-gray-300" />
              </div>
              <div className="text-sm font-medium text-gray-500">All clients are connected</div>
              <div className="text-xs text-gray-400 mt-1">Every client already has a patient list.</div>
            </div>
          ) : (
            <>
              {editing ? (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Client
                  </label>
                  <div className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 bg-gray-50">
                    {existingList?.client_name}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Client
                  </label>
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  >
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Google Sheet link
                </label>
                <div className="relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={sheetLink}
                    onChange={e => resetPreview(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                </div>
                <div className="text-[11px] text-gray-400 mt-1.5">
                  The first row should contain column headers. You can map the name and email columns before importing.
                </div>
              </div>

              <button
                onClick={handlePreview}
                disabled={!sheetLink.trim() || previewing || saving}
                className="w-full py-2.5 border border-indigo-200 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {previewing ? <><Loader2 size={13} className="animate-spin" /> Loading sheet...</> : <><Table2 size={13} /> Preview and map columns</>}
              </button>

              {preview && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">Column mapping</div>
                      <div className="text-[11px] text-gray-400">{preview.totalRows} data row{preview.totalRows === 1 ? '' : 's'} found</div>
                    </div>
                  </div>

                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Patient name column
                      </label>
                      <select
                        value={mapping.name}
                        onChange={e => setMapping(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
                      >
                        <option value="">Select column</option>
                        {preview.headers.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Email column
                      </label>
                      <select
                        value={mapping.email}
                        onChange={e => setMapping(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
                      >
                        <option value="">Select column</option>
                        {preview.headers.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {invalidMapping && (
                    <div className="mx-3 mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      Name and email must use different columns.
                    </div>
                  )}

                  <div className="overflow-x-auto border-t border-gray-100">
                    <div
                      className="grid min-w-max text-[11px] font-semibold text-gray-500 bg-gray-50"
                      style={{ gridTemplateColumns: `repeat(${preview.headers.length}, minmax(120px, 1fr))` }}
                    >
                      {preview.headers.map(header => (
                        <div key={header} className="px-3 py-2 border-r border-gray-100 last:border-r-0 truncate">{header}</div>
                      ))}
                    </div>
                    {preview.rows.map((row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid min-w-max text-xs text-gray-600 border-t border-gray-50"
                        style={{ gridTemplateColumns: `repeat(${preview.headers.length}, minmax(120px, 1fr))` }}
                      >
                        {preview.headers.map((header, colIndex) => (
                          <div key={`${rowIndex}-${header}`} className="px-3 py-2 border-r border-gray-50 last:border-r-0 truncate">
                            {row[colIndex] || '-'}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={(!editing && !clientId) || !sheetLink.trim() || !preview || !mapping.name || !mapping.email || invalidMapping || saving || (!editing && clients.length === 0)}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> {editing ? 'Updating...' : 'Importing...'}</>
              : editing ? 'Update mapping' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
