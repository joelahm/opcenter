import nodemailer from 'nodemailer'
import prisma from '@/lib/db'
import { getSecretSetting } from '@/lib/secure-settings'

async function getSetting(key: string) {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value || ''
}

async function getGmailAccessToken({
  clientId,
  clientSecret,
  refreshToken,
}: {
  clientId: string
  clientSecret: string
  refreshToken: string
}) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Gmail access token')
  }

  return data.access_token as string
}

async function createGmailOAuthTransport() {
  const [enabled, user, clientId, clientSecret, refreshToken] = await Promise.all([
    getSetting('gmail_oauth_enabled'),
    getSetting('gmail_oauth_user'),
    getSetting('gmail_oauth_client_id'),
    getSecretSetting('gmail_oauth_client_secret'),
    getSecretSetting('gmail_oauth_refresh_token'),
  ])

  if (enabled !== 'true' || !user || !clientId || !clientSecret || !refreshToken) return null

  const accessToken = await getGmailAccessToken({ clientId, clientSecret, refreshToken })

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
      accessToken,
    },
  })
}

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user || 'no-reply@fritzie-dashboard.local'

  const gmailTransport = await createGmailOAuthTransport()
  if (gmailTransport) {
    const gmailUser = await getSetting('gmail_oauth_user')
    await gmailTransport.sendMail({ from: gmailUser, to, subject, text })
    return { delivered: true }
  }

  if (!host || !user || !pass) {
    console.log(`[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${text}`)
    return { delivered: false }
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({ from, to, subject, text })
  return { delivered: true }
}
