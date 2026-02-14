import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    address: varchar('address', { length: 500 }),
    projectType: varchar('project_type', { length: 255 }),
    notes: text('notes'),
    source: varchar('source', { length: 50 }), // missed_call, form, manual
    status: varchar('status', { length: 50 }).default('new'), // new, contacted, estimate_sent, won, lost, opted_out
    actionRequired: boolean('action_required').default(false),
    actionRequiredReason: varchar('action_required_reason', { length: 255 }),
    conversationMode: varchar('conversation_mode', { length: 10 }).default('ai'), // ai, human, paused
    humanTakeoverAt: timestamp('human_takeover_at'),
    humanTakeoverBy: varchar('human_takeover_by', { length: 255 }),
    score: integer('score').default(50),
    scoreUpdatedAt: timestamp('score_updated_at'),
    scoreFactors: jsonb('score_factors').$type<{
      urgency: number;
      budget: number;
      engagement: number;
      intent: number;
      signals: string[];
      lastAnalysis: string;
    }>(),
    temperature: varchar('temperature', { length: 10 }).default('warm'),
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
    tags: jsonb('tags').$type<string[]>().default([]),
    optedOut: boolean('opted_out').default(false),
    optedOutAt: timestamp('opted_out_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('leads_client_phone_unique').on(table.clientId, table.phone),
    index('idx_leads_client_id').on(table.clientId),
    index('idx_leads_phone').on(table.phone),
    index('idx_leads_status').on(table.status),
    index('idx_leads_action_required').on(table.actionRequired).where(
      sql`${table.actionRequired} = true`
    ),
  ]
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
