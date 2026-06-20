import crypto from 'crypto'

const ITERATIONS = 310000
const KEY_LENGTH = 32
const DIGEST = 'sha256'

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
  return `pbkdf2_sha256$${ITERATIONS}$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, salt, hash] = stored.split('$')
  if (algorithm !== 'pbkdf2_sha256' || !iterations || !salt || !hash) return false

  const test = crypto.pbkdf2Sync(password, salt, Number(iterations), KEY_LENGTH, DIGEST).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'))
}
