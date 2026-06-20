import prisma from '@/lib/db'
import { emitRealtime } from '@/lib/realtime'
import { getSecretSetting } from '@/lib/secure-settings'

const KEYS = {
  webhook: 'discord_webhook_url',
  enabled: 'daily_summary_enabled',
  sendTime: 'daily_summary_time',
}

export async function getSetting(key: string, fallback = '') {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value ?? fallback
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  })
}

export async function getDailySummarySettings() {
  const [webhook, enabled, sendTime] = await Promise.all([
    getSecretSetting(KEYS.webhook),
    getSetting(KEYS.enabled, 'false'),
    getSetting(KEYS.sendTime, '09:00'),
  ])

  return {
    discord_webhook_url: webhook,
    daily_summary_enabled: enabled === 'true',
    daily_summary_time: sendTime,
  }
}

export async function buildDailySummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    newReviews,
    unrepliedReviews,
    negativeReviews,
    newPatients,
    openTasks,
    topLocation,
  ] = await Promise.all([
    prisma.review.count({ where: { createdAt: { gte: since } } }),
    prisma.review.count({ where: { replied: false } }),
    prisma.review.count({ where: { stars: { lte: 2 }, createdAt: { gte: since } } }),
    prisma.patient.count({ where: { isNew: true, importedAt: { gte: since } } }),
    prisma.task.count({ where: { status: { not: 'done' } } }),
    prisma.$queryRaw<any[]>`
      SELECT l.name, COUNT(r.id) AS unreplied
      FROM locations l
      LEFT JOIN reviews r ON r.location_id = l.id AND r.replied = false
      GROUP BY l.id
      ORDER BY unreplied DESC
      LIMIT 1
    `,
  ])

  const locationName = topLocation[0]?.name || 'No client location'
  const locationUnreplied = Number(topLocation[0]?.unreplied || 0)

  return {
    since,
    text: [
      '**Fritzie Daily Summary**',
      `New reviews: ${newReviews}`,
      `Unreplied reviews: ${unrepliedReviews}`,
      `Negative reviews in 24h: ${negativeReviews}`,
      `New patients in 24h: ${newPatients}`,
      `Open tasks: ${openTasks}`,
      `Needs attention: ${locationName} (${locationUnreplied} unreplied)`,
    ].join('\n'),
  }
}

export async function sendDailySummaryToDiscord(source: 'manual' | 'scheduled' = 'manual') {
  emitRealtime('daily-summary:status', { status: 'started', source, at: new Date().toISOString() })

  const settings = await getDailySummarySettings()
  if (!settings.discord_webhook_url) {
    emitRealtime('daily-summary:status', { status: 'failed', message: 'Missing Discord webhook URL' })
    throw new Error('Missing Discord webhook URL')
  }

  const summary = await buildDailySummary()
  const res = await fetch(settings.discord_webhook_url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content: summary.text }),
  })

  if (!res.ok) {
    const message = `Discord webhook failed with ${res.status}`
    await prisma.dailySummaryLog.create({
      data: { status: 'failed', message, payload: summary.text },
    })
    emitRealtime('daily-summary:status', { status: 'failed', message })
    throw new Error(message)
  }

  await prisma.dailySummaryLog.create({
    data: { status: 'success', message: 'Sent daily summary', payload: summary.text },
  })
  emitRealtime('daily-summary:status', { status: 'success', message: 'Daily summary sent', payload: summary.text })

  return summary
}
