import 'dotenv/config';
import { getDb, flowTemplates } from '@/db';
import { eq } from 'drizzle-orm';
import { createTemplate, publishTemplate } from '@/lib/services/flow-templates';

const DEFAULT_TEMPLATES = [
  {
    name: 'Estimate Follow-up - Standard',
    slug: 'estimate-standard',
    description: 'Standard 4-step estimate follow-up over 14 days',
    category: 'estimate' as const,
    defaultTrigger: 'manual' as const,
    defaultApprovalMode: 'auto' as const,
    tags: ['estimate', 'sales'],
    steps: [
      {
        stepNumber: 1,
        name: 'Initial follow-up',
        delayMinutes: 0,
        messageTemplate:
          "Hi {name}! Thanks for requesting an estimate from {business_name}. We've sent it to your email. Any questions, just reply here!",
      },
      {
        stepNumber: 2,
        name: 'Day 2 check-in',
        delayMinutes: 2 * 24 * 60,
        messageTemplate:
          'Hi {name}, just checking in on the estimate we sent. Happy to answer any questions or adjust the scope if needed!',
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 3,
        name: 'Day 5 follow-up',
        delayMinutes: 3 * 24 * 60,
        messageTemplate:
          "Hey {name}! Wanted to make sure you got our estimate. If you're comparing quotes, we'd love the chance to earn your business. Any questions?",
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 4,
        name: 'Day 14 final',
        delayMinutes: 9 * 24 * 60,
        messageTemplate:
          "Hi {name}, this is our last follow-up on your estimate. It expires soon, so let us know if you'd like to move forward. Thanks for considering {business_name}!",
        skipConditions: { ifReplied: true, ifScheduled: true },
      },
    ],
  },
  {
    name: 'Estimate Follow-up - Aggressive',
    slug: 'estimate-aggressive',
    description: 'Faster 4-step follow-up over 7 days for urgent leads',
    category: 'estimate' as const,
    defaultTrigger: 'manual' as const,
    defaultApprovalMode: 'auto' as const,
    tags: ['estimate', 'sales', 'urgent'],
    steps: [
      {
        stepNumber: 1,
        name: 'Immediate',
        delayMinutes: 0,
        messageTemplate:
          'Hi {name}! Your estimate from {business_name} is ready. Check your email! Reply here with any questions.',
      },
      {
        stepNumber: 2,
        name: 'Day 1',
        delayMinutes: 24 * 60,
        messageTemplate:
          "Hey {name}! Did you get a chance to review the estimate? I'm here if you have questions.",
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 3,
        name: 'Day 3',
        delayMinutes: 2 * 24 * 60,
        messageTemplate:
          '{name}, just following up! Ready to get your project scheduled when you are.',
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 4,
        name: 'Day 7',
        delayMinutes: 4 * 24 * 60,
        messageTemplate:
          "Last check-in, {name}! Let me know if you'd like to move forward or if anything's holding you back.",
        skipConditions: { ifReplied: true, ifScheduled: true },
      },
    ],
  },
  {
    name: 'Payment Reminder - Friendly',
    slug: 'payment-friendly',
    description: 'Friendly 4-step payment reminder over 21 days',
    category: 'payment' as const,
    defaultTrigger: 'manual' as const,
    defaultApprovalMode: 'ask_sms' as const,
    tags: ['payment', 'invoice'],
    steps: [
      {
        stepNumber: 1,
        name: 'Invoice sent',
        delayMinutes: 0,
        messageTemplate:
          'Hi {name}! Your invoice of {amount} is ready. Pay easily here: {payment_link}',
      },
      {
        stepNumber: 2,
        name: 'Due date reminder',
        delayMinutes: 7 * 24 * 60,
        messageTemplate:
          'Friendly reminder: Your invoice of {amount} is due soon. Pay here: {payment_link}',
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 3,
        name: 'Past due',
        delayMinutes: 7 * 24 * 60,
        messageTemplate:
          'Hi {name}, your balance of {amount} is past due. Please pay when you can: {payment_link}',
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 4,
        name: 'Final notice',
        delayMinutes: 7 * 24 * 60,
        messageTemplate:
          'Final notice: Please pay your balance of {amount} to avoid further action. {payment_link}',
        skipConditions: { ifPaid: true },
      },
    ],
  },
  {
    name: 'Payment Reminder - Firm',
    slug: 'payment-firm',
    description: 'Firmer 4-step payment reminder over 14 days',
    category: 'payment' as const,
    defaultTrigger: 'manual' as const,
    defaultApprovalMode: 'ask_sms' as const,
    tags: ['payment', 'invoice', 'firm'],
    steps: [
      {
        stepNumber: 1,
        name: 'Invoice sent',
        delayMinutes: 0,
        messageTemplate:
          'Hi {name}, your invoice of {amount} is ready for payment: {payment_link}',
      },
      {
        stepNumber: 2,
        name: 'Day 3 reminder',
        delayMinutes: 3 * 24 * 60,
        messageTemplate:
          'Reminder: Invoice #{invoice_number} for {amount} is due {due_date}. Pay now: {payment_link}',
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 3,
        name: 'Past due notice',
        delayMinutes: 4 * 24 * 60,
        messageTemplate:
          'PAST DUE: Your balance of {amount} requires immediate attention. {payment_link}',
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 4,
        name: 'Final warning',
        delayMinutes: 7 * 24 * 60,
        messageTemplate:
          'FINAL NOTICE: {amount} is significantly past due. Pay immediately to avoid collection action: {payment_link}',
        skipConditions: { ifPaid: true },
      },
    ],
  },
  {
    name: 'Review Request - Simple',
    slug: 'review-simple',
    description: 'Single review request after job completion',
    category: 'review' as const,
    defaultTrigger: 'ai_suggested' as const,
    defaultApprovalMode: 'ask_sms' as const,
    tags: ['review', 'reputation'],
    steps: [
      {
        stepNumber: 1,
        name: 'Review request',
        delayMinutes: 24 * 60,
        messageTemplate:
          "Hi {name}! Thanks for choosing {business_name}. If you're happy with our work, would you mind leaving us a quick review? {review_link} - It really helps!",
      },
    ],
  },
  {
    name: 'Review Request + Reminder',
    slug: 'review-with-reminder',
    description: 'Review request with follow-up reminder',
    category: 'review' as const,
    defaultTrigger: 'ai_suggested' as const,
    defaultApprovalMode: 'ask_sms' as const,
    tags: ['review', 'reputation'],
    steps: [
      {
        stepNumber: 1,
        name: 'Initial request',
        delayMinutes: 24 * 60,
        messageTemplate:
          "Hi {name}! Thanks for choosing {business_name}. We'd love your feedback! {review_link}",
      },
      {
        stepNumber: 2,
        name: 'Reminder',
        delayMinutes: 3 * 24 * 60,
        messageTemplate:
          'Hey {name}, just a gentle reminder - your review would mean a lot to us! {review_link} Thanks!',
      },
    ],
  },
  {
    name: 'Referral Request',
    slug: 'referral-standard',
    description: 'Referral request after positive interaction',
    category: 'referral' as const,
    defaultTrigger: 'ai_suggested' as const,
    defaultApprovalMode: 'ask_sms' as const,
    tags: ['referral', 'growth'],
    steps: [
      {
        stepNumber: 1,
        name: 'Referral ask',
        delayMinutes: 3 * 24 * 60,
        messageTemplate:
          'Hi {name}! Glad you\'re happy with our work. If you know anyone who needs {service_type}, we\'d appreciate a referral! We offer ${referral_bonus} for every referral that books.',
      },
    ],
  },
  {
    name: 'Appointment Reminder',
    slug: 'appointment-reminder',
    description: 'Confirmation + day-before reminder',
    category: 'appointment' as const,
    defaultTrigger: 'scheduled' as const,
    defaultApprovalMode: 'auto' as const,
    tags: ['appointment', 'scheduling'],
    steps: [
      {
        stepNumber: 1,
        name: 'Confirmation',
        delayMinutes: 0,
        messageTemplate:
          'Your appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}. Reply YES to confirm or call us to reschedule.',
      },
      {
        stepNumber: 2,
        name: 'Day before',
        delayMinutes: -24 * 60,
        messageTemplate:
          'Reminder: Your appointment with {business_name} is tomorrow at {appointment_time}. See you then!',
      },
    ],
  },
];

async function seedDefaultTemplates() {
  const db = getDb();

  console.log('Seeding default flow templates...\n');

  for (const templateData of DEFAULT_TEMPLATES) {
    const existing = await db
      .select()
      .from(flowTemplates)
      .where(eq(flowTemplates.slug, templateData.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Template "${templateData.slug}" already exists, skipping`);
      continue;
    }

    const template = await createTemplate(templateData);
    await publishTemplate(template.id, 'Initial version');
    console.log(`  Created template: ${templateData.name}`);
  }

  console.log('\nDefault templates seeded!');
}

seedDefaultTemplates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
