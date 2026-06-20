'use client'
import type { CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Paperclip, CheckSquare, Eye, GripVertical } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { CSS }          from '@dnd-kit/utilities'

const STATUSES = ['backlog', 'in_progress', 'in_review', 'done'] as const
type Status = typeof STATUSES[number]

const STATUS_META: Record<Status, { label: string; border: string; clientBg: string; clientText: string }> = {
  backlog:     { label: 'Backlog',     border: 'border-l-gray-300',  clientBg: 'bg-gray-100',  clientText: 'text-gray-600'  },
  in_progress: { label: 'In Progress', border: 'border-l-blue-400',  clientBg: 'bg-blue-50',   clientText: 'text-blue-700'  },
  in_review:   { label: 'In Review',   border: 'border-l-amber-400', clientBg: 'bg-amber-50',  clientText: 'text-amber-700' },
  done:        { label: 'Done',        border: 'border-l-green-400', clientBg: 'bg-green-50',  clientText: 'text-green-700' },
}

export interface Task {
  id:          string
  title:       string
  description: string | null
  status:      string
  clientId:    string | null
  createdAt:   string | Date
  client:      { id: string; name: string } | null
  checklists:  { id: string; text: string; completed: boolean }[]
  files:       { id: string; fileName: string }[]
}

interface Props {
  task:           Task
  onMove:         (taskId: string, newStatus: string) => void
  onDelete:       (taskId: string) => void
  onView:         (task: Task) => void
  canDelete:      boolean
  isDragOverlay?: boolean
}

export default function TaskCard({ task, onMove, onDelete, onView, canDelete, isDragOverlay }: Props) {
  const idx    = STATUSES.indexOf(task.status as Status)
  const meta   = STATUS_META[task.status as Status] ?? STATUS_META.backlog
  const done   = task.checklists.filter(c => c.completed).length
  const total  = task.checklists.length
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0
  const date   = new Date(task.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:       task.id,
    disabled: isDragOverlay,
  })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity:   isDragging ? 0.35 : 1,
    zIndex:    isDragging ? 999 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={`bg-white border border-gray-200 border-l-4 ${meta.border} rounded-xl p-3.5 shadow-sm transition-shadow group cursor-default
        ${isDragOverlay ? 'shadow-2xl rotate-1 scale-105' : 'hover:shadow-md'}
      `}
    >
      {/* Drag handle + client tag row */}
      <div className="flex items-center gap-1.5 mb-2">
        {/* Grip — only drag area */}
        {!isDragOverlay && (
          <div
            {...listeners}
            {...attributes}
            className="flex-shrink-0 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing transition-colors -ml-1 p-0.5"
          >
            <GripVertical size={14} />
          </div>
        )}

        {task.client && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono inline-block ${meta.clientBg} ${meta.clientText}`}>
            {task.client.name}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="text-sm font-semibold text-gray-900 leading-snug mb-1">{task.title}</div>

      {/* Description */}
      {task.description && (
        <div className="text-xs text-gray-400 line-clamp-2 mb-2.5 leading-relaxed">{task.description}</div>
      )}

      {/* Checklist progress */}
      {total > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckSquare size={10} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 font-mono">{done}/{total}</span>
            {done === total && <span className="text-[10px] text-green-600 font-bold">All done!</span>}
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${done === total ? 'bg-green-400' : 'bg-indigo-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <div className="flex items-center gap-2">
          {task.files.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Paperclip size={9} /> {task.files.length}
            </span>
          )}
          <span className="text-[10px] text-gray-300 font-mono">{date}</span>
        </div>

        {!isDragOverlay && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canDelete && <button
              onClick={() => onView(task)}
              title="View details"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <Eye size={12} />
            </button>}
            <button
              onClick={() => onMove(task.id, STATUSES[idx - 1])}
              disabled={idx <= 0}
              title={idx > 0 ? `Move to ${STATUS_META[STATUSES[idx - 1]].label}` : undefined}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => onMove(task.id, STATUSES[idx + 1])}
              disabled={idx >= STATUSES.length - 1}
              title={idx < STATUSES.length - 1 ? `Move to ${STATUS_META[STATUSES[idx + 1]].label}` : undefined}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => onDelete(task.id)}
              title="Delete task"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors ml-0.5"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
