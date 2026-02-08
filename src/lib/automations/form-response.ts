import { getDb, clients, leads, conversations, blockedNumbers, dailyStats } from '@/db';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and, sql } from 'drizzle-orm';
import { normalizePhoneNumber, formatPhoneNumber, isValidPhoneNumber } from '@/lib/utils/phone';
import { renderTemplate } from '@/lib/utils/templates';

interface FormPayload {
  clientId: string;
  name?: string;
  phone: string;
  email?: string;
  message?: string;
  projectType?: string;
  address?: string;
}

export async function handleFormSubmission(payload: FormPayload) {
  const db = getDb();
  const { clientId, name, phone, email, message, projectType, address } = payload;

  // Validate phone
  if (!phone || !isValidPhoneNumber(phone)) {
    return { processed: false, reason: 'Invalid phone number' };
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  // 1. Get client
  const clientResult = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.id, clientId),
      eq(clients.status, 'active')
    ))
    .limit(1);

  if (!clientResult.length) {
    return { processed: false, reason: 'Client not found or inactive' };
  }

  const client = clientResult[0];

  if (!client.twilioNumber) {
    return { processed: false, reason: 'Client has no Twilio number configured' };
  }

  // 2. Check if blocked
  const blockedResult = await db
    .select()
    .from(blockedNumbers)
    .where(and(
      eq(blockedNumbers.clientId, client.id),
      eq(blockedNumbers.phone, normalizedPhone)
    ))
    .limit(1);

  if (blockedResult.length) {
    return { processed: false, reason: 'Number is blocked' };
  }

  // 3. Create or update lead
  const existingLeadResult = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clientId, client.id),
      eq(leads.phone, normalizedPhone)
    ))
    .limit(1);

  let lead;
  const isNewLead = !existingLeadResult.length;

  if (existingLeadResult.length) {
    const updated = await db
      .update(leads)
      .set({
        name: name || existingLeadResult[0].name,
        email: email || existingLeadResult[0].email,
        address: address || existingLeadResult[0].address,
        projectType: projectType || existingLeadResult[0].projectType,
        notes: message ? `${existingLeadResult[0].notes || ''}\n\n[Form] ${message}`.trim() : existingLeadResult[0].notes,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, existingLeadResult[0].id))
      .returning();
    lead = updated[0];
  } else {
    const created = await db
      .insert(leads)
      .values({
        clientId: client.id,
        phone: normalizedPhone,
        name,
        email,
        address,
        projectType,
        notes: message ? `[Form] ${message}` : null,
        source: 'form',
        status: 'new',
      })
      .returning();
    lead = created[0];
  }

  // 4. Send SMS
  const messageContent = renderTemplate('form_response', {
    name: name || 'there',
    ownerName: client.ownerName,
    businessName: client.businessName,
  });

  const smsResult = await sendSMS(normalizedPhone, client.twilioNumber, messageContent);

  if (!smsResult.success) {
    console.error('Failed to send form response SMS:', smsResult.error);
    return { processed: false, reason: 'Failed to send SMS', error: smsResult.error };
  }

  // 5. Log conversations
  if (message) {
    await db.insert(conversations).values({
      leadId: lead.id,
      clientId: client.id,
      direction: 'inbound',
      messageType: 'form',
      content: `[Form Submission]\nName: ${name || 'N/A'}\nProject: ${projectType || 'N/A'}\nMessage: ${message}`,
    });
  }

  await db.insert(conversations).values({
    leadId: lead.id,
    clientId: client.id,
    direction: 'outbound',
    messageType: 'sms',
    content: messageContent,
    twilioSid: smsResult.sid,
  });

  // 6. Update stats
  const today = new Date().toISOString().split('T')[0];
  await db
    .insert(dailyStats)
    .values({
      clientId: client.id,
      date: today,
      formsResponded: 1,
      messagesSent: 1,
      conversationsStarted: isNewLead ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [dailyStats.clientId, dailyStats.date],
      set: {
        formsResponded: sql`${dailyStats.formsResponded} + 1`,
        messagesSent: sql`${dailyStats.messagesSent} + 1`,
        conversationsStarted: isNewLead
          ? sql`${dailyStats.conversationsStarted} + 1`
          : dailyStats.conversationsStarted,
      },
    });

  // 7. Increment monthly count
  await db
    .update(clients)
    .set({
      messagesSentThisMonth: sql`${clients.messagesSentThisMonth} + 1`,
    })
    .where(eq(clients.id, client.id));

  return {
    processed: true,
    leadId: lead.id,
    clientId: client.id,
    isNewLead,
  };
}
