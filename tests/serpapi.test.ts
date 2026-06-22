import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estimateSerpApiReviewCalls,
  extractSerpApiDataId,
  serpApiReviewSort,
  shouldContinueSerpApiPagination,
} from '../lib/serpapi'

test('SerpApi review call estimates account for the eight-result first page', () => {
  assert.equal(estimateSerpApiReviewCalls(0), 0)
  assert.equal(estimateSerpApiReviewCalls(8), 1)
  assert.equal(estimateSerpApiReviewCalls(82), 5)
})

test('initial backfills continue until the reported total is fetched', () => {
  assert.equal(shouldContinueSerpApiPagination({
    isBackfill: true,
    fetchedCount: 68,
    targetTotal: 82,
    pageHasKnownReview: true,
    hasNextPage: true,
    pagesFetched: 4,
    maxPages: 25,
  }), true)
})

test('incremental sync stops after reaching a known review', () => {
  assert.equal(shouldContinueSerpApiPagination({
    isBackfill: false,
    fetchedCount: 8,
    targetTotal: 82,
    pageHasKnownReview: true,
    hasNextPage: true,
    pagesFetched: 1,
    maxPages: 25,
  }), false)
})

test('Maps place results provide the data ID used by the reviews endpoint', () => {
  assert.equal(extractSerpApiDataId({
    place_results: { data_id: '0x123:0x456' },
  }, 'ChIJExample'), '0x123:0x456')

  assert.equal(extractSerpApiDataId({
    local_results: [
      { place_id: 'ChIJOther', data_id: 'wrong' },
      { place_id: 'ChIJExample', data_id: '0xabc:0xdef' },
    ],
  }, 'ChIJExample'), '0xabc:0xdef')
})

test('historical backfills use stable relevance pagination and incremental syncs use newest first', () => {
  assert.equal(serpApiReviewSort(true), 'qualityScore')
  assert.equal(serpApiReviewSort(false), 'newestFirst')
})
