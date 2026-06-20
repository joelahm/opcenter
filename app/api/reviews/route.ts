import { NextResponse }                 from 'next/server'
import prisma                           from '@/lib/db'
import { ReviewSentiment, Prisma }      from '@prisma/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter    = searchParams.get('filter')    || 'all'
    const sentiment = searchParams.get('sentiment') as ReviewSentiment | null
    const limit     = parseInt(searchParams.get('limit') || '50')

    const where: Prisma.ReviewWhereInput = {}
    if (filter === 'unreplied') where.replied   = false
    if (filter === 'negative')  where.sentiment = 'negative'
    if (filter === 'positive')  where.sentiment = 'positive'
    if (sentiment)              where.sentiment = sentiment

    const rows = await prisma.review.findMany({
      where,
      take:    limit,
      orderBy: { reviewDate: 'desc' },
      include: {
        location: { select: { name: true, address: true, campaign: true } },
      },
    })

    // Reshape to snake_case for client components
    const data = rows.map(r => ({
      id:                r.id,
      reviewer:          r.reviewer,
      stars:             r.stars,
      review_text:       r.reviewText,
      sentiment:         r.sentiment,
      replied:           r.replied,
      campaign:          r.campaign,
      review_date:       r.reviewDate,
      location_name:     r.location?.name ?? null,
      address:           r.location?.address ?? null,
      location_campaign: r.location?.campaign ?? null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Reviews GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

// POST — receives new reviews (e.g. from Google Apps Script webhook)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { location_gbp_id, reviewer, stars, review_text, replied, reply_text, campaign, review_date } = body

    const sentiment: ReviewSentiment = stars >= 4 ? 'positive' : stars === 3 ? 'neutral' : 'negative'

    const location = location_gbp_id
      ? await prisma.location.findUnique({ where: { gbpId: location_gbp_id } })
      : null

    const review = await prisma.review.create({
      data: {
        reviewer,
        stars:      Number(stars),
        reviewText: review_text  ?? null,
        sentiment,
        replied:    replied      ?? false,
        replyText:  reply_text   ?? null,
        campaign:   campaign     ?? null,
        reviewDate: review_date  ? new Date(review_date) : new Date(),
        locationId: location?.id ?? null,
      },
    })

    return NextResponse.json({ success: true, id: review.id })
  } catch (error) {
    console.error('Reviews POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save review' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
