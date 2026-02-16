import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { coupons } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';

const createCouponSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().max(100).optional(),
  discountType: z.enum(['percent', 'amount']),
  discountValue: z.number().int().positive(),
  duration: z.enum(['once', 'repeating', 'forever']).default('once'),
  durationMonths: z.number().int().positive().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  applicablePlans: z.array(z.string().uuid()).optional(),
  minAmountCents: z.number().int().nonnegative().optional(),
  firstTimeOnly: z.boolean().default(false),
}).strict();

/** GET /api/admin/coupons — List all coupons */
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  const results = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  return NextResponse.json({ coupons: results });
}

/** POST /api/admin/coupons — Create a coupon */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createCouponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = getDb();

  const [coupon] = await db.insert(coupons).values({
    code: data.code.toUpperCase(),
    name: data.name || null,
    discountType: data.discountType,
    discountValue: data.discountValue,
    duration: data.duration,
    durationMonths: data.durationMonths || null,
    maxRedemptions: data.maxRedemptions || null,
    validFrom: data.validFrom ? new Date(data.validFrom) : null,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
    applicablePlans: data.applicablePlans || null,
    minAmountCents: data.minAmountCents || null,
    firstTimeOnly: data.firstTimeOnly,
  }).returning();

  return NextResponse.json({ coupon }, { status: 201 });
}
