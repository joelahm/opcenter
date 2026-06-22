import test from 'node:test'
import assert from 'node:assert/strict'
import { currentMonthRange, currentWeekRange } from '../lib/date-ranges'

test('the 7d preset covers Monday through Sunday of the current week', () => {
  assert.deepEqual(currentWeekRange(new Date(2026, 5, 23, 12)), {
    from: '2026-06-22',
    to: '2026-06-28',
  })
})

test('the 30d preset covers the complete current calendar month', () => {
  assert.deepEqual(currentMonthRange(new Date(2026, 5, 23, 12)), {
    from: '2026-06-01',
    to: '2026-06-30',
  })
})
