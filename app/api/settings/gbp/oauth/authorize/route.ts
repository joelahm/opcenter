import { NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { appBaseUrl, getSetting } from '@/lib/gmail-oauth'
import { buildGbpAuthUrl } from '@/lib/gbp-oauth'
import { createOAuthState, oauthStateCookie } from '@/lib/oauth-state'

export async function GET() {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const [clientId, user] = await Promise.all([
      getSetting('gbp_oauth_client_id'),
      getSetting('gbp_oauth_user'),
    ])

    if (!clientId || !user) {
      return NextResponse.json({ success: false, error: 'Save GBP Google account and client ID first' }, { status: 400 })
    }

    const state = createOAuthState()
    const response = NextResponse.json({
      success: true,
      url: buildGbpAuthUrl({ origin: appBaseUrl(), clientId, loginHint: user, state }),
    })
    response.cookies.set(oauthStateCookie('gbp'), state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error('GBP OAuth authorize error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create GBP authorization URL' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
