import { NextRequest, NextResponse } from 'next/server'
import { unlink }                    from 'fs/promises'
import { join }                      from 'path'
import prisma                        from '@/lib/db'
import { TaskStatus }                from '@prisma/client'

const VALID_STATUSES: TaskStatus[] = ['backlog', 'in_progress', 'in_review', 'done']

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { status, title, description } = body

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(status      !== undefined && { status }),
        ...(title       !== undefined && { title }),
        ...(description !== undefined && { description }),
      },
    })

    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error('Task PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await prisma.task.findUnique({
      where:   { id: params.id },
      include: { files: true },
    })

    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }

    // Remove physical files (non-fatal if already missing)
    await Promise.allSettled(
      task.files.map(f => {
        const privatePrefix = '/api/tasks/files/'
        const path = f.fileUrl.startsWith(privatePrefix)
          ? join(process.cwd(), 'storage', 'task-uploads', f.id)
          : join(process.cwd(), 'public', f.fileUrl)
        return unlink(path)
      })
    )

    // Cascade deletes checklists + file records
    await prisma.task.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 })
  }
}
