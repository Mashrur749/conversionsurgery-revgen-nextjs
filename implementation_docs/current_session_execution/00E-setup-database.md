# Phase 1: Project Setup + Database

## Goal
Create Next.js 15 project, install dependencies, connect to existing Neon database.

---

## 1.1 Create Project

```bash
npx create-next-app@latest revenue-recovery --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd revenue-recovery
```

---

## 1.2 Install Dependencies

```bash
# Database
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# UI
npx shadcn@latest init -d
npx shadcn@latest add button card input label table badge dialog dropdown-menu toast tabs separator avatar sheet skeleton alert textarea select

# Services (install now, use later)
npm install twilio openai resend stripe

# Utilities
npm install zod date-fns libphonenumber-js

# Auth (install now, configure in Phase 2)
npm install next-auth@beta @auth/drizzle-adapter
```

---

## 1.3 Environment Variables

Create `.env.local`:

```env
# Database (Neon) - ALREADY EXISTS
DATABASE_URL="postgresql://[your-connection-string]"

# Auth (Phase 2)
AUTH_SECRET=""
AUTH_URL="http://localhost:3000"

# Twilio (Phase 3)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""

# OpenAI (Phase 3)
OPENAI_API_KEY=""

# Resend (Phase 2)
RESEND_API_KEY=""
EMAIL_FROM="Revenue Recovery <noreply@yourdomain.com>"

# Stripe (later)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET="generate-random-32-char-string"
```

---

## 1.4 Drizzle Config

Create `drizzle.config.ts` in project root:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## 1.5 Database Schema

Create `src/lib/db/schema.ts`:

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, date, time, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// CLIENTS (Contractors)
// ============================================
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  ownerName: varchar('owner_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull(),
  twilioNumber: varchar('twilio_number', { length: 20 }),
  googleBusinessUrl: varchar('google_business_url', { length: 500 }),
  timezone: varchar('timezone', { length: 50 }).default('America/Edmonton'),
  
  // ============================================
  // FEATURE FLAGS - See 00-feature-flags.md
  // ============================================
  
  // Core SMS
  missedCallSmsEnabled: boolean('missed_call_sms_enabled').default(true),
  aiResponseEnabled: boolean('ai_response_enabled').default(true),
  
  // AI Agent (Phase 36-37)
  aiAgentEnabled: boolean('ai_agent_enabled').default(true),
  aiAgentMode: varchar('ai_agent_mode', { length: 20 }).default('assist'), // 'off', 'assist', 'autonomous'
  autoEscalationEnabled: boolean('auto_escalation_enabled').default(true),
  
  // Voice AI (Phase 22)
  voiceEnabled: boolean('voice_enabled').default(false),
  voiceMode: varchar('voice_mode', { length: 20 }).default('after_hours'), // 'always', 'after_hours', 'overflow'
  
  // Automation
  flowsEnabled: boolean('flows_enabled').default(true),
  leadScoringEnabled: boolean('lead_scoring_enabled').default(true),
  
  // Integrations
  calendarSyncEnabled: boolean('calendar_sync_enabled').default(false),
  hotTransferEnabled: boolean('hot_transfer_enabled').default(false),
  paymentLinksEnabled: boolean('payment_links_enabled').default(false),
  
  // Reputation (Phase 19)
  reputationMonitoringEnabled: boolean('reputation_monitoring_enabled').default(false),
  autoReviewResponseEnabled: boolean('auto_review_response_enabled').default(false),
  
  // Communication
  photoRequestsEnabled: boolean('photo_requests_enabled').default(true),
  multiLanguageEnabled: boolean('multi_language_enabled').default(false),
  preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),
  
  // Weekly Summary (Phase 12c)
  weeklySummaryEnabled: boolean('weekly_summary_enabled').default(true),
  weeklySummaryDay: integer('weekly_summary_day').default(1), // 0=Sun, 1=Mon, etc.
  weeklySummaryTime: varchar('weekly_summary_time', { length: 5 }).default('08:00'),
  
  // ============================================
  // NOTIFICATIONS
  // ============================================
  notificationEmail: boolean('notification_email').default(true),
  notificationSms: boolean('notification_sms').default(true),
  
  // ============================================
  // BILLING & USAGE
  // ============================================
  webhookUrl: varchar('webhook_url', { length: 500 }),
  webhookEvents: jsonb('webhook_events').default(['lead.created', 'lead.qualified', 'appointment.booked']),
  messagesSentThisMonth: integer('messages_sent_this_month').default(0),
  monthlyMessageLimit: integer('monthly_message_limit').default(500),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  
  // ============================================
  // STATUS & META
  // ============================================
  status: varchar('status', { length: 20 }).default('active'),
  isTest: boolean('is_test').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// LEADS (Homeowners)
// ============================================
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }),
  address: varchar('address', { length: 500 }),
  projectType: varchar('project_type', { length: 255 }),
  notes: text('notes'),
  source: varchar('source', { length: 50 }),
  status: varchar('status', { length: 50 }).default('new'),
  actionRequired: boolean('action_required').default(false),
  actionRequiredReason: varchar('action_required_reason', { length: 255 }),
  optedOut: boolean('opted_out').default(false),
  optedOutAt: timestamp('opted_out_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  clientPhoneUnique: uniqueIndex('leads_client_phone_unique').on(table.clientId, table.phone),
  clientIdIdx: index('idx_leads_client_id').on(table.clientId),
  phoneIdx: index('idx_leads_phone').on(table.phone),
  statusIdx: index('idx_leads_status').on(table.status),
  actionRequiredIdx: index('idx_leads_action_required').on(table.actionRequired),
}));

// ============================================
// CONVERSATIONS
// ============================================
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  direction: varchar('direction', { length: 10 }),
  messageType: varchar('message_type', { length: 20 }),
  content: text('content').notNull(),
  twilioSid: varchar('twilio_sid', { length: 50 }),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  leadIdIdx: index('idx_conversations_lead_id').on(table.leadId),
  clientIdIdx: index('idx_conversations_client_id').on(table.clientId),
}));

// ============================================
// SCHEDULED MESSAGES
// ============================================
export const scheduledMessages = pgTable('scheduled_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  sequenceType: varchar('sequence_type', { length: 50 }),
  sequenceStep: integer('sequence_step'),
  content: text('content').notNull(),
  sendAt: timestamp('send_at').notNull(),
  sent: boolean('sent').default(false),
  sentAt: timestamp('sent_at'),
  cancelled: boolean('cancelled').default(false),
  cancelledAt: timestamp('cancelled_at'),
  cancelledReason: varchar('cancelled_reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  sendAtIdx: index('idx_scheduled_messages_send_at').on(table.sendAt),
  clientIdIdx: index('idx_scheduled_messages_client_id').on(table.clientId),
  leadIdIdx: index('idx_scheduled_messages_lead_id').on(table.leadId),
}));

// ============================================
// APPOINTMENTS
// ============================================
export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  appointmentDate: date('appointment_date').notNull(),
  appointmentTime: time('appointment_time').notNull(),
  address: varchar('address', { length: 500 }),
  status: varchar('status', { length: 20 }).default('scheduled'),
  reminderDayBeforeSent: boolean('reminder_day_before_sent').default(false),
  reminder2hrSent: boolean('reminder_2hr_sent').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  dateIdx: index('idx_appointments_date').on(table.appointmentDate),
  clientIdIdx: index('idx_appointments_client_id').on(table.clientId),
}));

// ============================================
// INVOICES
// ============================================
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  dueDate: date('due_date'),
  status: varchar('status', { length: 20 }).default('pending'),
  paymentLink: varchar('payment_link', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// BLOCKED NUMBERS
// ============================================
export const blockedNumbers = pgTable('blocked_numbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 20 }).notNull(),
  reason: varchar('reason', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  clientPhoneUnique: uniqueIndex('blocked_numbers_client_phone_unique').on(table.clientId, table.phone),
}));

// ============================================
// MESSAGE TEMPLATES
// ============================================
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  templateType: varchar('template_type', { length: 50 }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  clientTemplateUnique: uniqueIndex('message_templates_client_type_unique').on(table.clientId, table.templateType),
}));

// ============================================
// DAILY STATS
// ============================================
export const dailyStats = pgTable('daily_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  missedCallsCaptured: integer('missed_calls_captured').default(0),
  formsResponded: integer('forms_responded').default(0),
  conversationsStarted: integer('conversations_started').default(0),
  appointmentsReminded: integer('appointments_reminded').default(0),
  estimatesFollowedUp: integer('estimates_followed_up').default(0),
  reviewsRequested: integer('reviews_requested').default(0),
  referralsRequested: integer('referrals_requested').default(0),
  paymentsReminded: integer('payments_reminded').default(0),
  messagesSent: integer('messages_sent').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  clientDateUnique: uniqueIndex('daily_stats_client_date_unique').on(table.clientId, table.date),
}));

// ============================================
// ERROR LOG
// ============================================
export const errorLog = pgTable('error_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id),
  errorType: varchar('error_type', { length: 100 }),
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  resolved: boolean('resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// RELATIONS
// ============================================
export const clientsRelations = relations(clients, ({ many }) => ({
  leads: many(leads),
  conversations: many(conversations),
  scheduledMessages: many(scheduledMessages),
  appointments: many(appointments),
  invoices: many(invoices),
  blockedNumbers: many(blockedNumbers),
  messageTemplates: many(messageTemplates),
  dailyStats: many(dailyStats),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  client: one(clients, { fields: [leads.clientId], references: [clients.id] }),
  conversations: many(conversations),
  scheduledMessages: many(scheduledMessages),
  appointments: many(appointments),
  invoices: many(invoices),
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  lead: one(leads, { fields: [conversations.leadId], references: [leads.id] }),
  client: one(clients, { fields: [conversations.clientId], references: [clients.id] }),
}));
```

---

## 1.6 Database Client

Create `src/lib/db/index.ts`:

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

---

## 1.7 Verify Connection

Create a test API route `src/app/api/test-db/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';

export async function GET() {
  try {
    const result = await db.select().from(clients).limit(1);
    return NextResponse.json({ 
      success: true, 
      clientCount: result.length,
      client: result[0] || null 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
```

---

## 1.8 Verification Steps

1. Run `npm run dev`
2. Visit `http://localhost:3000/api/test-db`
3. Should see JSON with your test client data

**Expected response:**
```json
{
  "success": true,
  "clientCount": 1,
  "client": {
    "id": "...",
    "businessName": "Test Contractor",
    ...
  }
}
```

---

## Done Checklist

- [ ] Next.js 15 project created
- [ ] All dependencies installed
- [ ] `.env.local` with DATABASE_URL
- [ ] Drizzle schema matches Neon tables
- [ ] `/api/test-db` returns client data

**Next:** Phase 2 — Auth + Email
