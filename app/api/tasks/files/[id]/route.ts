import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import prisma from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const file = await prisma.taskFile.findUnique({ where: { id: params.id } })
    if (!file || file.fileUrl !== `/api/tasks/files/${file.id}`) {
      return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 })
    }

    const data = await readFile(join(process.cwd(), 'storage', 'task-uploads', file.id))
    const encodedName = encodeURIComponent(file.fileName)

    return new NextResponse(data, {
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Length': String(data.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ success: false, error: 'Attachment file is missing' }, { status: 404 })
    }
    console.error('Task attachment GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load attachment' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
