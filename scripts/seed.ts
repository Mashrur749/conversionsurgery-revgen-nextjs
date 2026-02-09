// Load .env.local
import 'dotenv/config';
import { getDb } from '@/db';
import {
  subscriptionPlans,
  flowTemplates,
  flowTemplateSteps,
  adminUsers,
  systemSettings,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes, scryptSync } from 'crypto';

const db = getDb();

// ============================================
// 1. SUBSCRIPTION PLANS
// ============================================

const PLANS = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For contractors just getting started with automation',
    priceMonthly: 49700, // $497 in cents
    priceYearly: 497000, // $4,970 (2 months free)
    stripePriceIdMonthly:
      process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_starter_monthly',
    stripePriceIdYearly:
      process.env.STRIPE_PRICE_STARTER_YEARLY || 'price_starter_yearly',
    stripeProductId: process.env.STRIPE_PRODUCT_STARTER || 'prod_starter',
    includedLeads: 100,
    includedMessages: 1000,
    includedTeamMembers: 2,
    includedPhoneNumbers: 1,
    features: [
      'Missed call text-back',
      'Basic AI responses',
      'Lead management CRM',
      'Email notifications',
    ],
    sortOrder: 1,
    isPublic: true,
  },
  {
    name: 'Professional',
    slug: 'professional',
    description: 'Full-featured revenue recovery for growing contractors',
    priceMonthly: 99700, // $997 in cents
    priceYearly: 997000, // $9,970 (2 months free)
    stripePriceIdMonthly:
      process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    stripePriceIdYearly:
      process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
    stripeProductId: process.env.STRIPE_PRODUCT_PRO || 'prod_pro',
    includedLeads: 500,
    includedMessages: 5000,
    includedTeamMembers: 5,
    includedPhoneNumbers: 3,
    features: [
      'Everything in Starter',
      'AI conversation agent',
      'Automated follow-up flows',
      'Invoice & payment recovery',
      'Calendar integration',
      'Team management',
      'Lead scoring',
      'Basic analytics',
    ],
    sortOrder: 2,
    isPublic: true,
    isPopular: true,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'For high-volume contractors and franchises',
    priceMonthly: 199700, // $1,997 in cents
    priceYearly: 1997000, // $19,970 (2 months free)
    stripePriceIdMonthly:
      process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
    stripePriceIdYearly:
      process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || 'price_enterprise_yearly',
    stripeProductId: process.env.STRIPE_PRODUCT_ENTERPRISE || 'prod_enterprise',
    includedLeads: 2000,
    includedMessages: 20000,
    includedTeamMembers: 20,
    includedPhoneNumbers: 10,
    features: [
      'Everything in Professional',
      'Voice AI call handling',
      'Hot transfer',
      'Reputation monitoring',
      'Auto review responses',
      'Multi-language support',
      'Advanced analytics',
      'Priority support',
      'Custom integrations',
    ],
    sortOrder: 3,
    isPublic: true,
  },
];

async function seedPlans() {
  console.log('Seeding subscription plans...');

  for (const plan of PLANS) {
    const existing = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.slug, plan.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Plan "${plan.slug}" exists, updating...`);
      await db
        .update(subscriptionPlans)
        .set(plan)
        .where(eq(subscriptionPlans.slug, plan.slug));
    } else {
      console.log(`  Creating plan "${plan.slug}"...`);
      await db.insert(subscriptionPlans).values(plan);
    }
  }

  console.log('  ✓ Plans seeded');
}

// ============================================
// 2. FLOW TEMPLATES
// ============================================

type FlowCategory = 'missed_call' | 'form_response' | 'estimate' | 'appointment' | 'payment' | 'review' | 'referral' | 'custom';

interface SeedFlowStep {
  stepNumber: number;
  name: string;
  delayMinutes: number;
  messageTemplate: string;
  skipConditions?: Record<string, boolean | string> | null;
}

const FLOW_TEMPLATES: Array<{
  name: string;
  slug: string;
  description: string;
  category: FlowCategory;
  steps: SeedFlowStep[];
}> = [
  {
    name: 'Missed Call Follow-up',
    slug: 'missed-call-standard',
    description: 'Automated follow-up sequence when a call is missed',
    category: 'missed_call',
    steps: [
      {
        stepNumber: 1,
        name: 'Immediate Text',
        delayMinutes: 0,
        messageTemplate:
          'Hi {{lead.name}}, this is {{client.businessName}}. Sorry we missed your call! How can we help you today?',
        skipConditions: null,
      },
      {
        stepNumber: 2,
        name: 'Follow-up if No Response',
        delayMinutes: 60,
        messageTemplate:
          'Hi {{lead.name}}, just following up on your call earlier. Are you still looking for help with a project?',
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 3,
        name: 'Final Follow-up',
        delayMinutes: 1440,
        messageTemplate:
          'Hi {{lead.name}}, we\'d love to help with your project. Reply anytime or call us back at {{client.phone}}. Thanks!',
        skipConditions: { ifReplied: true },
      },
    ],
  },
  {
    name: 'Estimate Follow-up - Standard',
    slug: 'estimate-standard',
    description: 'Follow-up sequence after sending an estimate',
    category: 'estimate',
    steps: [
      {
        stepNumber: 1,
        name: 'Day After',
        delayMinutes: 1440,
        messageTemplate:
          'Hi {{lead.name}}, just checking in on the estimate we sent. Any questions I can answer?',
        skipConditions: null,
      },
      {
        stepNumber: 2,
        name: 'Day 3',
        delayMinutes: 4320,
        messageTemplate:
          'Hi {{lead.name}}, wanted to follow up on your project. We\'d love to get you on the schedule. Ready to move forward?',
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 3,
        name: 'Day 7',
        delayMinutes: 10080,
        messageTemplate:
          'Hi {{lead.name}}, still interested in moving forward with your project? We have some availability coming up.',
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 4,
        name: 'Day 14',
        delayMinutes: 20160,
        messageTemplate:
          'Hi {{lead.name}}, final follow-up on your estimate. Let us know if you\'d like to proceed or if anything has changed. Thanks!',
        skipConditions: { ifReplied: true },
      },
    ],
  },
  {
    name: 'Invoice Reminder',
    slug: 'invoice-reminder',
    description: 'Payment reminder sequence for outstanding invoices',
    category: 'payment',
    steps: [
      {
        stepNumber: 1,
        name: 'Friendly Reminder',
        delayMinutes: 0,
        messageTemplate:
          'Hi {{lead.name}}, friendly reminder that invoice #{{invoice.number}} for ${{invoice.amount}} is due. Pay easily here: {{invoice.paymentLink}}',
        skipConditions: null,
      },
      {
        stepNumber: 2,
        name: '3 Days Overdue',
        delayMinutes: 4320,
        messageTemplate:
          'Hi {{lead.name}}, your invoice #{{invoice.number}} is now 3 days past due. Please submit payment at your earliest convenience: {{invoice.paymentLink}}',
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 3,
        name: '7 Days Overdue',
        delayMinutes: 10080,
        messageTemplate:
          'Hi {{lead.name}}, invoice #{{invoice.number}} is now 7 days overdue. Please pay today to avoid any service interruption: {{invoice.paymentLink}}',
        skipConditions: { ifPaid: true },
      },
    ],
  },
  {
    name: 'Appointment Reminder',
    slug: 'appointment-reminder',
    description: 'Reminder sequence before scheduled appointments',
    category: 'appointment',
    steps: [
      {
        stepNumber: 1,
        name: 'Day Before',
        delayMinutes: -1440,
        messageTemplate:
          'Hi {{lead.name}}, reminder: you have an appointment with {{client.businessName}} tomorrow at {{appointment.time}}. Reply C to confirm or R to reschedule.',
        skipConditions: null,
      },
      {
        stepNumber: 2,
        name: 'Morning Of',
        delayMinutes: -180,
        messageTemplate:
          'Hi {{lead.name}}, we\'ll see you today at {{appointment.time}}! Our team is looking forward to helping with your project.',
        skipConditions: null,
      },
    ],
  },
  {
    name: 'Review Request',
    slug: 'review-request',
    description: 'Request reviews after job completion',
    category: 'review',
    steps: [
      {
        stepNumber: 1,
        name: 'Initial Request',
        delayMinutes: 1440,
        messageTemplate:
          'Hi {{lead.name}}, thank you for choosing {{client.businessName}}! If you\'re happy with our work, we\'d really appreciate a review: {{client.googleReviewLink}}',
        skipConditions: null,
      },
      {
        stepNumber: 2,
        name: 'Gentle Reminder',
        delayMinutes: 10080,
        messageTemplate:
          'Hi {{lead.name}}, if you have a moment, we\'d love to hear your feedback: {{client.googleReviewLink}} Thanks again!',
        skipConditions: { ifReplied: true },
      },
    ],
  },
];

async function seedFlowTemplates() {
  console.log('Seeding flow templates...');

  for (const template of FLOW_TEMPLATES) {
    const { steps, ...templateData } = template;

    const existing = await db
      .select()
      .from(flowTemplates)
      .where(eq(flowTemplates.slug, template.slug))
      .limit(1);

    let templateId: string;

    if (existing.length > 0) {
      console.log(`  Template "${template.slug}" exists, updating...`);
      templateId = existing[0].id;
      await db
        .update(flowTemplates)
        .set(templateData)
        .where(eq(flowTemplates.slug, template.slug));

      // Delete old steps and recreate
      await db
        .delete(flowTemplateSteps)
        .where(eq(flowTemplateSteps.templateId, templateId));
    } else {
      console.log(`  Creating template "${template.slug}"...`);
      const [inserted] = await db
        .insert(flowTemplates)
        .values(templateData)
        .returning({ id: flowTemplates.id });
      templateId = inserted.id;
    }

    // Insert steps
    for (const step of steps) {
      await db.insert(flowTemplateSteps).values({
        templateId,
        stepNumber: step.stepNumber,
        name: step.name,
        delayMinutes: step.delayMinutes,
        messageTemplate: step.messageTemplate,
        skipConditions: step.skipConditions,
      });
    }
  }

  console.log('  ✓ Flow templates seeded');
}

// ============================================
// 3. ADMIN USER
// ============================================

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function seedAdminUser() {
  console.log('Seeding admin user...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@conversionsurgery.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123!';

  const existing = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, adminEmail))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  Admin "${adminEmail}" already exists, skipping`);
    return;
  }

  const passwordHash = hashPassword(adminPassword);

  await db.insert(adminUsers).values({
    email: adminEmail,
    name: 'Admin',
    passwordHash,
    role: 'super_admin',
  });

  console.log(`  ✓ Admin user created: ${adminEmail}`);
  console.log(`  ⚠️  CHANGE PASSWORD IMMEDIATELY IN PRODUCTION`);
}

// ============================================
// 4. SYSTEM SETTINGS
// ============================================

const SYSTEM_SETTINGS = [
  {
    key: 'app.name',
    value: 'ConversionSurgery',
    description: 'Application name',
  },
  {
    key: 'app.support_email',
    value: 'support@conversionsurgery.com',
    description: 'Support email address',
  },
  {
    key: 'app.default_timezone',
    value: 'America/Edmonton',
    description: 'Default timezone for new clients',
  },
  {
    key: 'sms.quiet_hours_start',
    value: '21:00',
    description: 'Default quiet hours start (9 PM)',
  },
  {
    key: 'sms.quiet_hours_end',
    value: '08:00',
    description: 'Default quiet hours end (8 AM)',
  },
  {
    key: 'sms.rate_limit_per_minute',
    value: '60',
    description: 'Max SMS per minute per client',
  },
  {
    key: 'ai.default_model',
    value: 'gpt-4o-mini',
    description: 'Default AI model for responses',
  },
  {
    key: 'ai.max_tokens',
    value: '500',
    description: 'Max tokens for AI responses',
  },
  {
    key: 'billing.trial_days',
    value: '14',
    description: 'Free trial period in days',
  },
  {
    key: 'billing.grace_period_days',
    value: '3',
    description: 'Grace period for failed payments',
  },
];

async function seedSystemSettings() {
  console.log('Seeding system settings...');

  for (const setting of SYSTEM_SETTINGS) {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, setting.key))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Setting "${setting.key}" exists, skipping`);
      continue;
    }

    await db.insert(systemSettings).values(setting);
    console.log(`  Created "${setting.key}"`);
  }

  console.log('  ✓ System settings seeded');
}

// ============================================
// 5. OVERAGE PRICING
// ============================================

const OVERAGE_PRICING = [
  {
    resource: 'leads',
    pricePerUnit: 50,
    unit: 'lead',
    description: '$0.50 per additional lead',
  },
  {
    resource: 'messages',
    pricePerUnit: 3,
    unit: 'message',
    description: '$0.03 per additional message',
  },
  {
    resource: 'team_members',
    pricePerUnit: 2000,
    unit: 'seat',
    description: '$20.00 per additional team member',
  },
  {
    resource: 'phone_numbers',
    pricePerUnit: 1500,
    unit: 'number',
    description: '$15.00 per additional phone number',
  },
  {
    resource: 'voice_minutes',
    pricePerUnit: 15,
    unit: 'minute',
    description: '$0.15 per voice AI minute',
  },
];

async function seedOveragePricing() {
  console.log('Seeding overage pricing...');

  // This would go into a dedicated table or plan configuration
  // For now, log what should be configured in Stripe
  console.log('  Configure these overages in Stripe:');
  for (const overage of OVERAGE_PRICING) {
    console.log(`    - ${overage.resource}: ${overage.description}`);
  }

  console.log('  ✓ Overage pricing noted');
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

export async function seed() {
  console.log('');
  console.log('========================================');
  console.log('  ConversionSurgery Database Seed');
  console.log('========================================');
  console.log('');

  try {
    await seedPlans();
    await seedFlowTemplates();
    await seedAdminUser();
    await seedSystemSettings();
    await seedOveragePricing();

    console.log('');
    console.log('========================================');
    console.log('  ✓ Seed completed successfully!');
    console.log('========================================');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('  ✗ Seed failed!');
    console.error('========================================');
    console.error(error);
    throw error;
  }
}

// Run directly
seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
