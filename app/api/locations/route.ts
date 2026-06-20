import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        l.*,
        COUNT(r.id)                                         AS total_reviews,
        AVG(r.stars)                                        AS avg_rating,
        SUM(CASE WHEN r.replied = TRUE  THEN 1 ELSE 0 END) AS replied_count,
        SUM(CASE WHEN r.replied = FALSE THEN 1 ELSE 0 END) AS unreplied_count
      FROM locations l
      LEFT JOIN reviews r ON l.id = r.location_id
      GROUP BY l.id
      ORDER BY total_reviews DESC
    `)
    const data = rows.map((r: any) => ({
      ...r,
      total_reviews:   Number(r.total_reviews   ?? 0),
      replied_count:   Number(r.replied_count   ?? 0),
      unreplied_count: Number(r.unreplied_count ?? 0),
      avg_rating:      parseFloat(String(r.avg_rating ?? 0)),
    }))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Locations API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch locations' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
