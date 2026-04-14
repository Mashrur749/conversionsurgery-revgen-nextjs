import { pgTable, uuid, jsonb, varchar, timestamp } from 'drizzle-orm/pg-core';

export const salesMethodology = pgTable('sales_methodology', {
  id: uuid('id').defaultRandom().primaryKey(),
  config: jsonb('config').$type<{
    stages: Array<{
      id: string;
      objective: string;
      requiredInfoBeforeAdvancing: string[];
      maxTurnsInStage: number;
      suggestedActions: Array<{
        action: string;
        when: string;
        constraint: string;
        example?: string;
      }>;
      exitConditions: Array<{ condition: string; nextStage: string }>;
    }>;
    globalRules: string[];
    emergencyBypass: {
      urgencyThreshold: number;
      acknowledgmentTemplate: string;
    };
  }>().notNull(),
  version: varchar('version', { length: 20 }).notNull().default('v1.0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SalesMethodology = typeof salesMethodology.$inferSelect;
export type NewSalesMethodology = typeof salesMethodology.$inferInsert;
