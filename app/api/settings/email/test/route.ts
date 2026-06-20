import { NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export async function POST() {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const result = await sendEmail({
      to:      current.email,
      subject: 'Fritzie Dashboard email test',
      text:    'Your Gmail OAuth email setup is working.',
    })

    return NextResponse.json({ success: true, delivered: result.delivered })
  } catch (error: any) {
    console.error('Email test error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to send test email' }, { status: 500 })
  }
}
