import { NextRequest, NextResponse } from 'next/server'
import prisma                        from '@/lib/db'
import { LocationStatus }            from '@prisma/client'

const LOCATION_STATUSES = new Set(Object.values(LocationStatus))

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await prisma.location.findUnique({
      where: { id: params.id },
      include: {
        reviews: {
          orderBy: { reviewDate: 'desc' },
          take:    8,
          select: {
            id:         true,
            reviewer:   true,
            stars:      true,
            reviewText: true,
            sentiment:  true,
            replied:    true,
            reviewDate: true,
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    const [totalReviews, unrepliedCount, avgRating] = await Promise.all([
      prisma.review.count({ where: { locationId: client.id } }),
      prisma.review.count({ where: { locationId: client.id, replied: false } }),
      prisma.review.aggregate({ where: { locationId: client.id }, _avg: { stars: true } }),
    ])

    return NextResponse.json({
      success: true,
      client: {
        ...client,
        gbp_connected:    client.gbpConnected,
        gbp_id:           client.gbpId,
        gbp_rating:       client.gbpRating,
        gbp_review_count: client.gbpReviewCount,
        last_synced:      client.lastSynced?.toISOString() ?? null,
        total_reviews:    totalReviews,
        unreplied_count:  unrepliedCount,
        avg_rating:       avgRating._avg.stars ?? 0,
        reviews: client.reviews.map(review => ({
          ...review,
          reviewDate: review.reviewDate?.toISOString() ?? null,
        })),
      },
    })
  } catch (error) {
    console.error('Client GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch client details' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { name, address, phone, website, gbp_id, status, gbp_connected } = body

    if (status !== undefined && !LOCATION_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: 'Invalid client status' }, { status: 400 })
    }

    const client = await prisma.location.update({
      where: { id: params.id },
      data: {
        ...(name          !== undefined && { name: name?.trim() }),
        ...(address       !== undefined && { address: address || null }),
        ...(phone         !== undefined && { phone: phone || null }),
        ...(website       !== undefined && { website: website || null }),
        ...(gbp_id        !== undefined && { gbpId: gbp_id || null }),
        ...(status        !== undefined && { status: status as LocationStatus }),
        ...(gbp_connected !== undefined && { gbpConnected: Boolean(gbp_connected) }),
      },
    })

    return NextResponse.json({ success: true, client })
  } catch (error: any) {
    console.error('Client PATCH error:', error)

    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'This Google Business Profile is already linked to another client' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: false, error: 'Failed to update client' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.location.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Client DELETE error:', error)

    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ success: false, error: 'Failed to delete client' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
