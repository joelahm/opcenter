import { NextRequest, NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { getGmailOAuthSettings, setSetting } from '@/lib/gmail-oauth'
import { setSecretSetting } from '@/lib/secure-settings'

export async function GET() {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: await getGmailOAuthSettings() })
  } catch (error) {
    console.error('Gmail OAuth GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch Gmail settings' }, { status: 500 })
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
      setSetting('gmail_oauth_user', String(body.user || '').trim()),
      setSetting('gmail_oauth_client_id', String(body.client_id || '').trim()),
      ...(body.client_secret ? [setSecretSetting('gmail_oauth_client_secret', String(body.client_secret).trim())] : []),
      setSetting('gmail_oauth_enabled', body.enabled ? 'true' : 'false'),
    ])

    return NextResponse.json({ success: true, data: await getGmailOAuthSettings() })
  } catch (error) {
    console.error('Gmail OAuth PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save Gmail settings' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
