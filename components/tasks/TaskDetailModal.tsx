'use client'
import { useState } from 'react'
import { X, Paperclip, CheckSquare, Square, ExternalLink, User, Calendar, Tag } from 'lucide-react'

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  backlog:     { label: 'Backlog',     bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'  },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500'  },
  in_review:   { label: 'In Review',   bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500' },
  done:        { label: 'Done',        bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500' },
}

interface ChecklistItem { id: string; text: string; completed: boolean }
interface FileItem       { id: string; fileName: string; fileUrl?: string; fileSize?: number | null; mimeType?: string | null }

interface Task {
  id:          string
  title:       string
  description: string | null
  status:      string
  createdAt:   string | Date
  client:      { id: string; name: string } | null
  checklists:  ChecklistItem[]
  files:       FileItem[]
}

interface Props {
  task:    Task
  onClose: () => void
  onUpdated?: () => void
}

function fileIcon(name: string) {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼'
  if (ext === 'pdf')                                         return '📄'
  if (['doc','docx'].includes(ext))                          return '📝'
  if (['xls','xlsx'].includes(ext))                          return '📊'
  if (['zip','rar','7z'].includes(ext))                      return '🗜'
  return '📎'
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return ''
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TaskDetailModal({ task, onClose, onUpdated }: Props) {
  const meta      = STATUS_META[task.status] ?? STATUS_META.backlog
  const date      = new Date(task.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
  const [items,   setItems]   = useState<ChecklistItem[]>(task.checklists)
  const [toggling, setToggling] = useState<string | null>(null)

  const done  = items.filter(c => c.completed).length
  const total = items.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  async function toggleItem(item: ChecklistItem) {
    if (toggling) return
    setToggling(item.id)
    const next = !item.completed
    setItems(prev => prev.map(c => c.id === item.id ? { ...c, completed: next } : c))
    try {
      await fetch(`/api/tasks/checklist/${item.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ completed: next }),
      })
      onUpdated?.()
    } catch {
      // revert on error
      setItems(prev => prev.map(c => c.id === item.id ? { ...c, completed: item.completed } : c))
    } finally {
      setToggling(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900 leading-snug flex-1">{task.title}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 mt-0.5"
            >
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          {/* Meta pills */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Status */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>

            {/* Client */}
            {task.client && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700">
                <User size={10} />
                {task.client.name}
              </span>
            )}

            {/* Date */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-50 text-gray-500">
              <Calendar size={10} />
              {date}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Description */}
          {task.description ? (
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</div>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          ) : (
            <div className="text-sm text-gray-300 italic">No description added.</div>
          )}

          {/* Checklist */}
          {total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={10} /> Checklist
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-gray-400">{done}/{total}</span>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${done === total ? 'bg-green-400' : 'bg-indigo-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-gray-400">{pct}%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    disabled={toggling === item.id}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                      ${item.completed ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'}
                      ${toggling === item.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                    `}
                  >
                    {item.completed
                      ? <CheckSquare size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
                      : <Square      size={15} className="text-gray-300 flex-shrink-0 mt-0.5" />
                    }
                    <span className={`text-sm leading-snug ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {task.files.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Paperclip size={10} /> Attachments ({task.files.length})
              </div>
              <div className="space-y-1.5">
                {task.files.map(f => (
                  <a
                    key={f.id}
                    href={f.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 transition-all group"
                  >
                    <span className="text-lg flex-shrink-0">{fileIcon(f.fileName)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate group-hover:text-indigo-700">{f.fileName}</div>
                      {f.fileSize && (
                        <div className="text-[10px] text-gray-400 font-mono">{formatSize(f.fileSize)}</div>
                      )}
                    </div>
                    <ExternalLink size={12} className="text-gray-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Empty checklist & no files placeholder */}
          {total === 0 && task.files.length === 0 && (
            <div className="text-center py-4 text-xs text-gray-300">No checklist or files attached.</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
