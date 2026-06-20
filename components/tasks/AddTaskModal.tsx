'use client'
import { useState, useRef } from 'react'
import { X, Plus, Trash2, Paperclip, Loader2, CheckSquare } from 'lucide-react'

const MAX_FILE_SIZE = 25 * 1024 * 1024

interface ChecklistItem { id: string; text: string }
interface Client        { id: string; name: string }

interface Props {
  clients:  Client[]
  onClose:  () => void
  onAdded:  () => void
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼'
  if (ext === 'pdf')                                                return '📄'
  if (['doc', 'docx'].includes(ext))                               return '📝'
  if (['xls', 'xlsx'].includes(ext))                               return '📊'
  if (['zip', 'rar', '7z'].includes(ext))                          return '🗜'
  return '📎'
}

function formatSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AddTaskModal({ clients, onClose, onAdded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [clientId,    setClientId]    = useState('')
  const [checklist,   setChecklist]   = useState<ChecklistItem[]>([])
  const [files,       setFiles]       = useState<File[]>([])
  const [dragging,    setDragging]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  function addItem() {
    setChecklist(p => [...p, { id: crypto.randomUUID(), text: '' }])
  }

  function updateItem(id: string, text: string) {
    setChecklist(p => p.map(c => c.id === id ? { ...c, text } : c))
  }

  function removeItem(id: string) {
    setChecklist(p => p.filter(c => c.id !== id))
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list) return
    const nextFiles = Array.from(list)
    const oversized = nextFiles.find(file => file.size > MAX_FILE_SIZE)

    if (oversized) {
      setError(`${oversized.name} is larger than ${formatSize(MAX_FILE_SIZE)}.`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setError('')
    setFiles(p => [...p, ...nextFiles])
    // reset input so the same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles(p => p.filter((_, i) => i !== idx))
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required'); return }

    setSaving(true)
    setError('')

    const fd = new FormData()
    fd.append('title',       title.trim())
    fd.append('description', description.trim())
    if (clientId) fd.append('clientId', clientId)
    fd.append('checklist', JSON.stringify(checklist.filter(c => c.text.trim())))
    files.forEach(f => fd.append('files', f))

    try {
      const res  = await fetch('/api/tasks', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      onAdded()
    } catch (e: any) {
      setError(e.message || 'Failed to create task')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-gray-900">Add task</div>
            <div className="text-xs text-gray-400 mt-0.5">Tasks start in Backlog</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Client */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Client
            </label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
            >
              <option value="">No client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more context..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all resize-none"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare size={11} /> Checklist
                {checklist.length > 0 && (
                  <span className="font-mono text-gray-300">({checklist.length})</span>
                )}
              </label>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
              >
                <Plus size={11} /> Add item
              </button>
            </div>

            {checklist.length === 0 ? (
              <div className="border-2 border-dashed border-gray-100 rounded-xl py-4 text-center text-xs text-gray-300 cursor-pointer hover:border-indigo-100 hover:text-indigo-300 transition-colors" onClick={addItem}>
                Click &quot;Add item&quot; to build a checklist
              </div>
            ) : (
              <div className="space-y-2">
                {checklist.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded border-2 border-gray-200 flex-shrink-0" />
                    <input
                      type="text"
                      value={item.text}
                      onChange={e => updateItem(item.id, e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addItem()}
                      placeholder={`Item ${idx + 1}`}
                      autoFocus={idx === checklist.length - 1}
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-indigo-300 transition-colors"
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip size={11} /> Attachments
                {files.length > 0 && (
                  <span className="font-mono text-gray-300">({files.length})</span>
                )}
              </label>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
              >
                <Plus size={11} /> Attach files
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />

            {files.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragEnter={e => { e.preventDefault(); setDragging(true) }}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={e => { e.preventDefault(); setDragging(false) }}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl py-5 text-center cursor-pointer transition-colors group ${
                  dragging ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'
                }`}
              >
                <Paperclip size={16} className="text-gray-200 group-hover:text-indigo-300 mx-auto mb-1 transition-colors" />
                <div className="text-xs text-gray-300 group-hover:text-indigo-400 transition-colors">
                  Drop files or click to browse
                </div>
                <div className="text-[10px] text-gray-300 mt-1">
                  PDF, images, documents, spreadsheets, text or ZIP, up to {formatSize(MAX_FILE_SIZE)} each
                </div>
              </div>
            ) : (
              <div
                onDragEnter={e => { e.preventDefault(); setDragging(true) }}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={e => { e.preventDefault(); setDragging(false) }}
                onDrop={handleDrop}
                className={`space-y-1.5 rounded-xl transition-colors ${dragging ? 'bg-indigo-50 ring-2 ring-indigo-100' : ''}`}
              >
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="text-lg flex-shrink-0">{fileIcon(f.name)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{f.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{formatSize(f.size)}</div>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-1.5 text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-200 rounded-xl transition-colors"
                >
                  + Add more files
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2.5 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Creating…</>
              : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  )
}
