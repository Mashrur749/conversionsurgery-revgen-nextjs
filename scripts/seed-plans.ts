/**
 * Seed the three-tier plan structure for Wave A.
 *
 * Voice AI is included free in all tiers (up to 1,000 min/mo fair-use).
 * No per-minute charge unless client exceeds fair-use threshold.
 *
 * IMPORTANT — Setup fee is split 50/50 (signing/go-live). The
 * `priceSetupCents` field below stores the TOTAL setup fee. The Stripe
 * price for the "setup at signing" line item must equal 50% of this
 * value. The remaining 50% is invoiced manually at go-live, and the
 * monthly subscription is activated at go-live (not at signing).
 *
 * Usage:  pnpm tsx scripts/seed-plans.ts
 *
 * Stripe price IDs must be created in the Stripe Dashboard first (test mode),
 * then set as env vars or passed inline. The script upserts by slug.
 */
import 'dotenv/config';
import { getDb } from '@/db';
import { plans } from '@/db/schema';
import { eq } from 'drizzle-orm';

const db = getDb();

const TIER_PLANS = [
  {
    name: 'Pilot',
    slug: 'pilot',
    description: 'Revenue Recovery Pilot — first 3 clients only',
    priceMonthly: 150000, // $1,500/mo
    priceSetupCents: 350000, // $3,500 setup
    priceYearly: 0,
    stripeProductId: process.env.STRIPE_PRODUCT_PILOT || '',
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PILOT_MONTHLY || '',
    stripePriceIdSetup: process.env.STRIPE_PRICE_PILOT_SETUP || '',
    stripePriceIdYearly: null,
    maxActiveClients: 3,
    publiclyVisible: false,
    features: {
      maxLeadsPerMonth: null,
      maxMessagesPerMonth: null,
      maxTeamMembers: 3,
      maxPhoneNumbers: 1,
      includesVoiceAi: true,
      includesCalendarSync: true,
      includesAdvancedAnalytics: false,
      includesWhiteLabel: false,
      supportLevel: 'priority' as const,
      apiAccess: false,
      allowOverages: false,
      isUnlimitedMessaging: true,
      isUnlimitedLeads: true,
      chargesOverage: false,
    },
    trialDays: 0,
    isPopular: false,
    displayOrder: 1,
    isActive: true,
  },
  {
    name: 'Standard',
    slug: 'standard',
    description: 'Revenue Recovery Standard — full managed service',
    priceMonthly: 200000, // $2,000/mo
    priceSetupCents: 550000, // $5,500 setup
    priceYearly: 0,
    stripeProductId: process.env.STRIPE_PRODUCT_STANDARD || '',
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY || '',
    stripePriceIdSetup: process.env.STRIPE_PRICE_STANDARD_SETUP || '',
    stripePriceIdYearly: null,
    maxActiveClients: null, // unlimited
    publiclyVisible: true,
    features: {
      maxLeadsPerMonth: null,
      maxMessagesPerMonth: null,
      maxTeamMembers: 5,
      maxPhoneNumbers: 3,
      includesVoiceAi: true,
      includesCalendarSync: true,
      includesAdvancedAnalytics: true,
      includesWhiteLabel: false,
      supportLevel: 'priority' as const,
      apiAccess: true,
      allowOverages: false,
      isUnlimitedMessaging: true,
      isUnlimitedLeads: true,
      chargesOverage: false,
    },
    trialDays: 0,
    isPopular: true,
    displayOrder: 2,
    isActive: true,
  },
  {
    name: 'Premium',
    slug: 'premium',
    description: 'Booked Estimate Operating System — full attribution + estimator reporting',
    priceMonthly: 350000, // $3,500/mo
    priceSetupCents: 950000, // $9,500 setup
    priceYearly: 0,
    stripeProductId: process.env.STRIPE_PRODUCT_PREMIUM || '',
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',
    stripePriceIdSetup: process.env.STRIPE_PRICE_PREMIUM_SETUP || '',
    stripePriceIdYearly: null,
    maxActiveClients: null,
    publiclyVisible: false, // operator-picked, not self-serve
    features: {
      maxLeadsPerMonth: null,
      maxMessagesPerMonth: null,
      maxTeamMembers: 10,
      maxPhoneNumbers: 5,
      includesVoiceAi: true,
      includesCalendarSync: true,
      includesAdvancedAnalytics: true,
      includesWhiteLabel: true,
      supportLevel: 'priority' as const,
      apiAccess: true,
      allowOverages: false,
      isUnlimitedMessaging: true,
      isUnlimitedLeads: true,
      chargesOverage: false,
    },
    trialDays: 0,
    isPopular: false,
    displayOrder: 3,
    isActive: true,
  },
];

async function seedPlans() {
  console.log('Seeding three-tier plans...\n');

  for (const plan of TIER_PLANS) {
    const [existing] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.slug, plan.slug))
      .limit(1);

    if (existing) {
      console.log(`  ↻ "${plan.slug}" exists — updating`);
      await db.update(plans).set(plan).where(eq(plans.slug, plan.slug));
    } else {
      console.log(`  + Creating "${plan.slug}"`);
      await db.insert(plans).values(plan);
    }
  }

  // Deactivate the old single-tier plan if it exists
  const [legacyPlan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.slug, 'billing-managed'))
    .limit(1);

  if (legacyPlan) {
    await db.update(plans).set({ isActive: false }).where(eq(plans.slug, 'billing-managed'));
    console.log('\n  ⚠ Deactivated legacy "billing-managed" plan');
  }

  console.log('\nDone. Verify Stripe price IDs are set before first checkout.\n');
  process.exit(0);
}

seedPlans().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
