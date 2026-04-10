/**
 * No-Show Recovery Automation
 *
 * Detects missed appointments and sends AI-personalized follow-ups.
 * Sequence:
 *   1. Immediately: send contractor a notification SMS so they can follow up directly.
 *   2. After 2-hour delay: send homeowner the recovery SMS (scheduled via scheduledMessages).
 *   3. 2 days later: second follow-up attempt.
 * Max 2 homeowner attempts, all through compliance gateway.
 */

import { getDb } from '@/db';
import { appointments, calendarEvents, clientMemberships, leads, clients, people, scheduledMessages } from '@/db/schema';
import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { buildAIContext } from '@/lib/agent/context-builder';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { getTrackedAI } from '@/lib/ai';
import { format, parse } from 'date-fns';

/**
 * Returns a Date representing 10:00 AM on the date that is `daysFromNow` days
 * from now, expressed in the client's local timezone.
 *
 * Using `setHours(10, 0, 0, 0)` would set 10am in the *server's* timezone
 * (UTC in production), which is wrong for clients in US timezones. Instead we:
 * 1. Determine the local calendar date N days out using Intl.DateTimeFormat.
 * 2. Build a UTC candidate for 10:00 on that calendar date.
 * 3. Check what local hour that candidate falls on and shift by the difference.
 */
function tenAmLocalTime(daysFromNow: number, timezone: string): Date {
  const now = new Date();
  const futureUtc = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);

  // Get the local calendar date (YYYY-MM-DD) in the client's timezone
  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(futureUtc);

  const [year, month, day] = localDateStr.split('-').map(Number);

  // Start with a UTC timestamp for 10:00 UTC on that calendar date
  const candidateUtc = new Date(Date.UTC(year, month - 1, day, 10, 0, 0, 0));

  // Determine what local hour that candidate falls on in the client's timezone
  const localHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(candidateUtc);
  const localHour = Number(localHourStr);

  // Shift to align with 10:00 local
  const offsetMs = (10 - localHour) * 60 * 60 * 1000;
  return new Date(candidateUtc.getTime() + offsetMs);
}

/**
 * Detects appointments that are 2+ hours past their time and still 'scheduled'.
 * Marks them as no_show and triggers the first recovery message.
 */
export async function processNoShows(): Promise<{
  detected: number;
  messaged: number;
  errors: string[];
}> {
  const db = getDb();
  const errors: string[] = [];
  let detected = 0;
  let messaged = 0;

  // Find appointments that are 2+ hours past their scheduled time and still 'scheduled'
  const noShows = await db
    .select({
      appointment: appointments,
      lead: leads,
      client: clients,
    })
    .from(appointments)
    .innerJoin(leads, eq(appointments.leadId, leads.id))
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(
      eq(appointments.status, 'scheduled'),
      // appointment_date + appointment_time + 2 hours < now
      lte(
        sql`(${appointments.appointmentDate}::date + ${appointments.appointmentTime}::time + interval '2 hours')`,
        sql`now()`
      )
    ));

  if (noShows.length === 0) {
    return { detected: 0, messaged: 0, errors: [] };
  }

  detected = noShows.length;

  // Batch update: mark all appointments as no_show at once
  const appointmentIds = noShows.map(({ appointment }) => appointment.id);
  await db
    .update(appointments)
    .set({ status: 'no_show', updatedAt: new Date() })
    .where(inArray(appointments.id, appointmentIds));

  // Filter to actionable leads (has Twilio number)
  const actionableNoShows = noShows.filter(({ client }) => {
    if (!client.twilioNumber) {
      errors.push(`Client ${client.id}: no Twilio number`);
      return false;
    }
    return true;
  });

  // Process with concurrency limit (max 5 concurrent AI + SMS operations)
  const CONCURRENCY = 5;
  for (let i = 0; i < actionableNoShows.length; i += CONCURRENCY) {
    const batch = actionableNoShows.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async ({ appointment, lead, client }) => {
        const apptDateTime = parse(
          `${appointment.appointmentDate} ${appointment.appointmentTime.substring(0, 5)}`,
          'yyyy-MM-dd HH:mm',
          new Date()
        );
        const formattedTime = format(apptDateTime, 'h:mm a');
        const formattedDate = format(apptDateTime, 'EEEE, MMM d');
        const leadName = lead.name || 'Customer';

        // Step 1: Notify the contractor immediately so they can follow up directly.
        // If a team member was assigned to this appointment, notify them as well as the owner.
        const contractorMsg = `No-show alert: ${leadName} missed their ${formattedDate} at ${formattedTime} appointment. We will send them a recovery SMS in 2 hours. You can reach them directly at ${lead.phone}.`;

        // Look up the calendar event for this appointment to find the assigned crew member
        let assignedMemberPhone: string | null = null;
        try {
          const [calEvent] = await db
            .select({ assignedTeamMemberId: calendarEvents.assignedTeamMemberId })
            .from(calendarEvents)
            .where(eq(calendarEvents.leadId, lead.id))
            .limit(1);

          if (calEvent?.assignedTeamMemberId) {
            const [member] = await db
              .select({ phone: people.phone })
              .from(clientMemberships)
              .innerJoin(people, eq(clientMemberships.personId, people.id))
              .where(eq(clientMemberships.id, calEvent.assignedTeamMemberId))
              .limit(1);

            if (member?.phone) {
              try {
                assignedMemberPhone = normalizePhoneNumber(member.phone);
              } catch {
                assignedMemberPhone = null;
              }
            }
          }
        } catch (err) {
          console.error(`[NoShowRecovery] Failed to look up assigned crew member for appointment ${appointment.id}:`, err);
        }

        // Normalize owner phone for duplicate detection
        let ownerPhone: string | null = null;
        try {
          ownerPhone = client.phone ? normalizePhoneNumber(client.phone) : null;
        } catch {
          ownerPhone = null;
        }

        // Send to owner
        try {
          if (ownerPhone) {
            await sendCompliantMessage({
              clientId: client.id,
              to: client.phone,
              from: client.twilioNumber as string,
              body: contractorMsg,
              messageClassification: 'proactive_outreach',
              messageCategory: 'transactional',
              consentBasis: { type: 'existing_consent' },
              metadata: {
                source: 'no_show_contractor_notification',
                appointmentId: appointment.id,
                recipient: 'owner',
              },
            });
          }
        } catch (err) {
          // Non-fatal — log and continue to schedule homeowner recovery
          console.error(`[NoShowRecovery] Contractor (owner) notification failed for appointment ${appointment.id}:`, err);
        }

        // Send to assigned crew member if different from owner
        if (assignedMemberPhone && assignedMemberPhone !== ownerPhone) {
          try {
            await sendCompliantMessage({
              clientId: client.id,
              to: assignedMemberPhone,
              from: client.twilioNumber as string,
              body: contractorMsg,
              messageClassification: 'proactive_outreach',
              messageCategory: 'transactional',
              consentBasis: { type: 'existing_consent' },
              metadata: {
                source: 'no_show_contractor_notification',
                appointmentId: appointment.id,
                recipient: 'assigned_crew',
              },
            });
          } catch (err) {
            console.error(`[NoShowRecovery] Assigned crew notification failed for appointment ${appointment.id}:`, err);
          }
        }

        // Step 2: Schedule the homeowner recovery SMS with a 2-hour delay.
        // This gives the contractor time to reach out directly first.
        const homeownerRecoveryAt = new Date();
        homeownerRecoveryAt.setHours(homeownerRecoveryAt.getHours() + 2);

        await db.insert(scheduledMessages).values({
          leadId: lead.id,
          clientId: client.id,
          sendAt: homeownerRecoveryAt,
          sequenceType: 'no_show_followup',
          sequenceStep: 1,
          content: '__AI_GENERATE__',
        });

        messaged++;

        // Step 3: Also schedule the second follow-up 2 days from now at 10am
        // in the client's local timezone (not the server's UTC timezone).
        const followUpDate = tenAmLocalTime(2, client.timezone || 'America/New_York');

        await db.insert(scheduledMessages).values({
          leadId: lead.id,
          clientId: client.id,
          sendAt: followUpDate,
          sequenceType: 'no_show_followup',
          sequenceStep: 2,
          content: '__AI_GENERATE__',
        });
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`Batch error: ${reason}`);
      }
    }
  }

  return { detected, messaged, errors };
}

/**
 * Processes second no-show follow-up messages.
 * Called by the scheduled message processor when it encounters 'no_show_followup_2' type.
 */
export async function processNoShowFollowUp(
  leadId: string,
  clientId: string
): Promise<string | null> {
  const db = getDb();

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);

  if (!lead || !client || !client.twilioNumber) return null;

  // Find the most recent no-show appointment
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(and(
      eq(appointments.leadId, leadId),
      eq(appointments.status, 'no_show')
    ))
    .limit(1);

  if (!appointment) return null;

  const message = await generateNoShowMessage(
    clientId,
    leadId,
    lead.name || 'there',
    appointment.appointmentDate,
    appointment.appointmentTime,
    client.businessName,
    client.ownerName,
    2 // second attempt
  );

  return message;
}

/**
 * Generates an AI-personalized no-show follow-up using the context pipeline.
 */
async function generateNoShowMessage(
  clientId: string,
  leadId: string,
  leadName: string,
  appointmentDate: string,
  appointmentTime: string,
  businessName: string,
  ownerName: string,
  attempt: number
): Promise<string | null> {
  try {
    const context = await buildAIContext({
      clientId,
      leadId,
      purpose: 'no_show_recovery',
    });

    const attemptPrompt = attempt === 1
      ? `This is the FIRST follow-up after a no-show. Be warm and understanding. Reference their specific project if known.`
      : `This is the SECOND and FINAL follow-up. Be even shorter and more casual. Give them an easy out.`;

    const ai = getTrackedAI({ clientId, operation: 'no_show_recovery', leadId, metadata: { attempt } });
    const result = await ai.chat(
      [
        {
          role: 'user',
          content: `Write a follow-up text message (attempt ${attempt} of 2).`,
        },
      ],
      {
        systemPrompt: `You are writing a no-show follow-up SMS from ${ownerName} at ${businessName}.
The customer "${leadName}" missed their appointment on ${appointmentDate} at ${appointmentTime}.

${attemptPrompt}

${context.guardrailText}

Rules:
- 1-2 short sentences maximum
- Sound like a real person texting, not a bot
- Be warm and understanding — no guilt, no pressure
- Reference their specific project/need from conversation history if available
- Offer to reschedule, make it easy
- Do NOT use exclamation marks excessively
- Do NOT mention how long it's been
- Do NOT use "just checking in"

Conversation context:
${context.conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

Project info: ${context.lead.projectInfo.type || 'unknown'}`,
        temperature: 0.8,
        maxTokens: 150,
      },
    );

    const text = result.content.trim();

    return text || null;
  } catch (err) {
    console.error('[NoShowRecovery] AI generation error:', err);
    return null;
  }
}
