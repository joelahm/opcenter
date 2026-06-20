import { NextRequest, NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { appBaseUrl, buildGoogleAuthUrl, getSetting } from '@/lib/gmail-oauth'
import { createOAuthState, oauthStateCookie } from '@/lib/oauth-state'

export async function GET(req: NextRequest) {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const clientId = await getSetting('gmail_oauth_client_id')
    const user = await getSetting('gmail_oauth_user')

    if (!clientId || !user) {
      return NextResponse.json({ success: false, error: 'Save Gmail address and client ID first' }, { status: 400 })
    }

    const state = createOAuthState()
    const response = NextResponse.json({
      success: true,
      url: buildGoogleAuthUrl({ origin: appBaseUrl(), clientId, loginHint: user, state }),
    })
    response.cookies.set(oauthStateCookie('gmail'), state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error('Gmail OAuth authorize error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create Google authorization URL' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
