import nodemailer from 'nodemailer'
import crypto from 'crypto'
import prisma from '@/lib/db'
import { getSecretSetting } from '@/lib/secure-settings'

function maskEmail(value: string) {
  const [local, domain] = value.split('@')
  if (!local || !domain) return 'invalid-address'
  return `${local.slice(0, 2)}***@${domain}`
}

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) }
  const details = error as Error & { code?: string; responseCode?: number; command?: string }
  return {
    name: details.name,
    message: details.message,
    code: details.code,
    responseCode: details.responseCode,
    command: details.command,
  }
}

function emailLog(event: string, details: Record<string, unknown> = {}) {
  console.info('[email]', JSON.stringify({ event, at: new Date().toISOString(), ...details }))
}

function emailError(event: string, details: Record<string, unknown> = {}) {
  console.error('[email]', JSON.stringify({ event, at: new Date().toISOString(), ...details }))
}

async function getSetting(key: string) {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value || ''
}

async function getGmailAccessToken({
  clientId,
  clientSecret,
  refreshToken,
  deliveryId,
}: {
  clientId: string
  clientSecret: string
  refreshToken: string
  deliveryId: string
}) {
  emailLog('gmail.token_refresh.started', { deliveryId })
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
    emailError('gmail.token_refresh.failed', {
      deliveryId,
      status: res.status,
      googleError: data.error,
      googleErrorDescription: data.error_description,
    })
    throw new Error(data.error_description || data.error || 'Failed to refresh Gmail access token')
  }

  emailLog('gmail.token_refresh.succeeded', { deliveryId })
  return data.access_token as string
}

async function getGmailOAuthClient(deliveryId: string) {
  const [enabled, user, clientId, clientSecret, refreshToken] = await Promise.all([
    getSetting('gmail_oauth_enabled'),
    getSetting('gmail_oauth_user'),
    getSetting('gmail_oauth_client_id'),
    getSecretSetting('gmail_oauth_client_secret'),
    getSecretSetting('gmail_oauth_refresh_token'),
  ])

  if (enabled !== 'true' || !user || !clientId || !clientSecret || !refreshToken) {
    emailLog('gmail.configuration.unavailable', {
      deliveryId,
      enabled: enabled === 'true',
      hasUser: Boolean(user),
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      hasRefreshToken: Boolean(refreshToken),
    })
    return null
  }

  const accessToken = await getGmailAccessToken({ clientId, clientSecret, refreshToken, deliveryId })

  return { user, accessToken }
}

function cleanEmailHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function encodeSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(cleanEmailHeader(value), 'utf8').toString('base64')}?=`
}

function buildGmailMessage({
  from,
  to,
  subject,
  text,
}: {
  from: string
  to: string
  subject: string
  text: string
}) {
  const encodedBody = Buffer.from(text, 'utf8')
    .toString('base64')
    .match(/.{1,76}/g)
    ?.join('\r\n') || ''

  const mime = [
    `From: ${cleanEmailHeader(from)}`,
    `To: ${cleanEmailHeader(to)}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ].join('\r\n')

  return Buffer.from(mime, 'utf8').toString('base64url')
}

async function sendGmailApiEmail({
  user,
  accessToken,
  deliveryId,
  to,
  subject,
  text,
}: {
  user: string
  accessToken: string
  deliveryId: string
  to: string
  subject: string
  text: string
}) {
  emailLog('gmail.message_send.started', {
    deliveryId,
    from: maskEmail(user),
    to: maskEmail(to),
  })
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: buildGmailMessage({ from: user, to, subject, text }) }),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || data?.error || 'Unknown Gmail API error'
    emailError('gmail.message_send.failed', {
      deliveryId,
      status: response.status,
      googleError: message,
    })
    throw new Error(`Gmail API send failed (${response.status}): ${message}`)
  }

  emailLog('gmail.message_send.succeeded', {
    deliveryId,
    messageId: data?.id,
    threadId: data?.threadId,
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
  const deliveryId = crypto.randomUUID()
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user || 'no-reply@fritzie-dashboard.local'

  emailLog('delivery.started', { deliveryId, to: maskEmail(to) })

  try {
    const gmailClient = await getGmailOAuthClient(deliveryId)
    if (gmailClient) {
      await sendGmailApiEmail({ ...gmailClient, deliveryId, to, subject, text })
      return { delivered: true, deliveryId }
    }

    if (!host || !user || !pass) {
      emailLog('delivery.not_configured', { deliveryId })
      return { delivered: false, deliveryId }
    }

    emailLog('smtp.message_send.started', { deliveryId, host, port, to: maskEmail(to) })
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    const result = await transporter.sendMail({ from, to, subject, text })
    emailLog('smtp.message_send.succeeded', { deliveryId, messageId: result.messageId })
    return { delivered: true, deliveryId }
  } catch (error) {
    emailError('delivery.failed', { deliveryId, error: errorDetails(error) })
    throw new Error(`Email delivery failed (reference ${deliveryId}): ${error instanceof Error ? error.message : String(error)}`)
  }
}
