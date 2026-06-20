import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { completed } = await req.json()
    await prisma.taskChecklist.update({
      where: { id: params.id },
      data:  { completed: Boolean(completed) },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Checklist PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update item' }, { status: 500 })
  }
}
