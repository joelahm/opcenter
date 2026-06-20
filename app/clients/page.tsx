import Topbar     from '@/components/dashboard/Topbar'
import ClientsView from '@/components/clients/ClientsView'
import prisma      from '@/lib/db'
import { requireUser } from '@/lib/auth'

async function getClients() {
  // $queryRaw for AVG + COUNT aggregate per location — Prisma ORM can't do this in one typed call yet
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      l.*,
      COUNT(r.id)                                         AS total_reviews,
      AVG(r.stars)                                        AS avg_rating,
      SUM(CASE WHEN r.replied = TRUE  THEN 1 ELSE 0 END) AS replied_count,
      SUM(CASE WHEN r.replied = FALSE THEN 1 ELSE 0 END) AS unreplied_count
    FROM locations l
    LEFT JOIN reviews r ON l.id = r.location_id
    GROUP BY l.id
    ORDER BY l.name ASC, l.created_at DESC
  `
  // Normalise BigInt counts (MySQL $queryRaw returns COUNT as BigInt)
  return rows.map((r: any) => ({
    ...r,
    total_reviews:   Number(r.total_reviews   ?? 0),
    replied_count:   Number(r.replied_count   ?? 0),
    unreplied_count: Number(r.unreplied_count ?? 0),
    avg_rating:      parseFloat(String(r.avg_rating ?? 0)),
    gbp_connected:   Boolean(r.gbp_connected),
  }))
}

export default async function ClientsPage() {
  const user = await requireUser()
  const clients = await getClients()
  const connected = clients.filter((c: any) => c.gbp_connected).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Clients"
        subtitle={`${clients.length} clients · ${connected} GBP connected`}
      />
      <div className="flex-1 overflow-y-auto">
        <ClientsView initialClients={clients} role={user.role} />
      </div>
    </div>
  )
}
