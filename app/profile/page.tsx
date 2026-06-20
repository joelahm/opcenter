import Topbar from '@/components/dashboard/Topbar'
import ProfileView from '@/components/profile/ProfileView'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Profile" subtitle="Manage your account credentials" />
      <div className="flex-1 overflow-y-auto">
        <ProfileView user={user} />
      </div>
    </div>
  )
}
