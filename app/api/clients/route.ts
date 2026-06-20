import { NextRequest, NextResponse } from 'next/server'
import prisma                        from '@/lib/db'
import { LocationStatus }            from '@prisma/client'

const LOCATION_STATUSES = new Set(Object.values(LocationStatus))

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        l.*,
        COUNT(r.id)                                         AS total_reviews,
        AVG(r.stars)                                        AS avg_rating,
        SUM(CASE WHEN r.replied = TRUE  THEN 1 ELSE 0 END) AS replied_count,
        SUM(CASE WHEN r.replied = FALSE THEN 1 ELSE 0 END) AS unreplied_count
      FROM locations l
      LEFT JOIN reviews r ON l.id = r.location_id
      GROUP BY l.id
      ORDER BY l.name ASC, l.created_at DESC
    `
    const data = rows.map((r: any) => ({
      ...r,
      total_reviews:   Number(r.total_reviews   ?? 0),
      replied_count:   Number(r.replied_count   ?? 0),
      unreplied_count: Number(r.unreplied_count ?? 0),
      avg_rating:      parseFloat(String(r.avg_rating ?? 0)),
      gbp_connected:   Boolean(r.gbp_connected),
    }))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Clients GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, address, phone, website, gbp_id, status = 'active', gbp_connected = false } = body

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    if (!LOCATION_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: 'Invalid client status' }, { status: 400 })
    }

    const client = await prisma.location.create({
      data: {
        name:         name.trim(),
        gbpId:        gbp_id   || null,
        address:      address  || null,
        phone:        phone    || null,
        website:      website  || null,
        status:       (status as LocationStatus) || 'active',
        gbpConnected: Boolean(gbp_connected),
      },
    })

    return NextResponse.json({ success: true, client })
  } catch (error: any) {
    console.error('Clients POST error:', error)

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'This Google Business Profile is already linked to another client' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: false, error: 'Failed to add client' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
