import { NextRequest, NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { sendDailySummaryToDiscord } from '@/lib/daily-summary'

export async function POST(req: NextRequest) {
  try {
    const schedulerSecret = process.env.SCHEDULER_SECRET || ''
    const scheduled = Boolean(schedulerSecret) && req.headers.get('x-scheduler-secret') === schedulerSecret

    if (!scheduled) {
      const current = await requireUser()
      if (!canManageUsers(current.role)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
    }

    const summary = await sendDailySummaryToDiscord(scheduled ? 'scheduled' : 'manual')
    return NextResponse.json({ success: true, data: summary })
  } catch (error: any) {
    console.error('Daily summary send error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to send daily summary' }, { status: 500 })
  }
}
