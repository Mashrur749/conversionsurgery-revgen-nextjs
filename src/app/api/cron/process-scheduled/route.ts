import { NextRequest, NextResponse } from 'next/server';
import { getDb, scheduledMessages, leads, clients, conversations, blockedNumbers, dailyStats } from '@/db';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { processNoShowFollowUp } from '@/lib/automations/no-show-recovery';
import { processWinBackFollowUp } from '@/lib/automations/win-back';
import { getClientUsagePolicy } from '@/lib/services/subscription';
import { isMessageLimitReached, type ClientUsagePolicy } from '@/lib/services/usage-policy';
import { processDueSmartAssistDrafts } from '@/lib/services/smart-assist-lifecycle';
import { SMART_ASSIST_SEQUENCE_TYPE } from '@/lib/services/smart-assist-state';
import { resolveReminderRecipients, type ReminderRoutingRecipient } from '@/lib/services/reminder-routing';
import { auditLog, calendarEvents, clientMemberships, leadContext, people } from '@/db/schema';
import { eq, and, lte, gte, sql, ne, or, isNull, gt } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendSMS, TwilioAmbiguousError } from '@/lib/services/twilio';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

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

    // Recover stuck messages: claimed (sent=true, sentAt set) >5 minutes ago
    // but the process died before actual delivery. We limit to messages whose
    // sendAt is within the last hour to avoid unclaiming legitimately-sent old messages.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recovered = await db
      .update(scheduledMessages)
      .set({ sent: false, sentAt: null })
      .where(and(
        eq(scheduledMessages.sent, true),
        eq(scheduledMessages.cancelled, false),
        lte(scheduledMessages.sentAt, fiveMinutesAgo),
        gte(scheduledMessages.sendAt, oneHourAgo)
      ))
      .returning({ id: scheduledMessages.id });

    if (recovered.length > 0) {
      console.log(`[CronScheduling] Recovered ${recovered.length} stuck messages`);
    }

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
    const routingByClient = new Map<string, Awaited<ReturnType<typeof resolveReminderRecipients>>>();

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
          // Freshness gate: check if context has changed since scheduling (AUDIT-01)
          const [ctx] = await db
            .select({ stage: leadContext.stage })
            .from(leadContext)
            .where(eq(leadContext.leadId, lead.id))
            .limit(1);

          if (ctx && ['booked', 'lost'].includes(ctx.stage)) {
            await markCancelled(db, message.id, `Lead stage changed to ${ctx.stage} since scheduling`);
            skipped++;
            continue;
          }

          // Check for recent inbound activity (lead replied within 7 days)
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const [recentInbound] = await db
            .select({ id: conversations.id })
            .from(conversations)
            .where(
              and(
                eq(conversations.leadId, lead.id),
                eq(conversations.direction, 'inbound'),
                gte(conversations.createdAt, sevenDaysAgo),
              )
            )
            .limit(1);

          if (recentInbound) {
            await markCancelled(db, message.id, 'Lead had recent inbound activity');
            skipped++;
            continue;
          }

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
          const routingCacheKey = `${client.id}:appointment_reminder_contractor`;
          let routing = routingByClient.get(routingCacheKey);
          if (!routing) {
            routing = await resolveReminderRecipients(client.id, 'appointment_reminder_contractor');
            routingByClient.set(routingCacheKey, routing);
          }

          // LB-02: Check if the lead's calendar event has a specific assigned team member.
          // If so, prepend that person to the primary chain so the reminder goes directly
          // to whoever was assigned at booking time, before falling back to general routing.
          let effectivePrimaryChain: ReminderRoutingRecipient[] = routing.primaryChain;
          try {
            const [assignedEvent] = await db
              .select({ assignedTeamMemberId: calendarEvents.assignedTeamMemberId })
              .from(calendarEvents)
              .where(and(
                eq(calendarEvents.leadId, lead.id),
                eq(calendarEvents.clientId, client.id),
                ne(calendarEvents.status, 'cancelled'),
                gt(calendarEvents.endTime, new Date()),
              ))
              .limit(1);

            if (assignedEvent?.assignedTeamMemberId) {
              const [assignedMember] = await db
                .select({
                  membershipId: clientMemberships.id,
                  personId: people.id,
                  name: people.name,
                  phone: people.phone,
                  isOwner: clientMemberships.isOwner,
                })
                .from(clientMemberships)
                .innerJoin(people, eq(clientMemberships.personId, people.id))
                .where(and(
                  eq(clientMemberships.id, assignedEvent.assignedTeamMemberId),
                  eq(clientMemberships.isActive, true),
                ))
                .limit(1);

              if (assignedMember?.phone) {
                let normalizedPhone: string | null = null;
                try {
                  normalizedPhone = normalizePhoneNumber(assignedMember.phone);
                } catch {
                  normalizedPhone = null;
                }

                if (normalizedPhone) {
                  const assignedAsRecipient: ReminderRoutingRecipient = {
                    role: assignedMember.isOwner ? 'owner' : 'assistant',
                    phone: normalizedPhone,
                    personId: assignedMember.personId,
                    membershipId: assignedMember.membershipId,
                    label: assignedMember.name || 'Assigned crew member',
                  };
                  // Prepend the assigned member; deduplicate if they are already first in the chain.
                  const alreadyFirst = effectivePrimaryChain[0]?.membershipId === assignedMember.membershipId;
                  if (!alreadyFirst) {
                    effectivePrimaryChain = [
                      assignedAsRecipient,
                      ...effectivePrimaryChain.filter((r) => r.membershipId !== assignedMember.membershipId),
                    ];
                  }
                }
              }
            }
          } catch {
            // Non-fatal — fall back to general routing if assignment lookup fails.
          }

          if (effectivePrimaryChain.length === 0) {
            await markCancelled(db, message.id, 'No valid reminder recipient configured');
            await db.insert(auditLog).values({
              personId: null,
              clientId: client.id,
              action: 'reminder_delivery_no_recipient',
              resourceType: 'scheduled_message',
              resourceId: message.id,
              metadata: {
                reminderType: 'appointment_reminder_contractor',
                reason: 'no_valid_recipient',
                policy: routing.policy,
                steps: routing.primarySteps,
              },
              createdAt: new Date(),
            });
            skipped++;
            continue;
          }

          const attempts: Array<{
            role: string;
            phone: string;
            status: 'sent' | 'failed';
            stage: 'primary_chain' | 'secondary';
            error?: string;
          }> = [];
          let deliveredRecipient: ReminderRoutingRecipient | null = null;

          for (const recipient of effectivePrimaryChain) {
            try {
              await sendSMS(recipient.phone, messageBody, client.twilioNumber);
              deliveredRecipient = recipient;
              attempts.push({
                role: recipient.role,
                phone: recipient.phone,
                status: 'sent',
                stage: 'primary_chain',
              });
              break;
            } catch (sendError) {
              attempts.push({
                role: recipient.role,
                phone: recipient.phone,
                status: 'failed',
                stage: 'primary_chain',
                error: sendError instanceof Error ? sendError.message : 'Unknown send error',
              });
            }
          }

          if (!deliveredRecipient) {
            await markCancelled(db, message.id, 'No reachable reminder recipient');
            await db.insert(auditLog).values({
              personId: null,
              clientId: client.id,
              action: 'reminder_delivery_no_recipient',
              resourceType: 'scheduled_message',
              resourceId: message.id,
              metadata: {
                reminderType: 'appointment_reminder_contractor',
                reason: 'all_recipients_unreachable',
                attempts,
              },
              createdAt: new Date(),
            });
            skipped++;
            continue;
          }

          for (const secondaryRecipient of routing.secondaryRecipients) {
            try {
              await sendSMS(secondaryRecipient.phone, messageBody, client.twilioNumber);
              attempts.push({
                role: secondaryRecipient.role,
                phone: secondaryRecipient.phone,
                status: 'sent',
                stage: 'secondary',
              });
            } catch (sendError) {
              attempts.push({
                role: secondaryRecipient.role,
                phone: secondaryRecipient.phone,
                status: 'failed',
                stage: 'secondary',
                error: sendError instanceof Error ? sendError.message : 'Unknown send error',
              });
            }
          }

          await db.insert(auditLog).values({
            personId: null,
            clientId: client.id,
            action: 'reminder_delivery_sent',
            resourceType: 'scheduled_message',
            resourceId: message.id,
            metadata: {
              reminderType: 'appointment_reminder_contractor',
              primaryRole: routing.rule.primaryRole,
              fallbackRoles: routing.rule.fallbackRoles,
              secondaryRoles: routing.rule.secondaryRoles,
              deliveredTo: {
                role: deliveredRecipient.role,
                phone: deliveredRecipient.phone,
                personId: deliveredRecipient.personId,
                membershipId: deliveredRecipient.membershipId,
                label: deliveredRecipient.label,
              },
              fallbackUsed: effectivePrimaryChain[0]?.phone !== deliveredRecipient.phone,
              attempts,
            },
            createdAt: new Date(),
          });
        } else {
          const sendResult = await sendCompliantMessage({
            clientId: client.id,
            to: lead.phone,
            from: client.twilioNumber,
            body: messageBody,
            messageClassification: 'proactive_outreach',
            messageCategory: 'marketing',
            consentBasis: { type: 'existing_consent' },
            leadId: lead.id,
            queueOnQuietHours: false, // Already scheduled, don't re-queue
            metadata: { source: 'scheduled_message', messageId: message.id, sequenceType: message.sequenceType },
          });

          if (sendResult.blocked) {
            // Mark as cancelled when blocked by compliance gateway
            await db
              .update(scheduledMessages)
              .set({
                cancelled: true,
                cancelledAt: new Date(),
                cancelledReason: sendResult.blockReason || 'Blocked by compliance gateway',
              })
              .where(eq(scheduledMessages.id, message.id));
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
        logSanitizedConsoleError('[CronScheduling] Failed to send scheduled message:', error, {
          messageId: message.id,
          clientId: client.id,
          leadId: lead.id,
          sequenceType: message.sequenceType,
        });

        if (error instanceof TwilioAmbiguousError) {
          // Twilio may have accepted the message — do NOT unclaim/retry.
          // Leave sent=true so stuck recovery won't touch it for 5 minutes.
          // The statusCallback will reconcile actual delivery status.
          console.warn(`[CronScheduling] Ambiguous send for message ${message.id} — leaving claimed, awaiting status callback`);
          failed++;
          continue;
        }

        // Definitive failure — increment attempts; cancel if max reached, otherwise unclaim for retry
        const newAttempts = (message.attempts ?? 0) + 1;
        if (newAttempts >= (message.maxAttempts ?? 3)) {
          await markCancelled(db, message.id, `Failed after ${newAttempts} attempts`);
        } else {
          await db
            .update(scheduledMessages)
            .set({ sent: false, sentAt: null, attempts: newAttempts })
            .where(eq(scheduledMessages.id, message.id));
        }
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
    return safeErrorResponse('[Cron][process-scheduled]', error, 'Processing failed');
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
