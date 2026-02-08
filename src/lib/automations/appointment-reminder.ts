import { getDb, clients, leads, appointments, scheduledMessages } from '@/db';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { subDays, subHours, parse, format } from 'date-fns';

interface AppointmentPayload {
  leadId: string;
  clientId: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm (24hr)
  address?: string;
}

export async function scheduleAppointmentReminders(payload: AppointmentPayload) {
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
      eq(scheduledMessages.sequenceType, 'appointment_reminder'),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // 4. Parse datetime
  const appointmentDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
  const formattedTime = format(appointmentDateTime, 'h:mm a');
  const appointmentAddress = address || lead.address || 'the scheduled location';

  const scheduledIds: string[] = [];

  // 5. Day-before reminder (10am)
  const dayBeforeSendAt = subDays(appointmentDateTime, 1);
  dayBeforeSendAt.setHours(10, 0, 0, 0);

  if (dayBeforeSendAt > new Date()) {
    const content = renderTemplate('appointment_day_before', {
      name: lead.name || 'there',
      time: formattedTime,
      address: appointmentAddress,
      businessName: client.businessName,
    });

    const scheduled = await db
      .insert(scheduledMessages)
      .values({
        leadId,
        clientId,
        sequenceType: 'appointment_reminder',
        sequenceStep: 1,
        content,
        sendAt: dayBeforeSendAt,
      })
      .returning();
    scheduledIds.push(scheduled[0].id);
  }

  // 6. 2-hour-before reminder
  const twoHourSendAt = subHours(appointmentDateTime, 2);

  if (twoHourSendAt > new Date()) {
    const content = renderTemplate('appointment_2hr', {
      name: lead.name || 'there',
      time: formattedTime,
      ownerName: client.ownerName,
      businessName: client.businessName,
    });

    const scheduled = await db
      .insert(scheduledMessages)
      .values({
        leadId,
        clientId,
        sequenceType: 'appointment_reminder',
        sequenceStep: 2,
        content,
        sendAt: twoHourSendAt,
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
