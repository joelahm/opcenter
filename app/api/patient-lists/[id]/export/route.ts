import { NextResponse }       from 'next/server'
import prisma                 from '@/lib/db'
import { patientsToCsv }      from '@/lib/patient-sheets'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const list = await prisma.patientList.findUnique({
      where: { id: params.id },
      include: {
        location: { select: { name: true } },
        patients: {
          where:   { isNew: true },
          select:  { id: true, name: true, email: true },
          orderBy: { importedAt: 'desc' },
        },
      },
    })

    if (!list) {
      return NextResponse.json({ success: false, error: 'Patient list not found' }, { status: 404 })
    }

    const csv = patientsToCsv(list.patients)
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const time = now.toTimeString().slice(0, 5).replace(':', '-')
    const clientName = list.location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const fileName = `${clientName}-${date}-${time}-new-patient.csv`
    const exportedIds = list.patients.map(patient => patient.id)

    if (exportedIds.length > 0) {
      await prisma.patient.updateMany({
        where: { id: { in: exportedIds } },
        data:  { isNew: false },
      })

      await prisma.patientList.update({
        where: { id: list.id },
        data:  { lastCampaignRan: new Date() },
      })
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Patient list export error:', error)
    return NextResponse.json({ success: false, error: 'Failed to export new patients' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
