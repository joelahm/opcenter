'use client'
import { useState, useCallback } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import TaskCard,  { type Task } from './TaskCard'
import AddTaskModal    from './AddTaskModal'
import TaskDetailModal from './TaskDetailModal'

const COLUMNS = [
  { key: 'backlog',     label: 'Backlog',     dot: 'bg-gray-400',  header: 'text-gray-500',  colBg: 'bg-gray-50/60'  },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-blue-500',  header: 'text-blue-600',  colBg: 'bg-blue-50/40'  },
  { key: 'in_review',   label: 'In Review',   dot: 'bg-amber-500', header: 'text-amber-600', colBg: 'bg-amber-50/40' },
  { key: 'done',        label: 'Done',        dot: 'bg-green-500', header: 'text-green-600', colBg: 'bg-green-50/40' },
] as const

interface Client { id: string; name: string }

interface Props {
  initialTasks: Task[]
  clients:      Client[]
  canDelete:    boolean
}

// ── Droppable column wrapper ──────────────────────────────────────────────────
function DroppableColumn({
  id, isOver, children,
}: { id: string; isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto space-y-2.5 pb-4 pr-0.5 rounded-xl transition-all duration-150
        ${isOver ? 'bg-indigo-50/60 ring-2 ring-inset ring-indigo-200' : ''}
      `}
    >
      {children}
    </div>
  )
}

// ── Main board ────────────────────────────────────────────────────────────────
export default function KanbanBoard({ initialTasks, clients, canDelete }: Props) {
  const [tasks,      setTasks]      = useState<Task[]>(initialTasks)
  const [filter,     setFilter]     = useState<string>('all')
  const [showAdd,    setShowAdd]    = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [overId,     setOverId]     = useState<string | null>(null)

  const activeTask = tasks.find(t => t.id === activeId) ?? null
  const visible    = filter === 'all' ? tasks : tasks.filter(t => t.clientId === filter)
  const openCount  = tasks.filter(t => t.status !== 'done').length

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const refreshTasks = useCallback(async () => {
    const res  = await fetch('/api/tasks')
    const data = await res.json()
    if (data.success) setTasks(data.data)
  }, [])

  const handleMove = useCallback(async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      })
    } catch {
      refreshTasks()
    }
  }, [refreshTasks])

  const handleDelete = useCallback(async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
  }, [])

  const handleAdded = useCallback(async () => {
    setShowAdd(false)
    await refreshTasks()
  }, [refreshTasks])

  const handleView = useCallback((task: Task) => {
    setDetailTask(task)
  }, [])

  const handleUpdated = useCallback(async () => {
    const res  = await fetch('/api/tasks')
    const data = await res.json()
    if (data.success) {
      setTasks(data.data)
      if (detailTask) {
        const updated = (data.data as Task[]).find(t => t.id === detailTask.id)
        if (updated) setDetailTask(updated)
      }
    }
  }, [detailTask])

  // ── DnD handlers ─────────────────────────────────────────────────────────
  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function onDragOver({ over }: { over: { id: string | number } | null }) {
    setOverId(over ? String(over.id) : null)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    setOverId(null)
    if (!over) return

    const taskId    = active.id as string
    const droppedOn = String(over.id)

    // over.id is either a column key or another task id — resolve to column key
    const colKeys   = COLUMNS.map(c => c.key) as string[]
    const newStatus = colKeys.includes(droppedOn)
      ? droppedOn
      : (tasks.find(t => t.id === droppedOn)?.status ?? null)

    if (!newStatus) return

    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    handleMove(taskId, newStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver as any}
      onDragEnd={onDragEnd}
    >
      <div className="flex flex-col h-full">

        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all cursor-pointer"
            >
              <option value="all">All clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {filter !== 'all' && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg font-medium">
              {visible.length} task{visible.length !== 1 ? 's' : ''}
            </span>
          )}

          <div className="flex-1" />
          <span className="text-[11px] text-gray-400 font-mono">{openCount} open</span>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={13} /> Add task
          </button>
        </div>

        {/* ── Kanban columns ──────────────────────────────────── */}
        <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden">
          {COLUMNS.map(col => {
            const colTasks = visible.filter(t => t.status === col.key)
            const isOver   = overId === col.key

            return (
              <div key={col.key} className="flex flex-col w-72 min-w-[280px] flex-shrink-0">
                {/* Column header */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2.5 transition-colors ${col.colBg} ${isOver ? 'opacity-80' : ''}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${col.header}`}>
                    {col.label}
                  </span>
                  <span className="ml-auto text-[11px] font-mono text-gray-400 bg-white/60 px-1.5 py-0.5 rounded-md">
                    {colTasks.length}
                  </span>
                </div>

                {/* Droppable area */}
                <DroppableColumn id={col.key} isOver={isOver}>
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onMove={handleMove}
                      onDelete={handleDelete}
                      onView={handleView}
                      canDelete={canDelete}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${isOver ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-100'}`}>
                      <span className={`text-xs ${isOver ? 'text-indigo-400' : 'text-gray-300'}`}>
                        {isOver ? 'Drop here' : 'No tasks'}
                      </span>
                    </div>
                  )}
                </DroppableColumn>
              </div>
            )
          })}
        </div>
      </div>

      {/* Drag overlay — floats with the cursor */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask && (
          <TaskCard
            task={activeTask}
            onMove={() => {}}
            onDelete={() => {}}
            onView={() => {}}
            canDelete={false}
            isDragOverlay
          />
        )}
      </DragOverlay>

      {showAdd && (
        <AddTaskModal
          clients={clients}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onUpdated={handleUpdated}
        />
      )}
    </DndContext>
  )
}
