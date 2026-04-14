/**
 * Appointment Booking Service
 *
 * Handles availability checking, slot suggestions, appointment creation,
 * rescheduling, and cancellation. Used by the conversational booking handler.
 */

import { getDb } from '@/db';
import { appointments, auditLog, businessHours, calendarEvents, clientMemberships, clients, leads, scheduledMessages } from '@/db/schema';
import { eq, and, gte, lte, not, inArray, lt, gt } from 'drizzle-orm';
import { scheduleAppointmentReminders } from '@/lib/automations/appointment-reminder';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { sendEmail } from '@/lib/services/resend';
import { createEvent } from '@/lib/services/calendar';
import { format, addDays, addMinutes, parse, isBefore, isAfter } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { resolveReminderRecipients } from '@/lib/services/reminder-routing';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

export interface TimeSlot {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  displayDate: string; // "Tuesday, Feb 18"
  displayTime: string; // "10:00 AM"
}

/** Shape of a per-day entry in the clientMemberships.workSchedule jsonb column. */
interface WorkScheduleDay {
  start: string;     // HH:mm
  end: string;       // HH:mm
  isWorking: boolean;
}

/** The full workSchedule object keyed by day-of-week string (0=Sunday…6=Saturday). */
type WorkSchedule = Record<string, WorkScheduleDay>;

/**
 * Gets available time slots for a client over the next 7 days.
 * Checks business hours and filters out existing appointments.
 *
 * @param membershipId - Optional. When provided, only checks that member&apos;s calendar
 *   integration and their appointments. Uses their workSchedule (S4) if set.
 *   When omitted, falls back to client-level behavior (all calendars, client business hours).
 * @param durationMinutes - Duration of the appointment in minutes (default 60). A longer
 *   appointment blocks more consecutive time. Conflict detection uses
 *   [slotStart, slotStart + durationMinutes) as the occupied window.
 */
export async function getAvailableSlots(
  clientId: string,
  preferredDate?: string,
  membershipId?: string,
  durationMinutes: number = 60,
  timezone: string = 'America/Edmonton'
): Promise<TimeSlot[]> {
  const db = getDb();

  // --- S4: Determine effective schedule for slot generation ---
  // When a membershipId is given, check for a member-level workSchedule first.
  let memberWorkSchedule: WorkSchedule | null = null;
  if (membershipId) {
    const [membership] = await db
      .select({ workSchedule: clientMemberships.workSchedule })
      .from(clientMemberships)
      .where(eq(clientMemberships.id, membershipId))
      .limit(1);

    if (membership?.workSchedule) {
      memberWorkSchedule = membership.workSchedule as WorkSchedule;
    }
  }

  // Get client business hours (used as fallback or when no membershipId provided)
  const hours = await db
    .select()
    .from(businessHours)
    .where(eq(businessHours.clientId, clientId));

  // If no member work schedule and no business hours, nothing to offer
  if (!memberWorkSchedule && hours.length === 0) return [];

  const hoursByDay = new Map(hours.map(h => [h.dayOfWeek, h]));

  // Get existing appointments for next 7 days
  const nowInClientTz = toZonedTime(new Date(), timezone);
  const startDate = preferredDate || format(nowInClientTz, 'yyyy-MM-dd');
  const endDate = format(addDays(new Date(startDate), 7), 'yyyy-MM-dd');

  // --- S1: Filter appointments by member when membershipId is given ---
  const appointmentConditions = membershipId
    ? and(
        eq(appointments.clientId, clientId),
        eq(appointments.assignedTeamMemberId, membershipId),
        gte(appointments.appointmentDate, startDate),
        lte(appointments.appointmentDate, endDate),
        not(eq(appointments.status, 'cancelled'))
      )
    : and(
        eq(appointments.clientId, clientId),
        gte(appointments.appointmentDate, startDate),
        lte(appointments.appointmentDate, endDate),
        not(eq(appointments.status, 'cancelled'))
      );

  const existingAppointments = await db
    .select({
      date: appointments.appointmentDate,
      time: appointments.appointmentTime,
      duration: appointments.durationMinutes,
    })
    .from(appointments)
    .where(appointmentConditions);

  // Get calendar events that overlap the window
  const windowStart = parse(startDate, 'yyyy-MM-dd', new Date());
  const windowEnd = parse(endDate, 'yyyy-MM-dd', new Date());

  // --- S1: Filter calendar events by member integration when membershipId is given ---
  const calendarEventConditions = membershipId
    ? and(
        eq(calendarEvents.clientId, clientId),
        eq(calendarEvents.assignedTeamMemberId, membershipId),
        not(eq(calendarEvents.status, 'cancelled')),
        lt(calendarEvents.startTime, windowEnd),
        gt(calendarEvents.endTime, windowStart)
      )
    : and(
        eq(calendarEvents.clientId, clientId),
        not(eq(calendarEvents.status, 'cancelled')),
        lt(calendarEvents.startTime, windowEnd),
        gt(calendarEvents.endTime, windowStart)
      );

  const existingCalendarEvents = await db
    .select({
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
    })
    .from(calendarEvents)
    .where(calendarEventConditions);

  // Build blocked time set — appointments block [appointmentStart, appointmentStart + duration)
  // Each appointment occupies N consecutive hourly slots based on its duration.
  const blockedSlots = new Set<string>();
  for (const appt of existingAppointments) {
    const apptStart = parse(
      `${appt.date} ${appt.time.substring(0, 5)}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    const apptDuration = appt.duration ?? 60;
    const apptEnd = addMinutes(apptStart, apptDuration);
    // Mark every hourly slot that overlaps with [apptStart, apptEnd)
    let cursor = apptStart;
    while (isBefore(cursor, apptEnd)) {
      blockedSlots.add(`${appt.date}|${format(cursor, 'HH:mm')}`);
      cursor = addMinutes(cursor, 60);
    }
  }

  // Generate available slots
  const slots: TimeSlot[] = [];
  // Compare slots against "now in client timezone" so UTC offsets don't truncate today's slots.
  // toZonedTime converts the wall-clock representation to the client's local time.
  const now = toZonedTime(new Date(), timezone);

  for (let i = 0; i < 7; i++) {
    const date = addDays(new Date(startDate), i);
    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');

    // --- S4: Resolve effective open/close times for this day ---
    let openTime: string | null = null;
    let closeTime: string | null = null;

    if (memberWorkSchedule) {
      const dayEntry = memberWorkSchedule[String(dayOfWeek)];
      if (!dayEntry?.isWorking) continue;
      openTime = dayEntry.start;
      closeTime = dayEntry.end;
    } else {
      const dayHours = hoursByDay.get(dayOfWeek);
      if (!dayHours || !dayHours.isOpen || !dayHours.openTime || !dayHours.closeTime) continue;
      openTime = dayHours.openTime;
      closeTime = dayHours.closeTime;
    }

    if (!openTime || !closeTime) continue;

    // --- S2: Generate slots at hourly intervals, ensuring durationMinutes fits before close ---
    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);
    const closeTotalMins = closeHour * 60 + closeMin;

    for (let hour = openHour; ; hour++) {
      const slotStartMins = hour * 60 + openMin;
      // Slot must start + duration fit before close
      if (slotStartMins + durationMinutes > closeTotalMins) break;

      const timeStr = `${String(hour).padStart(2, '0')}:${String(openMin).padStart(2, '0')}`;
      const slotDateTime = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());

      // Skip past times
      if (isBefore(slotDateTime, now)) continue;

      // Skip slots blocked by existing appointments
      if (blockedSlots.has(`${dateStr}|${timeStr}`)) continue;

      // --- S2: Conflict window spans the full duration of the new appointment ---
      const slotEnd = addMinutes(slotDateTime, durationMinutes);
      const hasCalendarConflict = existingCalendarEvents.some(
        event => isBefore(event.startTime, slotEnd) && isAfter(event.endTime, slotDateTime)
      );
      if (hasCalendarConflict) continue;

      slots.push({
        date: dateStr,
        time: timeStr,
        displayDate: format(date, 'EEEE, MMM d'),
        displayTime: format(slotDateTime, 'h:mm a'),
      });
    }
  }

  return slots;
}

/**
 * Suggests 2-3 time slots from available options, spread across different days.
 */
export function suggestSlots(
  available: TimeSlot[],
  count: number = 3
): TimeSlot[] {
  if (available.length <= count) return available;

  // Try to spread across different days
  const byDay = new Map<string, TimeSlot[]>();
  for (const slot of available) {
    const existing = byDay.get(slot.date) || [];
    existing.push(slot);
    byDay.set(slot.date, existing);
  }

  const suggestions: TimeSlot[] = [];
  const days = Array.from(byDay.keys());

  // Pick one slot from different days, preferring mid-morning
  for (const day of days) {
    if (suggestions.length >= count) break;
    const daySlots = byDay.get(day)!;
    // Prefer 10am slot, then closest to it
    const preferred = daySlots.find(s => s.time === '10:00')
      || daySlots.find(s => s.time >= '09:00' && s.time <= '11:00')
      || daySlots[0];
    if (preferred) suggestions.push(preferred);
  }

  return suggestions;
}

/**
 * Books an appointment and schedules reminders for both parties.
 * Returns the formatted confirmation message.
 *
 * When client.bookingConfirmationRequired = true, creates the appointment in
 * `pending_confirmation` status and delegates to the booking-confirmation flow
 * instead of auto-confirming with the homeowner.
 *
 * @param durationMinutes - Duration of the appointment in minutes (default 60). Saved to
 *   the appointment record and used to compute the calendar event end time (S2).
 */
export async function bookAppointment(
  clientId: string,
  leadId: string,
  date: string,
  time: string,
  address?: string,
  durationMinutes: number = 60
): Promise<{
  success: boolean;
  appointmentId?: string;
  confirmationMessage?: string;
  error?: string;
}> {
  const db = getDb();

  // Verify slot is still available
  const [existing] = await db
    .select()
    .from(appointments)
    .where(and(
      eq(appointments.clientId, clientId),
      eq(appointments.appointmentDate, date),
      eq(appointments.appointmentTime, time),
      not(eq(appointments.status, 'cancelled'))
    ))
    .limit(1);

  if (existing) {
    return { success: false, error: 'This time slot was just booked. Let me suggest another time.' };
  }

  // Get lead and client info
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);

  if (!lead || !client) {
    return { success: false, error: 'Lead or client not found' };
  }

  // Booking confirmation mode: when the client requires contractor approval before
  // confirming with the homeowner, delegate to the confirmation flow instead.
  if (client.bookingConfirmationRequired) {
    const { createPendingBooking } = await import('@/lib/services/booking-confirmation');
    const pendingResult = await createPendingBooking(
      clientId,
      leadId,
      date,
      time,
      address,
      durationMinutes
    );
    if (!pendingResult.success) {
      return { success: false, error: pendingResult.error };
    }
    return {
      success: true,
      appointmentId: pendingResult.appointmentId,
      confirmationMessage: pendingResult.holdingMessage,
    };
  }

  // Create appointment via existing automation
  // Wrapped in try-catch to handle race condition: the unique index
  // uq_appointments_client_date_time prevents double-booking at the DB level
  let result: { success: boolean; reason?: string; appointmentId?: string };
  try {
    result = await scheduleAppointmentReminders({
      leadId,
      clientId,
      date,
      time,
      address: address || lead.address || undefined,
    });
  } catch (err: unknown) {
    // Postgres unique violation = code 23505
    if (
      err instanceof Error &&
      'code' in err &&
      (err as Error & { code: string }).code === '23505'
    ) {
      return {
        success: false,
        error: 'This time slot was just booked by someone else. Let me suggest another time.',
      };
    }
    throw err;
  }

  if (!result.success) {
    return { success: false, error: result.reason };
  }

  // S2: Persist durationMinutes on the appointment record. scheduleAppointmentReminders
  // creates the appointment with the DB default (60 min); we update it here to avoid
  // modifying the automation's payload shape.
  if (result.appointmentId && durationMinutes !== 60) {
    await db
      .update(appointments)
      .set({ durationMinutes, updatedAt: new Date() })
      .where(eq(appointments.id, result.appointmentId));
  }

  // Schedule contractor notification (evening before + 1 hour before)
  const appointmentDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
  const formattedTime = format(appointmentDateTime, 'h:mm a');
  const formattedDate = format(appointmentDateTime, 'EEEE, MMM d');

  // Resolve reminder routing once — used both for the immediate notification SMS
  // and to populate assignedTeamMemberId on the calendar event so per-reminder
  // delivery goes to the right person (LB-02).
  const routing = await resolveReminderRecipients(clientId, 'booking_notification');

  // Primary recipient becomes the assigned crew member for this appointment (owner by default for MVP).
  const assignedRecipient = routing.primaryChain[0] ?? null;
  const assignedMembershipId = assignedRecipient?.membershipId ?? null;

  // Notify contractor immediately
  if (client.twilioNumber) {
    // Include the assigned member's name when they have a named identity distinct
    // from the generic "Business owner" fallback — makes it clear who owns the job.
    const assignedLabel =
      assignedRecipient && assignedRecipient.label !== 'Business owner'
        ? ` (Assigned: ${assignedRecipient.label})`
        : '';

    const contractorMsg = `New booking: ${lead.name || 'Customer'}, ${lead.projectType || 'service call'}, ${formattedDate} at ${formattedTime}${lead.address ? `, ${lead.address}` : ''}. Their #: ${lead.phone}${assignedLabel}`;
    const attempts: Array<{
      role: string;
      phone: string;
      status: 'sent' | 'failed';
      stage: 'primary_chain' | 'secondary';
      reason?: string;
    }> = [];

    let deliveredRecipient: (typeof routing.primaryChain)[number] | null = null;

    for (const recipient of routing.primaryChain) {
      try {
        const sendOutcome = await sendCompliantMessage({
          clientId,
          to: recipient.phone,
          from: client.twilioNumber,
          body: contractorMsg,
          messageClassification: 'proactive_outreach',
          messageCategory: 'transactional',
          consentBasis: { type: 'existing_consent' },
          metadata: {
            source: 'booking_notification',
            appointmentId: result.appointmentId,
            reminderRole: recipient.role,
          },
        });

        if (sendOutcome.blocked) {
          attempts.push({
            role: recipient.role,
            phone: recipient.phone,
            status: 'failed',
            stage: 'primary_chain',
            reason: `blocked:${sendOutcome.blockReason || 'unknown'}`,
          });
          continue;
        }

        attempts.push({
          role: recipient.role,
          phone: recipient.phone,
          status: 'sent',
          stage: 'primary_chain',
        });
        deliveredRecipient = recipient;
        break;
      } catch (error) {
        attempts.push({
          role: recipient.role,
          phone: recipient.phone,
          status: 'failed',
          stage: 'primary_chain',
          reason: error instanceof Error ? error.message : 'send_failed',
        });
      }
    }

    if (deliveredRecipient) {
      for (const secondaryRecipient of routing.secondaryRecipients) {
        try {
          const secondaryResult = await sendCompliantMessage({
            clientId,
            to: secondaryRecipient.phone,
            from: client.twilioNumber,
            body: contractorMsg,
            messageClassification: 'proactive_outreach',
            messageCategory: 'transactional',
            consentBasis: { type: 'existing_consent' },
            metadata: {
              source: 'booking_notification_secondary',
              appointmentId: result.appointmentId,
              reminderRole: secondaryRecipient.role,
            },
          });

          attempts.push({
            role: secondaryRecipient.role,
            phone: secondaryRecipient.phone,
            status: secondaryResult.blocked ? 'failed' : 'sent',
            stage: 'secondary',
            reason: secondaryResult.blocked
              ? `blocked:${secondaryResult.blockReason || 'unknown'}`
              : undefined,
          });
        } catch (error) {
          attempts.push({
            role: secondaryRecipient.role,
            phone: secondaryRecipient.phone,
            status: 'failed',
            stage: 'secondary',
            reason: error instanceof Error ? error.message : 'send_failed',
          });
        }
      }

      await db.insert(auditLog).values({
        personId: null,
        clientId,
        action: 'reminder_delivery_sent',
        resourceType: 'appointment',
        resourceId: result.appointmentId,
        metadata: {
          reminderType: 'booking_notification',
          deliveredTo: {
            role: deliveredRecipient.role,
            phone: deliveredRecipient.phone,
            personId: deliveredRecipient.personId,
            membershipId: deliveredRecipient.membershipId,
            label: deliveredRecipient.label,
          },
          fallbackUsed: routing.primaryChain[0]?.phone !== deliveredRecipient.phone,
          attempts,
        },
        createdAt: new Date(),
      });
    } else {
      // EC-16: All SMS recipients were blocked (quiet hours, opt-out, etc.).
      // Fall back to email — email is not subject to quiet-hours compliance.
      const recipientEmail = client.email;
      let emailFallbackStatus: 'sent' | 'no_email' | 'failed' = 'no_email';

      if (recipientEmail) {
        const subject = `New Booking — ${lead.name || 'Customer'} on ${formattedDate} at ${formattedTime}`;
        const html = `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1B2F26;">New Appointment Booked</h2>
            <p><strong>Customer:</strong> ${lead.name || 'Customer'}</p>
            <p><strong>Phone:</strong> ${lead.phone}</p>
            <p><strong>Date:</strong> ${formattedDate} at ${formattedTime}</p>
            ${lead.projectType ? `<p><strong>Service:</strong> ${lead.projectType}</p>` : ''}
            ${lead.address ? `<p><strong>Address:</strong> ${lead.address}</p>` : ''}
            <p style="color: #6b6762; font-size: 14px; margin-top: 16px;">SMS notification was blocked (quiet hours or opt-out). This email is your notification.</p>
          </div>
        `;
        try {
          const emailResult = await sendEmail({ to: recipientEmail, subject, html });
          emailFallbackStatus = emailResult.success ? 'sent' : 'failed';
        } catch {
          emailFallbackStatus = 'failed';
        }
      }

      if (emailFallbackStatus !== 'sent') {
        console.warn(
          `[appointment-booking] EC-16: All SMS recipients blocked for booking ${result.appointmentId} (client ${clientId}) and email fallback ${emailFallbackStatus === 'no_email' ? 'unavailable (no email on file)' : 'failed'}. Contractor was NOT notified.`
        );
      }

      await db.insert(auditLog).values({
        personId: null,
        clientId,
        action: 'reminder_delivery_no_recipient',
        resourceType: 'appointment',
        resourceId: result.appointmentId,
        metadata: {
          reminderType: 'booking_notification',
          reason: routing.primaryChain.length === 0 ? 'no_valid_recipient' : 'all_recipients_unreachable',
          attempts,
          emailFallback: emailFallbackStatus,
        },
        createdAt: new Date(),
      });
    }
  }

  // Create calendar event if client has calendar integration.
  // assignedTeamMemberId is populated with the primary routing recipient so
  // subsequent reminders can be directed to the specific assigned crew member.
  // S2: endTime uses the actual appointment duration instead of a hardcoded +1 hour.
  try {
    await createEvent({
      clientId,
      leadId,
      title: `${lead.projectType || 'Service Call'}: ${lead.name || 'Customer'}`,
      startTime: appointmentDateTime,
      endTime: addMinutes(appointmentDateTime, durationMinutes),
      location: lead.address || undefined,
      timezone: client.timezone || 'America/Edmonton',
      eventType: 'estimate',
      assignedTeamMemberId: assignedMembershipId ?? undefined, // undefined = no assignment; null would be treated same way
    });
  } catch (err) {
    // Calendar creation failure must never block the booking from completing.
    // Log for operator visibility — syncStatus will be 'error' on the event record
    // (handled inside createEvent → syncEventToProviders in Task 3).
    logSanitizedConsoleError(
      '[Booking][calendar-event-creation] Failed to create calendar event',
      err,
      {
        clientId,
        leadId,
        appointmentId: result.appointmentId,
      }
    );
  }

  // Dispatch webhook
  try {
    const { dispatchWebhook } = await import('@/lib/services/webhook-dispatch');
    await dispatchWebhook(clientId, 'appointment.booked', {
      appointmentId: result.appointmentId,
      leadId,
      date: appointmentDateTime.toISOString(),
    });
  } catch {}

  // Track funnel event with AI attribution
  try {
    const { trackAppointmentBooked } = await import(
      '@/lib/services/funnel-tracking'
    );
    await trackAppointmentBooked(clientId, leadId, date);
  } catch {} // Never block booking on tracking failure

  return {
    success: true,
    appointmentId: result.appointmentId,
    confirmationMessage: `You're all set for ${formattedDate} at ${formattedTime}. We'll send you a reminder the day before. If anything changes, just text us!`,
  };
}

/**
 * Reschedules an appointment. Cancels old one and books new time.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime: string
): Promise<{
  success: boolean;
  newAppointmentId?: string;
  confirmationMessage?: string;
  error?: string;
}> {
  const db = getDb();

  // Find existing appointment
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment) {
    return { success: false, error: 'Appointment not found' };
  }

  // Cancel old appointment
  await db
    .update(appointments)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  // Cancel old reminders
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: 'Rescheduled',
    })
    .where(and(
      eq(scheduledMessages.leadId, appointment.leadId),
      inArray(scheduledMessages.sequenceType, ['appointment_reminder', 'appointment_reminder_contractor']),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // Book new time
  return bookAppointment(
    appointment.clientId,
    appointment.leadId,
    newDate,
    newTime,
    appointment.address || undefined
  );
}

/**
 * Cancels an appointment gracefully.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<{ success: boolean }> {
  const db = getDb();

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment) return { success: false };

  await db
    .update(appointments)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));

  // Cancel pending reminders
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: reason || 'Customer cancelled',
    })
    .where(and(
      eq(scheduledMessages.leadId, appointment.leadId),
      inArray(scheduledMessages.sequenceType, ['appointment_reminder', 'appointment_reminder_contractor']),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // Update lead status
  await db
    .update(leads)
    .set({ status: 'lost', updatedAt: new Date() })
    .where(eq(leads.id, appointment.leadId));

  return { success: true };
}
