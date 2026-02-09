# Phase 36: Conversation Agent Schema

## Prerequisites
- Phase 17 (CRM Conversations) complete
- Phase 19-22 (Flow System) complete
- Phase 29 (Lead Scoring) complete

## Goal
Create the database schema to support an intelligent conversation agent that:
1. Tracks lead journey state across conversations
2. Stores detected signals and context
3. Manages escalation queue for human handoff
4. Records agent decisions for learning/debugging

---

## Step 1: Create Lead State Enums

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// CONVERSATION AGENT
// ============================================

export const leadStageEnum = pgEnum('lead_stage', [
  'new',           // Just came in, no conversation yet
  'qualifying',    // Gathering info about their needs
  'nurturing',     // Not ready yet, staying in touch
  'hot',           // Showing buying signals
  'objection',     // Has concerns/objections to address
  'escalated',     // Needs human intervention
  'booked',        // Appointment/job scheduled
  'lost',          // Unsubscribed, went competitor, no response
]);

export const sentimentEnum = pgEnum('sentiment', [
  'positive',
  'neutral', 
  'negative',
  'frustrated',
]);

export const escalationReasonEnum = pgEnum('escalation_reason', [
  'explicit_request',      // Asked for human/manager/owner
  'frustrated_sentiment',  // Detected frustration
  'legal_threat',          // Mentioned lawyer, BBB, complaint
  'repeated_objection',    // Same objection 3+ times
  'complex_technical',     // Question beyond AI capability
  'high_value_lead',       // Big job, needs personal touch
  'negative_review_threat',// Threatened bad review
  'pricing_negotiation',   // Wants custom pricing
  'complaint',             // Service complaint
  'emergency',             // Urgent safety/emergency issue
  'other',
]);

export const agentActionEnum = pgEnum('agent_action', [
  'respond',          // Send AI response
  'wait',             // Don't respond yet, let them reply
  'trigger_flow',     // Start an automated flow
  'escalate',         // Hand off to human
  'book_appointment', // Attempt booking
  'send_quote',       // Send estimate/quote
  'request_photos',   // Ask for project photos
  'send_payment',     // Send payment link
  'close_won',        // Mark as booked/won
  'close_lost',       // Mark as lost
]);
```

---

## Step 2: Create Lead Context Table

This stores the AI's understanding of each lead:

```typescript
export const leadContext = pgTable('lead_context', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull().unique(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  
  // Current stage in journey
  stage: leadStageEnum('stage').default('new').notNull(),
  previousStage: leadStageEnum('previous_stage'),
  stageChangedAt: timestamp('stage_changed_at').defaultNow(),
  
  // Detected signals (0-100 confidence)
  urgencyScore: integer('urgency_score').default(50), // How soon they need service
  budgetScore: integer('budget_score').default(50),   // Willingness to pay
  intentScore: integer('intent_score').default(50),   // Likelihood to book
  
  // Sentiment tracking
  currentSentiment: sentimentEnum('current_sentiment').default('neutral'),
  sentimentHistory: jsonb('sentiment_history').$type<Array<{
    sentiment: string;
    confidence: number;
    messageId: string;
    timestamp: string;
  }>>().default([]),
  
  // Extracted information
  projectType: varchar('project_type', { length: 100 }),    // e.g., "bathroom remodel"
  projectSize: varchar('project_size', { length: 50 }),      // e.g., "large", "small"
  estimatedValue: integer('estimated_value'),                // Dollars
  preferredTimeframe: varchar('preferred_timeframe', { length: 50 }), // e.g., "next week", "spring"
  propertyType: varchar('property_type', { length: 50 }),    // residential, commercial
  
  // Objections and concerns
  objections: jsonb('objections').$type<Array<{
    type: string;       // "price", "timing", "trust", "competition"
    detail: string;
    raisedAt: string;
    addressedAt?: string;
    resolved: boolean;
  }>>().default([]),
  
  // Competitor mentions
  competitorMentions: jsonb('competitor_mentions').$type<Array<{
    name?: string;
    context: string;
    messageId: string;
    timestamp: string;
  }>>().default([]),
  
  // Interaction metrics
  totalMessages: integer('total_messages').default(0),
  leadMessages: integer('lead_messages').default(0),
  agentMessages: integer('agent_messages').default(0),
  avgResponseTimeSeconds: integer('avg_response_time_seconds'),
  
  // Booking attempts
  bookingAttempts: integer('booking_attempts').default(0),
  lastBookingAttempt: timestamp('last_booking_attempt'),
  
  // Quote/estimate tracking
  quotesSent: integer('quotes_sent').default(0),
  lastQuoteAmount: integer('last_quote_amount'),
  lastQuoteSentAt: timestamp('last_quote_sent_at'),
  
  // Conversation summary (updated by AI)
  conversationSummary: text('conversation_summary'),
  keyFacts: jsonb('key_facts').$type<string[]>().default([]),
  
  // Next action recommendation
  recommendedAction: agentActionEnum('recommended_action'),
  recommendedActionReason: text('recommended_action_reason'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  leadIdx: uniqueIndex('lead_context_lead_idx').on(table.leadId),
  clientIdx: index('lead_context_client_idx').on(table.clientId),
  stageIdx: index('lead_context_stage_idx').on(table.stage),
  intentIdx: index('lead_context_intent_idx').on(table.intentScore),
}));
```

---

## Step 3: Create Agent Decision Log

Records every decision the AI makes for debugging and learning:

```typescript
export const agentDecisions = pgTable('agent_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
  
  // What triggered this decision
  triggerType: varchar('trigger_type', { length: 30 }).notNull(), // 'inbound_message', 'scheduled', 'flow_complete', 'manual'
  
  // State at decision time
  stageAtDecision: leadStageEnum('stage_at_decision'),
  contextSnapshot: jsonb('context_snapshot').$type<{
    urgencyScore: number;
    budgetScore: number;
    intentScore: number;
    sentiment: string;
    recentObjections: string[];
  }>(),
  
  // The decision
  action: agentActionEnum('action').notNull(),
  actionDetails: jsonb('action_details').$type<{
    responseText?: string;
    flowId?: string;
    escalationReason?: string;
    waitDurationMinutes?: number;
    [key: string]: any;
  }>(),
  
  // Reasoning (from LLM)
  reasoning: text('reasoning'),
  confidence: integer('confidence'), // 0-100
  
  // Alternative actions considered
  alternativesConsidered: jsonb('alternatives_considered').$type<Array<{
    action: string;
    confidence: number;
    reason: string;
  }>>(),
  
  // Outcome (filled in later)
  outcome: varchar('outcome', { length: 30 }), // 'positive', 'negative', 'neutral', 'pending'
  outcomeDetails: text('outcome_details'),
  
  // Timing
  processingTimeMs: integer('processing_time_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  leadIdx: index('agent_decisions_lead_idx').on(table.leadId),
  clientIdx: index('agent_decisions_client_idx').on(table.clientId),
  actionIdx: index('agent_decisions_action_idx').on(table.action),
  createdAtIdx: index('agent_decisions_created_idx').on(table.createdAt),
}));
```

---

## Step 4: Create Escalation Queue

```typescript
export const escalationQueue = pgTable('escalation_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  
  // Why escalated
  reason: escalationReasonEnum('reason').notNull(),
  reasonDetails: text('reason_details'),
  triggerMessageId: uuid('trigger_message_id').references(() => messages.id),
  
  // Priority (1=highest, 5=lowest)
  priority: integer('priority').default(3).notNull(),
  
  // Context for human
  conversationSummary: text('conversation_summary'),
  suggestedResponse: text('suggested_response'),
  keyPoints: jsonb('key_points').$type<string[]>().default([]),
  
  // Assignment
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, assigned, in_progress, resolved, dismissed
  assignedTo: uuid('assigned_to').references(() => teamMembers.id),
  assignedAt: timestamp('assigned_at'),
  
  // Resolution
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => teamMembers.id),
  resolution: varchar('resolution', { length: 30 }), // 'handled', 'returned_to_ai', 'no_action', 'converted', 'lost'
  resolutionNotes: text('resolution_notes'),
  
  // Should AI resume after human handles?
  returnToAi: boolean('return_to_ai').default(true),
  returnToAiAfter: timestamp('return_to_ai_after'), // Don't resume until this time
  
  // Timing
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // SLA tracking
  firstResponseAt: timestamp('first_response_at'),
  slaDeadline: timestamp('sla_deadline'),
  slaBreach: boolean('sla_breach').default(false),
}, (table) => ({
  leadIdx: index('escalation_queue_lead_idx').on(table.leadId),
  clientIdx: index('escalation_queue_client_idx').on(table.clientId),
  statusIdx: index('escalation_queue_status_idx').on(table.status),
  priorityIdx: index('escalation_queue_priority_idx').on(table.priority),
  assignedIdx: index('escalation_queue_assigned_idx').on(table.assignedTo),
}));
```

---

## Step 5: Create Escalation Rules Table

Client-configurable rules for when to escalate:

```typescript
export const escalationRules = pgTable('escalation_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Rule conditions (JSON for flexibility)
  conditions: jsonb('conditions').$type<{
    // Trigger conditions (ANY match = escalate)
    triggers: Array<{
      type: 'keyword' | 'sentiment' | 'intent_score' | 'objection_count' | 'value_threshold' | 'no_response' | 'custom';
      operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex';
      value: string | number;
      caseSensitive?: boolean;
    }>;
    // Optional: Only apply if these conditions are also true
    filters?: Array<{
      field: 'stage' | 'project_type' | 'source' | 'tags';
      operator: 'equals' | 'contains' | 'in';
      value: string | string[];
    }>;
  }>().notNull(),
  
  // What happens when triggered
  action: jsonb('action').$type<{
    priority: number;  // 1-5
    assignTo?: string; // Team member ID or 'round_robin' or 'owner'
    notifyVia: ('sms' | 'email' | 'push')[];
    suggestedResponseTemplate?: string;
    autoResponse?: string; // Send this while human takes over
    pauseAi: boolean;      // Stop AI responses until resolved
  }>().notNull(),
  
  // Rule settings
  enabled: boolean('enabled').default(true),
  priority: integer('priority').default(100), // Lower = evaluated first
  
  // Stats
  timesTriggered: integer('times_triggered').default(0),
  lastTriggeredAt: timestamp('last_triggered_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: index('escalation_rules_client_idx').on(table.clientId),
  enabledIdx: index('escalation_rules_enabled_idx').on(table.enabled),
}));
```

---

## Step 6: Create Conversation Checkpoints

For long conversations, store periodic summaries:

```typescript
export const conversationCheckpoints = pgTable('conversation_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  
  // When this checkpoint was created
  messageIndex: integer('message_index').notNull(), // After which message
  checkpointAt: timestamp('checkpoint_at').defaultNow().notNull(),
  
  // Compressed summary of conversation up to this point
  summary: text('summary').notNull(),
  
  // Key extracted data at this point
  extractedData: jsonb('extracted_data').$type<{
    projectDetails?: string;
    customerNeeds?: string[];
    questionsAsked?: string[];
    questionsAnswered?: string[];
    agreements?: string[];
    openIssues?: string[];
  }>(),
  
  // Context state at checkpoint
  stageAtCheckpoint: leadStageEnum('stage_at_checkpoint'),
  scoresAtCheckpoint: jsonb('scores_at_checkpoint').$type<{
    urgency: number;
    budget: number;
    intent: number;
  }>(),
  
  // Token count for context management
  tokenCount: integer('token_count'),
}, (table) => ({
  leadIdx: index('conversation_checkpoints_lead_idx').on(table.leadId),
  messageIdx: index('conversation_checkpoints_message_idx').on(table.messageIndex),
}));
```

---

## Step 7: Add Agent Settings to Client

**APPEND** to clients table or create client_agent_settings:

```typescript
export const clientAgentSettings = pgTable('client_agent_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull().unique(),
  
  // AI personality
  agentName: varchar('agent_name', { length: 50 }).default('Assistant'),
  agentTone: varchar('agent_tone', { length: 30 }).default('professional'), // professional, friendly, casual
  
  // Response settings
  maxResponseLength: integer('max_response_length').default(300), // characters
  useEmojis: boolean('use_emojis').default(false),
  signMessages: boolean('sign_messages').default(false), // Add "- Name" at end
  
  // Behavior settings
  autoRespond: boolean('auto_respond').default(true),
  respondOutsideHours: boolean('respond_outside_hours').default(true),
  maxDailyMessagesPerLead: integer('max_daily_messages_per_lead').default(5),
  minTimeBetweenMessages: integer('min_time_between_messages').default(60), // seconds
  
  // Goal settings
  primaryGoal: varchar('primary_goal', { length: 30 }).default('book_appointment'), // book_appointment, get_quote_request, collect_info
  bookingAggressiveness: integer('booking_aggressiveness').default(5), // 1-10
  maxBookingAttempts: integer('max_booking_attempts').default(3),
  
  // Escalation thresholds
  autoEscalateAfterMessages: integer('auto_escalate_after_messages'), // null = never
  autoEscalateOnNegativeSentiment: boolean('auto_escalate_on_negative_sentiment').default(true),
  autoEscalateOnHighValue: integer('auto_escalate_on_high_value'), // Dollar threshold
  
  // Knowledge boundaries
  canDiscussPricing: boolean('can_discuss_pricing').default(false),
  canScheduleAppointments: boolean('can_schedule_appointments').default(true),
  canSendPaymentLinks: boolean('can_send_payment_links').default(false),
  
  // Quiet hours (use client's timezone)
  quietHoursEnabled: boolean('quiet_hours_enabled').default(true),
  quietHoursStart: time('quiet_hours_start').default('21:00'),
  quietHoursEnd: time('quiet_hours_end').default('08:00'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

---

## Step 8: Create Relations

```typescript
export const leadContextRelations = relations(leadContext, ({ one }) => ({
  lead: one(leads, {
    fields: [leadContext.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [leadContext.clientId],
    references: [clients.id],
  }),
}));

export const agentDecisionsRelations = relations(agentDecisions, ({ one }) => ({
  lead: one(leads, {
    fields: [agentDecisions.leadId],
    references: [leads.id],
  }),
  message: one(messages, {
    fields: [agentDecisions.messageId],
    references: [messages.id],
  }),
}));

export const escalationQueueRelations = relations(escalationQueue, ({ one }) => ({
  lead: one(leads, {
    fields: [escalationQueue.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [escalationQueue.clientId],
    references: [clients.id],
  }),
  assignedTeamMember: one(teamMembers, {
    fields: [escalationQueue.assignedTo],
    references: [teamMembers.id],
  }),
}));

export const escalationRulesRelations = relations(escalationRules, ({ one }) => ({
  client: one(clients, {
    fields: [escalationRules.clientId],
    references: [clients.id],
  }),
}));
```

---

## Step 9: Create Type Exports

**CREATE** `src/lib/types/agent.ts`:

```typescript
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { 
  leadContext, 
  agentDecisions, 
  escalationQueue, 
  escalationRules,
  conversationCheckpoints,
  clientAgentSettings,
} from '@/lib/db/schema';

export type LeadContext = InferSelectModel<typeof leadContext>;
export type NewLeadContext = InferInsertModel<typeof leadContext>;

export type AgentDecision = InferSelectModel<typeof agentDecisions>;
export type NewAgentDecision = InferInsertModel<typeof agentDecisions>;

export type EscalationQueueItem = InferSelectModel<typeof escalationQueue>;
export type NewEscalationQueueItem = InferInsertModel<typeof escalationQueue>;

export type EscalationRule = InferSelectModel<typeof escalationRules>;
export type NewEscalationRule = InferInsertModel<typeof escalationRules>;

export type ConversationCheckpoint = InferSelectModel<typeof conversationCheckpoints>;
export type ClientAgentSettings = InferSelectModel<typeof clientAgentSettings>;

// Lead stage type
export type LeadStage = 
  | 'new' 
  | 'qualifying' 
  | 'nurturing' 
  | 'hot' 
  | 'objection' 
  | 'escalated' 
  | 'booked' 
  | 'lost';

// Agent action type
export type AgentAction = 
  | 'respond'
  | 'wait'
  | 'trigger_flow'
  | 'escalate'
  | 'book_appointment'
  | 'send_quote'
  | 'request_photos'
  | 'send_payment'
  | 'close_won'
  | 'close_lost';

// Escalation reason type
export type EscalationReason =
  | 'explicit_request'
  | 'frustrated_sentiment'
  | 'legal_threat'
  | 'repeated_objection'
  | 'complex_technical'
  | 'high_value_lead'
  | 'negative_review_threat'
  | 'pricing_negotiation'
  | 'complaint'
  | 'emergency'
  | 'other';

// Signal scores interface
export interface LeadSignals {
  urgency: number;   // 0-100
  budget: number;    // 0-100
  intent: number;    // 0-100
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
}

// Lead state for LangGraph
export interface LeadState {
  leadId: string;
  clientId: string;
  stage: LeadStage;
  signals: LeadSignals;
  conversationHistory: Array<{
    role: 'lead' | 'agent' | 'human';
    content: string;
    timestamp: string;
  }>;
  objections: string[];
  extractedInfo: Record<string, any>;
  bookingAttempts: number;
  lastAction: AgentAction | null;
  humanNeededReason?: EscalationReason;
}
```

---

## Step 10: Run Migration

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 11: Seed Default Escalation Rules

**CREATE** `src/lib/db/seeds/escalation-rules.ts`:

```typescript
import { db } from '@/lib/db';
import { escalationRules } from '@/lib/db/schema';

export async function seedDefaultEscalationRules(clientId: string) {
  const defaultRules = [
    {
      clientId,
      name: 'Explicit Human Request',
      description: 'Customer asks to speak with a human, manager, or owner',
      conditions: {
        triggers: [
          { type: 'keyword', operator: 'contains', value: 'speak to human', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'talk to someone', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'real person', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'manager', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'owner', caseSensitive: false },
        ],
      },
      action: {
        priority: 1,
        assignTo: 'owner',
        notifyVia: ['sms', 'push'],
        autoResponse: "I'm connecting you with a member of our team right now. They'll be with you shortly!",
        pauseAi: true,
      },
      priority: 10,
    },
    {
      clientId,
      name: 'Legal/Complaint Threat',
      description: 'Customer mentions lawyer, BBB, complaint, or legal action',
      conditions: {
        triggers: [
          { type: 'keyword', operator: 'contains', value: 'lawyer', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'attorney', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'BBB', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'better business', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'sue', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'legal action', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'file a complaint', caseSensitive: false },
        ],
      },
      action: {
        priority: 1,
        assignTo: 'owner',
        notifyVia: ['sms', 'email', 'push'],
        autoResponse: "I understand you have serious concerns. Let me get the owner on the line to address this personally.",
        pauseAi: true,
      },
      priority: 5,
    },
    {
      clientId,
      name: 'Frustrated Customer',
      description: 'Detected negative/frustrated sentiment',
      conditions: {
        triggers: [
          { type: 'sentiment', operator: 'equals', value: 'frustrated' },
        ],
      },
      action: {
        priority: 2,
        assignTo: 'round_robin',
        notifyVia: ['push'],
        pauseAi: false,
      },
      priority: 50,
    },
    {
      clientId,
      name: 'High Value Lead',
      description: 'Estimated project value over $10,000',
      conditions: {
        triggers: [
          { type: 'value_threshold', operator: 'greater_than', value: 10000 },
        ],
      },
      action: {
        priority: 2,
        assignTo: 'owner',
        notifyVia: ['sms', 'push'],
        pauseAi: false,
      },
      priority: 60,
    },
    {
      clientId,
      name: 'Emergency/Safety',
      description: 'Customer mentions emergency, flood, fire, safety issue',
      conditions: {
        triggers: [
          { type: 'keyword', operator: 'contains', value: 'emergency', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'flooding', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'fire damage', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'gas leak', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'dangerous', caseSensitive: false },
          { type: 'keyword', operator: 'contains', value: 'urgent', caseSensitive: false },
        ],
      },
      action: {
        priority: 1,
        assignTo: 'owner',
        notifyVia: ['sms', 'push'],
        autoResponse: "This sounds urgent. I'm alerting our team immediately and someone will contact you right away.",
        pauseAi: true,
      },
      priority: 1,
    },
  ];

  await db.insert(escalationRules).values(defaultRules);
}
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add agent tables |
| `src/lib/types/agent.ts` | Created |
| `src/lib/db/seeds/escalation-rules.ts` | Created |

---

## Database Tables Created

| Table | Purpose |
|-------|---------|
| `lead_context` | AI's understanding of each lead |
| `agent_decisions` | Log of every AI decision |
| `escalation_queue` | Human handoff queue |
| `escalation_rules` | Client-configurable escalation triggers |
| `conversation_checkpoints` | Periodic conversation summaries |
| `client_agent_settings` | Per-client AI configuration |

---

## Verification

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%agent%' OR table_name LIKE '%escalation%' OR table_name = 'lead_context';

-- Check enums
SELECT typname FROM pg_type WHERE typname LIKE '%lead_stage%' OR typname LIKE '%agent_action%';
```

---

## Success Criteria
- [ ] All 6 tables created successfully
- [ ] Enums created for stages, actions, reasons
- [ ] Foreign keys linking to leads, clients, messages
- [ ] Indexes on frequently queried columns
- [ ] Default escalation rules seeding works
- [ ] Type exports available for TypeScript
