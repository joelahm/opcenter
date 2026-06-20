import { NextRequest, NextResponse } from 'next/server'
import { getGbpReviewData }          from '@/lib/gbp-reviews'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')
    const data = await getGbpReviewData(locationId)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('GBP reviews GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch GBP reviews' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
