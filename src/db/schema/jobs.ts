import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';

export const jobStatusEnum = pgEnum('job_status', [
  'lead',
  'quoted',
  'won',
  'lost',
  'completed',
]);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    status: jobStatusEnum('status').default('lead'),

    // Financial tracking (cents)
    quoteAmount: integer('quote_amount'),
    depositAmount: integer('deposit_amount'),
    finalAmount: integer('final_amount'),
    paidAmount: integer('paid_amount').default(0),

    // Job details
    description: text('description'),
    address: text('address'),
    scheduledDate: date('scheduled_date'),
    completedDate: date('completed_date'),

    // Metadata
    wonAt: timestamp('won_at'),
    lostAt: timestamp('lost_at'),
    lostReason: varchar('lost_reason', { length: 255 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_jobs_client').on(table.clientId),
    index('idx_jobs_status').on(table.status),
  ]
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
