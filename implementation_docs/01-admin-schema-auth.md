# Phase 7a: Admin Schema & Auth

## Current State (from Phases 1-6)
```
src/
├── lib/
│   ├── db/
│   │   ├── index.ts       ← DB connection
│   │   └── schema.ts      ← All tables including users
│   └── auth.ts            ← NextAuth config
├── types/
│   └── next-auth.d.ts     ← Session types
```

## Goal
Add `isAdmin` field to users, update auth to handle admins.

---

## Step 1: Update Schema

**REPLACE** entire `src/lib/db/schema.ts`:

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, date, time, jsonb, uniqueIndex, index, primaryKey } from 'drizzle-orm/pg-core';
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
  notificationEmail: boolean('notification_email').default(true),
  notificationSms: boolean('notification_sms').default(true),
  webhookUrl: varchar('webhook_url', { length: 500 }),
  webhookEvents: jsonb('webhook_events').default(['lead.created', 'lead.qualified', 'appointment.booked']),
  messagesSentThisMonth: integer('messages_sent_this_month').default(0),
  monthlyMessageLimit: integer('monthly_message_limit').default(500),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  status: varchar('status', { length: 20 }).default('active'),
  isTest: boolean('is_test').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// AUTH TABLES (NextAuth)
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified'),
  image: varchar('image', { length: 500 }),
  clientId: uuid('client_id').references(() => clients.id),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
}, (table) => ({
  providerProviderAccountIdUnique: uniqueIndex('accounts_provider_provider_account_id_unique')
    .on(table.provider, table.providerAccountId),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.identifier, table.token] }),
}));

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

export const usersRelations = relations(users, ({ one, many }) => ({
  client: one(clients, { fields: [users.clientId], references: [clients.id] }),
  accounts: many(accounts),
  sessions: many(sessions),
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

## Step 2: Push Schema Changes

```bash
npx drizzle-kit push
```

---

## Step 3: Update Auth Types

**REPLACE** entire `src/types/next-auth.d.ts`:

```typescript
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      isAdmin?: boolean;
    };
    client?: {
      id: string;
      businessName: string;
      ownerName: string;
    };
  }
}
```

---

## Step 4: Update Auth Config

**REPLACE** entire `src/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { users, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/verify',
    error: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;

        const [dbUser] = await db
          .select({
            clientId: users.clientId,
            isAdmin: users.isAdmin,
          })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        session.user.isAdmin = dbUser?.isAdmin || false;

        if (!dbUser?.isAdmin && dbUser?.clientId) {
          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, dbUser.clientId))
            .limit(1);

          if (client) {
            (session as any).client = {
              id: client.id,
              businessName: client.businessName,
              ownerName: client.ownerName,
            };
          }
        }
      }
      return session;
    },
    async signIn({ user }) {
      if (!user.email) return false;

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (dbUser?.isAdmin) return true;

      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.email, user.email))
        .limit(1);

      if (!client) return false;

      if (user.id) {
        await db
          .update(users)
          .set({ clientId: client.id })
          .where(eq(users.id, user.id));
      }

      return true;
    },
  },
  session: {
    strategy: 'database',
  },
});
```

---

## Step 5: Set Yourself as Admin

Run this SQL in your Neon console (replace with your email):

```sql
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

---

## Verify

1. `npm run dev`
2. Login with your admin email
3. Open browser console, check session: `await fetch('/api/auth/session').then(r => r.json())`
4. Should see `user.isAdmin: true`

---

## Next
Proceed to **Phase 7b** to add admin UI components.
