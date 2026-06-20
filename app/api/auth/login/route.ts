import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth'
import { checkRateLimit, requestIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const rate = checkRateLimit(`login:${requestIp(req.headers)}:${normalizedEmail}`, 5, 15 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user || user.status !== 'active' || !verifyPassword(String(password || ''), user.passwordHash)) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date() },
    })

    const token = createSessionToken({ userId: user.id, email: user.email, role: user.role })
    const res = NextResponse.json({ success: true })

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })

    return res
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 })
  }
}
