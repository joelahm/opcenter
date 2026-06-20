const { createServer } = require('http')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

let lastSummaryKey = null

async function maybeSendDailySummary() {
  try {
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: ['daily_summary_enabled', 'daily_summary_time'] } },
    })
    const settings = Object.fromEntries(rows.map(row => [row.key, row.value]))
    await prisma.$disconnect()

    if (settings.daily_summary_enabled !== 'true') return

    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const currentKey = `${now.toISOString().slice(0, 10)}-${currentTime}`

    if (currentTime !== (settings.daily_summary_time || '09:00')) return
    if (lastSummaryKey === currentKey) return

    lastSummaryKey = currentKey
    await fetch(`http://127.0.0.1:${port}/api/settings/daily-summary/send`, {
      method: 'POST',
      headers: { 'x-scheduler-secret': process.env.SCHEDULER_SECRET || '' },
    })
  } catch (error) {
    console.error('Daily summary scheduler error:', error)
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res))
  const io = new Server(server, {
    path: '/socket.io',
  })

  global.realtimeEmit = (event, payload) => {
    io.emit(event, payload)
  }

  io.on('connection', socket => {
    socket.emit('daily-summary:status', {
      status: 'connected',
      message: 'Realtime summary channel connected',
      at: new Date().toISOString(),
    })
  })

  setInterval(maybeSendDailySummary, 60 * 1000)

  server.listen(port, hostname, () => {
    console.log(`Ready on http://localhost:${port}`)
  })
})
