import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { hashPassword } from '@/lib/password'

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { token, name, password } = await req.json()

    if (!token || !name?.trim() || !password || String(password).length < 8) {
      return NextResponse.json({ success: false, error: 'Name, token, and an 8 character password are required' }, { status: 400 })
    }

    const invite = await prisma.invite.findUnique({
      where: { tokenHash: tokenHash(String(token)) },
    })

    if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Invite is invalid or expired' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: invite.email } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'A user already exists for this invite email' }, { status: 409 })
    }

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email:        invite.email,
          name:         name.trim(),
          passwordHash: hashPassword(String(password)),
          role:         invite.role,
          status:       'active',
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data:  { status: 'accepted', acceptedAt: new Date() },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ success: false, error: 'Registration failed' }, { status: 500 })
  }
}
