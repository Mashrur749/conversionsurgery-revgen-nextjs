import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-session';
import { getDb, scheduledMessages } from '@/db';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const schema = z.object({
  leadId: z.string().uuid(),
  sequenceType: z.string().optional(), // Cancel specific sequence or all
});

/**
 * POST /api/sequences/cancel - Cancels scheduled message sequences for a lead.
 * Can cancel all sequences or specific types (appointment, estimate, review, payment).
 */
export async function POST(request: NextRequest) {
  const authSession = await getAuthSession();
  if (!authSession?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { leadId, sequenceType } = parsed.data;
    const clientId = authSession.clientId;

    // Map short names to actual database sequenceType values
    const sequenceTypeMap: Record<string, string[]> = {
      appointment: ['appointment_reminder'],
      estimate: ['estimate_followup'],
      review: ['review_request', 'referral_request'],
      payment: ['payment_reminder'],
    };

    const sequenceTypesToCancel = sequenceType ? (sequenceTypeMap[sequenceType] || [sequenceType]) : undefined;

    // Build the base conditions
    let whereCondition = and(
      eq(scheduledMessages.leadId, leadId),
      eq(scheduledMessages.clientId, clientId),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    );

    // Add sequenceType filter if specified
    if (sequenceTypesToCancel && sequenceTypesToCancel.length > 0) {
      whereCondition = and(
        whereCondition,
        inArray(scheduledMessages.sequenceType, sequenceTypesToCancel)
      );
    }

    const result = await db
      .update(scheduledMessages)
      .set({
        cancelled: true,
        cancelledAt: new Date(),
        cancelledReason: 'Manually cancelled',
      })
      .where(whereCondition)
      .returning({ id: scheduledMessages.id });

    return NextResponse.json({
      success: true,
      cancelledCount: result.length,
    });
  } catch (error) {
    console.error('[AppointmentSystem] Cancel sequence error:', error);
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}
