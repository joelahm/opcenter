import assert from 'node:assert/strict'
import test from 'node:test'
import { csvExportUrl } from '../lib/patient-sheets'
import { decryptSecret, encryptSecret } from '../lib/secure-settings'
import { createOAuthState, validOAuthState } from '../lib/oauth-state'
import { checkRateLimit } from '../lib/rate-limit'

process.env.AUTH_SECRET ||= 'test-auth-secret-that-is-long-enough'

test('Google Sheet URLs are restricted to docs.google.com over HTTPS', () => {
  const url = csvExportUrl('https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=123')
  assert.equal(url, 'https://docs.google.com/spreadsheets/d/sheet-id/export?format=csv&gid=123')

  assert.throws(() => csvExportUrl('http://docs.google.com/spreadsheets/d/id/edit'))
  assert.throws(() => csvExportUrl('https://127.0.0.1/export?output=csv'))
  assert.throws(() => csvExportUrl('https://evil.example/export?output=csv'))
})

test('application secrets encrypt and decrypt without exposing plaintext', () => {
  const plaintext = 'sensitive-refresh-token'
  const encrypted = encryptSecret(plaintext)
  assert.match(encrypted, /^enc:v1:/)
  assert.equal(encrypted.includes(plaintext), false)
  assert.equal(decryptSecret(encrypted), plaintext)
})

test('OAuth state comparison rejects missing and modified values', () => {
  const state = createOAuthState()
  assert.equal(validOAuthState(state, state), true)
  assert.equal(validOAuthState(state, `${state}x`), false)
  assert.equal(validOAuthState(undefined, state), false)
  assert.equal(validOAuthState(state, null), false)
})

test('rate limiter blocks requests over the configured limit', () => {
  const key = `test-${Date.now()}-${Math.random()}`
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, true)
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, true)
  assert.equal(checkRateLimit(key, 2, 60_000).allowed, false)
})
