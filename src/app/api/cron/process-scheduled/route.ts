import { NextRequest, NextResponse } from 'next/server';
import { getDb, scheduledMessages, leads, clients, conversations, blockedNumbers, dailyStats } from '@/db';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { processNoShowFollowUp } from '@/lib/automations/no-show-recovery';
import { processWinBackFollowUp } from '@/lib/automations/win-back';
import { getClientUsagePolicy } from '@/lib/services/subscription';
import { isMessageLimitReached, type ClientUsagePolicy } from '@/lib/services/usage-policy';
import { processDueSmartAssistDrafts } from '@/lib/services/smart-assist-lifecycle';
import { SMART_ASSIST_SEQUENCE_TYPE } from '@/lib/services/smart-assist-state';
import { eq, and, lte, sql, ne, or, isNull } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendSMS } from '@/lib/services/twilio';

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
    const smartAssistResult = await processDueSmartAssistDrafts(25);

    // Monthly message count reset moved to dedicated /api/cron/monthly-reset (D9)

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
        or(
          isNull(scheduledMessages.sequenceType),
          ne(scheduledMessages.sequenceType, SMART_ASSIST_SEQUENCE_TYPE)
        ),
        lte(scheduledMessages.sendAt, new Date())
      ))
      .limit(50);

    let sent = smartAssistResult.sent;
    let skipped = smartAssistResult.skipped;
    let failed = smartAssistResult.failed;
    const usagePolicyByClient = new Map<string, ClientUsagePolicy | null>();

    for (const { message, lead, client } of dueMessages) {
      const isContractorReminder = message.sequenceType === 'appointment_reminder_contractor';

      // Skip if lead opted out
      if (!isContractorReminder && lead.optedOut) {
        await markCancelled(db, message.id, 'Lead opted out');
        skipped++;
        continue;
      }

      // Skip if number blocked
      if (!isContractorReminder) {
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
      }

      if (!usagePolicyByClient.has(client.id)) {
        usagePolicyByClient.set(client.id, await getClientUsagePolicy(client.id));
      }
      const usagePolicy = usagePolicyByClient.get(client.id) ?? null;
      const limitCheck = isMessageLimitReached(
        client.messagesSentThisMonth,
        usagePolicy,
        client.monthlyMessageLimit
      );

      if (limitCheck.reached) {
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

        if (isContractorReminder) {
          if (!client.phone) {
            await markCancelled(db, message.id, 'Client owner phone missing');
            skipped++;
            continue;
          }

          await sendSMS(client.phone, messageBody, client.twilioNumber);
        } else {
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
        }

        // Update daily stats (monthly count handled by gateway)
        await updateDailyStats(db, client.id, message.sequenceType);

        sent++;

        // Throttle: 100ms between messages to avoid carrier filtering (E10)
        if (sent < dueMessages.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
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
      processed: dueMessages.length + smartAssistResult.processed,
      sent,
      skipped,
      failed,
      smartAssist: smartAssistResult,
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
