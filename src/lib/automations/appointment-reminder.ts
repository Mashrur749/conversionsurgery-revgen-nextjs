import { getDb, clients, leads, appointments, scheduledMessages } from '@/db';
import { conversations, leadContext } from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { subDays, subHours, parse, format } from 'date-fns';
import { resolveReminderRecipients } from '@/lib/services/reminder-routing';

/**
 * Returns the UTC Date representing 10:00 AM on the day that is `daysOffset`
 * days before `baseDate`, expressed in the given IANA timezone.
 *
 * Cannot use `setHours(10, 0, 0, 0)` — that adjusts wall-clock time in the
 * *server's* local timezone (UTC in production). Clients may be in any US or
 * Canadian timezone, so we derive the correct UTC offset using Intl.DateTimeFormat.
 */
function tenAmOnDayBefore(baseDate: Date, daysOffset: number, timezone: string): Date {
  const targetDate = subDays(baseDate, daysOffset);

  // Determine the local calendar date in the client's timezone
  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(targetDate);

  const [year, month, day] = localDateStr.split('-').map(Number);

  // Build a UTC candidate for 10:00 UTC on that local calendar date
  const candidateUtc = new Date(Date.UTC(year, month - 1, day, 10, 0, 0, 0));

  // Check what local hour that candidate actually falls on
  const localHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(candidateUtc);
  const localHour = Number(localHourStr);

  // Shift so the result lands at 10:00 local
  const offsetMs = (10 - localHour) * 60 * 60 * 1000;
  return new Date(candidateUtc.getTime() + offsetMs);
}

/**
 * Builds a concise pre-appointment context brief for the contractor 2-hour reminder.
 * Fetches the lead's AI context signals and the last few conversation messages so the
 * estimator arrives prepared without needing to open the dashboard.
 *
 * Format: "[Name] - [projectType]. Budget: ~$[value]. [sentiment]. Notes: [summary]. [address]"
 */
async function buildContextBrief(
  leadId: string,
  leadName: string | null,
  appointmentAddress: string,
  formattedTime: string
): Promise<string> {
  const db = getDb();

  // Fetch lead context signals
  const [ctx] = await db
    .select({
      projectType: leadContext.projectType,
      estimatedValue: leadContext.estimatedValue,
      currentSentiment: leadContext.currentSentiment,
      conversationSummary: leadContext.conversationSummary,
      urgencyScore: leadContext.urgencyScore,
    })
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  // Fetch last 5 inbound messages for context
  const recentMessages = await db
    .select({ content: conversations.content, direction: conversations.direction })
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, leadId),
        eq(conversations.direction, 'inbound')
      )
    )
    .orderBy(desc(conversations.createdAt))
    .limit(3);

  const name = leadName || 'Customer';
  const parts: string[] = [`${name} @ ${formattedTime}`];

  if (appointmentAddress && appointmentAddress !== 'the scheduled location') {
    parts.push(appointmentAddress);
  }

  if (ctx) {
    if (ctx.projectType) {
      parts.push(`Job: ${ctx.projectType}`);
    }
    if (ctx.estimatedValue && ctx.estimatedValue > 0) {
      const formatted = ctx.estimatedValue >= 1000
        ? `~$${Math.round(ctx.estimatedValue / 1000)}k`
        : `~$${ctx.estimatedValue}`;
      parts.push(`Budget: ${formatted}`);
    }
    if (ctx.currentSentiment && ctx.currentSentiment !== 'neutral') {
      const sentimentLabel =
        ctx.currentSentiment === 'positive' ? 'Friendly' :
        ctx.currentSentiment === 'negative' ? 'Unhappy' :
        ctx.currentSentiment === 'frustrated' ? 'Frustrated' : null;
      if (sentimentLabel) parts.push(sentimentLabel);
    }
    if (ctx.urgencyScore && ctx.urgencyScore >= 75) {
      parts.push('High urgency');
    }
    if (ctx.conversationSummary) {
      const summary = ctx.conversationSummary.length > 100
        ? `${ctx.conversationSummary.substring(0, 100)}...`
        : ctx.conversationSummary;
      parts.push(`Notes: ${summary}`);
    } else if (recentMessages.length > 0) {
      const lastMsg = recentMessages[0].content;
      const truncated = lastMsg.length > 80 ? `${lastMsg.substring(0, 80)}...` : lastMsg;
      parts.push(`Last msg: "${truncated}"`);
    }
  }

  return parts.join(' | ');
}

interface AppointmentPayload {
  leadId: string;
  clientId: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm (24hr)
  address?: string;
}

interface AppointmentReminderResult {
  success: boolean;
  reason?: string;
  appointmentId?: string;
  scheduledCount?: number;
  scheduledIds?: string[];
}

export interface ReminderPlanEntry {
  sequenceType: 'appointment_reminder' | 'appointment_reminder_contractor';
  sequenceStep: 1 | 2;
  sendAt: Date;
}

/**
 * Builds reminder plan entries for both homeowner and contractor.
 * Used by scheduling and regression tests.
 *
 * @param timezone - IANA timezone string for the client (e.g. 'America/New_York').
 *   The day-before reminder fires at 10:00 AM in *this* timezone, not the
 *   server's timezone. Defaults to 'America/New_York' if omitted.
 */
export function buildAppointmentReminderPlan(
  appointmentDateTime: Date,
  now: Date = new Date(),
  includeContractor: boolean = true,
  timezone: string = 'America/New_York'
): ReminderPlanEntry[] {
  const entries: ReminderPlanEntry[] = [];
  // Compute 10am local time the day before the appointment in the client's timezone
  const dayBeforeSendAt = tenAmOnDayBefore(appointmentDateTime, 1, timezone);
  const twoHourSendAt = subHours(appointmentDateTime, 2);

  if (dayBeforeSendAt > now) {
    entries.push({ sequenceType: 'appointment_reminder', sequenceStep: 1, sendAt: dayBeforeSendAt });
    if (includeContractor) {
      entries.push({ sequenceType: 'appointment_reminder_contractor', sequenceStep: 1, sendAt: dayBeforeSendAt });
    }
  }

  if (twoHourSendAt > now) {
    entries.push({ sequenceType: 'appointment_reminder', sequenceStep: 2, sendAt: twoHourSendAt });
    if (includeContractor) {
      entries.push({ sequenceType: 'appointment_reminder_contractor', sequenceStep: 2, sendAt: twoHourSendAt });
    }
  }

  return entries;
}

/**
 * Schedules appointment reminders (day-before and 2-hour) for a lead.
 * Creates an appointment record and scheduled messages for automated reminders.
 */
export async function scheduleAppointmentReminders(payload: AppointmentPayload): Promise<AppointmentReminderResult> {
  const db = getDb();
  const { leadId, clientId, date, time, address } = payload;

  // 1. Get client and lead
  const clientResult = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

  if (!clientResult.length || !leadResult.length) {
    return { success: false, reason: 'Client or lead not found' };
  }

  const client = clientResult[0];
  const lead = leadResult[0];

  // 2. Create appointment
  const appointmentCreated = await db
    .insert(appointments)
    .values({
      leadId,
      clientId,
      appointmentDate: date,
      appointmentTime: time,
      address: address || lead.address,
      status: 'scheduled',
    })
    .returning();

  const appointment = appointmentCreated[0];

  // 3. Cancel existing appointment reminders
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: 'New appointment scheduled',
    })
    .where(and(
      eq(scheduledMessages.leadId, leadId),
      inArray(scheduledMessages.sequenceType, ['appointment_reminder', 'appointment_reminder_contractor']),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // 4. Parse datetime
  const appointmentDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
  const formattedTime = format(appointmentDateTime, 'h:mm a');
  const appointmentAddress = address || lead.address || 'the scheduled location';

  const scheduledIds: string[] = [];
  const contractorRouting = await resolveReminderRecipients(
    clientId,
    'appointment_reminder_contractor'
  );
  const plan = buildAppointmentReminderPlan(
    appointmentDateTime,
    new Date(),
    contractorRouting.primaryChain.length > 0,
    client.timezone || 'America/New_York'
  );

  // 5/6. Insert reminder plan entries
  for (const entry of plan) {
    let content: string;
    if (entry.sequenceType === 'appointment_reminder') {
      content = entry.sequenceStep === 1
        ? renderTemplate('appointment_day_before', {
            name: lead.name || 'there',
            time: formattedTime,
            address: appointmentAddress,
            businessName: client.businessName,
          })
        : renderTemplate('appointment_2hr', {
            name: lead.name || 'there',
            time: formattedTime,
            ownerName: client.ownerName,
            businessName: client.businessName,
          });
    } else if (entry.sequenceStep === 1) {
      // Day-before contractor reminder: simple appointment summary
      content = `Reminder: ${lead.name || 'Customer'} appointment tomorrow at ${formattedTime}${appointmentAddress ? ` (${appointmentAddress})` : ''}.`;
    } else {
      // 2-hour contractor reminder: include AI context brief so estimator arrives prepared
      const brief = await buildContextBrief(leadId, lead.name, appointmentAddress, formattedTime);
      content = `Appt in 2h: ${brief}`;
    }

    const scheduled = await db
      .insert(scheduledMessages)
      .values({
        leadId,
        clientId,
        sequenceType: entry.sequenceType,
        sequenceStep: entry.sequenceStep,
        content,
        sendAt: entry.sendAt,
      })
      .returning();
    scheduledIds.push(scheduled[0].id);
  }

  // 7. Update lead status
  await db
    .update(leads)
    .set({ status: 'appointment_scheduled', updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  return {
    success: true,
    appointmentId: appointment.id,
    scheduledCount: scheduledIds.length,
    scheduledIds,
  };
}
