import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { reviews } from './reviews';
import { responseTemplates } from './response-templates';

export const reviewResponses = pgTable(
  'review_responses',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Response content
    responseText: text('response_text').notNull(),
    responseType: varchar('response_type', { length: 20 }).default('ai_generated'), // ai_generated, template, custom
    templateId: uuid('template_id').references(() => responseTemplates.id),

    // Status
    status: varchar('status', { length: 20 }).default('draft'), // draft, pending_approval, approved, posted, rejected

    // Approval workflow
    submittedAt: timestamp('submitted_at'),
    submittedBy: uuid('submitted_by'),
    approvedAt: timestamp('approved_at'),
    approvedBy: uuid('approved_by'),
    rejectionReason: text('rejection_reason'),

    // Posting
    postedAt: timestamp('posted_at'),
    postError: text('post_error'),

    // Tracking
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_review_responses_review').on(table.reviewId),
    index('idx_review_responses_client').on(table.clientId),
    index('idx_review_responses_status').on(table.status),
  ]
);

export type ReviewResponse = typeof reviewResponses.$inferSelect;
export type NewReviewResponse = typeof reviewResponses.$inferInsert;
