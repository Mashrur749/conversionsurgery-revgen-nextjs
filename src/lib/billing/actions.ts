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

export async function cancelSubscription(clientId: string, reason: string) {
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
  await addPM(clientId, paymentMethodId, true);
  revalidatePath('/client/billing');
}

export async function removePaymentMethod(clientId: string, paymentMethodId: string) {
  await removePM(clientId, paymentMethodId);
  revalidatePath('/client/billing');
}

export async function setDefaultPaymentMethod(clientId: string, paymentMethodId: string) {
  await setDefaultPM(clientId, paymentMethodId);
  revalidatePath('/client/billing');
}

export async function changePlan(
  clientId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly'
) {
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
