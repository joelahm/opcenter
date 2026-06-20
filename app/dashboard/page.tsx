import Topbar         from '@/components/dashboard/Topbar'
import GbpReviewsView from '@/components/gbp-reviews/GbpReviewsView'
import { getGbpReviewData } from '@/lib/gbp-reviews'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const data = await getGbpReviewData()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="GBP Reviews"
        subtitle="Review management by client location"
        alertCount={data.stats.unreplied}
      />
      <GbpReviewsView initialData={data} />
    </div>
  )
}
