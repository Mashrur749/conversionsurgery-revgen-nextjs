import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { plans } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { isSuperAdmin } from '@/lib/utils/admin-auth';
import { auth } from '@/auth';

/** GET /api/admin/plans - List all plans. */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.BILLING_VIEW },
  async () => {
    const db = getDb();
    const allPlans = await db
      .select()
      .from(plans)
      .orderBy(asc(plans.displayOrder));

    return NextResponse.json({ plans: allPlans });
  }
);

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

const createPlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  priceMonthly: z.number().int().min(0),
  priceYearly: z.number().int().min(0).optional(),
  features: featuresSchema,
  trialDays: z.number().int().min(0).default(14),
  isPopular: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
  stripeProductId: z.string().optional(),
}).strict();

/** POST /api/admin/plans - Create a new plan (super admin only). */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.BILLING_MANAGE },
  async ({ request }) => {
    const session = await auth();
    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const db = getDb();
    const [plan] = await db
      .insert(plans)
      .values(parsed.data)
      .returning();

    return NextResponse.json({ plan }, { status: 201 });
  }
);
