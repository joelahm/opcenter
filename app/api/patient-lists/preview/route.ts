import { NextRequest, NextResponse } from 'next/server'
import { previewPatientSheet }        from '@/lib/patient-sheets'

export async function POST(req: NextRequest) {
  try {
    const { sheet_link } = await req.json()

    if (!sheet_link?.trim()) {
      return NextResponse.json({ success: false, error: 'Google Sheet link is required' }, { status: 400 })
    }

    const preview = await previewPatientSheet(sheet_link.trim())

    if (preview.headers.length === 0) {
      return NextResponse.json({ success: false, error: 'No header row found in this sheet' }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...preview })
  } catch (error: any) {
    console.error('Patient sheet preview error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to preview patient sheet' }, { status: 500 })
  }
}
