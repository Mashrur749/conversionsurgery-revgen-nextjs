import { getDb } from '@/db';
import { agencyMemberships, clientMemberships, clients, people, roleTemplates, systemSettings } from '@/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { sendEmail } from '@/lib/services/resend';

interface AccessReviewResult {
  skipped: boolean;
  month: string;
  sent: number;
}

/**
 * Sends monthly access review digest to agency owners.
 */
export async function processMonthlyAccessReview(now: Date = new Date()): Promise<AccessReviewResult> {
  const db = getDb();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const [lastRun] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'last_access_review_month'))
    .limit(1);

  if (lastRun?.value === monthKey) {
    return { skipped: true, month: monthKey, sent: 0 };
  }

  const owners = await db
    .select({
      email: people.email,
      name: people.name,
    })
    .from(agencyMemberships)
    .innerJoin(people, eq(agencyMemberships.personId, people.id))
    .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id))
    .where(
      and(
        eq(agencyMemberships.isActive, true),
        eq(roleTemplates.slug, 'agency_owner'),
        isNotNull(people.email)
      )
    );

  const agencyMembers = await db
    .select({
      id: agencyMemberships.id,
      name: people.name,
      email: people.email,
      role: roleTemplates.name,
      isActive: agencyMemberships.isActive,
      lastLoginAt: people.lastLoginAt,
    })
    .from(agencyMemberships)
    .innerJoin(people, eq(agencyMemberships.personId, people.id))
    .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id));

  const clientMembers = await db
    .select({
      id: clientMemberships.id,
      clientName: clients.businessName,
      name: people.name,
      email: people.email,
      role: roleTemplates.name,
      isActive: clientMemberships.isActive,
      lastLoginAt: people.lastLoginAt,
    })
    .from(clientMemberships)
    .innerJoin(clients, eq(clientMemberships.clientId, clients.id))
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .innerJoin(roleTemplates, eq(clientMemberships.roleTemplateId, roleTemplates.id));

  const staleThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const staleAgency = agencyMembers.filter((m) => !m.lastLoginAt || m.lastLoginAt < staleThreshold);
  const staleClient = clientMembers.filter((m) => !m.lastLoginAt || m.lastLoginAt < staleThreshold);

  let sent = 0;
  for (const owner of owners) {
    if (!owner.email) continue;
    try {
      await sendEmail({
        to: owner.email,
        subject: `Monthly Access Review — ${monthKey}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Monthly Access Review (${monthKey})</h2>
            <p>Agency members: <strong>${agencyMembers.length}</strong> (${staleAgency.length} stale)</p>
            <p>Client memberships: <strong>${clientMembers.length}</strong> (${staleClient.length} stale)</p>
            <h3>Stale Agency Access (90+ days)</h3>
            <ul>${staleAgency.slice(0, 20).map((m) => `<li>${m.name} (${m.email || 'no email'}) — ${m.role}</li>`).join('') || '<li>None</li>'}</ul>
            <h3>Stale Client Access (90+ days)</h3>
            <ul>${staleClient.slice(0, 20).map((m) => `<li>${m.clientName}: ${m.name} (${m.email || 'no email'}) — ${m.role}</li>`).join('') || '<li>None</li>'}</ul>
            <p>Action: Review and deactivate unused access where appropriate.</p>
          </div>
        `,
      });
      sent++;
    } catch (error) {
      console.error('[AccessReview] Failed to send email', owner.email, error);
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: 'last_access_review_month',
      value: monthKey,
      description: 'Last month access review digest was sent',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: monthKey, updatedAt: new Date() },
    });

  return { skipped: false, month: monthKey, sent };
}
