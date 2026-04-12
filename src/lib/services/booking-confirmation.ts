/**
 * Booking Confirmation Service
 *
 * Handles the contractor-approval flow for non-Google-Calendar clients.
 * When bookingConfirmationRequired = true, appointments are created in
 * `pending_confirmation` status. The contractor receives an SMS to approve or
 * suggest a new time. Only after confirmation does the homeowner get notified.
 *
 * Timeout escalation:
 *   - 2 hours: reminder SMS to contractor
 *   - 4 hours: operator alert SMS
 *
 * These timeouts are implemented as scheduled_messages rows with
 * sequenceType = 'booking_confirmation_reminder' and
 *               'booking_confirmation_escalation'.
 * The cron runner sends them; they are cancelled when the contractor confirms.
 */

import { getDb } from '@/db';
import { appointments, leads, clients, scheduledMessages, auditLog } from '@/db/schema';
import { eq, and, not, inArray } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { resolveReminderRecipients } from '@/lib/services/reminder-routing';
import { format, parse, addMinutes } from 'date-fns';
import { createEvent } from '@/lib/services/calendar';
import { getAgencyField } from '@/lib/services/agency-settings';
import { normalizePhoneNumber } from '@/lib/utils/phone';

/** Sequence types owned by the booking-confirmation flow. */
export const BOOKING_CONFIRMATION_SEQUENCE_TYPES = [
  'booking_confirmation_reminder',
  'booking_confirmation_escalation',
] as const;

export type BookingConfirmationSequenceType =
  (typeof BOOKING_CONFIRMATION_SEQUENCE_TYPES)[number];

export interface CreatePendingBookingResult {
  success: boolean;
  appointmentId?: string;
  /** Homeowner-facing holding message to send immediately. */
  holdingMessage?: string;
  error?: string;
}

/**
 * Creates an appointment in `pending_confirmation` status, sends the contractor
 * a booking-request SMS, schedules the 2h reminder and 4h escalation, and
 * returns the holding message to send the homeowner.
 *
 * Call this instead of `bookAppointment()` when client.bookingConfirmationRequired = true.
 */
export async function createPendingBooking(
  clientId: string,
  leadId: string,
  date: string,
  time: string,
  address?: string | null,
  durationMinutes: number = 60
): Promise<CreatePendingBookingResult> {
  const db = getDb();

  // Verify slot not already taken
  const [existing] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.appointmentDate, date),
        eq(appointments.appointmentTime, time),
        not(eq(appointments.status, 'cancelled'))
      )
    )
    .limit(1);

  if (existing) {
    return {
      success: false,
      error: 'This time slot was just booked. Let me suggest another time.',
    };
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);

  if (!lead || !client) {
    return { success: false, error: 'Lead or client not found' };
  }

  const appointmentAddress = address || lead.address || undefined;

  // Create appointment in pending_confirmation status
  const [appointment] = await db
    .insert(appointments)
    .values({
      leadId,
      clientId,
      appointmentDate: date,
      appointmentTime: time,
      address: appointmentAddress,
      status: 'pending_confirmation',
      durationMinutes,
    })
    .returning();

  const appointmentDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
  const formattedDate = format(appointmentDateTime, 'EEEE, MMM d');
  const formattedTime = format(appointmentDateTime, 'h:mm a');

  // Resolve contractor routing
  const routing = await resolveReminderRecipients(clientId, 'booking_notification');
  const primaryContractor = routing.primaryChain[0] ?? null;

  // Send booking request SMS to contractor
  if (client.twilioNumber && primaryContractor) {
    const contractorMsg = `Booking request: ${lead.name || 'Customer'} for ${lead.projectType || 'service call'}, ${formattedDate} at ${formattedTime}${appointmentAddress ? `, ${appointmentAddress}` : ''}. Reply YES to confirm, or suggest a new time (e.g., THU 2PM).`;

    try {
      const sendResult = await sendCompliantMessage({
        clientId,
        to: primaryContractor.phone,
        from: client.twilioNumber,
        body: contractorMsg,
        messageClassification: 'proactive_outreach',
        messageCategory: 'transactional',
        consentBasis: { type: 'existing_consent' },
        metadata: {
          source: 'booking_confirmation_request',
          appointmentId: appointment.id,
          reminderRole: primaryContractor.role,
        },
      });

      await db.insert(auditLog).values({
        personId: null,
        clientId,
        action: 'booking_confirmation_requested',
        resourceType: 'appointment',
        resourceId: appointment.id,
        metadata: {
          sentTo: primaryContractor.phone,
          blocked: sendResult.blocked,
          blockReason: sendResult.blockReason,
        },
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('[BookingConfirmation] Failed to send contractor request:', err);
    }

    // Schedule 2h reminder
    const reminderAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await db.insert(scheduledMessages).values({
      leadId,
      clientId,
      sequenceType: 'booking_confirmation_reminder',
      sequenceStep: 1,
      content: `Reminder: Booking request from ${lead.name || 'Customer'} on ${formattedDate} at ${formattedTime} is still awaiting your confirmation. Reply YES to confirm or suggest another time (e.g., THU 2PM).`,
      sendAt: reminderAt,
    });

    // Resolve operator phone for 4h escalation
    const rawOpPhone = await getAgencyField('operatorPhone');
    const operatorPhone = rawOpPhone ? normalizePhoneNumber(rawOpPhone) : null;
    const escalationPhone = operatorPhone ?? primaryContractor.phone;

    // Schedule 4h operator escalation
    const escalationAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await db.insert(scheduledMessages).values({
      leadId,
      clientId,
      sequenceType: 'booking_confirmation_escalation',
      sequenceStep: 1,
      content: `ALERT: Booking request for ${lead.name || 'Customer'} (${formattedDate} at ${formattedTime}) has not been confirmed after 4 hours. Appointment ID: ${appointment.id}. Please follow up.`,
      sendAt: escalationAt,
    });

    // Store escalation phone for the cron to use — we log it in audit so the cron
    // can look it up without needing to resolve routing again
    await db.insert(auditLog).values({
      personId: null,
      clientId,
      action: 'booking_confirmation_escalation_scheduled',
      resourceType: 'appointment',
      resourceId: appointment.id,
      metadata: { escalationPhone },
      createdAt: new Date(),
    });
  }

  // Holding message for homeowner
  const holdingMessage = `Great, I'm checking ${client.ownerName}'s availability for ${formattedDate} at ${formattedTime}. You'll hear back shortly to confirm!`;

  return {
    success: true,
    appointmentId: appointment.id,
    holdingMessage,
  };
}

/**
 * Confirms a pending appointment after contractor approval.
 * Updates status to 'scheduled', notifies the homeowner, cancels timeout messages,
 * and schedules standard reminders.
 */
export async function confirmPendingBooking(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment) {
    return { success: false, error: 'Appointment not found' };
  }

  if (appointment.status !== 'pending_confirmation') {
    return { success: false, error: `Appointment is not pending confirmation (status: ${appointment.status})` };
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, appointment.leadId)).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, appointment.clientId)).limit(1);

  if (!lead || !client) {
    return { success: false, error: 'Lead or client not found' };
  }

  // Update appointment to scheduled
  await db
    .update(appointments)
    .set({ status: 'scheduled', updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  // Cancel pending timeout messages for this appointment's lead
  await db
    .update(scheduledMessages)
    .set({ cancelled: true, cancelledAt: new Date(), cancelledReason: 'Contractor confirmed booking' })
    .where(
      and(
        eq(scheduledMessages.leadId, appointment.leadId),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false),
        inArray(scheduledMessages.sequenceType, [
          'booking_confirmation_reminder',
          'booking_confirmation_escalation',
        ])
      )
    );

  const appointmentDateTime = parse(
    `${appointment.appointmentDate} ${appointment.appointmentTime.substring(0, 5)}`,
    'yyyy-MM-dd HH:mm',
    new Date()
  );
  const formattedDate = format(appointmentDateTime, 'EEEE, MMM d');
  const formattedTime = format(appointmentDateTime, 'h:mm a');

  // Notify homeowner
  if (client.twilioNumber && lead.phone) {
    const homeownerMsg = `You're all set! ${client.ownerName} confirmed your appointment for ${formattedDate} at ${formattedTime}. We'll send you a reminder the day before. If anything changes, just text us!`;

    try {
      await sendCompliantMessage({
        clientId: appointment.clientId,
        to: lead.phone,
        from: client.twilioNumber,
        body: homeownerMsg,
        messageClassification: 'proactive_outreach',
        messageCategory: 'transactional',
        consentBasis: { type: 'existing_consent' },
        leadId: appointment.leadId,
        metadata: {
          source: 'booking_confirmation_confirmed',
          appointmentId,
        },
      });
    } catch (err) {
      console.error('[BookingConfirmation] Failed to notify homeowner:', err);
    }
  }

  // Schedule standard appointment reminders
  try {
    const { scheduleAppointmentReminders } = await import('@/lib/automations/appointment-reminder');
    await scheduleAppointmentReminders({
      leadId: appointment.leadId,
      clientId: appointment.clientId,
      date: appointment.appointmentDate,
      time: appointment.appointmentTime.substring(0, 5),
      address: appointment.address || undefined,
    });
  } catch (err) {
    console.error('[BookingConfirmation] Failed to schedule reminders:', err);
  }

  // Update lead status
  await db
    .update(leads)
    .set({ status: 'appointment_scheduled', updatedAt: new Date() })
    .where(eq(leads.id, appointment.leadId));

  // Create calendar event if configured
  try {
    await createEvent({
      clientId: appointment.clientId,
      leadId: appointment.leadId,
      title: `${lead.projectType || 'Service Call'}: ${lead.name || 'Customer'}`,
      startTime: appointmentDateTime,
      endTime: addMinutes(appointmentDateTime, appointment.durationMinutes ?? 60),
      location: appointment.address || undefined,
      timezone: client.timezone || 'America/New_York',
      eventType: 'estimate',
    });
  } catch {} // Don't block confirmation on calendar failure

  // Dispatch webhook
  try {
    const { dispatchWebhook } = await import('@/lib/services/webhook-dispatch');
    await dispatchWebhook(appointment.clientId, 'appointment.booked', {
      appointmentId,
      leadId: appointment.leadId,
      date: appointmentDateTime.toISOString(),
    });
  } catch {}

  // Track funnel event
  try {
    const { trackAppointmentBooked } = await import('@/lib/services/funnel-tracking');
    await trackAppointmentBooked(appointment.clientId, appointment.leadId, appointment.appointmentDate);
  } catch {}

  await db.insert(auditLog).values({
    personId: null,
    clientId: appointment.clientId,
    action: 'booking_confirmation_confirmed',
    resourceType: 'appointment',
    resourceId: appointmentId,
    metadata: { confirmedAt: new Date().toISOString() },
    createdAt: new Date(),
  });

  return { success: true };
}

/**
 * Updates a pending appointment to a contractor-suggested new time.
 * Cancels the old appointment and creates a new pending_confirmation one.
 * Notifies the homeowner of the proposed new time and asks them to confirm.
 */
export async function suggestNewTimeForPendingBooking(
  appointmentId: string,
  newDate: string,
  newTime: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment) {
    return { success: false, error: 'Appointment not found' };
  }

  if (appointment.status !== 'pending_confirmation') {
    return { success: false, error: 'Appointment is not in pending_confirmation status' };
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, appointment.leadId)).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, appointment.clientId)).limit(1);

  if (!lead || !client) {
    return { success: false, error: 'Lead or client not found' };
  }

  // Cancel old pending appointment and its timeout messages
  await db
    .update(appointments)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  await db
    .update(scheduledMessages)
    .set({ cancelled: true, cancelledAt: new Date(), cancelledReason: 'Contractor suggested new time' })
    .where(
      and(
        eq(scheduledMessages.leadId, appointment.leadId),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false),
        inArray(scheduledMessages.sequenceType, [
          'booking_confirmation_reminder',
          'booking_confirmation_escalation',
        ])
      )
    );

  // Create a new pending booking with the contractor's suggested time
  const result = await createPendingBooking(
    appointment.clientId,
    appointment.leadId,
    newDate,
    newTime,
    appointment.address,
    appointment.durationMinutes ?? 60
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Notify homeowner of the proposed new time
  if (client.twilioNumber && lead.phone) {
    const newDateTime = parse(`${newDate} ${newTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const formattedDate = format(newDateTime, 'EEEE, MMM d');
    const formattedTime = format(newDateTime, 'h:mm a');

    const homeownerMsg = `Update: ${client.ownerName} has proposed ${formattedDate} at ${formattedTime} for your appointment. Does that work for you? Reply YES to confirm or let us know another time.`;

    try {
      await sendCompliantMessage({
        clientId: appointment.clientId,
        to: lead.phone,
        from: client.twilioNumber,
        body: homeownerMsg,
        messageClassification: 'proactive_outreach',
        messageCategory: 'transactional',
        consentBasis: { type: 'existing_consent' },
        leadId: appointment.leadId,
        metadata: {
          source: 'booking_confirmation_new_time',
          appointmentId: result.appointmentId,
        },
      });
    } catch (err) {
      console.error('[BookingConfirmation] Failed to notify homeowner of new time:', err);
    }
  }

  return { success: true };
}

/**
 * Finds the most recent pending_confirmation appointment for a client
 * (by contractor phone → looks up who sent the request).
 * Used in incoming-sms.ts when an authorized sender replies YES or a time.
 */
export async function findPendingConfirmationForContractor(
  clientId: string
): Promise<{ id: string; leadId: string } | null> {
  const db = getDb();

  const [appt] = await db
    .select({ id: appointments.id, leadId: appointments.leadId })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.status, 'pending_confirmation')
      )
    )
    .orderBy(appointments.createdAt)
    .limit(1);

  return appt ?? null;
}

/**
 * Parses a contractor time-suggestion reply like "THU 2PM", "Friday 10am", "Mon 9:30am".
 * Returns { date, time } in YYYY-MM-DD / HH:mm format, or null if not parseable.
 */
export function parseContractorTimeSuggestion(
  message: string
): { date: string; time: string } | null {
  const clean = message.trim().toUpperCase();

  const dayMap: Record<string, number> = {
    SUN: 0, SUNDAY: 0,
    MON: 1, MONDAY: 1,
    TUE: 2, TUESDAY: 2,
    WED: 3, WEDNESDAY: 3,
    THU: 4, THURSDAY: 4,
    FRI: 5, FRIDAY: 5,
    SAT: 6, SATURDAY: 6,
  };

  // Match patterns like "THU 2PM", "FRI 10:30AM", "MONDAY 9AM"
  const match = clean.match(
    /^(SUN|MON|TUE|WED|THU|FRI|SAT|SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );

  if (!match) return null;

  const [, dayStr, hourStr, minStr, amPm] = match;
  const targetDay = dayMap[dayStr.toUpperCase()];
  if (targetDay === undefined) return null;

  let hour = parseInt(hourStr, 10);
  const min = parseInt(minStr || '0', 10);

  if (amPm === 'PM' && hour < 12) hour += 12;
  if (amPm === 'AM' && hour === 12) hour = 0;
  // Default: no AM/PM — assume AM for <= 7, PM for 8-11
  if (!amPm) {
    if (hour >= 1 && hour <= 7) hour += 12;
  }

  // Find the next occurrence of targetDay from today
  const now = new Date();
  const todayDay = now.getDay();
  let daysAhead = (targetDay - todayDay + 7) % 7;
  if (daysAhead === 0) daysAhead = 7; // Always next occurrence, not today

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysAhead);

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mi = String(min).padStart(2, '0');

  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}
