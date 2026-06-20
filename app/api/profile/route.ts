import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/db'
import { createSessionToken, requireUser, SESSION_COOKIE } from '@/lib/auth'
import { hashPassword, verifyPassword } from '@/lib/password'

function hashOtp(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function PATCH(req: NextRequest) {
  try {
    const current = await requireUser()
    const body = await req.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const currentPassword = String(body.current_password || '')
    const newPassword = String(body.new_password || '')
    const otpCode = String(body.otp_code || '').trim()

    if (!name || !email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid name and email are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: current.id } })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const updateData: any = { name, email }
    const emailChanged = email !== user.email
    let otpId: string | null = null

    if (emailChanged) {
      if (!otpCode) {
        return NextResponse.json(
          { success: false, error: 'Email verification code is required', code: 'EMAIL_OTP_REQUIRED' },
          { status: 409 }
        )
      }

      const otp = await prisma.emailOtp.findFirst({
        where: {
          userId:     current.id,
          email,
          purpose:    'email_change',
          consumedAt: null,
          expiresAt:  { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!otp || otp.codeHash !== hashOtp(otpCode)) {
        return NextResponse.json({ success: false, error: 'Invalid or expired verification code' }, { status: 400 })
      }
      otpId = otp.id
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'New password must be at least 8 characters' }, { status: 400 })
      }
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 })
      }
      updateData.passwordHash = hashPassword(newPassword)
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: current.id },
        data:  updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
        },
      }),
      ...(otpId ? [
        prisma.emailOtp.update({
          where: { id: otpId },
          data:  { consumedAt: new Date() },
        }),
      ] : []),
    ])

    const token = createSessionToken({ userId: updated.id, email: updated.email, role: updated.role })
    const res = NextResponse.json({ success: true, data: updated })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return res
  } catch (error: any) {
    console.error('Profile PATCH error:', error)

    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'That email is already in use' }, { status: 409 })
    }

    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
  }
}
