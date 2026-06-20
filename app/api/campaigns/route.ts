import { NextResponse } from 'next/server'
import prisma           from '@/lib/db'

export async function GET() {
  try {
    // $queryRaw for the cross-table AVG + GROUP BY that Prisma ORM can't express in one call
    const rows = await prisma.$queryRaw<any[]>`
      SELECT c.*, COUNT(r.id) AS total_reviews, AVG(r.stars) AS avg_rating
      FROM campaigns c
      LEFT JOIN reviews r ON c.name = r.campaign
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `
    const data = rows.map(row => ({
      ...row,
      total_reviews: Number(row.total_reviews ?? 0),
      avg_rating: row.avg_rating == null ? null : Number(row.avg_rating),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Campaigns GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
