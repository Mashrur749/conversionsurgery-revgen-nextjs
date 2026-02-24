import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { users } from './auth';
import { quarterlyCampaignStatusEnum, quarterlyCampaignTypeEnum } from './quarterly-campaign-enums';

export const quarterlyCampaigns = pgTable(
  'quarterly_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    quarterKey: varchar('quarter_key', { length: 7 }).notNull(), // YYYY-QN
    campaignType: quarterlyCampaignTypeEnum('campaign_type').notNull(),
    status: quarterlyCampaignStatusEnum('status').default('planned').notNull(),
    scheduledAt: timestamp('scheduled_at'),
    launchedAt: timestamp('launched_at'),
    completedAt: timestamp('completed_at'),
    planNotes: text('plan_notes'),
    outcomeSummary: text('outcome_summary'),
    requiredAssets: jsonb('required_assets')
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    completedAssets: jsonb('completed_assets')
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    evidenceLinks: jsonb('evidence_links')
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('quarterly_campaigns_client_quarter_unique').on(table.clientId, table.quarterKey),
    index('idx_quarterly_campaigns_client').on(table.clientId),
    index('idx_quarterly_campaigns_status').on(table.status, table.scheduledAt),
    index('idx_quarterly_campaigns_quarter').on(table.quarterKey),
  ]
);

export type QuarterlyCampaign = typeof quarterlyCampaigns.$inferSelect;
export type NewQuarterlyCampaign = typeof quarterlyCampaigns.$inferInsert;
