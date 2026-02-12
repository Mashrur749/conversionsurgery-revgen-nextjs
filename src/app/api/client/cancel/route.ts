import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  initiateCancellation,
  scheduleRetentionCall,
  confirmCancellation,
} from '@/lib/services/cancellation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/services/resend';

const cancelSchema = z.object({
  reason: z.string().min(1),
  feedback: z.string().optional(),
  action: z.enum(['schedule_call', 'confirm']),
});

/** POST /api/client/cancel */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Invalid input',
        details: parsed.error.flatten().fieldErrors
      }, { status: 400 });
    }

    const { reason, feedback, action } = parsed.data;

    // Create cancellation request
    const requestId = await initiateCancellation(clientId, reason, feedback);

    const db = getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (action === 'schedule_call') {
      // Schedule call for tomorrow 10am
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 1);
      scheduledAt.setHours(10, 0, 0, 0);

      await scheduleRetentionCall(requestId, scheduledAt);

      // Notify admin
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@conversionsurgery.com',
        subject: `Retention Call Scheduled: ${client?.businessName}`,
        html: `<p>A client wants to cancel and has scheduled a retention call.</p>
         <p><strong>Business:</strong> ${client?.businessName}</p>
         <p><strong>Reason:</strong> ${reason}</p>
         <p><strong>Feedback:</strong> ${feedback || 'None provided'}</p>
         <p><strong>Scheduled:</strong> Tomorrow at 10am</p>`,
      });

      return NextResponse.json({ success: true, action: 'call_scheduled' });
    }

    if (action === 'confirm') {
      await confirmCancellation(requestId, 7);

      // Notify admin
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@conversionsurgery.com',
        subject: `Client Cancelled: ${client?.businessName}`,
        html: `<p>A client has cancelled their subscription.</p>
         <p><strong>Business:</strong> ${client?.businessName}</p>
         <p><strong>Reason:</strong> ${reason}</p>
         <p><strong>Feedback:</strong> ${feedback || 'None provided'}</p>
         <p><strong>Grace Period:</strong> 7 days</p>`,
      });

      return NextResponse.json({ success: true, action: 'cancelled' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Billing] Cancellation error:', error);
    return NextResponse.json({ error: 'Failed to process cancellation' }, { status: 500 });
  }
}
