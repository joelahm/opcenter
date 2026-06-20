'use client'
import { useState, useRef, useCallback, DragEvent } from 'react'
import { X, Upload, ChevronRight, Check, AlertCircle, Loader2, FileText } from 'lucide-react'

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const cols: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else { cur += c }
    }
    cols.push(cur.trim())
    return cols
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
  return { headers, rows }
}

// ─── Target fields ────────────────────────────────────────────────────────────
const TARGET_FIELDS = [
  { key: 'name',    label: 'Business Name', required: true  },
  { key: 'address', label: 'Address',       required: false },
  { key: 'phone',   label: 'Phone',         required: false },
  { key: 'website', label: 'Website',       required: false },
  { key: 'gbp_id',  label: 'GBP / Place ID', required: false },
]

function autoDetect(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const lower = headers.map(h => h.toLowerCase())
  TARGET_FIELDS.forEach(({ key }) => {
    const synonyms: Record<string, string[]> = {
      name:    ['name', 'business', 'company', 'client'],
      address: ['address', 'addr', 'location', 'street'],
      phone:   ['phone', 'mobile', 'tel', 'contact'],
      website: ['website', 'web', 'url', 'site'],
      gbp_id:  ['gbp', 'place_id', 'placeid', 'gbp_id', 'google_id'],
    }
    const match = lower.findIndex(h => synonyms[key]?.some(s => h.includes(s)))
    if (match !== -1) map[key] = headers[match]
  })
  return map
}

type Step = 'upload' | 'map' | 'done'

interface Props {
  onClose: () => void
  onImported: () => void
}

export default function ImportModal({ onClose, onImported }: Props) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [step, setStep]       = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders]   = useState<string[]>([])
  const [rows, setRows]         = useState<Record<string, string>[]>([])
  const [mapping, setMapping]   = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError]       = useState('')

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file')
      return
    }
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      if (!h.length) { setError('Could not parse CSV — check the file format'); return }
      setHeaders(h)
      setRows(r)
      setMapping(autoDetect(h))
      setStep('map')
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  async function handleImport() {
    setError('')
    if (!mapping.name) { setError('You must map the Business Name column'); return }

    const mapped = rows.map(row => {
      const out: Record<string, string> = {}
      TARGET_FIELDS.forEach(({ key }) => {
        if (mapping[key]) out[key] = row[mapping[key]] || ''
      })
      return out
    })

    setImporting(true)
    try {
      const res  = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mapped }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setResult({ imported: data.imported, skipped: data.skipped })
      setStep('done')
    } catch (e: any) {
      setError(e.message || 'Import failed')
    }
    setImporting(false)
  }

  const preview = rows.slice(0, 3)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-gray-900">Import clients</div>
            <div className="text-xs text-gray-400 mt-0.5">Upload a CSV and map the columns</div>
          </div>
          <div className="flex items-center gap-3 mr-2">
            {(['upload', 'map', 'done'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  step === s ? 'bg-indigo-600 text-white' :
                  (['upload', 'map', 'done'].indexOf(step) > i) ? 'bg-green-500 text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {(['upload', 'map', 'done'].indexOf(step) > i) ? <Check size={10} /> : i + 1}
                </div>
                <span className="text-[11px] text-gray-500 capitalize hidden sm:inline">{s === 'done' ? 'complete' : s}</span>
                {i < 2 && <ChevronRight size={12} className="text-gray-300" />}
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Upload size={20} className="text-indigo-500" />
                </div>
                <div className="text-sm font-medium text-gray-700 mb-1">Drop your CSV here</div>
                <div className="text-xs text-gray-400">or click to browse · .csv files only</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
              />
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                <div className="text-xs font-semibold text-gray-600 mb-2">Expected columns (any order):</div>
                <div className="flex flex-wrap gap-1.5">
                  {TARGET_FIELDS.map(f => (
                    <span key={f.key} className={`text-[11px] font-mono px-2 py-0.5 rounded ${f.required ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.label}{f.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Column mapping ── */}
          {step === 'map' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                <FileText size={13} className="text-gray-400" />
                <span className="text-xs text-gray-700 font-medium">{fileName}</span>
                <span className="text-[11px] text-gray-400 ml-auto">{rows.length} rows detected</span>
              </div>

              {/* Mapping selectors */}
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-3">Map CSV columns to client fields</div>
                <div className="space-y-2">
                  {TARGET_FIELDS.map(f => (
                    <div key={f.key} className="flex items-center gap-3">
                      <div className="w-36 flex-shrink-0">
                        <span className={`text-[11px] font-medium ${f.required ? 'text-gray-900' : 'text-gray-500'}`}>
                          {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                        </span>
                      </div>
                      <select
                        value={mapping[f.key] || ''}
                        onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-indigo-400 transition-colors"
                      >
                        <option value="">— skip —</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      {mapping[f.key] && (
                        <Check size={13} className="text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {preview.length > 0 && mapping.name && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">Preview (first {preview.length} rows)</div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {TARGET_FIELDS.filter(f => mapping[f.key]).map(f => (
                            <th key={f.key} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {preview.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {TARGET_FIELDS.filter(f => mapping[f.key]).map(f => (
                              <td key={f.key} className="px-3 py-2 text-gray-700 truncate max-w-[150px]">
                                {row[mapping[f.key]] || <span className="text-gray-300">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && result && (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-green-600" />
              </div>
              <div className="text-base font-semibold text-gray-900 mb-1">Import complete</div>
              <div className="text-sm text-gray-500">
                <span className="font-bold text-green-600">{result.imported}</span> clients imported
                {result.skipped > 0 && (
                  <span className="text-gray-400"> · {result.skipped} skipped (duplicate or missing name)</span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2.5 flex-shrink-0">
          {step === 'done' ? (
            <button
              onClick={onImported}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              View clients
            </button>
          ) : (
            <>
              <button
                onClick={step === 'map' ? () => setStep('upload') : onClose}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {step === 'map' ? 'Back' : 'Cancel'}
              </button>
              {step === 'map' && (
                <button
                  onClick={handleImport}
                  disabled={!mapping.name || importing}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <><Loader2 size={13} className="animate-spin" /> Importing…</>
                  ) : `Import ${rows.length} clients`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
