import { NextRequest, NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { getDailySummarySettings, setSetting } from '@/lib/daily-summary'
import { setSecretSetting } from '@/lib/secure-settings'

export async function GET() {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: await getDailySummarySettings() })
  } catch (error) {
    console.error('Daily summary settings GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch daily summary settings' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    await Promise.all([
      setSecretSetting('discord_webhook_url', String(body.discord_webhook_url || '').trim()),
      setSetting('daily_summary_enabled', body.daily_summary_enabled ? 'true' : 'false'),
      setSetting('daily_summary_time', String(body.daily_summary_time || '09:00')),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Daily summary settings PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save daily summary settings' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
