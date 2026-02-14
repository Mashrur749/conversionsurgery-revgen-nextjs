import { getDb } from '@/db';
import { npsSurveys, appointments, leads, clients } from '@/db/schema';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';

/**
 * Send NPS survey for a completed appointment via SMS.
 */
export async function sendNpsSurvey(
  leadId: string,
  appointmentId: string
): Promise<{ success: boolean; surveyId?: string }> {
  const db = getDb();

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.optedOut) return { success: false };

  const [client] = await db
    .select({ id: clients.id, twilioNumber: clients.twilioNumber, businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.id, lead.clientId))
    .limit(1);

  if (!client?.twilioNumber) return { success: false };

  // Check if we already sent a survey for this appointment
  const [existing] = await db
    .select({ id: npsSurveys.id })
    .from(npsSurveys)
    .where(and(eq(npsSurveys.appointmentId, appointmentId), eq(npsSurveys.leadId, leadId)))
    .limit(1);

  if (existing) return { success: false };

  const [survey] = await db
    .insert(npsSurveys)
    .values({
      clientId: lead.clientId,
      leadId,
      appointmentId,
      sentVia: 'sms',
      status: 'sent',
    })
    .returning();

  const body = `Hi${lead.name ? ` ${lead.name}` : ''}! How was your experience with ${client.businessName}? Reply with a number 1-10 (10 = amazing). Your feedback helps us improve!`;

  const result = await sendCompliantMessage({
    clientId: lead.clientId,
    to: lead.phone,
    from: client.twilioNumber,
    body,
    messageCategory: 'transactional',
    consentBasis: { type: 'existing_consent' },
    leadId,
  });

  if (!result.sent) {
    await db
      .update(npsSurveys)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(npsSurveys.id, survey.id));
    return { success: false };
  }

  return { success: true, surveyId: survey.id };
}

/**
 * Process an NPS response from an incoming SMS.
 * Looks for a number 1-10 in the message text.
 */
export async function processNpsResponse(
  surveyId: string,
  score: number,
  comment?: string
): Promise<void> {
  const db = getDb();

  await db
    .update(npsSurveys)
    .set({
      score,
      comment: comment || null,
      respondedAt: new Date(),
      status: 'responded',
      updatedAt: new Date(),
    })
    .where(eq(npsSurveys.id, surveyId));
}

/**
 * Find pending NPS surveys for a lead (to match incoming responses).
 */
export async function findPendingSurvey(leadId: string) {
  const db = getDb();
  const [survey] = await db
    .select()
    .from(npsSurveys)
    .where(and(eq(npsSurveys.leadId, leadId), eq(npsSurveys.status, 'sent')))
    .limit(1);
  return survey;
}

/**
 * Send NPS surveys for completed appointments that happened 4+ hours ago
 * and haven't received a survey yet.
 */
export async function sendPendingNpsSurveys(): Promise<{
  sent: number;
  errors: number;
}> {
  const db = getDb();
  let sent = 0;
  let errors = 0;

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  // Find completed appointments from 4-24 hours ago without NPS surveys
  const completedAppointments = await db
    .select({
      id: appointments.id,
      leadId: appointments.leadId,
    })
    .from(appointments)
    .leftJoin(npsSurveys, eq(npsSurveys.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.status, 'completed'),
        lte(appointments.updatedAt, fourHoursAgo),
        isNull(npsSurveys.id)
      )
    )
    .limit(20);

  for (const appt of completedAppointments) {
    try {
      const result = await sendNpsSurvey(appt.leadId, appt.id);
      if (result.success) sent++;
    } catch (err) {
      console.error(`[NPS] Error sending survey for appointment ${appt.id}:`, err);
      errors++;
    }
  }

  console.log(`[NPS] Sent ${sent} surveys, ${errors} errors`);
  return { sent, errors };
}
