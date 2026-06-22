import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'fritzie_session'
const PUBLIC_PATHS = ['/login', '/register', '/api/auth/login', '/api/auth/logout', '/api/auth/register']

interface SessionPayload {
  userId: string
  email: string
  role: 'super_admin' | 'admin' | 'member'
  exp: number
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return atob(padded)
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return result === 0
}

async function verifySession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const secret = process.env.AUTH_SECRET
  if (!secret) return null

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    if (!safeEqual(base64Url(new Uint8Array(signed)), signature)) return null

    const payload = JSON.parse(decodeBase64Url(body)) as SessionPayload
    if (!payload.userId || !payload.exp || payload.exp < Date.now()) return null
    if (!['super_admin', 'admin', 'member'].includes(payload.role)) return null
    return payload
  } catch {
    return null
  }
}

function apiError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function isAdmin(role: string) {
  return role === 'super_admin' || role === 'admin'
}

function isAuthorized(req: NextRequest, session: SessionPayload) {
  const path = req.nextUrl.pathname
  const method = req.method

  if (path.startsWith('/settings') || path.startsWith('/api/settings')) return session.role === 'super_admin'
  if (path.startsWith('/patient-lists') || path.startsWith('/api/patient-lists')) return isAdmin(session.role)

  if (path.startsWith('/api/clients/')) {
    if (method === 'DELETE') return session.role === 'super_admin'
    if (method !== 'GET') return isAdmin(session.role)
  }
  if (path === '/api/clients' && method !== 'GET') return isAdmin(session.role)
  if (path === '/api/clients/import') return isAdmin(session.role)
  if (path === '/api/reviews' && method === 'POST') return isAdmin(session.role)
  if (path.startsWith('/api/gbp-reviews/') && method !== 'GET') return isAdmin(session.role)
  if (path.startsWith('/api/tasks/') && method === 'DELETE') return isAdmin(session.role)

  return true
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (
    path.startsWith('/_next/static') ||
    path.startsWith('/_next/image') ||
    path === '/favicon.ico' ||
    PUBLIC_PATHS.some(publicPath => path === publicPath || path.startsWith(`${publicPath}/`))
  ) {
    return NextResponse.next()
  }

  const schedulerSecret = process.env.SCHEDULER_SECRET
  if (
    path === '/api/settings/daily-summary/send' &&
    schedulerSecret &&
    safeEqual(req.headers.get('x-scheduler-secret') || '', schedulerSecret)
  ) {
    return NextResponse.next()
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) {
    if (path.startsWith('/api/')) return apiError('Unauthorized', 401)
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (!isAuthorized(req, session)) {
    if (path.startsWith('/api/')) return apiError('Forbidden', 403)
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.searchParams.set('error', 'forbidden')
    return NextResponse.redirect(url)
  }

  const headers = new Headers(req.headers)
  headers.set('x-user-id', session.userId)
  headers.set('x-user-role', session.role)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
