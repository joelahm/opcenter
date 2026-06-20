import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { canManageUsers, requireUser } from '@/lib/auth'

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const invite = await prisma.invite.findUnique({ where: { id: params.id } })
    if (!invite) return NextResponse.json({ success: false, error: 'Invite not found' }, { status: 404 })
    if (invite.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Only pending invites can be revoked' }, { status: 400 })
    }

    await prisma.invite.update({ where: { id: params.id }, data: { status: 'revoked' } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invite revoke error:', error)
    return NextResponse.json({ success: false, error: 'Failed to revoke invite' }, { status: 500 })
  }
}
