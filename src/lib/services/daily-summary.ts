import { getDb, clients, dailyStats, leads, appointments, conversations, notificationPreferences } from '@/db';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { sendEmail } from '@/lib/services/resend';
import { createMagicLink } from '@/lib/services/magic-link';
import { formatDailySummaryEmail } from './daily-summary-template';

interface DailyStats {
  newLeads: number;
  messagesSent: number;
  messagesReceived: number;
  appointmentsBooked: number;
  missedCalls: number;
}

interface LeadNeedingAttention {
  id: string;
  name: string | null;
  phone: string;
  lastMessageAt: Date | null;
}

interface TodayAppointment {
  leadName: string | null;
  leadPhone: string;
  time: string;
  status: string | null;
}

export async function getDailyStats(clientId: string, date: string): Promise<DailyStats> {
  const db = getDb();

  const [stats] = await db
    .select({
      newLeads: sql<number>`COALESCE(SUM(${dailyStats.conversationsStarted}), 0)`,
      messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
      missedCalls: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      eq(dailyStats.date, date)
    ));

  // Count inbound messages for the day
  const startOfDay = new Date(`${date}T00:00:00Z`);
  const endOfDay = new Date(`${date}T23:59:59Z`);

  const [inbound] = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(and(
      eq(conversations.clientId, clientId),
      eq(conversations.direction, 'inbound'),
      gte(conversations.createdAt, startOfDay),
      lte(conversations.createdAt, endOfDay)
    ));

  // Count appointments booked that day
  const [appts] = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointments)
    .where(and(
      eq(appointments.clientId, clientId),
      gte(appointments.createdAt, startOfDay),
      lte(appointments.createdAt, endOfDay)
    ));

  return {
    newLeads: Number(stats?.newLeads || 0),
    messagesSent: Number(stats?.messagesSent || 0),
    messagesReceived: Number(inbound?.count || 0),
    appointmentsBooked: Number(appts?.count || 0),
    missedCalls: Number(stats?.missedCalls || 0),
  };
}

export async function getLeadsNeedingAttention(clientId: string): Promise<LeadNeedingAttention[]> {
  const db = getDb();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Leads with recent inbound messages but no outbound response in 2+ hours
  const needsAttention = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      lastMessageAt: leads.updatedAt,
    })
    .from(leads)
    .where(and(
      eq(leads.clientId, clientId),
      eq(leads.actionRequired, true),
      lte(leads.updatedAt, twoHoursAgo)
    ))
    .orderBy(desc(leads.updatedAt))
    .limit(10);

  return needsAttention;
}

export async function getTodayAppointments(clientId: string, date: string): Promise<TodayAppointment[]> {
  const db = getDb();

  const todayAppts = await db
    .select({
      leadName: leads.name,
      leadPhone: leads.phone,
      time: appointments.appointmentTime,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(leads, eq(appointments.leadId, leads.id))
    .where(and(
      eq(appointments.clientId, clientId),
      eq(appointments.appointmentDate, date)
    ))
    .orderBy(appointments.appointmentTime);

  return todayAppts;
}

export async function sendDailySummary(clientId: string): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const [stats, needsAttention, todayAppts] = await Promise.all([
    getDailyStats(clientId, yesterdayStr),
    getLeadsNeedingAttention(clientId),
    getTodayAppointments(clientId, todayStr),
  ]);

  // Skip email if there was zero activity and no appointments today
  const hasActivity = stats.newLeads > 0 || stats.messagesSent > 0 ||
    stats.messagesReceived > 0 || stats.appointmentsBooked > 0 ||
    needsAttention.length > 0 || todayAppts.length > 0;

  if (!hasActivity) {
    console.log(`[DailySummary] Skipping ${client.businessName} — no activity`);
    return;
  }

  const dashboardLink = await createMagicLink(clientId);

  const { subject, html } = formatDailySummaryEmail(
    client.businessName,
    client.ownerName,
    stats,
    needsAttention,
    todayAppts,
    dashboardLink
  );

  await sendEmail({ to: client.email, subject, html });
}

export async function processDailySummaries(): Promise<number> {
  const db = getDb();

  // Find clients who have daily summary enabled in notification preferences
  const eligibleClients = await db
    .select({
      clientId: notificationPreferences.clientId,
    })
    .from(notificationPreferences)
    .innerJoin(clients, eq(notificationPreferences.clientId, clients.id))
    .where(and(
      eq(notificationPreferences.emailDailySummary, true),
      eq(clients.status, 'active')
    ));

  let sent = 0;
  for (const { clientId } of eligibleClients) {
    try {
      await sendDailySummary(clientId);
      sent++;
    } catch (error) {
      console.error(`[DailySummary] Failed for client ${clientId}:`, error);
    }
  }

  return sent;
}
