import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { clients, subscriptions, scheduledMessages } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { AI_ASSIST_CATEGORIES } from '@/lib/services/ai-send-policy';
import { getOnboardingQualityReadiness } from '@/lib/services/onboarding-quality';
import { z } from 'zod';
import { sendOnboardingNotification } from '@/lib/services/agency-communication';
import { cancelSubscription } from '@/lib/services/subscription';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client });
  }
);

const updateClientSchema = z.object({
  businessName: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  timezone: z.string().optional(),
  googleBusinessUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  twilioNumber: z.string().optional().or(z.null()),
  notificationEmail: z.boolean().optional(),
  notificationSms: z.boolean().optional(),
  monthlyMessageLimit: z.number().min(0).optional(),
  status: z.enum(['pending', 'active', 'paused', 'cancelled']).optional(),
  // Voice AI settings
  voiceEnabled: z.boolean().optional(),
  voiceMode: z.enum(['after_hours', 'overflow', 'always']).optional(),
  voiceGreeting: z.string().optional().or(z.null()),
  voiceVoiceId: z.string().optional().or(z.null()),
  voiceMaxDuration: z.number().min(30).max(600).optional(),
  // Feature flags
  missedCallSmsEnabled: z.boolean().optional(),
  aiResponseEnabled: z.boolean().optional(),
  aiAgentEnabled: z.boolean().optional(),
  aiAgentMode: z.enum(['off', 'assist', 'autonomous']).optional(),
  autoEscalationEnabled: z.boolean().optional(),
  smartAssistEnabled: z.boolean().optional(),
  smartAssistDelayMinutes: z.number().int().min(1).max(60).optional(),
  smartAssistManualCategories: z.array(z.enum(AI_ASSIST_CATEGORIES)).optional(),
  flowsEnabled: z.boolean().optional(),
  leadScoringEnabled: z.boolean().optional(),
  reputationMonitoringEnabled: z.boolean().optional(),
  autoReviewResponseEnabled: z.boolean().optional(),
  calendarSyncEnabled: z.boolean().optional(),
  hotTransferEnabled: z.boolean().optional(),
  paymentLinksEnabled: z.boolean().optional(),
  photoRequestsEnabled: z.boolean().optional(),
  multiLanguageEnabled: z.boolean().optional(),
  preferredLanguage: z.string().max(10).optional(),
  // Webhook config
  webhookUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  webhookEvents: z.array(z.string()).optional(),
});

export const PATCH = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId, session }) => {
    const body = await request.json();
    const data = updateClientSchema.parse(body);

    // Normalize phone if provided
    if (data.phone) {
      data.phone = normalizePhoneNumber(data.phone);
    }

    const db = getDb();

    // Check previous status to detect activation
    const [existing] = await db
      .select({ status: clients.status, aiAgentMode: clients.aiAgentMode })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    const autonomousTransitionRequested =
      data.aiAgentMode === 'autonomous' && existing?.aiAgentMode !== 'autonomous';

    if (autonomousTransitionRequested) {
      const readiness = await getOnboardingQualityReadiness({
        clientId,
        source: 'autonomous_transition',
        evaluatedByPersonId: session.personId,
        persistSnapshot: true,
      });

      if (!readiness.decision.allowed) {
        return NextResponse.json(
          {
            error: 'Autonomous mode blocked: onboarding quality gates are not ready.',
            onboardingQuality: {
              evaluation: readiness.evaluation,
              decision: readiness.decision,
              override: readiness.override,
            },
          },
          { status: 409 }
        );
      }
    }

    const [updated] = await db
      .update(clients)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fire onboarding notification when status changes to 'active'
    if (data.status === 'active' && existing?.status !== 'active') {
      sendOnboardingNotification(clientId).catch((err) =>
        logSanitizedConsoleError('[Admin][clients.patch.onboarding-notification]', err, {
          clientId,
        })
      );
    }

    return NextResponse.json({ client: updated });
  }
);

export const DELETE = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_DELETE, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();

    // Soft delete - set status to cancelled
    const [updated] = await db
      .update(clients)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // B3: Cancel active Stripe subscriptions
    const activeSubs = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.clientId, clientId),
        inArray(subscriptions.status, ['active', 'trialing', 'past_due'])
      ));

    for (const sub of activeSubs) {
      try {
        await cancelSubscription(sub.id, 'Client account cancelled', true);
      } catch (err) {
        logSanitizedConsoleError('[Admin][clients.delete.cancel-subscription]', err, {
          clientId,
          subscriptionId: sub.id,
        });
      }
    }

    // Cancel pending scheduled messages
    await db
      .update(scheduledMessages)
      .set({
        cancelled: true,
        cancelledAt: new Date(),
        cancelledReason: 'Client account cancelled',
      })
      .where(and(
        eq(scheduledMessages.clientId, clientId),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      ));

    return NextResponse.json({ success: true });
  }
);
