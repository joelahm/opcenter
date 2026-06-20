import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { canManageUsers, requireUser } from '@/lib/auth'

const ROLES = new Set(['super_admin', 'admin', 'member'])
const STATUSES = new Set(['active', 'disabled'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const role = String(body.role || '')
    const status = String(body.status || '')
    if (!ROLES.has(role) || !STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: 'Invalid role or status' }, { status: 400 })
    }
    if (params.id === current.id && (role !== 'super_admin' || status !== 'active')) {
      return NextResponse.json({ success: false, error: 'You cannot remove your own super-admin access' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { role: role as any, status: status as any },
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: user })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
    console.error('User PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 })
  }
}
