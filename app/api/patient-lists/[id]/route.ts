import { NextRequest, NextResponse } from 'next/server'
import prisma                        from '@/lib/db'
import { fetchPatientsFromSheet, getPatientSyncPlan } from '@/lib/patient-sheets'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { sheet_link, mapping } = await req.json()

    if (!sheet_link?.trim()) {
      return NextResponse.json({ success: false, error: 'Google Sheet link is required' }, { status: 400 })
    }

    if (!mapping?.name || !mapping?.email) {
      return NextResponse.json({ success: false, error: 'Name and email columns are required' }, { status: 400 })
    }

    if (mapping.name === mapping.email) {
      return NextResponse.json({ success: false, error: 'Name and email must be mapped to different columns' }, { status: 400 })
    }

    const list = await prisma.patientList.findUnique({
      where:  { id: params.id },
      select: { id: true },
    })

    if (!list) {
      return NextResponse.json({ success: false, error: 'Patient list not found' }, { status: 404 })
    }

    const patients = await fetchPatientsFromSheet(sheet_link.trim(), {
      name:  mapping.name,
      email: mapping.email,
    })
    const now = new Date()
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
      data: {
        sheetLink:       sheet_link.trim(),
        nameColumn:      mapping.name,
        emailColumn:     mapping.email,
        lastFetchedAt:   now,
        lastImportedAt:  now,
      },
    })

    return NextResponse.json({
      success: true,
      imported,
      removed: removedEmails.length,
      total:   patients.length,
      message: `Updated mapping and synced ${patients.length} row${patients.length === 1 ? '' : 's'} - ${imported} new, ${removedEmails.length} removed`,
    })
  } catch (error: any) {
    console.error('Patient list PATCH error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update patient list mapping' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.patientList.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Patient list DELETE error:', error)

    if (error?.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Patient list not found' }, { status: 404 })
    }

    return NextResponse.json({ success: false, error: 'Failed to delete patient list' }, { status: 500 })
  }
}
