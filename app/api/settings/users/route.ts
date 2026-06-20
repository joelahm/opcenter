import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { canManageUsers, requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: users.map(user => ({
        ...user,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt:   user.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
