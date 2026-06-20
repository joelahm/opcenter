import crypto from 'crypto'
import { cookies } from 'next/headers'
import prisma from '@/lib/db'

export const SESSION_COOKIE = 'fritzie_session'

interface SessionPayload {
  userId: string
  email: string
  role: string
  exp: number
}

function secret() {
  return process.env.AUTH_SECRET || 'dev-change-this-auth-secret'
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>) {
  const body = base64url(JSON.stringify({
    ...payload,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }))
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature || sign(body) !== signature) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value
  const session = verifySessionToken(token)
  if (!session) return null

  return prisma.user.findFirst({
    where: { id: session.userId, status: 'active' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  })
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export function canManageUsers(role: string) {
  return role === 'super_admin'
}

export function isAdmin(role: string) {
  return role === 'super_admin' || role === 'admin'
}
