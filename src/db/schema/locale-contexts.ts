import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const localeContexts = pgTable('locale_contexts', {
  id: uuid('id').defaultRandom().primaryKey(),
  localeId: varchar('locale_id', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  config: jsonb('config').$type<{
    language: string;
    timezone: string;
    communicationNorms: {
      directness: 'low' | 'medium' | 'high';
      apologeticTone: boolean;
      formalityDefault: 'casual' | 'friendly' | 'professional';
      greetingStyle: string;
      closingStyle: string;
      commonExpressions: string[];
      avoidExpressions: string[];
    };
    regulatoryContext: {
      consentFramework: string;
      quietHoursRule: string;
    };
    culturalReferences: {
      seasonalAnchors: Record<string, string>;
      trustAnchors: string[];
      localTerminology: Record<string, string>;
    };
    buyingPsychology: {
      priceDiscussionStyle: string;
      comparisonShoppingNorm: string;
      decisionTimeline: string;
    };
  }>().notNull(),
  version: varchar('version', { length: 20 }).notNull().default('v1.0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type LocaleContext = typeof localeContexts.$inferSelect;
export type NewLocaleContext = typeof localeContexts.$inferInsert;
