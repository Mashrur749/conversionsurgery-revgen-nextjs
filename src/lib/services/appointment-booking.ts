/**
 * Appointment Booking Service
 *
 * Handles availability checking, slot suggestions, appointment creation,
 * rescheduling, and cancellation. Used by the conversational booking handler.
 */

import { getDb } from '@/db';
import { appointments, businessHours, clients, leads, scheduledMessages } from '@/db/schema';
import { eq, and, gte, lte, not } from 'drizzle-orm';
import { scheduleAppointmentReminders } from '@/lib/automations/appointment-reminder';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { createEvent } from '@/lib/services/calendar';
import { format, addDays, addHours, parse, isBefore, isAfter } from 'date-fns';

export interface TimeSlot {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  displayDate: string; // "Tuesday, Feb 18"
  displayTime: string; // "10:00 AM"
}

/**
 * Gets available time slots for a client over the next 7 days.
 * Checks business hours and filters out existing appointments (1-hour blocks).
 */
export async function getAvailableSlots(
  clientId: string,
  preferredDate?: string
): Promise<TimeSlot[]> {
  const db = getDb();

  // Get business hours
  const hours = await db
    .select()
    .from(businessHours)
    .where(eq(businessHours.clientId, clientId));

  if (hours.length === 0) return [];

  const hoursByDay = new Map(hours.map(h => [h.dayOfWeek, h]));

  // Get existing appointments for next 7 days
  const startDate = preferredDate || format(new Date(), 'yyyy-MM-dd');
  const endDate = format(addDays(new Date(startDate), 7), 'yyyy-MM-dd');

  const existingAppointments = await db
    .select({
      date: appointments.appointmentDate,
      time: appointments.appointmentTime,
    })
    .from(appointments)
    .where(and(
      eq(appointments.clientId, clientId),
      gte(appointments.appointmentDate, startDate),
      lte(appointments.appointmentDate, endDate),
      not(eq(appointments.status, 'cancelled'))
    ));

  // Build blocked time set
  const blockedSlots = new Set(
    existingAppointments.map(a => `${a.date}|${a.time.substring(0, 5)}`)
  );

  // Generate available slots
  const slots: TimeSlot[] = [];
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date = addDays(new Date(startDate), i);
    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayHours = hoursByDay.get(dayOfWeek);

    if (!dayHours || !dayHours.isOpen || !dayHours.openTime || !dayHours.closeTime) {
      continue;
    }

    // Generate hourly slots within business hours
    const [openHour, openMin] = dayHours.openTime.split(':').map(Number);
    const [closeHour] = dayHours.closeTime.split(':').map(Number);

    for (let hour = openHour; hour < closeHour; hour++) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(openMin).padStart(2, '0')}`;
      const slotDateTime = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());

      // Skip past times
      if (isBefore(slotDateTime, now)) continue;

      // Skip blocked slots
      if (blockedSlots.has(`${dateStr}|${timeStr}`)) continue;

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
 */
export async function bookAppointment(
  clientId: string,
  leadId: string,
  date: string,
  time: string,
  address?: string
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

  // Create appointment via existing automation
  const result = await scheduleAppointmentReminders({
    leadId,
    clientId,
    date,
    time,
    address: address || lead.address || undefined,
  });

  if (!result.success) {
    return { success: false, error: result.reason };
  }

  // Schedule contractor notification (evening before + 1 hour before)
  const appointmentDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
  const formattedTime = format(appointmentDateTime, 'h:mm a');
  const formattedDate = format(appointmentDateTime, 'EEEE, MMM d');

  // Notify contractor immediately
  if (client.twilioNumber && client.phone) {
    const contractorMsg = `New booking: ${lead.name || 'Customer'}, ${lead.projectType || 'service call'}, ${formattedDate} at ${formattedTime}${lead.address ? `, ${lead.address}` : ''}. Their #: ${lead.phone}`;
    await sendCompliantMessage({
      clientId,
      to: client.phone,
      from: client.twilioNumber,
      body: contractorMsg,
      messageCategory: 'transactional',
      consentBasis: { type: 'existing_consent' },
      metadata: { source: 'booking_notification', appointmentId: result.appointmentId },
    }).catch(() => {}); // Don't block on contractor notification failure
  }

  // Create calendar event if client has calendar integration
  try {
    await createEvent({
      clientId,
      leadId,
      title: `${lead.projectType || 'Service Call'}: ${lead.name || 'Customer'}`,
      startTime: appointmentDateTime,
      endTime: addHours(appointmentDateTime, 1),
      location: lead.address || undefined,
      eventType: 'estimate',
    });
  } catch {} // Don't block booking on calendar failure

  // Dispatch webhook
  try {
    const { dispatchWebhook } = await import('@/lib/services/webhook-dispatch');
    await dispatchWebhook(clientId, 'appointment.booked', {
      appointmentId: result.appointmentId,
      leadId,
      date: appointmentDateTime.toISOString(),
    });
  } catch {}

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
      eq(scheduledMessages.sequenceType, 'appointment_reminder'),
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
      eq(scheduledMessages.sequenceType, 'appointment_reminder'),
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
