import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export async function POST(req: NextRequest) {
  try {
    const current = await requireUser()
    const { email } = await req.json()
    const nextEmail = String(email || '').trim().toLowerCase()
    const rate = checkRateLimit(`email-otp:${current.id}:${nextEmail}`, 3, 10 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many verification codes requested. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    if (!nextEmail || !nextEmail.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 })
    }

    if (nextEmail === current.email) {
      return NextResponse.json({ success: false, error: 'Enter a new email address first' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: nextEmail } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'That email is already in use' }, { status: 409 })
    }

    const code = generateCode()
    await prisma.emailOtp.create({
      data: {
        userId:    current.id,
        email:     nextEmail,
        codeHash:  hashCode(code),
        purpose:   'email_change',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    const result = await sendEmail({
      to:      nextEmail,
      subject: 'Your Fritzie Dashboard email change code',
      text:    `Your verification code is ${code}. It expires in 10 minutes.`,
    })

    return NextResponse.json({
      success: true,
      delivered: result.delivered,
      dev_code: result.delivered || process.env.NODE_ENV === 'production' ? undefined : code,
    })
  } catch (error) {
    console.error('Email OTP error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send verification code' }, { status: 500 })
  }
}
