import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const industryPlaybooks = pgTable('industry_playbooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  playbookId: varchar('playbook_id', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  config: jsonb('config').$type<{
    vocabularyMapping: Array<{
      homeownerTerm: string;
      contractorTerm: string;
      context?: string;
    }>;
    projectSizingHeuristics: {
      scopeIndicators: Array<{
        signal: string;
        impliedScope: 'small' | 'medium' | 'large' | 'complex';
        impliedTimeline: string;
        qualifyingQuestions: string[];
      }>;
    };
    objectionPatterns: Array<{
      category: string;
      typicalPhrasing: string[];
      handlingStrategy: string;
      neverSay: string[];
    }>;
    conversionDynamics: {
      typicalSalesCycle: string;
      decisionMakers: string;
      competitorCount: string;
      highValueSignals: string[];
      lowValueSignals: string[];
      optimalFollowUpCadence: string;
    };
    communicationStyle: {
      purchaseType: 'emergency' | 'routine' | 'considered' | 'luxury';
      informationDensity: 'high' | 'medium' | 'low';
      emotionalRegister: string;
      expertiseDisplay: 'subtle' | 'direct';
    };
    qualifyingSequence: Array<{
      question: string;
      whyItMatters: string;
      ifAnswered: string;
    }>;
    emergencySignals: {
      keywords: string[];
      urgencyFloor: number;
    };
    differentiators: string[];
    exampleConversations: Array<{
      scenario: string;
      turns: Array<{ role: 'homeowner' | 'agent'; message: string }>;
      annotations: string[];
    }>;
  }>().notNull(),
  version: varchar('version', { length: 20 }).notNull().default('v1.0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type IndustryPlaybook = typeof industryPlaybooks.$inferSelect;
export type NewIndustryPlaybook = typeof industryPlaybooks.$inferInsert;
