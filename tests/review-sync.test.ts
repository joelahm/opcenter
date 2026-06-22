import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewFingerprint } from '../lib/review-sync'

test('review fingerprints match text reviews despite timestamp and whitespace differences', () => {
  const first = reviewFingerprint({
    reviewer: 'GARY',
    stars: 5,
    text: 'A very good experience. Thank you.',
    reviewDate: new Date('2026-06-08T12:00:00Z'),
  })
  const second = reviewFingerprint({
    reviewer: 'gary',
    stars: 5,
    text: '  A very good experience.   Thank you. ',
    reviewDate: new Date('2026-06-12T12:00:00Z'),
  })

  assert.equal(first, second)
})

test('reviews without text use the review date to avoid merging separate ratings', () => {
  const first = reviewFingerprint({
    reviewer: 'Google user',
    stars: 5,
    text: null,
    reviewDate: new Date('2026-06-08T12:00:00Z'),
  })
  const second = reviewFingerprint({
    reviewer: 'Google user',
    stars: 5,
    text: null,
    reviewDate: new Date('2026-06-09T12:00:00Z'),
  })

  assert.notEqual(first, second)
})
