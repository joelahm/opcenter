import Topbar from '@/components/dashboard/Topbar'
import SettingsView from '@/components/settings/SettingsView'
import prisma from '@/lib/db'
import { getDailySummarySettings } from '@/lib/daily-summary'
import { getGmailOAuthSettings } from '@/lib/gmail-oauth'
import { getGbpOAuthSettings } from '@/lib/gbp-oauth'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getSettingsData() {
  const current = await requireUser()
  const [users, invites, summary, gmail, gbp] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      take:    50,
    }),
    getDailySummarySettings(),
    getGmailOAuthSettings(),
    getGbpOAuthSettings(),
  ])

  return {
    current_user_id: current.id,
    users: users.map(user => ({
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt:   user.createdAt.toISOString(),
    })),
    invites: invites.map(invite => ({
      id:         invite.id,
      email:      invite.email,
      role:       invite.role,
      status:     invite.status,
      expires_at: invite.expiresAt.toISOString(),
      created_at: invite.createdAt.toISOString(),
    })),
    summary,
    gmail,
    gbp,
  }
}

export default async function SettingsPage() {
  const data = await getSettingsData()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Settings" subtitle="Users, invites, and Discord daily summary" />
      <div className="flex-1 overflow-y-auto">
        <SettingsView initialData={data} />
      </div>
    </div>
  )
}
