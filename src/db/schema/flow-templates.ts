import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { flowCategoryEnum, flowTriggerEnum, flowApprovalEnum } from './flow-enums';

export const flowTemplates = pgTable('flow_templates', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),

  // Identity
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  description: text('description'),
  category: flowCategoryEnum('category').notNull(),

  // Versioning
  version: integer('version').default(1),
  isPublished: boolean('is_published').default(false),
  publishedAt: timestamp('published_at'),

  // Defaults for client flows
  defaultTrigger: flowTriggerEnum('default_trigger').default('manual'),
  defaultApprovalMode: flowApprovalEnum('default_approval_mode').default('auto'),

  // Metadata
  usageCount: integer('usage_count').default(0),
  tags: jsonb('tags').$type<string[]>(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const flowTemplateSteps = pgTable('flow_template_steps', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),

  // Step config
  stepNumber: integer('step_number').notNull(),
  name: varchar('name', { length: 100 }),
  delayMinutes: integer('delay_minutes').default(0),

  // Message
  messageTemplate: text('message_template').notNull(),

  // Conditions (optional)
  skipConditions: jsonb('skip_conditions').$type<{
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
    custom?: string;
  }>(),

  createdAt: timestamp('created_at').defaultNow(),
});

export const flowTemplateVersions = pgTable('flow_template_versions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),

  // Snapshot of template at this version
  snapshot: jsonb('snapshot').$type<{
    name: string;
    steps: Array<{
      stepNumber: number;
      delayMinutes: number;
      messageTemplate: string;
    }>;
  }>(),

  changeNotes: text('change_notes'),
  publishedAt: timestamp('published_at').defaultNow(),
  publishedBy: uuid('published_by'),
});

export type FlowTemplate = typeof flowTemplates.$inferSelect;
export type NewFlowTemplate = typeof flowTemplates.$inferInsert;
export type FlowTemplateStep = typeof flowTemplateSteps.$inferSelect;
export type NewFlowTemplateStep = typeof flowTemplateSteps.$inferInsert;
export type FlowTemplateVersion = typeof flowTemplateVersions.$inferSelect;
export type NewFlowTemplateVersion = typeof flowTemplateVersions.$inferInsert;
