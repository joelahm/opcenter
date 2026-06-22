import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateNewReviewCount } from '../lib/gbp-review-delta'

test('the first GBP sync establishes a baseline', () => {
  assert.equal(calculateNewReviewCount({
    hadPreviousSync: false,
    previousTotal: 0,
    currentTotal: 82,
    newDetailsCount: 5,
  }), 0)
})

test('a repeat sync reports the increase in Google total reviews', () => {
  assert.equal(calculateNewReviewCount({
    hadPreviousSync: true,
    previousTotal: 82,
    currentTotal: 84,
    newDetailsCount: 1,
  }), 2)
})

test('new review details detect additions even when the total is unchanged', () => {
  assert.equal(calculateNewReviewCount({
    hadPreviousSync: true,
    previousTotal: 84,
    currentTotal: 84,
    newDetailsCount: 1,
  }), 1)
})
