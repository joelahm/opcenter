import { appBaseUrl } from '@/lib/gmail-oauth'
import { getSetting, setSetting } from '@/lib/app-settings'
import { getSecretSetting } from '@/lib/secure-settings'

export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage'

export function gbpRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, '')}/api/settings/gbp/oauth/callback`
}

export async function getGbpOAuthSettings() {
  const [enabled, user, clientId, clientSecret, refreshToken] = await Promise.all([
    getSetting('gbp_oauth_enabled', 'false'),
    getSetting('gbp_oauth_user'),
    getSetting('gbp_oauth_client_id'),
    getSecretSetting('gbp_oauth_client_secret'),
    getSecretSetting('gbp_oauth_refresh_token'),
  ])

  return {
    enabled: enabled === 'true',
    user,
    client_id: clientId,
    has_client_secret: Boolean(clientSecret),
    connected: Boolean(user && clientId && clientSecret && refreshToken),
    redirect_uri: gbpRedirectUri(appBaseUrl()),
  }
}

export function buildGbpAuthUrl({ origin, clientId, loginHint, state }: {
  origin: string
  clientId: string
  loginHint?: string
  state?: string
}) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', gbpRedirectUri(origin))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GBP_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  if (loginHint) url.searchParams.set('login_hint', loginHint)
  if (state) url.searchParams.set('state', state)
  return url.toString()
}

export async function getGbpAccessToken() {
  const [clientId, clientSecret, refreshToken] = await Promise.all([
    getSetting('gbp_oauth_client_id'),
    getSecretSetting('gbp_oauth_client_secret'),
    getSecretSetting('gbp_oauth_refresh_token'),
  ])

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Business Profile OAuth is not connected')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json()

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Unable to refresh GBP access token')
  }

  return String(payload.access_token)
}

async function googleGet(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Google Business Profile request failed (${response.status})`)
  }

  return payload
}

export async function findManagedLocationByPlaceId(placeId: string, accessToken: string) {
  const accountsPayload = await googleGet(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    accessToken
  )

  for (const account of accountsPayload.accounts || []) {
    let pageToken = ''

    do {
      const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`)
      url.searchParams.set('readMask', 'name,title,storefrontAddress,phoneNumbers,websiteUri,metadata')
      url.searchParams.set('pageSize', '100')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const payload = await googleGet(url.toString(), accessToken)
      const location = (payload.locations || []).find((item: any) => item.metadata?.placeId === placeId)

      if (location) {
        return {
          accountName: String(account.name),
          locationName: String(location.name),
          details: location,
        }
      }

      pageToken = payload.nextPageToken || ''
    } while (pageToken)
  }

  return null
}

export async function fetchAllGbpReviews(accountName: string, locationName: string, accessToken: string) {
  const reviews: any[] = []
  let pageToken = ''

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews`)
    url.searchParams.set('pageSize', '50')
    url.searchParams.set('orderBy', 'updateTime desc')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const payload = await googleGet(url.toString(), accessToken)
    reviews.push(...(payload.reviews || []))
    pageToken = payload.nextPageToken || ''
  } while (pageToken)

  return reviews
}

export { getSetting, setSetting }
