const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  console.log('No dummy seed data configured.')
}

main().catch(console.error).finally(() => p.$disconnect())
