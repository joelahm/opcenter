const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function hashPassword(password) {
  const iterations = 310000
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex')
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`
}

async function main() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase()
  const name = String(process.env.SUPER_ADMIN_NAME || 'Super Admin').trim()
  const password = String(process.env.SUPER_ADMIN_PASSWORD || '')

  if (!email || !email.includes('@')) {
    throw new Error('SUPER_ADMIN_EMAIL must be a valid email address')
  }
  if (!name) {
    throw new Error('SUPER_ADMIN_NAME is required')
  }
  if (password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must contain at least 12 characters')
  }

  const passwordHash = hashPassword(password)

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: 'super_admin',
      status: 'active',
    },
    update: {
      name,
      passwordHash,
      role: 'super_admin',
      status: 'active',
    },
  })

  console.log(`Super admin is ready: ${email}`)
}

main()
  .catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
