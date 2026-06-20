import { NextRequest, NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { appBaseUrl, getSetting, gmailRedirectUri, setSetting } from '@/lib/gmail-oauth'
import { getSecretSetting, setSecretSetting } from '@/lib/secure-settings'
import { oauthStateCookie, validOAuthState } from '@/lib/oauth-state'

function redirectWithClearedState(path: string) {
  const response = NextResponse.redirect(new URL(path, appBaseUrl()))
  response.cookies.set(oauthStateCookie('gmail'), '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(req: NextRequest) {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.redirect(new URL('/settings?gmail=forbidden', appBaseUrl()))
    }

    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')
    const state = req.nextUrl.searchParams.get('state')
    const expectedState = req.cookies.get(oauthStateCookie('gmail'))?.value

    if (!validOAuthState(expectedState, state)) {
      return redirectWithClearedState('/settings?gmail=invalid_state')
    }

    if (error || !code) {
      return redirectWithClearedState(`/settings?gmail=${encodeURIComponent(error || 'missing_code')}`)
    }

    const [clientId, clientSecret] = await Promise.all([
      getSetting('gmail_oauth_client_id'),
      getSecretSetting('gmail_oauth_client_secret'),
    ])

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  gmailRedirectUri(appBaseUrl()),
        grant_type:    'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.refresh_token) {
      const message = tokenData.error_description || tokenData.error || 'token_failed'
      return redirectWithClearedState(`/settings?gmail=${encodeURIComponent(message)}`)
    }

    await Promise.all([
      setSecretSetting('gmail_oauth_refresh_token', tokenData.refresh_token),
      setSetting('gmail_oauth_enabled', 'true'),
    ])

    return redirectWithClearedState('/settings?gmail=connected')
  } catch (error: any) {
    console.error('Gmail OAuth callback error:', error)
    return redirectWithClearedState(`/settings?gmail=${encodeURIComponent(error?.message || 'failed')}`)
  }
}
export const dynamic = 'force-dynamic'
