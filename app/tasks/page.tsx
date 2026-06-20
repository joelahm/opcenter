import Topbar      from '@/components/dashboard/Topbar'
import KanbanBoard from '@/components/tasks/KanbanBoard'
import prisma      from '@/lib/db'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const user = await requireUser()
  const [rawTasks, clients] = await Promise.all([
    prisma.task.findMany({
      include: {
        client:     { select: { id: true, name: true } },
        checklists: { orderBy: { sortOrder: 'asc' } },
        files:      { select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.location.findMany({
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Normalize Dates → strings so they serialize cleanly to the client component
  const tasks = rawTasks.map((t: typeof rawTasks[number]) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    checklists: t.checklists.map((c: typeof t.checklists[number]) => ({ ...c })),
    files:      t.files.map((f: typeof t.files[number])       => ({ ...f })),
  }))

  const openCount = tasks.filter((t: typeof tasks[number]) => t.status !== 'done').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Tasks"
        subtitle={`${openCount} open task${openCount !== 1 ? 's' : ''}`}
      />
      <div className="flex-1 overflow-hidden">
        <KanbanBoard initialTasks={tasks} clients={clients} canDelete={user.role !== 'member'} />
      </div>
    </div>
  )
}
