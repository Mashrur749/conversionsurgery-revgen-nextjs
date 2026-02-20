import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { plans, subscriptions } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/admin/plans/[id] - Get a single plan. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.BILLING_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;
  const db = getDb();

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, id))
    .limit(1);

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  return NextResponse.json({ plan });
}

const featuresSchema = z.object({
  maxLeadsPerMonth: z.number().nullable(),
  maxTeamMembers: z.number().nullable(),
  maxPhoneNumbers: z.number(),
  includesVoiceAi: z.boolean(),
  includesCalendarSync: z.boolean(),
  includesAdvancedAnalytics: z.boolean(),
  includesWhiteLabel: z.boolean(),
  supportLevel: z.enum(['email', 'priority', 'dedicated']),
  apiAccess: z.boolean(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceMonthly: z.number().int().min(0).optional(),
  priceYearly: z.number().int().min(0).optional(),
  features: featuresSchema.optional(),
  trialDays: z.number().int().min(0).optional(),
  isPopular: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
  stripeProductId: z.string().optional(),
}).strict();

/** PATCH /api/admin/plans/[id] - Update a plan. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.BILLING_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updatePlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const db = getDb();

  // If deactivating, check for active subscriptions first
  if (parsed.data.isActive === false) {
    const activeSubscriptions = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.planId, id),
          inArray(subscriptions.status, ['active', 'trialing', 'past_due'])
        )
      )
      .limit(1);

    if (activeSubscriptions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot deactivate plan with active subscriptions. Migrate subscribers to another plan first.' },
        { status: 409 }
      );
    }
  }

  const [updated] = await db
    .update(plans)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(plans.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  return NextResponse.json({ plan: updated });
}

/** DELETE /api/admin/plans/[id] - Soft-delete (deactivate) a plan. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.BILLING_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;
  const db = getDb();

  // Check for active subscriptions before deactivating
  const activeSubscriptions = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.planId, id),
        inArray(subscriptions.status, ['active', 'trialing', 'past_due'])
      )
    )
    .limit(1);

  if (activeSubscriptions.length > 0) {
    return NextResponse.json(
      { error: 'Cannot deactivate plan with active subscriptions. Migrate subscribers to another plan first.' },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(plans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(plans.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
