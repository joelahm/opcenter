import { NextRequest, NextResponse } from 'next/server'
import prisma                        from '@/lib/db'
import { fetchPatientsFromSheet }    from '@/lib/patient-sheets'

async function serializePatientList(list: any) {
  const [totalPatients, newPatients] = await Promise.all([
    prisma.patient.count({ where: { patientListId: list.id } }),
    prisma.patient.count({ where: { patientListId: list.id, isNew: true } }),
  ])

  return {
    id:                 list.id,
    client_id:          list.locationId,
    client_name:        list.location.name,
    sheet_link:         list.sheetLink,
    name_column:        list.nameColumn,
    email_column:       list.emailColumn,
    total_patients:     totalPatients,
    new_patients:       newPatients,
    last_campaign_ran:  list.lastCampaignRan?.toISOString() ?? null,
    last_imported_at:   list.lastImportedAt?.toISOString() ?? null,
    last_fetched_at:    list.lastFetchedAt?.toISOString() ?? null,
  }
}

export async function GET() {
  try {
    const [lists, availableClients] = await Promise.all([
      prisma.patientList.findMany({
        include: { location: { select: { id: true, name: true } } },
        orderBy: { location: { name: 'asc' } },
      }),
      prisma.location.findMany({
        where:   { patientList: null },
        select:  { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const data = await Promise.all(lists.map(serializePatientList))

    return NextResponse.json({
      success: true,
      data,
      available_clients: availableClients,
    })
  } catch (error) {
    console.error('Patient lists GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch patient lists' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { client_id, sheet_link, mapping } = await req.json()

    if (!client_id) {
      return NextResponse.json({ success: false, error: 'Client is required' }, { status: 400 })
    }

    if (!sheet_link?.trim()) {
      return NextResponse.json({ success: false, error: 'Google Sheet link is required' }, { status: 400 })
    }

    if (!mapping?.name || !mapping?.email) {
      return NextResponse.json({ success: false, error: 'Name and email columns are required' }, { status: 400 })
    }

    if (mapping?.name && mapping?.email && mapping.name === mapping.email) {
      return NextResponse.json({ success: false, error: 'Name and email must be mapped to different columns' }, { status: 400 })
    }

    const patients = await fetchPatientsFromSheet(sheet_link.trim(), {
      name:  mapping?.name,
      email: mapping?.email,
    })
    const now = new Date()

    const list = await prisma.patientList.create({
      data: {
        locationId:     client_id,
        sheetLink:      sheet_link.trim(),
        nameColumn:     mapping?.name,
        emailColumn:    mapping?.email,
        lastImportedAt: now,
        lastFetchedAt:  now,
        patients: {
          create: patients.map(patient => ({
            name:  patient.name,
            email: patient.email,
            isNew: false,
          })),
        },
      },
    })

    return NextResponse.json({
      success:  true,
      id:       list.id,
      imported: patients.length,
    })
  } catch (error: any) {
    console.error('Patient lists POST error:', error)

    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'This client already has a patient list' }, { status: 409 })
    }

    return NextResponse.json({ success: false, error: error?.message || 'Failed to import patient list' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
