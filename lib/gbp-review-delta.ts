interface ReviewDeltaInput {
  hadPreviousSync: boolean
  previousTotal: number
  currentTotal: number
  newDetailsCount: number
}

export function calculateNewReviewCount({
  hadPreviousSync,
  previousTotal,
  currentTotal,
  newDetailsCount,
}: ReviewDeltaInput) {
  if (!hadPreviousSync) return 0
  return Math.max(0, currentTotal - previousTotal, newDetailsCount)
}
