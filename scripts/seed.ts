// Load .env.local
import 'dotenv/config';
import { getDb } from '@/db';
import {
  subscriptionPlans,
  flowTemplates,
  flowTemplateSteps,
  systemSettings,
  clients,
  leads,
  conversations,
  businessHours,
  dailyStats,
  appointments,
  scheduledMessages,
  templateVariants,
  plans,
  users,
  people,
  roleTemplates,
  clientMemberships,
  agencyMemberships,
} from '@/db/schema';
import {
  ALL_PORTAL_PERMISSIONS,
  ALL_AGENCY_PERMISSIONS,
  PORTAL_PERMISSIONS,
  AGENCY_PERMISSIONS,
} from '@/lib/permissions/constants';
import { eq, and } from 'drizzle-orm';

const db = getDb();

// ============================================
// 1. SUBSCRIPTION PLANS (subscriptionPlans table)
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

async function seedSubscriptionPlans() {
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

  console.log('  ✓ Subscription plans seeded');
}

// ============================================
// 2. BILLING PLANS (plans table)
// ============================================

const BILLING_PLANS = [
  {
    name: 'Starter',
    slug: 'billing-starter',
    description: 'Basic SMS automation',
    priceMonthly: 49700,
    priceYearly: 497000,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_starter_monthly',
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || 'price_starter_yearly',
    stripeProductId: process.env.STRIPE_PRODUCT_STARTER || 'prod_starter',
    features: {
      maxLeadsPerMonth: 100,
      maxTeamMembers: 2,
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
    isActive: true,
  },
  {
    name: 'Professional',
    slug: 'billing-professional',
    description: 'Full revenue recovery suite',
    priceMonthly: 99700,
    priceYearly: 997000,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
    stripeProductId: process.env.STRIPE_PRODUCT_PRO || 'prod_pro',
    features: {
      maxLeadsPerMonth: 500,
      maxTeamMembers: 5,
      maxPhoneNumbers: 3,
      includesVoiceAi: false,
      includesCalendarSync: true,
      includesAdvancedAnalytics: true,
      includesWhiteLabel: false,
      supportLevel: 'priority' as const,
      apiAccess: true,
    },
    trialDays: 14,
    isPopular: true,
    displayOrder: 2,
    isActive: true,
  },
  {
    name: 'Enterprise',
    slug: 'billing-enterprise',
    description: 'Full suite with voice AI and white label',
    priceMonthly: 199700,
    priceYearly: 1997000,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || 'price_enterprise_yearly',
    stripeProductId: process.env.STRIPE_PRODUCT_ENTERPRISE || 'prod_enterprise',
    features: {
      maxLeadsPerMonth: null, // unlimited
      maxTeamMembers: null,   // unlimited
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
    isActive: true,
  },
];

async function seedBillingPlans() {
  console.log('Seeding billing plans...');

  for (const plan of BILLING_PLANS) {
    const existing = await db
      .select()
      .from(plans)
      .where(eq(plans.slug, plan.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Billing plan "${plan.slug}" exists, updating...`);
      await db.update(plans).set(plan).where(eq(plans.slug, plan.slug));
    } else {
      console.log(`  Creating billing plan "${plan.slug}"...`);
      await db.insert(plans).values(plan);
    }
  }

  console.log('  ✓ Billing plans seeded');
}

// ============================================
// 3. FLOW TEMPLATES
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
  {
    name: 'Form Response',
    slug: 'form-response-standard',
    description: 'Automated response when a website form is submitted',
    category: 'form_response',
    steps: [
      {
        stepNumber: 1,
        name: 'Immediate Acknowledgment',
        delayMinutes: 0,
        messageTemplate:
          'Hi {{lead.name}}, thanks for reaching out to {{client.businessName}}! We received your inquiry and will get back to you shortly. Is there anything specific you need help with right away?',
        skipConditions: null,
      },
      {
        stepNumber: 2,
        name: 'Next Day Follow-up',
        delayMinutes: 1440,
        messageTemplate:
          'Hi {{lead.name}}, just following up on your inquiry. We\'d love to help with your project. When would be a good time for a quick call?',
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
// 4. ROLE TEMPLATES
// ============================================

const BUILT_IN_ROLE_TEMPLATES = [
  {
    name: 'Business Owner',
    slug: 'business_owner',
    description: 'Full access to all client portal features.',
    scope: 'client',
    permissions: [...ALL_PORTAL_PERMISSIONS],
  },
  {
    name: 'Office Manager',
    slug: 'office_manager',
    description: 'Access to most client portal features except AI settings and team management.',
    scope: 'client',
    permissions: ALL_PORTAL_PERMISSIONS.filter(
      (p) => p !== PORTAL_PERMISSIONS.SETTINGS_AI && p !== PORTAL_PERMISSIONS.TEAM_MANAGE
    ),
  },
  {
    name: 'Team Member',
    slug: 'team_member',
    description: 'Basic access to dashboard, leads, and conversations.',
    scope: 'client',
    permissions: [
      PORTAL_PERMISSIONS.DASHBOARD,
      PORTAL_PERMISSIONS.LEADS_VIEW,
      PORTAL_PERMISSIONS.CONVERSATIONS_VIEW,
    ],
  },
  {
    name: 'Agency Owner',
    slug: 'agency_owner',
    description: 'Full access to all agency features including billing and settings.',
    scope: 'agency',
    permissions: [...ALL_AGENCY_PERMISSIONS],
  },
  {
    name: 'Agency Admin',
    slug: 'agency_admin',
    description: 'Full agency access except billing management and system settings.',
    scope: 'agency',
    permissions: ALL_AGENCY_PERMISSIONS.filter(
      (p) => p !== AGENCY_PERMISSIONS.BILLING_MANAGE && p !== AGENCY_PERMISSIONS.SETTINGS_MANAGE
    ),
  },
  {
    name: 'Account Manager',
    slug: 'account_manager',
    description: 'Manage assigned clients.',
    scope: 'agency',
    permissions: [
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CLIENTS_EDIT,
      AGENCY_PERMISSIONS.FLOWS_VIEW,
      AGENCY_PERMISSIONS.FLOWS_EDIT,
      AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
      AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND,
      AGENCY_PERMISSIONS.ANALYTICS_VIEW,
      AGENCY_PERMISSIONS.KNOWLEDGE_EDIT,
      AGENCY_PERMISSIONS.AI_EDIT,
    ],
  },
  {
    name: 'Content Specialist',
    slug: 'content_specialist',
    description: 'View clients and conversations, edit templates and knowledge base.',
    scope: 'agency',
    permissions: [
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
      AGENCY_PERMISSIONS.TEMPLATES_EDIT,
      AGENCY_PERMISSIONS.KNOWLEDGE_EDIT,
    ],
  },
];

async function seedRoleTemplates() {
  console.log('Seeding role templates...');

  for (const template of BUILT_IN_ROLE_TEMPLATES) {
    const existing = await db
      .select()
      .from(roleTemplates)
      .where(eq(roleTemplates.slug, template.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Role template "${template.slug}" exists, updating permissions...`);
      await db.update(roleTemplates).set({
        permissions: template.permissions,
        updatedAt: new Date(),
      }).where(eq(roleTemplates.slug, template.slug));
    } else {
      console.log(`  Creating role template "${template.slug}"...`);
      await db.insert(roleTemplates).values({
        name: template.name,
        slug: template.slug,
        description: template.description,
        scope: template.scope,
        permissions: template.permissions,
        isBuiltIn: true,
      });
    }
  }

  console.log('  ✓ Role templates seeded');
}

// ============================================
// 5. ADMIN USER (via people + agency_memberships)
// ============================================

async function seedAdminUser() {
  console.log('Seeding admin user...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@conversionsurgery.com';

  // Find or create person
  let [adminPerson] = await db
    .select()
    .from(people)
    .where(eq(people.email, adminEmail))
    .limit(1);

  if (!adminPerson) {
    [adminPerson] = await db.insert(people).values({
      name: 'Admin',
      email: adminEmail,
    }).returning();
    console.log(`  Created admin person: ${adminEmail}`);
  } else {
    console.log(`  Admin person "${adminEmail}" already exists`);
  }

  // Look up agency_owner role template
  const [ownerRole] = await db
    .select()
    .from(roleTemplates)
    .where(and(eq(roleTemplates.slug, 'agency_owner'), eq(roleTemplates.scope, 'agency')))
    .limit(1);

  if (!ownerRole) {
    console.error('  ✗ agency_owner role template not found — run seedRoleTemplates first');
    return;
  }

  // Create agency membership if not exists
  const [existingMembership] = await db
    .select()
    .from(agencyMemberships)
    .where(eq(agencyMemberships.personId, adminPerson.id))
    .limit(1);

  if (!existingMembership) {
    await db.insert(agencyMemberships).values({
      personId: adminPerson.id,
      roleTemplateId: ownerRole.id,
      clientScope: 'all',
    });
    console.log(`  Created agency membership for ${adminEmail}`);
  } else {
    console.log(`  Agency membership for "${adminEmail}" already exists`);
  }

  // Create NextAuth user record if not exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (!existingUser) {
    await db.insert(users).values({
      name: 'Admin',
      email: adminEmail,
      personId: adminPerson.id,
    });
    console.log(`  Created user record: ${adminEmail}`);
  } else if (!existingUser.personId) {
    await db.update(users).set({ personId: adminPerson.id, updatedAt: new Date() }).where(eq(users.id, existingUser.id));
    console.log(`  Linked user to person: ${adminEmail}`);
  }

  console.log(`  ✓ Admin user seeded: ${adminEmail}`);
}

// ============================================
// 6. SYSTEM SETTINGS
// ============================================

const SYSTEM_SETTINGS = [
  { key: 'app.name', value: 'ConversionSurgery', description: 'Application name' },
  { key: 'app.support_email', value: 'support@conversionsurgery.com', description: 'Support email address' },
  { key: 'app.default_timezone', value: 'America/Edmonton', description: 'Default timezone for new clients' },
  { key: 'sms.quiet_hours_start', value: '21:00', description: 'Default quiet hours start (9 PM)' },
  { key: 'sms.quiet_hours_end', value: '08:00', description: 'Default quiet hours end (8 AM)' },
  { key: 'sms.rate_limit_per_minute', value: '60', description: 'Max SMS per minute per client' },
  { key: 'ai.default_model', value: 'gpt-4o-mini', description: 'Default AI model for responses' },
  { key: 'ai.max_tokens', value: '500', description: 'Max tokens for AI responses' },
  { key: 'billing.trial_days', value: '14', description: 'Free trial period in days' },
  { key: 'billing.grace_period_days', value: '3', description: 'Grace period for failed payments' },
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
// 7. TEMPLATE VARIANTS (A/B Testing)
// ============================================

const TEMPLATE_VARIANTS = [
  // Missed Call variants
  {
    templateType: 'missed_call',
    name: 'Standard',
    content: 'Hi {name}, this is {businessName}. Sorry we missed your call! How can we help you today?',
    isActive: true,
    notes: 'Default conversational tone',
  },
  {
    templateType: 'missed_call',
    name: 'Urgent',
    content: 'Hey {name}! {ownerName} from {businessName} here — saw I missed your call. I have a few openings this week. What do you need help with? 🔨',
    isActive: true,
    notes: 'More urgent/personal tone with emoji, mentions availability',
  },
  {
    templateType: 'missed_call',
    name: 'Professional',
    content: 'Good day {name}, this is {ownerName} at {businessName}. I apologize for missing your call. I\'d be happy to assist you — could you share some details about your project?',
    isActive: true,
    notes: 'Formal professional tone, asks for project details',
  },
  // Form Response variants
  {
    templateType: 'form_response',
    name: 'Standard',
    content: 'Hi {name}, thanks for reaching out to {businessName}! We received your inquiry and will get back to you shortly.',
    isActive: true,
    notes: 'Default acknowledgment',
  },
  {
    templateType: 'form_response',
    name: 'Enthusiastic',
    content: 'Hey {name}! 🎉 Thanks for contacting {businessName}! We love new projects. {ownerName} will personally review your request and reach out ASAP. Anything urgent you need right now?',
    isActive: true,
    notes: 'High energy, personal, asks for immediate needs',
  },
  // Appointment Reminder variants
  {
    templateType: 'appointment_day_before',
    name: 'Standard',
    content: 'Hi {name}, reminder: you have an appointment with {businessName} tomorrow. Reply C to confirm or R to reschedule.',
    isActive: true,
    notes: 'Simple reminder with confirm/reschedule options',
  },
  {
    templateType: 'appointment_day_before',
    name: 'Detailed',
    content: 'Hi {name}, just a heads up — your appointment with {businessName} is tomorrow. We\'ll need access to the work area. Please reply CONFIRM if you\'re all set, or call us to reschedule.',
    isActive: true,
    notes: 'More detail about what to expect, mentions access needs',
  },
  // Estimate Follow-up variants
  {
    templateType: 'estimate_followup',
    name: 'Standard',
    content: 'Hi {name}, just checking in on the estimate we sent. Any questions I can answer?',
    isActive: true,
    notes: 'Simple check-in',
  },
  {
    templateType: 'estimate_followup',
    name: 'Value-driven',
    content: 'Hi {name}, wanted to follow up on your estimate. We pride ourselves on quality work and standing behind every job. Ready to get started? I can schedule you in this week.',
    isActive: true,
    notes: 'Emphasizes value proposition and availability',
  },
  // Review Request variants
  {
    templateType: 'review_request',
    name: 'Standard',
    content: 'Hi {name}, thank you for choosing {businessName}! If you\'re happy with our work, we\'d appreciate a quick review: {googleReviewLink}',
    isActive: true,
    notes: 'Simple ask with link',
  },
  {
    templateType: 'review_request',
    name: 'Personal',
    content: 'Hi {name}, {ownerName} here from {businessName}. It was great working on your project! Your feedback means the world to our small team — would you mind leaving a quick review? {googleReviewLink} 🙏',
    isActive: true,
    notes: 'Personal tone from owner, emotional appeal',
  },
];

async function seedTemplateVariants() {
  console.log('Seeding template variants...');

  for (const variant of TEMPLATE_VARIANTS) {
    const existing = await db
      .select()
      .from(templateVariants)
      .where(eq(templateVariants.name, variant.name))
      .limit(1);

    // Check by type+name combo (unique constraint)
    if (existing.length > 0 && existing[0].templateType === variant.templateType) {
      console.log(`  Variant "${variant.templateType}/${variant.name}" exists, skipping`);
      continue;
    }

    try {
      await db.insert(templateVariants).values(variant);
      console.log(`  Created "${variant.templateType}/${variant.name}"`);
    } catch {
      console.log(`  Variant "${variant.templateType}/${variant.name}" already exists, skipping`);
    }
  }

  console.log('  ✓ Template variants seeded');
}

// ============================================
// 8. DEMO CLIENTS
// ============================================

const DEMO_CLIENTS = [
  {
    businessName: 'Summit Roofing Co.',
    ownerName: 'Mike Henderson',
    email: 'mike@summitroofing.ca',
    phone: '+14035551001',
    twilioNumber: '+14035550101',
    timezone: 'America/Edmonton',
    status: 'active',
    missedCallSmsEnabled: true,
    aiResponseEnabled: true,
    aiAgentEnabled: true,
    aiAgentMode: 'autonomous',
    flowsEnabled: true,
    leadScoringEnabled: true,
    notificationEmail: true,
    notificationSms: true,
    monthlyMessageLimit: 5000,
    messagesSentThisMonth: 247,
    isTest: true,
  },
  {
    businessName: 'Precision Plumbing',
    ownerName: 'Sarah Chen',
    email: 'sarah@precisionplumbing.ca',
    phone: '+17805551002',
    twilioNumber: '+17805550102',
    timezone: 'America/Edmonton',
    status: 'active',
    missedCallSmsEnabled: true,
    aiResponseEnabled: true,
    aiAgentEnabled: true,
    aiAgentMode: 'assist',
    flowsEnabled: true,
    leadScoringEnabled: true,
    notificationEmail: true,
    notificationSms: true,
    monthlyMessageLimit: 1000,
    messagesSentThisMonth: 89,
    isTest: true,
  },
  {
    businessName: 'Northern HVAC Solutions',
    ownerName: 'James Walker',
    email: 'james@northernhvac.ca',
    phone: '+14035551003',
    twilioNumber: '+14035550103',
    timezone: 'America/Edmonton',
    status: 'active',
    missedCallSmsEnabled: true,
    aiResponseEnabled: true,
    aiAgentEnabled: false,
    flowsEnabled: true,
    leadScoringEnabled: false,
    notificationEmail: true,
    notificationSms: false,
    monthlyMessageLimit: 1000,
    messagesSentThisMonth: 34,
    isTest: true,
  },
  {
    businessName: 'Calgary Concrete Pro',
    ownerName: 'Dave Martinez',
    email: 'dave@calgaryconcrete.ca',
    phone: '+14035551004',
    status: 'pending',
    timezone: 'America/Edmonton',
    missedCallSmsEnabled: true,
    aiResponseEnabled: true,
    notificationEmail: true,
    notificationSms: true,
    monthlyMessageLimit: 500,
    messagesSentThisMonth: 0,
    isTest: true,
  },
  {
    businessName: 'Alpine Electrical',
    ownerName: 'Lisa Park',
    email: 'lisa@alpineelectrical.ca',
    phone: '+17805551005',
    twilioNumber: '+17805550105',
    timezone: 'America/Edmonton',
    status: 'active',
    missedCallSmsEnabled: true,
    aiResponseEnabled: true,
    aiAgentEnabled: true,
    aiAgentMode: 'autonomous',
    flowsEnabled: true,
    leadScoringEnabled: true,
    notificationEmail: true,
    notificationSms: true,
    monthlyMessageLimit: 5000,
    messagesSentThisMonth: 412,
    isTest: true,
  },
];

async function seedDemoClients(): Promise<string[]> {
  console.log('Seeding demo clients...');
  const clientIds: string[] = [];

  for (const client of DEMO_CLIENTS) {
    const existing = await db
      .select()
      .from(clients)
      .where(eq(clients.email, client.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Client "${client.businessName}" exists, skipping`);
      clientIds.push(existing[0].id);
      continue;
    }

    const [inserted] = await db.insert(clients).values(client).returning({ id: clients.id });
    clientIds.push(inserted.id);
    console.log(`  Created "${client.businessName}"`);
  }

  console.log('  ✓ Demo clients seeded');
  return clientIds;
}

// ============================================
// 9. DEMO USERS (NextAuth login accounts)
// ============================================

async function seedDemoUsers(clientIds: string[]) {
  console.log('Seeding demo users...');

  // Admin user (already created in seedAdminUser, just verify)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@conversionsurgery.com';
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

  if (existingAdmin.length === 0) {
    // Find admin person
    const [adminPerson] = await db.select().from(people).where(eq(people.email, adminEmail)).limit(1);
    await db.insert(users).values({
      name: 'Admin',
      email: adminEmail,
      personId: adminPerson?.id,
    });
    console.log(`  Created admin user: ${adminEmail}`);
  } else {
    console.log(`  Admin user exists, skipping`);
  }

  // Client users: create person + client_membership + user for each demo client
  const [businessOwnerRole] = await db
    .select()
    .from(roleTemplates)
    .where(and(eq(roleTemplates.slug, 'business_owner'), eq(roleTemplates.scope, 'client')))
    .limit(1);

  if (!businessOwnerRole) {
    console.error('  ✗ business_owner role template not found');
    return;
  }

  for (let i = 0; i < DEMO_CLIENTS.length; i++) {
    const client = DEMO_CLIENTS[i];
    const clientId = clientIds[i];

    const existingUser = await db.select().from(users).where(eq(users.email, client.email)).limit(1);
    if (existingUser.length > 0) {
      console.log(`  User "${client.email}" exists, skipping`);
      continue;
    }

    // Create person for the client owner
    let [ownerPerson] = await db.select().from(people).where(eq(people.email, client.email)).limit(1);
    if (!ownerPerson) {
      [ownerPerson] = await db.insert(people).values({
        name: client.ownerName,
        email: client.email,
        phone: client.phone,
      }).returning();
    }

    // Create client membership (business owner)
    const [existingMembership] = await db.select().from(clientMemberships)
      .where(and(eq(clientMemberships.personId, ownerPerson.id), eq(clientMemberships.clientId, clientId)))
      .limit(1);

    if (!existingMembership) {
      await db.insert(clientMemberships).values({
        personId: ownerPerson.id,
        clientId,
        roleTemplateId: businessOwnerRole.id,
        isOwner: true,
        receiveEscalations: true,
        receiveHotTransfers: true,
      });
    }

    // Create NextAuth user
    await db.insert(users).values({
      name: client.ownerName,
      email: client.email,
      personId: ownerPerson.id,
    });
    console.log(`  Created user: ${client.email}`);
  }

  console.log('  ✓ Demo users seeded');
}

// ============================================
// 10. TEAM MEMBERS (via people + client_memberships)
// ============================================

async function seedTeamMembers(clientIds: string[]) {
  console.log('Seeding team members...');

  const [teamMemberRole] = await db
    .select()
    .from(roleTemplates)
    .where(and(eq(roleTemplates.slug, 'team_member'), eq(roleTemplates.scope, 'client')))
    .limit(1);

  if (!teamMemberRole) {
    console.error('  ✗ team_member role template not found');
    return;
  }

  const TEAM_MEMBERS = [
    // Summit Roofing (clientIds[0]) - extra team members (owner already created)
    { clientId: clientIds[0], name: 'Tyler Burns', phone: '+14035551011', email: 'tyler@summitroofing.ca', receiveHotTransfers: true },
    { clientId: clientIds[0], name: 'Jordan Wells', phone: '+14035551012', email: 'jordan@summitroofing.ca', receiveHotTransfers: false },

    // Precision Plumbing (clientIds[1]) - extra team members
    { clientId: clientIds[1], name: 'Kevin Patel', phone: '+17805551021', email: 'kevin@precisionplumbing.ca', receiveHotTransfers: false },

    // Alpine Electrical (clientIds[4]) - extra team members
    { clientId: clientIds[4], name: 'Ryan Choi', phone: '+17805551051', email: 'ryan@alpineelectrical.ca', receiveHotTransfers: true },
    { clientId: clientIds[4], name: 'Amanda Foster', phone: '+17805551052', email: 'amanda@alpineelectrical.ca', receiveHotTransfers: false },
    { clientId: clientIds[4], name: 'Derek Silva', phone: '+17805551053', email: 'derek@alpineelectrical.ca', receiveHotTransfers: false },
  ];

  for (const member of TEAM_MEMBERS) {
    // Check if person already exists
    let [person] = await db.select().from(people).where(eq(people.phone, member.phone)).limit(1);
    if (!person && member.email) {
      [person] = await db.select().from(people).where(eq(people.email, member.email)).limit(1);
    }

    if (!person) {
      [person] = await db.insert(people).values({
        name: member.name,
        phone: member.phone,
        email: member.email,
      }).returning();
    }

    // Check if membership already exists
    const [existingMembership] = await db.select().from(clientMemberships)
      .where(and(eq(clientMemberships.personId, person.id), eq(clientMemberships.clientId, member.clientId)))
      .limit(1);

    if (existingMembership) {
      console.log(`  Team member "${member.name}" exists, skipping`);
      continue;
    }

    await db.insert(clientMemberships).values({
      personId: person.id,
      clientId: member.clientId,
      roleTemplateId: teamMemberRole.id,
      receiveEscalations: true,
      receiveHotTransfers: member.receiveHotTransfers,
    });
    console.log(`  Created team member: ${member.name}`);
  }

  console.log('  ✓ Team members seeded');
}

// ============================================
// 11. BUSINESS HOURS
// ============================================

async function seedBusinessHours(clientIds: string[]) {
  console.log('Seeding business hours...');

  // Standard contractor hours: Mon-Fri 7am-6pm, Sat 8am-2pm, Sun closed
  const STANDARD_HOURS = [
    { dayOfWeek: 0, isOpen: false, openTime: null, closeTime: null },      // Sunday
    { dayOfWeek: 1, isOpen: true, openTime: '07:00', closeTime: '18:00' }, // Monday
    { dayOfWeek: 2, isOpen: true, openTime: '07:00', closeTime: '18:00' }, // Tuesday
    { dayOfWeek: 3, isOpen: true, openTime: '07:00', closeTime: '18:00' }, // Wednesday
    { dayOfWeek: 4, isOpen: true, openTime: '07:00', closeTime: '18:00' }, // Thursday
    { dayOfWeek: 5, isOpen: true, openTime: '07:00', closeTime: '18:00' }, // Friday
    { dayOfWeek: 6, isOpen: true, openTime: '08:00', closeTime: '14:00' }, // Saturday
  ];

  // Only seed for active clients with Twilio numbers
  const activeClientIds = [clientIds[0], clientIds[1], clientIds[2], clientIds[4]];

  for (const clientId of activeClientIds) {
    for (const hours of STANDARD_HOURS) {
      try {
        await db.insert(businessHours).values({
          clientId,
          dayOfWeek: hours.dayOfWeek,
          openTime: hours.openTime,
          closeTime: hours.closeTime,
          isOpen: hours.isOpen,
        });
      } catch {
        // Unique constraint violation — already exists
      }
    }
  }

  console.log('  ✓ Business hours seeded');
}

// ============================================
// 12. DEMO LEADS
// ============================================

async function seedDemoLeads(clientIds: string[]): Promise<string[]> {
  console.log('Seeding demo leads...');
  const leadIds: string[] = [];

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  const LEADS = [
    // Summit Roofing leads (clientIds[0])
    { clientId: clientIds[0], name: 'John Richardson', phone: '+14035559001', source: 'missed_call', status: 'contacted', score: 72, temperature: 'warm', createdAt: daysAgo(5) },
    { clientId: clientIds[0], name: 'Emily Watson', phone: '+14035559002', source: 'form', status: 'estimate_sent', score: 85, temperature: 'warm', createdAt: daysAgo(3) },
    { clientId: clientIds[0], name: 'Robert Kim', phone: '+14035559003', source: 'missed_call', status: 'won', score: 95, temperature: 'warm', createdAt: daysAgo(12) },
    { clientId: clientIds[0], name: 'Patricia Nguyen', phone: '+14035559004', source: 'missed_call', status: 'new', score: 50, temperature: 'warm', createdAt: daysAgo(1), actionRequired: true, actionRequiredReason: 'New lead — no response yet' },
    { clientId: clientIds[0], name: 'Michael Brown', phone: '+14035559005', source: 'form', status: 'contacted', score: 65, temperature: 'warm', createdAt: daysAgo(7), projectType: 'Roof replacement' },

    // Precision Plumbing leads (clientIds[1])
    { clientId: clientIds[1], name: 'Jennifer Lee', phone: '+17805559011', source: 'missed_call', status: 'contacted', score: 78, temperature: 'warm', createdAt: daysAgo(2) },
    { clientId: clientIds[1], name: 'David Thompson', phone: '+17805559012', source: 'missed_call', status: 'new', score: 40, temperature: 'warm', createdAt: daysAgo(0), actionRequired: true, actionRequiredReason: 'Missed call today — needs follow-up' },
    { clientId: clientIds[1], name: 'Maria Garcia', phone: '+17805559013', source: 'form', status: 'estimate_sent', score: 88, temperature: 'warm', createdAt: daysAgo(4), projectType: 'Bathroom renovation' },
    { clientId: clientIds[1], name: 'Thomas Wilson', phone: '+17805559014', source: 'missed_call', status: 'lost', score: 20, temperature: 'cool', createdAt: daysAgo(21), optedOut: true, optedOutAt: daysAgo(18) },

    // Northern HVAC leads (clientIds[2])
    { clientId: clientIds[2], name: 'Susan Taylor', phone: '+14035559021', source: 'missed_call', status: 'contacted', score: 60, temperature: 'warm', createdAt: daysAgo(6) },
    { clientId: clientIds[2], name: 'Christopher Martin', phone: '+14035559022', source: 'form', status: 'won', score: 92, temperature: 'warm', createdAt: daysAgo(14), projectType: 'Furnace replacement' },

    // Alpine Electrical leads (clientIds[4])
    { clientId: clientIds[4], name: 'Amanda Clark', phone: '+17805559041', source: 'missed_call', status: 'estimate_sent', score: 81, temperature: 'warm', createdAt: daysAgo(2), projectType: 'Panel upgrade' },
    { clientId: clientIds[4], name: 'Daniel Rodriguez', phone: '+17805559042', source: 'form', status: 'contacted', score: 68, temperature: 'warm', createdAt: daysAgo(3) },
    { clientId: clientIds[4], name: 'Jessica Miller', phone: '+17805559043', source: 'missed_call', status: 'new', score: 55, temperature: 'warm', createdAt: daysAgo(0), actionRequired: true, actionRequiredReason: 'New missed call — AI responded, awaiting reply' },
    { clientId: clientIds[4], name: 'Brian Johnson', phone: '+17805559044', source: 'missed_call', status: 'won', score: 90, temperature: 'warm', createdAt: daysAgo(9), projectType: 'Whole house rewiring' },
    { clientId: clientIds[4], name: 'Karen Davis', phone: '+17805559045', source: 'form', status: 'contacted', score: 70, temperature: 'warm', createdAt: daysAgo(4) },
  ];

  for (const lead of LEADS) {
    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.phone, lead.phone))
      .limit(1);

    if (existing.length > 0) {
      leadIds.push(existing[0].id);
      console.log(`  Lead "${lead.name}" exists, skipping`);
      continue;
    }

    const [inserted] = await db.insert(leads).values(lead).returning({ id: leads.id });
    leadIds.push(inserted.id);
    console.log(`  Created lead: ${lead.name} (${lead.status})`);
  }

  console.log('  ✓ Demo leads seeded');
  return leadIds;
}

// ============================================
// 13. DEMO CONVERSATIONS
// ============================================

async function seedDemoConversations(clientIds: string[], leadIds: string[]) {
  console.log('Seeding demo conversations...');

  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000);

  const convos = [
    // John Richardson missed call thread
    { leadId: leadIds[0], clientId: clientIds[0], direction: 'outbound', messageType: 'sms', content: 'Hi John, this is Summit Roofing Co. Sorry we missed your call! How can we help you today?', aiConfidence: '0.95', createdAt: minutesAgo(7200) },
    { leadId: leadIds[0], clientId: clientIds[0], direction: 'inbound', messageType: 'sms', content: 'Hi, yeah I need a quote on replacing my roof. Its about 20 years old and starting to leak.', createdAt: minutesAgo(7140) },
    { leadId: leadIds[0], clientId: clientIds[0], direction: 'outbound', messageType: 'ai_response', content: 'Thanks for reaching out, John! A 20-year-old roof with leaks definitely needs attention. We\'d love to come take a look. What area are you in, and when would be a good time for Mike to swing by for a free estimate?', aiConfidence: '0.88', createdAt: minutesAgo(7138) },
    { leadId: leadIds[0], clientId: clientIds[0], direction: 'inbound', messageType: 'sms', content: 'Im in the NW, near Nose Hill. Thursday afternoon works if thats possible', createdAt: minutesAgo(7100) },
    { leadId: leadIds[0], clientId: clientIds[0], direction: 'outbound', messageType: 'ai_response', content: 'Perfect! NW near Nose Hill works great for us. I\'ll book you in for Thursday afternoon — does 2:00 PM work? Mike will come by, take measurements, and give you a quote on the spot.', aiConfidence: '0.92', createdAt: minutesAgo(7098) },

    // Emily Watson form submission thread
    { leadId: leadIds[1], clientId: clientIds[0], direction: 'outbound', messageType: 'sms', content: 'Hi Emily, thanks for reaching out to Summit Roofing Co! We received your inquiry about roof repair. When would be a good time to discuss your project?', aiConfidence: '0.90', createdAt: minutesAgo(4320) },
    { leadId: leadIds[1], clientId: clientIds[0], direction: 'inbound', messageType: 'sms', content: 'Hi! I need some shingles replaced after the hail storm last month. Maybe 200 sq ft area. Whats the typical cost?', createdAt: minutesAgo(4280) },
    { leadId: leadIds[1], clientId: clientIds[0], direction: 'outbound', messageType: 'ai_response', content: 'Hail damage repairs are our specialty, Emily! For a 200 sq ft area, it typically runs $1,500-$3,000 depending on the shingle type and damage extent. Good news — this might be covered by your homeowner\'s insurance. Would you like us to do a free inspection this week?', aiConfidence: '0.85', createdAt: minutesAgo(4278) },

    // Jennifer Lee (Precision Plumbing)
    { leadId: leadIds[5], clientId: clientIds[1], direction: 'outbound', messageType: 'sms', content: 'Hi Jennifer, this is Precision Plumbing. Sorry we missed your call! How can we help?', aiConfidence: '0.95', createdAt: minutesAgo(2880) },
    { leadId: leadIds[5], clientId: clientIds[1], direction: 'inbound', messageType: 'sms', content: 'My kitchen sink is leaking under the counter. Can someone come look at it today?', createdAt: minutesAgo(2820) },
    { leadId: leadIds[5], clientId: clientIds[1], direction: 'outbound', messageType: 'ai_response', content: 'Absolutely, Jennifer! An under-sink leak needs quick attention. Sarah can send Kevin out this afternoon — would 3:00 PM work for you? We charge a $89 service call fee which gets applied to the repair if you go ahead.', aiConfidence: '0.91', createdAt: minutesAgo(2818) },
    { leadId: leadIds[5], clientId: clientIds[1], direction: 'inbound', messageType: 'sms', content: '3pm works perfectly, thanks!', createdAt: minutesAgo(2800) },

    // Amanda Clark (Alpine Electrical)
    { leadId: leadIds[11], clientId: clientIds[4], direction: 'outbound', messageType: 'sms', content: 'Hi Amanda, this is Alpine Electrical. Sorry we missed your call! How can we help you today?', aiConfidence: '0.95', createdAt: minutesAgo(2880) },
    { leadId: leadIds[11], clientId: clientIds[4], direction: 'inbound', messageType: 'sms', content: 'Hey! I need my electrical panel upgraded. Current one is 100 amp and we need 200 for the new hot tub we are getting', createdAt: minutesAgo(2820) },
    { leadId: leadIds[11], clientId: clientIds[4], direction: 'outbound', messageType: 'ai_response', content: 'Great timing, Amanda! A 100A to 200A panel upgrade is one of our most common jobs. It typically runs $2,800-$4,200 depending on your panel location and permits required. We\'re fully licensed and can handle the city permit. Want us to come take a look this week?', aiConfidence: '0.88', createdAt: minutesAgo(2818) },
    { leadId: leadIds[11], clientId: clientIds[4], direction: 'inbound', messageType: 'sms', content: 'Yes please! Wednesday morning would work if you have availability', createdAt: minutesAgo(2790) },
    { leadId: leadIds[11], clientId: clientIds[4], direction: 'outbound', messageType: 'ai_response', content: 'Wednesday morning works! I\'ll book Lisa to come by at 9:30 AM for a free assessment. She\'ll check your current panel, electrical load, and give you a firm quote. What\'s your address?', aiConfidence: '0.90', createdAt: minutesAgo(2788) },
  ];

  let created = 0;
  for (const convo of convos) {
    try {
      await db.insert(conversations).values(convo);
      created++;
    } catch {
      // Skip duplicates
    }
  }

  console.log(`  ✓ ${created} demo conversations seeded`);
}

// ============================================
// 14. DAILY STATS (last 30 days)
// ============================================

async function seedDailyStats(clientIds: string[]) {
  console.log('Seeding daily stats (last 30 days)...');

  const now = new Date();
  const activeClientIds = [clientIds[0], clientIds[1], clientIds[2], clientIds[4]];

  // Per-client activity profiles
  const profiles: Record<number, { missedCalls: [number, number]; forms: [number, number]; messages: [number, number]; appointments: [number, number]; estimates: [number, number] }> = {
    0: { missedCalls: [3, 8], forms: [1, 4], messages: [8, 25], appointments: [0, 2], estimates: [1, 3] }, // Summit - high volume
    1: { missedCalls: [1, 5], forms: [0, 2], messages: [3, 12], appointments: [0, 1], estimates: [0, 2] }, // Precision - medium
    2: { missedCalls: [0, 3], forms: [0, 1], messages: [1, 6], appointments: [0, 1], estimates: [0, 1] },  // Northern - low
    3: { missedCalls: [2, 7], forms: [1, 3], messages: [6, 20], appointments: [0, 2], estimates: [1, 3] }, // Alpine - high
  };

  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  for (let i = 0; i < activeClientIds.length; i++) {
    const clientId = activeClientIds[i];
    const profile = profiles[i];

    for (let d = 0; d < 30; d++) {
      const date = new Date(now.getTime() - d * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      // Lower activity on weekends
      const scale = isWeekend ? 0.3 : 1;

      try {
        await db.insert(dailyStats).values({
          clientId,
          date: dateStr,
          missedCallsCaptured: Math.round(rand(profile.missedCalls[0], profile.missedCalls[1]) * scale),
          formsResponded: Math.round(rand(profile.forms[0], profile.forms[1]) * scale),
          conversationsStarted: Math.round(rand(1, 5) * scale),
          messagesSent: Math.round(rand(profile.messages[0], profile.messages[1]) * scale),
          appointmentsReminded: Math.round(rand(profile.appointments[0], profile.appointments[1]) * scale),
          estimatesFollowedUp: Math.round(rand(profile.estimates[0], profile.estimates[1]) * scale),
          reviewsRequested: d % 3 === 0 ? rand(0, 2) : 0,
          paymentsReminded: d % 5 === 0 ? rand(0, 1) : 0,
        });
      } catch {
        // Skip if unique constraint (clientId + date) already exists
      }
    }
  }

  console.log('  ✓ Daily stats seeded (30 days x 4 clients)');
}

// ============================================
// 15. DEMO APPOINTMENTS
// ============================================

async function seedDemoAppointments(clientIds: string[], leadIds: string[]) {
  console.log('Seeding demo appointments...');

  const now = new Date();
  const daysFromNow = (d: number) => {
    const date = new Date(now.getTime() + d * 86400000);
    return date.toISOString().split('T')[0];
  };

  const APPOINTMENTS = [
    // Summit Roofing
    { leadId: leadIds[0], clientId: clientIds[0], appointmentDate: daysFromNow(2), appointmentTime: '14:00', address: '123 Nose Hill Dr NW, Calgary', status: 'scheduled' },
    { leadId: leadIds[2], clientId: clientIds[0], appointmentDate: daysFromNow(-3), appointmentTime: '10:00', address: '456 Crowfoot Way NW, Calgary', status: 'completed' },

    // Precision Plumbing
    { leadId: leadIds[5], clientId: clientIds[1], appointmentDate: daysFromNow(0), appointmentTime: '15:00', address: '789 Whyte Ave, Edmonton', status: 'confirmed' },

    // Alpine Electrical
    { leadId: leadIds[11], clientId: clientIds[4], appointmentDate: daysFromNow(1), appointmentTime: '09:30', address: '321 Jasper Ave, Edmonton', status: 'scheduled' },
    { leadId: leadIds[14], clientId: clientIds[4], appointmentDate: daysFromNow(-5), appointmentTime: '11:00', address: '654 Gateway Blvd, Edmonton', status: 'completed' },
  ];

  for (const appt of APPOINTMENTS) {
    try {
      await db.insert(appointments).values(appt);
      console.log(`  Created appointment: ${appt.appointmentDate} ${appt.appointmentTime}`);
    } catch {
      console.log(`  Appointment already exists, skipping`);
    }
  }

  console.log('  ✓ Demo appointments seeded');
}

// ============================================
// 16. SCHEDULED MESSAGES
// ============================================

async function seedScheduledMessages(clientIds: string[], leadIds: string[]) {
  console.log('Seeding scheduled messages...');

  const now = new Date();
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600000);

  const MESSAGES = [
    // Estimate follow-up for Emily Watson (Summit)
    {
      leadId: leadIds[1],
      clientId: clientIds[0],
      sequenceType: 'estimate_followup',
      sequenceStep: 2,
      content: 'Hi Emily, wanted to follow up on your hail damage estimate. We have some availability next week. Ready to move forward?',
      sendAt: hoursFromNow(24),
      sent: false,
      cancelled: false,
    },
    // Appointment reminder for John Richardson (Summit)
    {
      leadId: leadIds[0],
      clientId: clientIds[0],
      sequenceType: 'appointment_reminder',
      sequenceStep: 1,
      content: 'Hi John, reminder: you have an appointment with Summit Roofing Co. tomorrow at 2:00 PM. Reply C to confirm or R to reschedule.',
      sendAt: hoursFromNow(12),
      sent: false,
      cancelled: false,
    },
    // Follow-up for Amanda Clark (Alpine)
    {
      leadId: leadIds[11],
      clientId: clientIds[4],
      sequenceType: 'estimate_followup',
      sequenceStep: 1,
      content: 'Hi Amanda, just checking in on the panel upgrade estimate. Any questions I can answer?',
      sendAt: hoursFromNow(48),
      sent: false,
      cancelled: false,
    },
    // Already sent message (for history)
    {
      leadId: leadIds[2],
      clientId: clientIds[0],
      sequenceType: 'review_request',
      sequenceStep: 1,
      content: 'Hi Robert, thank you for choosing Summit Roofing Co! If you\'re happy with our work, we\'d appreciate a review.',
      sendAt: hoursFromNow(-48),
      sent: true,
      sentAt: hoursFromNow(-48),
      cancelled: false,
    },
    // Cancelled message (opted out)
    {
      leadId: leadIds[8],
      clientId: clientIds[1],
      sequenceType: 'estimate_followup',
      sequenceStep: 2,
      content: 'Hi Thomas, following up on your plumbing estimate. Ready to schedule?',
      sendAt: hoursFromNow(-72),
      sent: false,
      cancelled: true,
      cancelledAt: hoursFromNow(-74),
      cancelledReason: 'Opted out',
    },
  ];

  for (const msg of MESSAGES) {
    try {
      await db.insert(scheduledMessages).values(msg);
    } catch {
      // Skip duplicates
    }
  }

  console.log('  ✓ Scheduled messages seeded');
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
    // Reference data (no dependencies)
    await seedSubscriptionPlans();
    await seedBillingPlans();
    await seedFlowTemplates();
    await seedRoleTemplates(); // Must run before admin/team member seeding
    await seedAdminUser();
    await seedSystemSettings();
    await seedTemplateVariants();

    // Demo data (has dependencies: clients → leads → conversations/appointments)
    const clientIds = await seedDemoClients();
    await seedDemoUsers(clientIds);
    await seedTeamMembers(clientIds);
    await seedBusinessHours(clientIds);
    const leadIds = await seedDemoLeads(clientIds);
    await seedDemoConversations(clientIds, leadIds);
    await seedDailyStats(clientIds);
    await seedDemoAppointments(clientIds, leadIds);
    await seedScheduledMessages(clientIds, leadIds);

    console.log('');
    console.log('========================================');
    console.log('  ✓ Seed completed successfully!');
    console.log('========================================');
    console.log('');
    console.log('  Demo login emails (use magic link):');
    console.log('    Admin: admin@conversionsurgery.com');
    console.log('    Client: mike@summitroofing.ca');
    console.log('    Client: sarah@precisionplumbing.ca');
    console.log('    Client: james@northernhvac.ca');
    console.log('    Client: lisa@alpineelectrical.ca');
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
