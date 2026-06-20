import Topbar           from '@/components/dashboard/Topbar'
import PatientListsView from '@/components/patient-lists/PatientListsView'
import prisma           from '@/lib/db'
import { requireUser }  from '@/lib/auth'

async function getPatientLists() {
  const [lists, availableClients] = await Promise.all([
    prisma.patientList.findMany({
      include: { location: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.location.findMany({
      where:   { patientList: null },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const data = await Promise.all(lists.map(async list => {
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
  }))

  return { data, availableClients }
}

export default async function PatientListsPage() {
  const user = await requireUser()
  const { data, availableClients } = await getPatientLists()
  const totalPatients = data.reduce((sum, list) => sum + list.total_patients, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Patient Lists"
        subtitle={`${data.length} connected lists - ${totalPatients} patients`}
      />
      <div className="flex-1 overflow-y-auto">
        <PatientListsView initialLists={data} initialAvailableClients={availableClients} role={user.role} />
      </div>
    </div>
  )
}
