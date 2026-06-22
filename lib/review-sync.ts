import prisma from '@/lib/db'
import { ReviewSentiment } from '@prisma/client'

export interface NormalizedReview {
  externalId?: string
  reviewer: string
  stars: number
  text: string | null
  reviewDate: Date
  replied: boolean
  replyText: string | null
}

export interface SavedReview {
  reviewer: string
  stars: number
  text: string | null
  review_date: string
}

interface ReviewFingerprintInput {
  reviewer: string | null
  stars: number
  text: string | null
  reviewDate: Date | null
}

function normalizeFingerprintText(value: string | null) {
  return (value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

export function reviewFingerprint({ reviewer, stars, text, reviewDate }: ReviewFingerprintInput) {
  const normalizedReviewer = normalizeFingerprintText(reviewer)
  const normalizedText = normalizeFingerprintText(text)
  if (normalizedText) return `${normalizedReviewer}|${stars}|text:${normalizedText}`

  const day = reviewDate && !Number.isNaN(reviewDate.getTime())
    ? reviewDate.toISOString().slice(0, 10)
    : 'unknown-date'
  return `${normalizedReviewer}|${stars}|date:${day}`
}

function sentimentFromRating(rating: number): ReviewSentiment {
  if (rating >= 4) return 'positive'
  if (rating === 3) return 'neutral'
  return 'negative'
}

export async function saveNormalizedReviews(
  locationId: string,
  reviews: NormalizedReview[],
  reviewIdMap: Record<string, string>
) {
  const newReviews: SavedReview[] = []
  let updatedCount = 0

  for (const review of reviews) {
    const mappedReviewId = review.externalId ? reviewIdMap[review.externalId] : ''
    const existingById = mappedReviewId
      ? await prisma.review.findUnique({ where: { id: mappedReviewId } })
      : null
    const candidates = existingById ? [] : await prisma.review.findMany({
      where: { locationId, reviewer: review.reviewer, stars: review.stars },
    })
    const fingerprint = reviewFingerprint({
      reviewer: review.reviewer,
      stars: review.stars,
      text: review.text,
      reviewDate: review.reviewDate,
    })
    const existing = existingById || candidates.find(candidate => reviewFingerprint({
      reviewer: candidate.reviewer,
      stars: candidate.stars,
      text: candidate.reviewText,
      reviewDate: candidate.reviewDate,
    }) === fingerprint)

    const data = {
      reviewer: review.reviewer,
      stars: review.stars,
      reviewText: review.text || existing?.reviewText || null,
      sentiment: sentimentFromRating(review.stars),
      replied: Boolean(review.replied || existing?.replied),
      replyText: review.replyText || existing?.replyText || null,
      reviewDate: review.externalId ? review.reviewDate : existing?.reviewDate || review.reviewDate,
    }

    if (existing) {
      await prisma.review.update({ where: { id: existing.id }, data })
      if (review.externalId) reviewIdMap[review.externalId] = existing.id
      updatedCount += 1
      continue
    }

    const created = await prisma.review.create({ data: { locationId, ...data } })
    if (review.externalId) reviewIdMap[review.externalId] = created.id
    newReviews.push({
      reviewer: review.reviewer,
      stars: review.stars,
      text: review.text,
      review_date: review.reviewDate.toISOString(),
    })
  }

  return { newReviews, updatedCount }
}

export async function deduplicateLocationReviews(
  locationId: string,
  reviewIdMap: Record<string, string>
) {
  const reviews = await prisma.review.findMany({
    where: { locationId },
    orderBy: { createdAt: 'asc' },
  })
  const mappedIds = new Set(Object.values(reviewIdMap))
  const groups = new Map<string, typeof reviews>()

  for (const review of reviews) {
    const fingerprint = reviewFingerprint({
      reviewer: review.reviewer,
      stars: review.stars,
      text: review.reviewText,
      reviewDate: review.reviewDate,
    })
    groups.set(fingerprint, [...(groups.get(fingerprint) || []), review])
  }

  let deletedCount = 0
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue

    const canonical = group.find(review => mappedIds.has(review.id))
      || group.find(review => review.replied)
      || group[0]
    const duplicates = group.filter(review => review.id !== canonical.id)
    const repliedReview = group.find(review => review.replied && review.replyText)

    await prisma.$transaction([
      prisma.review.update({
        where: { id: canonical.id },
        data: {
          replied: group.some(review => review.replied),
          replyText: repliedReview?.replyText || canonical.replyText,
        },
      }),
      prisma.review.deleteMany({ where: { id: { in: duplicates.map(review => review.id) } } }),
    ])

    for (const [externalId, reviewId] of Object.entries(reviewIdMap)) {
      if (duplicates.some(review => review.id === reviewId)) reviewIdMap[externalId] = canonical.id
    }
    deletedCount += duplicates.length
  }

  return deletedCount
}
