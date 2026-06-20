import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { canManageUsers, requireUser } from '@/lib/auth'

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function GET() {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      take:    50,
    })

    return NextResponse.json({
      success: true,
      data: invites.map(invite => ({
        id:         invite.id,
        email:      invite.email,
        role:       invite.role,
        status:     invite.status,
        expires_at: invite.expiresAt.toISOString(),
        created_at: invite.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Invites GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch invites' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { email, role = 'member' } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 })
    }

    if (!['admin', 'member'].includes(role) && current.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
    }

    const token = crypto.randomBytes(32).toString('base64url')
    const invite = await prisma.invite.create({
      data: {
        email:       normalizedEmail,
        role,
        tokenHash:   tokenHash(token),
        expiresAt:   new Date(Date.now() + 24 * 60 * 60 * 1000),
        invitedById: current.id,
      },
    })

    const origin = req.headers.get('origin') || 'http://localhost:3000'
    return NextResponse.json({
      success: true,
      data: {
        id:          invite.id,
        invite_link: `${origin}/register?token=${encodeURIComponent(token)}`,
        expires_at:  invite.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Invites POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create invite' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
