import { NextRequest, NextResponse } from 'next/server'
import { canManageUsers, requireUser } from '@/lib/auth'
import { appBaseUrl, getSetting } from '@/lib/gmail-oauth'
import { gbpRedirectUri, setSetting } from '@/lib/gbp-oauth'
import { getSecretSetting, setSecretSetting } from '@/lib/secure-settings'
import { oauthStateCookie, validOAuthState } from '@/lib/oauth-state'

function redirectWithClearedState(path: string) {
  const response = NextResponse.redirect(new URL(path, appBaseUrl()))
  response.cookies.set(oauthStateCookie('gbp'), '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(req: NextRequest) {
  try {
    const current = await requireUser()
    if (!canManageUsers(current.role)) {
      return NextResponse.redirect(new URL('/settings?gbp=forbidden', appBaseUrl()))
    }

    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')
    const state = req.nextUrl.searchParams.get('state')
    const expectedState = req.cookies.get(oauthStateCookie('gbp'))?.value

    if (!validOAuthState(expectedState, state)) {
      return redirectWithClearedState('/settings?gbp=invalid_state')
    }

    if (error || !code) {
      return redirectWithClearedState(`/settings?gbp=${encodeURIComponent(error || 'missing_code')}`)
    }

    const [clientId, clientSecret] = await Promise.all([
      getSetting('gbp_oauth_client_id'),
      getSecretSetting('gbp_oauth_client_secret'),
    ])

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: gbpRedirectUri(appBaseUrl()),
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.refresh_token) {
      const message = tokenData.error_description || tokenData.error || 'token_failed'
      return redirectWithClearedState(`/settings?gbp=${encodeURIComponent(message)}`)
    }

    await Promise.all([
      setSecretSetting('gbp_oauth_refresh_token', tokenData.refresh_token),
      setSetting('gbp_oauth_enabled', 'true'),
    ])

    return redirectWithClearedState('/settings?gbp=connected')
  } catch (error: any) {
    console.error('GBP OAuth callback error:', error)
    return redirectWithClearedState(`/settings?gbp=${encodeURIComponent(error?.message || 'failed')}`)
  }
}
export const dynamic = 'force-dynamic'
