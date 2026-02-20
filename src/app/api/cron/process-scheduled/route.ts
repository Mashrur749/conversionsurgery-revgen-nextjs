import { NextRequest, NextResponse } from 'next/server';
import { getDb, scheduledMessages, leads, clients, conversations, blockedNumbers, dailyStats } from '@/db';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { processNoShowFollowUp } from '@/lib/automations/no-show-recovery';
import { processWinBackFollowUp } from '@/lib/automations/win-back';
import { eq, and, lte, sql } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';

/**
 * GET handler to process scheduled messages.
 * Sends pending messages, handles opt-outs and blocked numbers, tracks daily stats.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    // Reset monthly message counts on the 1st of each month
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() < 1) {
      await db
        .update(clients)
        .set({ messagesSentThisMonth: 0 });
      console.log('Reset monthly message counts');
    }

    // Get due messages (limit to prevent timeout)
    const dueMessages = await db
      .select({
        message: scheduledMessages,
        lead: leads,
        client: clients,
      })
      .from(scheduledMessages)
      .innerJoin(leads, eq(scheduledMessages.leadId, leads.id))
      .innerJoin(clients, eq(scheduledMessages.clientId, clients.id))
      .where(and(
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false),
        lte(scheduledMessages.sendAt, new Date())
      ))
      .limit(50);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const { message, lead, client } of dueMessages) {
      // Skip if lead opted out
      if (lead.optedOut) {
        await markCancelled(db, message.id, 'Lead opted out');
        skipped++;
        continue;
      }

      // Skip if number blocked
      const blockedResult = await db
        .select()
        .from(blockedNumbers)
        .where(and(
          eq(blockedNumbers.clientId, client.id),
          eq(blockedNumbers.phone, lead.phone)
        ))
        .limit(1);

      if (blockedResult.length) {
        await markCancelled(db, message.id, 'Number blocked');
        skipped++;
        continue;
      }

      // Skip if over monthly limit
      const messagesSent = client.messagesSentThisMonth || 0;
      const limit = client.monthlyMessageLimit || 10000;
      if (messagesSent >= limit) {
        skipped++;
        continue;
      }

      // Skip if client has no Twilio number
      if (!client.twilioNumber) {
        await markCancelled(db, message.id, 'No Twilio number');
        skipped++;
        continue;
      }

      // Atomic claim: mark as sending to prevent duplicate processing on concurrent cron runs.
      // If 0 rows updated, another process already claimed this message.
      const [claimed] = await db
        .update(scheduledMessages)
        .set({ sent: true, sentAt: new Date() })
        .where(and(
          eq(scheduledMessages.id, message.id),
          eq(scheduledMessages.sent, false),
          eq(scheduledMessages.cancelled, false)
        ))
        .returning({ id: scheduledMessages.id });

      if (!claimed) {
        skipped++;
        continue;
      }

      // Send SMS via compliance gateway
      try {
        // Resolve __AI_GENERATE__ placeholder to real AI-generated content
        let messageBody = message.content;
        if (message.content === '__AI_GENERATE__') {
          let generated: string | null = null;

          if (message.sequenceType === 'no_show_followup') {
            generated = await processNoShowFollowUp(lead.id, client.id);
          } else if (message.sequenceType === 'win_back') {
            generated = await processWinBackFollowUp(lead.id, client.id);
          }

          if (!generated) {
            await markCancelled(db, message.id, `AI generation failed for ${message.sequenceType}`);
            skipped++;
            continue;
          }
          messageBody = generated;
        }

        const sendResult = await sendCompliantMessage({
          clientId: client.id,
          to: lead.phone,
          from: client.twilioNumber,
          body: messageBody,
          messageCategory: 'marketing',
          consentBasis: { type: 'existing_consent' },
          leadId: lead.id,
          queueOnQuietHours: false, // Already scheduled, don't re-queue
          metadata: { source: 'scheduled_message', messageId: message.id, sequenceType: message.sequenceType },
        });

        if (sendResult.blocked) {
          // Unclaim: mark back as unsent and cancelled
          await markCancelled(db, message.id, `Compliance: ${sendResult.blockReason}`);
          skipped++;
          continue;
        }

        // Log conversation (use resolved messageBody, not the placeholder)
        await db.insert(conversations).values({
          leadId: lead.id,
          clientId: client.id,
          direction: 'outbound',
          messageType: 'scheduled',
          content: messageBody,
          twilioSid: sendResult.messageSid || undefined,
        });

        // Update daily stats (monthly count handled by gateway)
        await updateDailyStats(db, client.id, message.sequenceType);

        sent++;
      } catch (error) {
        console.error('[CronScheduling] Failed to send scheduled message:', message.id, error);
        // Unclaim: mark back as unsent so it can be retried on next cron run
        await db
          .update(scheduledMessages)
          .set({ sent: false, sentAt: null })
          .where(eq(scheduledMessages.id, message.id));
        failed++;
      }
    }

    return NextResponse.json({
      processed: dueMessages.length,
      sent,
      skipped,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CronScheduling] Cron error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

/**
 * Marks a scheduled message as cancelled with a reason.
 * @param db - Database client instance
 * @param messageId - The scheduled message UUID
 * @param reason - Cancellation reason (e.g., "Lead opted out", "Number blocked")
 */
async function markCancelled(db: ReturnType<typeof getDb>, messageId: string, reason: string) {
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: reason,
    })
    .where(eq(scheduledMessages.id, messageId));
}

/**
 * Updates daily statistics for a client after sending a message.
 * @param db - Database client instance
 * @param clientId - The client UUID
 * @param sequenceType - The message sequence type (optional)
 */
async function updateDailyStats(db: ReturnType<typeof getDb>, clientId: string, sequenceType: string | null) {
  const today = new Date().toISOString().split('T')[0];

  await db
    .insert(dailyStats)
    .values({
      clientId,
      date: today,
      messagesSent: 1,
    })
    .onConflictDoUpdate({
      target: [dailyStats.clientId, dailyStats.date],
      set: {
        messagesSent: sql`${dailyStats.messagesSent} + 1`,
      },
    });
}
