'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  cancelSubscription as cancelSub,
  pauseSubscription as pauseSub,
  resumeSubscription as resumeSub,
  changePlan as changeSubPlan,
  createSubscription,
} from '@/lib/services/subscription';
import {
  addPaymentMethod as addPM,
  removePaymentMethod as removePM,
  setDefaultPaymentMethod as setDefaultPM,
} from '@/lib/services/payment-methods';
import { getPortalSession, PORTAL_PERMISSIONS, hasPermission } from '@/lib/permissions';

/**
 * Verify the caller is authenticated and has billing access for the given client.
 * Throws if not authenticated or clientId doesn't match session.
 */
async function requireBillingAccess(clientId: string) {
  const session = await getPortalSession();
  if (!session) {
    throw new Error('Unauthorized: not authenticated');
  }
  if (session.clientId !== clientId) {
    throw new Error('Forbidden: client mismatch');
  }
  if (!hasPermission(session.permissions, PORTAL_PERMISSIONS.SETTINGS_EDIT)) {
    throw new Error('Forbidden: insufficient permissions');
  }
  return session;
}

export async function cancelSubscription(clientId: string, reason: string) {
  await requireBillingAccess(clientId);
  const db = getDb();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  await cancelSub(subscription.id, reason);
  revalidatePath('/client/billing');
}

export async function pauseSubscription(clientId: string, resumeDate: Date) {
  await requireBillingAccess(clientId);
  const db = getDb();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  await pauseSub(subscription.id, resumeDate);
  revalidatePath('/client/billing');
}

export async function resumeSubscription(clientId: string) {
  await requireBillingAccess(clientId);
  const db = getDb();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  await resumeSub(subscription.id);
  revalidatePath('/client/billing');
}

export async function addPaymentMethod(clientId: string, paymentMethodId: string) {
  await requireBillingAccess(clientId);
  await addPM(clientId, paymentMethodId, true);
  revalidatePath('/client/billing');
}

export async function removePaymentMethod(clientId: string, paymentMethodId: string) {
  await requireBillingAccess(clientId);
  await removePM(clientId, paymentMethodId);
  revalidatePath('/client/billing');
}

export async function setDefaultPaymentMethod(clientId: string, paymentMethodId: string) {
  await requireBillingAccess(clientId);
  await setDefaultPM(clientId, paymentMethodId);
  revalidatePath('/client/billing');
}

export async function changePlan(
  clientId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly'
) {
  await requireBillingAccess(clientId);
  const db = getDb();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  if (!subscription) {
    // No existing subscription — create a new one
    await createSubscription(
      clientId,
      planId,
      billingCycle === 'yearly' ? 'year' : 'month'
    );
    revalidatePath('/client/billing');
    revalidatePath('/client/billing/upgrade');
    return;
  }

  await changeSubPlan(
    subscription.id,
    planId,
    billingCycle === 'yearly' ? 'year' : 'month'
  );

  revalidatePath('/client/billing');
  revalidatePath('/client/billing/upgrade');
}
