import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink }  from 'fs/promises'
import { join }                      from 'path'
import crypto                        from 'crypto'
import prisma                        from '@/lib/db'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
])
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'zip'])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId') || undefined

    const tasks = await prisma.task.findMany({
      where:   clientId ? { clientId } : undefined,
      include: {
        client:     { select: { id: true, name: true } },
        checklists: { orderBy: { sortOrder: 'asc' } },
        files:      true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const savedFileIds: string[] = []
  try {
    const formData      = await req.formData()
    const title         = (formData.get('title')       as string)?.trim()
    const description   = (formData.get('description') as string)?.trim() || null
    const clientId      = (formData.get('clientId')    as string) || null
    const checklistJson = (formData.get('checklist')   as string) || '[]'
    const files         = formData.getAll('files') as File[]

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }

    const checklistItems: { text: string }[] = JSON.parse(checklistJson)
    const uploadFiles = files.filter(file => file instanceof File && file.size > 0)
    const oversizedFile = uploadFiles.find(file => file.size > MAX_FILE_SIZE)

    if (oversizedFile) {
      return NextResponse.json(
        { success: false, error: `${oversizedFile.name} is larger than 25 MB.` },
        { status: 400 }
      )
    }

    const invalidFile = uploadFiles.find(file => {
      const extension = file.name.split('.').pop()?.toLowerCase() || ''
      return !ALLOWED_MIME_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(extension)
    })
    if (invalidFile) {
      return NextResponse.json(
        { success: false, error: `${invalidFile.name} is not an accepted attachment type.` },
        { status: 400 }
      )
    }

    const uploadDir = join(process.cwd(), 'storage', 'task-uploads')
    await mkdir(uploadDir, { recursive: true })

    const fileRecords = await Promise.all(
      uploadFiles.map(async file => {
        const bytes = await file.arrayBuffer()
        const id = crypto.randomUUID()
        await writeFile(join(uploadDir, id), Buffer.from(bytes), { flag: 'wx' })
        savedFileIds.push(id)
        return {
          id,
          fileName: file.name,
          fileUrl:  `/api/tasks/files/${id}`,
          fileSize: file.size,
          mimeType: file.type || null,
        }
      })
    )

    const task = await prisma.task.create({
      data: {
        title,
        description,
        clientId: clientId || null,
        checklists: {
          create: checklistItems
            .filter(c => c.text?.trim())
            .map((c, i) => ({ text: c.text.trim(), sortOrder: i })),
        },
      files: { create: fileRecords },
      },
      include: {
        client:     { select: { id: true, name: true } },
        checklists: true,
        files:      true,
      },
    })

    return NextResponse.json({ success: true, task })
  } catch (error) {
    await Promise.allSettled(
      savedFileIds.map(id => unlink(join(process.cwd(), 'storage', 'task-uploads', id)))
    )
    console.error('Tasks POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
