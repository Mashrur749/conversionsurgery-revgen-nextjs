import { getDb } from '@/db';
import { plans } from '@/db/schema';

export async function seedPlans() {
  const db = getDb();

  const defaultPlans = [
    {
      name: 'Starter',
      slug: 'starter',
      description: 'Perfect for solo contractors just getting started',
      priceMonthly: 49700, // $497
      priceYearly: 497000, // $4,970 (2 months free)
      features: {
        maxLeadsPerMonth: 50,
        maxTeamMembers: 1,
        maxPhoneNumbers: 1,
        includesVoiceAi: false,
        includesCalendarSync: false,
        includesAdvancedAnalytics: false,
        includesWhiteLabel: false,
        supportLevel: 'email' as const,
        apiAccess: false,
      },
      trialDays: 14,
      displayOrder: 1,
    },
    {
      name: 'Professional',
      slug: 'professional',
      description: 'For growing businesses that need more power',
      priceMonthly: 99700, // $997
      priceYearly: 997000, // $9,970
      features: {
        maxLeadsPerMonth: 200,
        maxTeamMembers: 5,
        maxPhoneNumbers: 3,
        includesVoiceAi: true,
        includesCalendarSync: true,
        includesAdvancedAnalytics: true,
        includesWhiteLabel: false,
        supportLevel: 'priority' as const,
        apiAccess: false,
      },
      trialDays: 14,
      isPopular: true,
      displayOrder: 2,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For established businesses with high volume',
      priceMonthly: 199700, // $1,997
      priceYearly: 1997000, // $19,970
      features: {
        maxLeadsPerMonth: null, // unlimited
        maxTeamMembers: null,
        maxPhoneNumbers: 10,
        includesVoiceAi: true,
        includesCalendarSync: true,
        includesAdvancedAnalytics: true,
        includesWhiteLabel: true,
        supportLevel: 'dedicated' as const,
        apiAccess: true,
      },
      trialDays: 14,
      displayOrder: 3,
    },
  ];

  for (const plan of defaultPlans) {
    await db.insert(plans).values(plan).onConflictDoNothing();
  }

  console.log('Plans seeded successfully');
}
