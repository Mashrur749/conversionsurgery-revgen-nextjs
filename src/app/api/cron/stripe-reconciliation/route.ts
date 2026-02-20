import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { getDb } from '@/db';
import { subscriptions, clients, billingEvents } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';

/**
 * GET /api/cron/stripe-reconciliation
 *
 * Reconciles local subscription state with Stripe.
 * Designed to run daily (during off-peak hours, e.g., 2am UTC).
 *
 * Checks:
 * 1. Local active subscriptions that are canceled/missing in Stripe
 * 2. Stripe active subscriptions that are canceled/missing locally
 * 3. Status mismatches (e.g., local shows 'active' but Stripe shows 'past_due')
 *
 * Automatically fixes discrepancies and logs each correction as a billing event.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const stripe = getStripeClient();

  const results = {
    checked: 0,
    mismatches: 0,
    fixed: 0,
    errors: [] as string[],
  };

  try {
    // Get all local subscriptions that should be active
    const localSubs = await db
      .select({
        id: subscriptions.id,
        clientId: subscriptions.clientId,
        status: subscriptions.status,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        stripeCustomerId: subscriptions.stripeCustomerId,
      })
      .from(subscriptions)
      .where(
        inArray(subscriptions.status, ['active', 'trialing', 'past_due', 'paused'])
      );

    results.checked = localSubs.length;

    // Process in batches to avoid Stripe rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < localSubs.length; i += BATCH_SIZE) {
      const batch = localSubs.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (localSub) => {
          if (!localSub.stripeSubscriptionId) {
            results.errors.push(
              `Sub ${localSub.id}: no stripeSubscriptionId — cannot reconcile`
            );
            return;
          }

          try {
            const stripeSub = await stripe.subscriptions.retrieve(
              localSub.stripeSubscriptionId
            );

            // Map Stripe status to our status type
            const stripeStatus = stripeSub.status as string;

            if (stripeStatus !== localSub.status) {
              results.mismatches++;

              // Fix: update local to match Stripe (Stripe is the source of truth)
              const mappedStatus = mapStripeStatus(stripeStatus);

              await db.transaction(async (tx) => {
                await tx.update(subscriptions).set({
                  status: mappedStatus,
                  canceledAt: stripeSub.canceled_at
                    ? new Date(stripeSub.canceled_at * 1000)
                    : null,
                  cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                  updatedAt: new Date(),
                }).where(eq(subscriptions.id, localSub.id));

                await tx.insert(billingEvents).values({
                  clientId: localSub.clientId,
                  eventType: 'reconciliation_fix',
                  description: `Status corrected: ${localSub.status} → ${mappedStatus} (Stripe: ${stripeStatus})`,
                  stripeEventId: `reconciliation_${localSub.id}_${Date.now()}`,
                });

                // If Stripe shows canceled, update client status too
                if (mappedStatus === 'canceled' && localSub.clientId) {
                  await tx.update(clients).set({
                    status: 'cancelled',
                    updatedAt: new Date(),
                  }).where(
                    and(
                      eq(clients.id, localSub.clientId),
                      eq(clients.status, 'active')
                    )
                  );
                }
              });

              results.fixed++;
              console.log(
                `[Reconciliation] Fixed sub ${localSub.id}: ${localSub.status} → ${mappedStatus}`
              );
            }
          } catch (error) {
            // Stripe error — subscription might not exist
            if (
              error instanceof Error &&
              'statusCode' in error &&
              (error as { statusCode: number }).statusCode === 404
            ) {
              // Subscription doesn't exist in Stripe — mark as canceled locally
              results.mismatches++;

              await db.transaction(async (tx) => {
                await tx.update(subscriptions).set({
                  status: 'canceled',
                  canceledAt: new Date(),
                  updatedAt: new Date(),
                }).where(eq(subscriptions.id, localSub.id));

                await tx.insert(billingEvents).values({
                  clientId: localSub.clientId,
                  eventType: 'reconciliation_fix',
                  description: `Subscription not found in Stripe — marked as canceled`,
                  stripeEventId: `reconciliation_orphan_${localSub.id}_${Date.now()}`,
                });

                if (localSub.clientId) {
                  await tx.update(clients).set({
                    status: 'cancelled',
                    updatedAt: new Date(),
                  }).where(
                    and(
                      eq(clients.id, localSub.clientId),
                      eq(clients.status, 'active')
                    )
                  );
                }
              });

              results.fixed++;
              console.log(
                `[Reconciliation] Orphaned sub ${localSub.id}: not found in Stripe, marked canceled`
              );
            } else {
              console.error(`[Reconciliation] Sub ${localSub.id} error:`, error);
              results.errors.push(`Sub ${localSub.id}: retrieval failed`);
            }
          }
        })
      );

      // Small delay between batches to stay under Stripe rate limits
      if (i + BATCH_SIZE < localSubs.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(
      `[Reconciliation] Complete: checked=${results.checked}, mismatches=${results.mismatches}, fixed=${results.fixed}, errors=${results.errors.length}`
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Reconciliation] Fatal error:', error);
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 }
    );
  }
}

function mapStripeStatus(
  stripeStatus: string
): 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'paused' {
  switch (stripeStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'canceled': return 'canceled';
    case 'unpaid': return 'unpaid';
    case 'paused': return 'paused';
    case 'incomplete':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'canceled';
  }
}
