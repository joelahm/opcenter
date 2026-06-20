import prisma from '@/lib/db'

export async function getSetting(key: string, fallback = '') {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value ?? fallback
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}
