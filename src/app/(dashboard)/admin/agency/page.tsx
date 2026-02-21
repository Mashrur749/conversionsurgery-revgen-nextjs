import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { agencyMessages, clients, systemSettings } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { AgencyDashboard } from './_components/agency-dashboard';

export default async function AgencyPage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect('/login');
  }

  const db = getDb();

  const [
    totalMessages,
    pendingPrompts,
    weeklyDigests,
    activeClients,
    agencyNumberSetting,
    clientList,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(agencyMessages)
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(agencyMessages)
      .where(
        and(
          eq(agencyMessages.actionStatus, 'pending'),
          eq(agencyMessages.category, 'action_prompt')
        )
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(agencyMessages)
      .where(
        and(
          eq(agencyMessages.category, 'weekly_digest'),
          sql`${agencyMessages.createdAt} >= now() - interval '7 days'`
        )
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(eq(clients.status, 'active'))
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, 'agency_twilio_number'))
      .then((r) => r[0]?.value ?? null),
    db
      .select({
        id: clients.id,
        businessName: clients.businessName,
      })
      .from(clients)
      .where(eq(clients.status, 'active'))
      .orderBy(clients.businessName),
  ]);

  return (
    <div>
      <AgencyDashboard
        stats={{
          totalMessages,
          pendingPrompts,
          weeklyDigests,
          activeClients,
        }}
        agencyNumber={agencyNumberSetting}
        clients={clientList}
      />
    </div>
  );
}
