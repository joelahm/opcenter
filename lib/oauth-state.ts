import crypto from 'crypto'

export function createOAuthState() {
  return crypto.randomBytes(32).toString('base64url')
}

export function oauthStateCookie(provider: 'gmail' | 'gbp') {
  return `oauth_state_${provider}`
}

export function validOAuthState(expected: string | undefined, actual: string | null) {
  if (!expected || !actual || expected.length !== actual.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}
