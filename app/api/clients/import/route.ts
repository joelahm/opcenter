import { NextRequest, NextResponse } from 'next/server'
import prisma                        from '@/lib/db'
import { LocationStatus }            from '@prisma/client'

interface ClientRow {
  name:     string
  address?: string
  phone?:   string
  website?: string
  gbp_id?:  string
  status?:  string
}

export async function POST(req: NextRequest) {
  try {
    const { rows }: { rows: ClientRow[] } = await req.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows provided' }, { status: 400 })
    }

    const valid   = rows.filter(r => r.name?.trim())
    const skipped = rows.length - valid.length

    if (valid.length === 0) {
      return NextResponse.json({ success: false, error: 'No rows with a valid name' }, { status: 400 })
    }

    // createMany skips duplicates via skipDuplicates (unique constraint on gbp_id)
    const result = await prisma.location.createMany({
      data: valid.map(r => ({
        name:         r.name.trim(),
        gbpId:        r.gbp_id?.trim()  || null,
        address:      r.address?.trim() || null,
        phone:        r.phone?.trim()   || null,
        website:      r.website?.trim() || null,
        status:       (r.status?.trim() || 'active') as LocationStatus,
        gbpConnected: false,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      success:  true,
      imported: result.count,
      skipped:  skipped + (valid.length - result.count),
    })
  } catch (error) {
    console.error('Clients import error:', error)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
}
