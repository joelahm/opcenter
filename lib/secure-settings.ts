import crypto from 'crypto'
import { getSetting, setSetting } from '@/lib/app-settings'

const PREFIX = 'enc:v1'

function encryptionKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required to encrypt application secrets')
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(value: string) {
  if (!value || value.startsWith(`${PREFIX}:`)) return value
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptSecret(value: string) {
  if (!value || !value.startsWith(`${PREFIX}:`)) return value
  const [, , ivValue, tagValue, encryptedValue] = value.split(':')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Invalid encrypted setting')

  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export async function getSecretSetting(key: string) {
  const stored = await getSetting(key)
  if (stored && !stored.startsWith(`${PREFIX}:`)) {
    await setSetting(key, encryptSecret(stored))
    return stored
  }
  return decryptSecret(stored)
}

export async function setSecretSetting(key: string, value: string) {
  return setSetting(key, encryptSecret(value))
}
