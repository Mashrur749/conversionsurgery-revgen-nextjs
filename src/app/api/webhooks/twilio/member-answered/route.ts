import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { callAttempts, teamMembers, leads, clients } from '@/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and } from 'drizzle-orm';
import { formatPhoneNumber } from '@/lib/utils/phone';

/**
 * [Voice] Twilio webhook for team member answering ring group call
 * Updates call status and notifies other team members
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get('attemptId');
  const memberId = url.searchParams.get('memberId');

  if (!attemptId || !memberId) {
    return new NextResponse('OK');
  }

  const db = getDb();

  const [attempt] = await db
    .update(callAttempts)
    .set({
      answeredBy: memberId,
      answeredAt: new Date(),
      status: 'answered',
    })
    .where(eq(callAttempts.id, attemptId))
    .returning();

  if (!attempt) {
    return new NextResponse('OK');
  }

  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, memberId))
    .limit(1);

  const otherMembers = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, attempt.clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ));

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, attempt.leadId))
    .limit(1);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, attempt.clientId))
    .limit(1);

  if (client?.twilioNumber) {
    const leadDisplay = lead?.name || formatPhoneNumber(lead?.phone || '');

    for (const otherMember of otherMembers) {
      if (otherMember.id === memberId) continue;

      await sendSMS(
        otherMember.phone,
        client.twilioNumber,
        `✓ ${member?.name || 'Team member'} answered the call with ${leadDisplay}`
      );
    }
  }

  if (lead) {
    await db
      .update(leads)
      .set({ actionRequired: false, actionRequiredReason: null })
      .where(eq(leads.id, lead.id));
  }

  return new NextResponse('OK');
}
