import Link       from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Topbar     from '@/components/dashboard/Topbar'
import prisma     from '@/lib/db'

export default async function PatientListDetailPage({ params }: { params: { id: string } }) {
  const list = await prisma.patientList.findUnique({
    where: { id: params.id },
    include: {
      location: { select: { name: true } },
      patients: {
        orderBy: { importedAt: 'desc' },
      },
    },
  })

  if (!list) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Topbar title="Patient List" subtitle="Not found" />
        <div className="p-5">
          <Link href="/patient-lists" className="text-sm text-indigo-600 hover:text-indigo-700">Back to patient lists</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title={list.location.name}
        subtitle={`${list.patients.length} patients`}
      />
      <div className="flex-1 overflow-y-auto p-5">
        <Link
          href="/patient-lists"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 mb-4"
        >
          <ArrowLeft size={13} /> Back
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1.8fr_0.7fr_1fr] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>Name</span>
            <span>Email</span>
            <span>Status</span>
            <span>Imported</span>
          </div>

          <div className="divide-y divide-gray-50">
            {list.patients.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-400">No patients imported.</div>
            ) : list.patients.map(patient => (
              <div
                key={patient.id}
                className="grid grid-cols-[1.5fr_1.8fr_0.7fr_1fr] gap-3 px-4 py-3 items-center hover:bg-gray-50/70 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 truncate">{patient.name}</span>
                <span className="text-xs text-gray-500 truncate">{patient.email}</span>
                <span className={`w-fit text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  patient.isNew ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {patient.isNew ? 'New' : 'Existing'}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  {patient.importedAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
