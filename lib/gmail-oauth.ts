import { getSecretSetting } from '@/lib/secure-settings'
import { getSetting, setSetting } from '@/lib/app-settings'

export const GMAIL_SCOPE = 'https://mail.google.com/'

export async function getGmailOAuthSettings() {
  const [enabled, user, clientId, clientSecret, refreshToken] = await Promise.all([
    getSetting('gmail_oauth_enabled', 'false'),
    getSetting('gmail_oauth_user'),
    getSetting('gmail_oauth_client_id'),
    getSecretSetting('gmail_oauth_client_secret'),
    getSecretSetting('gmail_oauth_refresh_token'),
  ])

  return {
    enabled: enabled === 'true',
    user,
    client_id: clientId,
    has_client_secret: Boolean(clientSecret),
    connected: Boolean(user && clientId && clientSecret && refreshToken),
    redirect_uri: gmailRedirectUri(appBaseUrl()),
  }
}

export { getSetting, setSetting }

export function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function gmailRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, '')}/api/settings/email/oauth/callback`
}

export function buildGoogleAuthUrl({
  origin,
  clientId,
  loginHint,
  state,
}: {
  origin: string
  clientId: string
  loginHint?: string
  state?: string
}) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', gmailRedirectUri(origin))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GMAIL_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  if (loginHint) url.searchParams.set('login_hint', loginHint)
  if (state) url.searchParams.set('state', state)
  return url.toString()
}
