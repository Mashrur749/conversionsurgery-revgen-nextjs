import { getDb } from '@/db';
import { appointments, leads, scheduledMessages, conversations, auditLog } from '@/db/schema';
import { eq, and, inArray, lte, gte, desc } from 'drizzle-orm';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';
import { detectCompetitorChosenSignal } from '@/lib/automations/estimate-auto-trigger';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const TRIGGER_AFTER_DAYS = 3;
const MAX_APPOINTMENT_AGE_DAYS = 30;
const CONVERSATION_SILENCE_HOURS = 48;
const RESOLVED_STATUSES = ['won', 'lost', 'closed', 'estimate_sent'] as const;

/**
 * Daily cron: find appointments 3-30 days old where no estimate follow-up
 * has been triggered. Infers that the estimate was given at/after the
 * appointment and starts the follow-up sequence automatically.
 *
 * This removes the dependency on contractors flagging "estimate sent."
 */
export async function runAppointmentFollowupTrigger(): Promise<{
  processed: number;
  triggered: number;
  skipped: number;
}> {
  const db = getDb();
  const now = new Date();
  const triggerCutoff = new Date(now.getTime() - TRIGGER_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const maxAgeCutoff = new Date(now.getTime() - MAX_APPOINTMENT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const silenceCutoff = new Date(now.getTime() - CONVERSATION_SILENCE_HOURS * 60 * 60 * 1000);

  const triggerDate = triggerCutoff.toISOString().split('T')[0];
  const maxAgeDate = maxAgeCutoff.toISOString().split('T')[0];

  // 1. Query qualifying appointments: completed/confirmed, 3-30 days old
  const qualifyingAppointments = await db
    .select({
      id: appointments.id,
      leadId: appointments.leadId,
      clientId: appointments.clientId,
      appointmentDate: appointments.appointmentDate,
    })
    .from(appointments)
    .where(
      and(
        inArray(appointments.status, ['completed', 'confirmed']),
        lte(appointments.appointmentDate, triggerDate),
        gte(appointments.appointmentDate, maxAgeDate)
      )
    );

  if (qualifyingAppointments.length === 0) {
    return { processed: 0, triggered: 0, skipped: 0 };
  }

  // Deduplicate by leadId (one lead may have multiple appointments)
  const seenLeads = new Set<string>();
  const uniqueAppointments = qualifyingAppointments.filter((a) => {
    if (seenLeads.has(a.leadId)) return false;
    seenLeads.add(a.leadId);
    return true;
  });

  let triggered = 0;
  let skipped = 0;

  for (const appt of uniqueAppointments) {
    try {
      // Filter 1: Lead status not resolved
      const [lead] = await db
        .select({ status: leads.status })
        .from(leads)
        .where(eq(leads.id, appt.leadId))
        .limit(1);

      if (!lead || (RESOLVED_STATUSES as readonly string[]).includes(lead.status ?? '')) {
        skipped++;
        continue;
      }

      // Filter 2: No active estimate follow-up sequence
      const [activeSequence] = await db
        .select({ id: scheduledMessages.id })
        .from(scheduledMessages)
        .where(
          and(
            eq(scheduledMessages.leadId, appt.leadId),
            eq(scheduledMessages.sequenceType, 'estimate_followup'),
            eq(scheduledMessages.sent, false),
            eq(scheduledMessages.cancelled, false)
          )
        )
        .limit(1);

      if (activeSequence) {
        skipped++;
        continue;
      }

      // Filter 3: No outbound conversation in last 48h
      const [recentOutbound] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.leadId, appt.leadId),
            eq(conversations.direction, 'outbound'),
            gte(conversations.createdAt, silenceCutoff)
          )
        )
        .limit(1);

      if (recentOutbound) {
        skipped++;
        continue;
      }

      // Filter 4: Competitor-chosen guard
      const recentInbound = await db
        .select({ content: conversations.content })
        .from(conversations)
        .where(
          and(
            eq(conversations.leadId, appt.leadId),
            eq(conversations.direction, 'inbound')
          )
        )
        .orderBy(desc(conversations.createdAt))
        .limit(5);

      const competitorDetected = recentInbound.some(
        (conv) => conv.content !== null && detectCompetitorChosenSignal(conv.content)
      );

      if (competitorDetected) {
        skipped++;
        continue;
      }

      // Action: start estimate follow-up sequence (also sets lead status to estimate_sent)
      const result = await startEstimateFollowup({
        leadId: appt.leadId,
        clientId: appt.clientId,
      });

      if (result.success) {
        triggered++;

        // Audit log
        await db.insert(auditLog).values({
          clientId: appt.clientId,
          action: 'appointment_followup_triggered',
          resourceType: 'lead',
          resourceId: appt.leadId,
          metadata: {
            appointmentId: appt.id,
            appointmentDate: appt.appointmentDate,
            scheduledCount: result.scheduledCount,
          } as Record<string, unknown>,
        });
      } else {
        skipped++;
      }
    } catch (err) {
      logSanitizedConsoleError('[AppointmentFollowup] Error processing appointment:', err, {
        appointmentId: appt.id,
        leadId: appt.leadId,
      });
      skipped++;
    }
  }

  console.log('[AppointmentFollowup] Complete:', { processed: uniqueAppointments.length, triggered, skipped });
  return { processed: uniqueAppointments.length, triggered, skipped };
}
