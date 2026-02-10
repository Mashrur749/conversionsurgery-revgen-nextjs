import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

/**
 * Escalation Rules — client-configurable rules for when to escalate to human
 */
export const escalationRules = pgTable(
  'escalation_rules',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),

    // Rule conditions (JSON for flexibility)
    conditions: jsonb('conditions')
      .$type<{
        triggers: Array<{
          type:
            | 'keyword'
            | 'sentiment'
            | 'intent_score'
            | 'objection_count'
            | 'value_threshold'
            | 'no_response'
            | 'custom';
          operator:
            | 'equals'
            | 'contains'
            | 'greater_than'
            | 'less_than'
            | 'regex';
          value: string | number;
          caseSensitive?: boolean;
        }>;
        filters?: Array<{
          field: 'stage' | 'project_type' | 'source' | 'tags';
          operator: 'equals' | 'contains' | 'in';
          value: string | string[];
        }>;
      }>()
      .notNull(),

    // What happens when triggered
    action: jsonb('action')
      .$type<{
        priority: number;
        assignTo?: string;
        notifyVia: ('sms' | 'email' | 'push')[];
        suggestedResponseTemplate?: string;
        autoResponse?: string;
        pauseAi: boolean;
      }>()
      .notNull(),

    // Rule settings
    enabled: boolean('enabled').default(true),
    priority: integer('priority').default(100), // Lower = evaluated first

    // Stats
    timesTriggered: integer('times_triggered').default(0),
    lastTriggeredAt: timestamp('last_triggered_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('escalation_rules_client_idx').on(table.clientId),
    index('escalation_rules_enabled_idx').on(table.enabled),
  ]
);

export type EscalationRule = typeof escalationRules.$inferSelect;
export type NewEscalationRule = typeof escalationRules.$inferInsert;
