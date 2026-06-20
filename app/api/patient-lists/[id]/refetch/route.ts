import { NextResponse }          from 'next/server'
import prisma                    from '@/lib/db'
import { fetchPatientsFromSheet, getPatientSyncPlan } from '@/lib/patient-sheets'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const list = await prisma.patientList.findUnique({
      where:  { id: params.id },
      select: { id: true, sheetLink: true, nameColumn: true, emailColumn: true },
    })

    if (!list) {
      return NextResponse.json({ success: false, error: 'Patient list not found' }, { status: 404 })
    }

    if (!list.nameColumn || !list.emailColumn) {
      return NextResponse.json(
        {
          success: false,
          needs_mapping: true,
          error: 'This patient list needs column mapping before it can be refetched',
        },
        { status: 400 }
      )
    }

    const patients = await fetchPatientsFromSheet(list.sheetLink, {
      name:  list.nameColumn,
      email: list.emailColumn,
    })
    const existingPatients = await prisma.patient.findMany({
      where:  { patientListId: list.id },
      select: { email: true },
    })
    const { existingEmails, removedEmails } = getPatientSyncPlan(patients, existingPatients)
    let imported = 0

    await prisma.patient.updateMany({
      where: { patientListId: list.id, isNew: true },
      data:  { isNew: false },
    })

    if (removedEmails.length > 0) {
      await prisma.patient.deleteMany({
        where: {
          patientListId: list.id,
          email:         { in: removedEmails },
        },
      })
    }

    for (const patient of patients) {
      const isNewPatient = !existingEmails.has(patient.email.toLowerCase())

      await prisma.patient.upsert({
        where: {
          patientListId_email: {
            patientListId: list.id,
            email:         patient.email,
          },
        },
        update: { name: patient.name, isNew: false },
        create: {
          patientListId: list.id,
          name:          patient.name,
          email:         patient.email,
          isNew:         isNewPatient,
        },
      })

      if (isNewPatient) {
        imported += 1
      }
    }

    await prisma.patientList.update({
      where: { id: list.id },
      data:  { lastFetchedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      imported,
      removed: removedEmails.length,
      total:   patients.length,
      message: `Synced ${patients.length} rows - ${imported} new, ${removedEmails.length} removed`,
    })
  } catch (error: any) {
    console.error('Patient list refetch error:', error)
    const needsMapping = String(error?.message || '').toLowerCase().includes('map the sheet columns')
    return NextResponse.json({
      success: false,
      needs_mapping: needsMapping,
      error: error?.message || 'Failed to refetch patient list',
    }, { status: needsMapping ? 400 : 500 })
  }
}
