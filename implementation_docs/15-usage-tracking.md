# Phase 06b: Usage Tracking & Cost Attribution

## Prerequisites
- Phase 06 (Deployment) complete
- Database running
- OpenAI and Twilio configured

## Goal
Track all billable API usage per client to:
1. Know exact cost per client
2. Detect usage anomalies
3. Ensure profitability per account
4. Enable usage-based billing if needed

---

## Step 1: Create Usage Schema

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// API USAGE TRACKING
// ============================================

export const apiServiceEnum = pgEnum('api_service', [
  'openai',
  'twilio_sms',
  'twilio_voice',
  'twilio_phone',
  'stripe',
  'google_places',
  'cloudflare_r2',
]);

// Granular usage records (every API call)
export const apiUsage = pgTable('api_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  
  // Service details
  service: apiServiceEnum('service').notNull(),
  operation: varchar('operation', { length: 50 }).notNull(), // e.g., 'chat_completion', 'send_sms', 'lead_scoring'
  model: varchar('model', { length: 50 }), // e.g., 'gpt-4o-mini', 'gpt-4o'
  
  // Usage metrics
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  units: integer('units').default(1), // messages, minutes, requests, bytes
  
  // Cost in cents (avoids floating point issues)
  costCents: integer('cost_cents').notNull().default(0),
  
  // Context
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  messageId: uuid('message_id'),
  flowExecutionId: uuid('flow_execution_id'),
  
  // External reference
  externalId: varchar('external_id', { length: 100 }), // Twilio SID, OpenAI request ID, etc.
  
  // Additional data
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: index('api_usage_client_idx').on(table.clientId),
  serviceIdx: index('api_usage_service_idx').on(table.service),
  createdAtIdx: index('api_usage_created_at_idx').on(table.createdAt),
  clientDateIdx: index('api_usage_client_date_idx').on(table.clientId, table.createdAt),
}));

// Daily aggregates (for faster reporting)
export const apiUsageDaily = pgTable('api_usage_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  service: apiServiceEnum('service').notNull(),
  
  // Aggregated metrics
  totalRequests: integer('total_requests').default(0).notNull(),
  totalTokensIn: integer('total_tokens_in').default(0).notNull(),
  totalTokensOut: integer('total_tokens_out').default(0).notNull(),
  totalUnits: integer('total_units').default(0).notNull(),
  totalCostCents: integer('total_cost_cents').default(0).notNull(),
  
  // Breakdown by operation (JSON for flexibility)
  operationBreakdown: jsonb('operation_breakdown').$type<Record<string, {
    requests: number;
    costCents: number;
  }>>(),
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('api_usage_daily_unique_idx').on(table.clientId, table.date, table.service),
  dateIdx: index('api_usage_daily_date_idx').on(table.date),
}));

// Monthly summaries (for billing and reports)
export const apiUsageMonthly = pgTable('api_usage_monthly', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  month: varchar('month', { length: 7 }).notNull(), // "2026-02"
  
  // Cost by service (cents)
  openaiCostCents: integer('openai_cost_cents').default(0).notNull(),
  twilioSmsCostCents: integer('twilio_sms_cost_cents').default(0).notNull(),
  twilioVoiceCostCents: integer('twilio_voice_cost_cents').default(0).notNull(),
  twilioPhoneCostCents: integer('twilio_phone_cost_cents').default(0).notNull(),
  stripeCostCents: integer('stripe_cost_cents').default(0).notNull(),
  googlePlacesCostCents: integer('google_places_cost_cents').default(0).notNull(),
  storageCostCents: integer('storage_cost_cents').default(0).notNull(),
  totalCostCents: integer('total_cost_cents').default(0).notNull(),
  
  // Volume metrics
  totalMessages: integer('total_messages').default(0).notNull(),
  totalAiCalls: integer('total_ai_calls').default(0).notNull(),
  totalVoiceMinutes: integer('total_voice_minutes').default(0).notNull(),
  
  // Comparison
  previousMonthCostCents: integer('previous_month_cost_cents'),
  costChangePercent: integer('cost_change_percent'), // -20 to +500 etc.
  
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('api_usage_monthly_unique_idx').on(table.clientId, table.month),
  monthIdx: index('api_usage_monthly_month_idx').on(table.month),
}));

// Usage alerts
export const usageAlerts = pgTable('usage_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  
  alertType: varchar('alert_type', { length: 30 }).notNull(), // 'spike', 'threshold', 'anomaly'
  severity: varchar('severity', { length: 10 }).notNull(), // 'info', 'warning', 'critical'
  
  message: text('message').notNull(),
  details: jsonb('details').$type<{
    currentCost?: number;
    previousCost?: number;
    threshold?: number;
    percentChange?: number;
  }>(),
  
  acknowledged: boolean('acknowledged').default(false),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: uuid('acknowledged_by'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  clientIdx: index('usage_alerts_client_idx').on(table.clientId),
  unacknowledgedIdx: index('usage_alerts_unack_idx').on(table.acknowledged),
}));
```

Run migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 2: Create Cost Configuration

**CREATE** `src/lib/config/api-costs.ts`:

```typescript
/**
 * API Cost Configuration
 * All costs in dollars per unit
 * Updated: February 2026
 */

export const API_COSTS = {
  // OpenAI - per 1K tokens
  openai: {
    'gpt-4o-mini': {
      input: 0.00015,  // $0.15 per 1M
      output: 0.0006,  // $0.60 per 1M
    },
    'gpt-4o': {
      input: 0.0025,   // $2.50 per 1M
      output: 0.01,    // $10 per 1M
    },
    'gpt-4-turbo': {
      input: 0.01,
      output: 0.03,
    },
  },
  
  // Twilio SMS - per segment (US)
  twilio_sms: {
    outbound: 0.0079,
    inbound: 0.0079,
    mms_outbound: 0.02,
    mms_inbound: 0.01,
  },
  
  // Twilio Voice - per minute (US)
  twilio_voice: {
    outbound: 0.014,
    inbound: 0.0085,
    recording: 0.0025, // per minute stored
  },
  
  // Twilio Phone Numbers - per month
  twilio_phone: {
    local: 1.15,
    toll_free: 2.15,
  },
  
  // Stripe - percentage + fixed
  stripe: {
    percentage: 0.029,  // 2.9%
    fixed: 0.30,        // $0.30 per transaction
  },
  
  // Google Places API - per request
  google_places: {
    place_details: 0.017,
    find_place: 0.017,
    nearby_search: 0.032,
  },
  
  // Cloudflare R2 - per GB
  cloudflare_r2: {
    storage_gb: 0.015,  // per month
    class_a_ops: 0.0000045, // per 1K (PUT, POST, LIST)
    class_b_ops: 0.00000036, // per 1K (GET)
  },
} as const;

export type ApiService = keyof typeof API_COSTS;

/**
 * Calculate cost in cents for a given API call
 */
export function calculateCostCents(params: {
  service: ApiService;
  operation: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  amount?: number; // For Stripe transactions
}): number {
  const { service, operation, model, inputTokens, outputTokens, units = 1, amount } = params;
  
  let costDollars = 0;
  
  switch (service) {
    case 'openai': {
      const modelKey = model || 'gpt-4o-mini';
      const modelCosts = API_COSTS.openai[modelKey as keyof typeof API_COSTS.openai];
      if (modelCosts) {
        const inputCost = ((inputTokens || 0) / 1000) * modelCosts.input;
        const outputCost = ((outputTokens || 0) / 1000) * modelCosts.output;
        costDollars = inputCost + outputCost;
      }
      break;
    }
    
    case 'twilio_sms': {
      const smsCosts = API_COSTS.twilio_sms;
      const rate = smsCosts[operation as keyof typeof smsCosts] || smsCosts.outbound;
      costDollars = rate * units;
      break;
    }
    
    case 'twilio_voice': {
      const voiceCosts = API_COSTS.twilio_voice;
      const rate = voiceCosts[operation as keyof typeof voiceCosts] || voiceCosts.outbound;
      costDollars = rate * units;
      break;
    }
    
    case 'twilio_phone': {
      const phoneCosts = API_COSTS.twilio_phone;
      const rate = phoneCosts[operation as keyof typeof phoneCosts] || phoneCosts.local;
      costDollars = rate * units;
      break;
    }
    
    case 'stripe': {
      if (amount) {
        costDollars = (amount * API_COSTS.stripe.percentage) + API_COSTS.stripe.fixed;
      }
      break;
    }
    
    case 'google_places': {
      const placesCosts = API_COSTS.google_places;
      const rate = placesCosts[operation as keyof typeof placesCosts] || placesCosts.place_details;
      costDollars = rate * units;
      break;
    }
    
    case 'cloudflare_r2': {
      const r2Costs = API_COSTS.cloudflare_r2;
      const rate = r2Costs[operation as keyof typeof r2Costs] || r2Costs.storage_gb;
      costDollars = rate * units;
      break;
    }
  }
  
  // Convert to cents and round
  return Math.round(costDollars * 100);
}
```

---

## Step 3: Create Usage Tracking Service

**CREATE** `src/lib/services/usage-tracking.ts`:

```typescript
import { db } from '@/lib/db';
import { apiUsage, apiUsageDaily, apiUsageMonthly, usageAlerts } from '@/lib/db/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { calculateCostCents, ApiService } from '@/lib/config/api-costs';

interface TrackUsageParams {
  clientId: string;
  service: ApiService;
  operation: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  amount?: number;
  leadId?: string;
  messageId?: string;
  flowExecutionId?: string;
  externalId?: string;
  metadata?: Record<string, any>;
}

/**
 * Track a single API usage event
 */
export async function trackUsage(params: TrackUsageParams): Promise<void> {
  const costCents = calculateCostCents({
    service: params.service,
    operation: params.operation,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    units: params.units,
    amount: params.amount,
  });
  
  // Insert usage record
  await db.insert(apiUsage).values({
    clientId: params.clientId,
    service: params.service,
    operation: params.operation,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    units: params.units || 1,
    costCents,
    leadId: params.leadId,
    messageId: params.messageId,
    flowExecutionId: params.flowExecutionId,
    externalId: params.externalId,
    metadata: params.metadata,
  });
  
  // Update daily rollup
  await updateDailyRollup(params.clientId, params.service, params.operation, {
    requests: 1,
    tokensIn: params.inputTokens || 0,
    tokensOut: params.outputTokens || 0,
    units: params.units || 1,
    costCents,
  });
}

/**
 * Update daily aggregates (upsert)
 */
async function updateDailyRollup(
  clientId: string,
  service: ApiService,
  operation: string,
  metrics: {
    requests: number;
    tokensIn: number;
    tokensOut: number;
    units: number;
    costCents: number;
  }
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // Try to get existing record
  const [existing] = await db
    .select()
    .from(apiUsageDaily)
    .where(and(
      eq(apiUsageDaily.clientId, clientId),
      eq(apiUsageDaily.date, today),
      eq(apiUsageDaily.service, service)
    ))
    .limit(1);
  
  if (existing) {
    // Update existing
    const breakdown = (existing.operationBreakdown || {}) as Record<string, { requests: number; costCents: number }>;
    breakdown[operation] = {
      requests: (breakdown[operation]?.requests || 0) + metrics.requests,
      costCents: (breakdown[operation]?.costCents || 0) + metrics.costCents,
    };
    
    await db
      .update(apiUsageDaily)
      .set({
        totalRequests: existing.totalRequests + metrics.requests,
        totalTokensIn: existing.totalTokensIn + metrics.tokensIn,
        totalTokensOut: existing.totalTokensOut + metrics.tokensOut,
        totalUnits: existing.totalUnits + metrics.units,
        totalCostCents: existing.totalCostCents + metrics.costCents,
        operationBreakdown: breakdown,
        updatedAt: new Date(),
      })
      .where(eq(apiUsageDaily.id, existing.id));
  } else {
    // Insert new
    await db.insert(apiUsageDaily).values({
      clientId,
      date: today,
      service,
      totalRequests: metrics.requests,
      totalTokensIn: metrics.tokensIn,
      totalTokensOut: metrics.tokensOut,
      totalUnits: metrics.units,
      totalCostCents: metrics.costCents,
      operationBreakdown: {
        [operation]: {
          requests: metrics.requests,
          costCents: metrics.costCents,
        },
      },
    });
  }
}

/**
 * Get usage summary for a client
 */
export async function getClientUsageSummary(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalCostCents: number;
  byService: Record<string, number>;
  byDay: Array<{ date: string; costCents: number }>;
  topOperations: Array<{ operation: string; costCents: number; requests: number }>;
}> {
  // Get daily records
  const dailyRecords = await db
    .select()
    .from(apiUsageDaily)
    .where(and(
      eq(apiUsageDaily.clientId, clientId),
      gte(apiUsageDaily.date, startDate),
      lte(apiUsageDaily.date, endDate)
    ))
    .orderBy(apiUsageDaily.date);
  
  // Aggregate
  let totalCostCents = 0;
  const byService: Record<string, number> = {};
  const byDayMap: Record<string, number> = {};
  const operationMap: Record<string, { costCents: number; requests: number }> = {};
  
  for (const record of dailyRecords) {
    totalCostCents += record.totalCostCents;
    
    byService[record.service] = (byService[record.service] || 0) + record.totalCostCents;
    
    byDayMap[record.date] = (byDayMap[record.date] || 0) + record.totalCostCents;
    
    // Aggregate operations
    const breakdown = record.operationBreakdown as Record<string, { requests: number; costCents: number }> | null;
    if (breakdown) {
      for (const [op, data] of Object.entries(breakdown)) {
        if (!operationMap[op]) {
          operationMap[op] = { costCents: 0, requests: 0 };
        }
        operationMap[op].costCents += data.costCents;
        operationMap[op].requests += data.requests;
      }
    }
  }
  
  // Convert to arrays
  const byDay = Object.entries(byDayMap)
    .map(([date, costCents]) => ({ date, costCents }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const topOperations = Object.entries(operationMap)
    .map(([operation, data]) => ({ operation, ...data }))
    .sort((a, b) => b.costCents - a.costCents)
    .slice(0, 10);
  
  return {
    totalCostCents,
    byService,
    byDay,
    topOperations,
  };
}

/**
 * Get current month usage for a client
 */
export async function getCurrentMonthUsage(clientId: string): Promise<{
  costCents: number;
  daysRemaining: number;
  projectedCostCents: number;
}> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  
  const summary = await getClientUsageSummary(clientId, startOfMonth, today);
  
  // Project based on daily average
  const dailyAverage = dayOfMonth > 0 ? summary.totalCostCents / dayOfMonth : 0;
  const projectedCostCents = Math.round(dailyAverage * daysInMonth);
  
  return {
    costCents: summary.totalCostCents,
    daysRemaining,
    projectedCostCents,
  };
}

/**
 * Update monthly summaries (run via cron)
 */
export async function updateMonthlySummaries(): Promise<void> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startOfMonth = `${currentMonth}-01`;
  
  // Get all clients with usage this month
  const clientsWithUsage = await db
    .selectDistinct({ clientId: apiUsageDaily.clientId })
    .from(apiUsageDaily)
    .where(gte(apiUsageDaily.date, startOfMonth));
  
  for (const { clientId } of clientsWithUsage) {
    const today = now.toISOString().split('T')[0];
    const summary = await getClientUsageSummary(clientId, startOfMonth, today);
    
    // Get previous month for comparison
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const [prevRecord] = await db
      .select()
      .from(apiUsageMonthly)
      .where(and(
        eq(apiUsageMonthly.clientId, clientId),
        eq(apiUsageMonthly.month, prevMonthStr)
      ))
      .limit(1);
    
    const previousCost = prevRecord?.totalCostCents || 0;
    const costChange = previousCost > 0
      ? Math.round(((summary.totalCostCents - previousCost) / previousCost) * 100)
      : null;
    
    // Count messages and AI calls from daily records
    const dailyRecords = await db
      .select()
      .from(apiUsageDaily)
      .where(and(
        eq(apiUsageDaily.clientId, clientId),
        gte(apiUsageDaily.date, startOfMonth)
      ));
    
    let totalMessages = 0;
    let totalAiCalls = 0;
    let totalVoiceMinutes = 0;
    
    for (const record of dailyRecords) {
      if (record.service === 'twilio_sms') {
        totalMessages += record.totalUnits;
      }
      if (record.service === 'openai') {
        totalAiCalls += record.totalRequests;
      }
      if (record.service === 'twilio_voice') {
        totalVoiceMinutes += record.totalUnits;
      }
    }
    
    // Upsert monthly record
    await db
      .insert(apiUsageMonthly)
      .values({
        clientId,
        month: currentMonth,
        openaiCostCents: summary.byService['openai'] || 0,
        twilioSmsCostCents: summary.byService['twilio_sms'] || 0,
        twilioVoiceCostCents: summary.byService['twilio_voice'] || 0,
        twilioPhoneCostCents: summary.byService['twilio_phone'] || 0,
        stripeCostCents: summary.byService['stripe'] || 0,
        googlePlacesCostCents: summary.byService['google_places'] || 0,
        storageCostCents: summary.byService['cloudflare_r2'] || 0,
        totalCostCents: summary.totalCostCents,
        totalMessages,
        totalAiCalls,
        totalVoiceMinutes,
        previousMonthCostCents: previousCost,
        costChangePercent: costChange,
      })
      .onConflictDoUpdate({
        target: [apiUsageMonthly.clientId, apiUsageMonthly.month],
        set: {
          openaiCostCents: summary.byService['openai'] || 0,
          twilioSmsCostCents: summary.byService['twilio_sms'] || 0,
          twilioVoiceCostCents: summary.byService['twilio_voice'] || 0,
          twilioPhoneCostCents: summary.byService['twilio_phone'] || 0,
          stripeCostCents: summary.byService['stripe'] || 0,
          googlePlacesCostCents: summary.byService['google_places'] || 0,
          storageCostCents: summary.byService['cloudflare_r2'] || 0,
          totalCostCents: summary.totalCostCents,
          totalMessages,
          totalAiCalls,
          totalVoiceMinutes,
          previousMonthCostCents: previousCost,
          costChangePercent: costChange,
          updatedAt: new Date(),
        },
      });
  }
}
```

---

## Step 4: Create Usage Alert Service

**CREATE** `src/lib/services/usage-alerts.ts`:

```typescript
import { db } from '@/lib/db';
import { usageAlerts, apiUsageMonthly, clients } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentMonthUsage } from './usage-tracking';
import { sendSMS } from './twilio';

interface AlertThresholds {
  monthlyWarning: number;  // cents
  monthlyCritical: number; // cents
  spikePercent: number;    // e.g., 50 = 50% increase
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  monthlyWarning: 5000,    // $50
  monthlyCritical: 10000,  // $100
  spikePercent: 50,        // 50% increase from previous month
};

/**
 * Check usage and create alerts if needed
 */
export async function checkUsageAlerts(
  clientId: string,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Promise<void> {
  const usage = await getCurrentMonthUsage(clientId);
  
  // Check threshold alerts
  if (usage.costCents >= thresholds.monthlyCritical) {
    await createAlert({
      clientId,
      alertType: 'threshold',
      severity: 'critical',
      message: `Monthly usage has exceeded $${(thresholds.monthlyCritical / 100).toFixed(2)}`,
      details: {
        currentCost: usage.costCents,
        threshold: thresholds.monthlyCritical,
      },
    });
  } else if (usage.costCents >= thresholds.monthlyWarning) {
    await createAlert({
      clientId,
      alertType: 'threshold',
      severity: 'warning',
      message: `Monthly usage has exceeded $${(thresholds.monthlyWarning / 100).toFixed(2)}`,
      details: {
        currentCost: usage.costCents,
        threshold: thresholds.monthlyWarning,
      },
    });
  }
  
  // Check for spikes
  const now = new Date();
  const prevMonthStr = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  
  const [prevMonth] = await db
    .select()
    .from(apiUsageMonthly)
    .where(and(
      eq(apiUsageMonthly.clientId, clientId),
      eq(apiUsageMonthly.month, prevMonthStr)
    ))
    .limit(1);
  
  if (prevMonth && prevMonth.totalCostCents > 0) {
    const percentChange = ((usage.costCents - prevMonth.totalCostCents) / prevMonth.totalCostCents) * 100;
    
    if (percentChange >= thresholds.spikePercent) {
      await createAlert({
        clientId,
        alertType: 'spike',
        severity: percentChange >= 100 ? 'critical' : 'warning',
        message: `Usage is ${Math.round(percentChange)}% higher than last month`,
        details: {
          currentCost: usage.costCents,
          previousCost: prevMonth.totalCostCents,
          percentChange: Math.round(percentChange),
        },
      });
    }
  }
  
  // Check projected overage
  if (usage.projectedCostCents >= thresholds.monthlyCritical * 1.5) {
    await createAlert({
      clientId,
      alertType: 'anomaly',
      severity: 'warning',
      message: `Projected monthly cost: $${(usage.projectedCostCents / 100).toFixed(2)}`,
      details: {
        currentCost: usage.costCents,
        projectedCost: usage.projectedCostCents,
      },
    });
  }
}

/**
 * Create an alert (with deduplication)
 */
async function createAlert(params: {
  clientId: string;
  alertType: string;
  severity: string;
  message: string;
  details: Record<string, any>;
}): Promise<void> {
  // Check for recent duplicate alert (same type within 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [existing] = await db
    .select()
    .from(usageAlerts)
    .where(and(
      eq(usageAlerts.clientId, params.clientId),
      eq(usageAlerts.alertType, params.alertType),
      eq(usageAlerts.severity, params.severity)
    ))
    .orderBy(desc(usageAlerts.createdAt))
    .limit(1);
  
  if (existing && existing.createdAt && existing.createdAt > oneDayAgo) {
    // Skip duplicate
    return;
  }
  
  // Create alert
  await db.insert(usageAlerts).values({
    clientId: params.clientId,
    alertType: params.alertType,
    severity: params.severity,
    message: params.message,
    details: params.details,
  });
  
  // Notify admin for critical alerts
  if (params.severity === 'critical') {
    await notifyAdminOfAlert(params.clientId, params.message);
  }
}

/**
 * Notify admin of critical alert
 */
async function notifyAdminOfAlert(clientId: string, message: string): Promise<void> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  
  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  if (!adminPhone) return;
  
  await sendSMS({
    to: adminPhone,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: `⚠️ Usage Alert for ${client?.businessName || 'Unknown'}: ${message}`,
  });
}

/**
 * Get unacknowledged alerts for a client
 */
export async function getUnacknowledgedAlerts(clientId: string) {
  return db
    .select()
    .from(usageAlerts)
    .where(and(
      eq(usageAlerts.clientId, clientId),
      eq(usageAlerts.acknowledged, false)
    ))
    .orderBy(desc(usageAlerts.createdAt));
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
  await db
    .update(usageAlerts)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    })
    .where(eq(usageAlerts.id, alertId));
}

/**
 * Run alert checks for all clients (cron job)
 */
export async function checkAllClientAlerts(): Promise<void> {
  const allClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.status, 'active'));
  
  for (const client of allClients) {
    try {
      await checkUsageAlerts(client.id);
    } catch (error) {
      console.error(`Error checking alerts for client ${client.id}:`, error);
    }
  }
}
```

---

## Step 5: Create Wrapped API Clients

**CREATE** `src/lib/clients/openai-tracked.ts`:

```typescript
import OpenAI from 'openai';
import { trackUsage } from '@/lib/services/usage-tracking';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TrackedCompletionParams {
  clientId: string;
  operation: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  leadId?: string;
  response_format?: { type: 'json_object' } | { type: 'text' };
}

/**
 * Create chat completion with usage tracking
 */
export async function chatCompletion(params: TrackedCompletionParams) {
  const model = params.model || 'gpt-4o-mini';
  
  const response = await openai.chat.completions.create({
    model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens,
    response_format: params.response_format,
  });
  
  // Track usage asynchronously (don't block response)
  trackUsage({
    clientId: params.clientId,
    service: 'openai',
    operation: params.operation,
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    leadId: params.leadId,
    externalId: response.id,
    metadata: {
      finishReason: response.choices[0]?.finish_reason,
    },
  }).catch(err => console.error('Usage tracking error:', err));
  
  return response;
}

/**
 * Create embedding with usage tracking
 */
export async function createEmbedding(params: {
  clientId: string;
  operation: string;
  input: string | string[];
}) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: params.input,
  });
  
  trackUsage({
    clientId: params.clientId,
    service: 'openai',
    operation: params.operation,
    model: 'text-embedding-3-small',
    inputTokens: response.usage?.total_tokens,
  }).catch(err => console.error('Usage tracking error:', err));
  
  return response;
}

// Re-export for convenience
export { openai };
```

**CREATE** `src/lib/clients/twilio-tracked.ts`:

```typescript
import twilio from 'twilio';
import { trackUsage } from '@/lib/services/usage-tracking';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

interface SendSMSParams {
  clientId: string;
  to: string;
  from: string;
  body: string;
  leadId?: string;
  mediaUrl?: string[];
}

/**
 * Send SMS with usage tracking
 */
export async function sendSMS(params: SendSMSParams) {
  const { clientId, to, from, body, leadId, mediaUrl } = params;
  
  const message = await twilioClient.messages.create({
    to,
    from,
    body,
    mediaUrl,
  });
  
  // Calculate segments (SMS = 160 chars, with special chars = 70)
  const hasUnicode = /[^\x00-\x7F]/.test(body);
  const charsPerSegment = hasUnicode ? 70 : 160;
  const segments = Math.ceil(body.length / charsPerSegment);
  
  const operation = mediaUrl?.length ? 'mms_outbound' : 'outbound';
  
  // Track usage
  trackUsage({
    clientId,
    service: 'twilio_sms',
    operation,
    units: segments,
    leadId,
    externalId: message.sid,
    metadata: {
      to,
      from,
      segments,
      status: message.status,
    },
  }).catch(err => console.error('Usage tracking error:', err));
  
  return message;
}

/**
 * Track inbound SMS (called from webhook)
 */
export async function trackInboundSMS(params: {
  clientId: string;
  leadId?: string;
  messageSid: string;
  numSegments: number;
  numMedia: number;
}) {
  const operation = params.numMedia > 0 ? 'mms_inbound' : 'inbound';
  
  await trackUsage({
    clientId: params.clientId,
    service: 'twilio_sms',
    operation,
    units: params.numSegments,
    leadId: params.leadId,
    externalId: params.messageSid,
    metadata: {
      numMedia: params.numMedia,
    },
  });
}

/**
 * Track phone number provisioning
 */
export async function trackPhoneProvisioning(params: {
  clientId: string;
  phoneNumber: string;
  type: 'local' | 'toll_free';
}) {
  await trackUsage({
    clientId: params.clientId,
    service: 'twilio_phone',
    operation: params.type,
    units: 1,
    externalId: params.phoneNumber,
  });
}

// Re-export client for direct access if needed
export { twilioClient };
```

---

## Step 6: Create Usage API Routes

**CREATE** `src/app/api/admin/usage/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiUsageMonthly, clients } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

// GET - Get usage summary for all clients
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || getCurrentMonth();
  
  // Get all clients with their monthly usage
  const usage = await db
    .select({
      clientId: apiUsageMonthly.clientId,
      clientName: clients.businessName,
      month: apiUsageMonthly.month,
      openaiCost: apiUsageMonthly.openaiCostCents,
      twilioSmsCost: apiUsageMonthly.twilioSmsCostCents,
      twilioVoiceCost: apiUsageMonthly.twilioVoiceCostCents,
      totalCost: apiUsageMonthly.totalCostCents,
      totalMessages: apiUsageMonthly.totalMessages,
      totalAiCalls: apiUsageMonthly.totalAiCalls,
      costChange: apiUsageMonthly.costChangePercent,
    })
    .from(apiUsageMonthly)
    .innerJoin(clients, eq(apiUsageMonthly.clientId, clients.id))
    .where(eq(apiUsageMonthly.month, month))
    .orderBy(desc(apiUsageMonthly.totalCostCents));
  
  // Calculate totals
  const totals = usage.reduce(
    (acc, u) => ({
      totalCost: acc.totalCost + u.totalCost,
      openaiCost: acc.openaiCost + u.openaiCost,
      twilioSmsCost: acc.twilioSmsCost + u.twilioSmsCost,
      totalMessages: acc.totalMessages + u.totalMessages,
      totalAiCalls: acc.totalAiCalls + u.totalAiCalls,
    }),
    { totalCost: 0, openaiCost: 0, twilioSmsCost: 0, totalMessages: 0, totalAiCalls: 0 }
  );
  
  return NextResponse.json({
    month,
    clients: usage,
    totals,
  });
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
```

**CREATE** `src/app/api/admin/usage/[clientId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientUsageSummary, getCurrentMonthUsage } from '@/lib/services/usage-tracking';
import { getUnacknowledgedAlerts } from '@/lib/services/usage-alerts';

// GET - Get detailed usage for a specific client
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || getMonthStart();
  const endDate = searchParams.get('endDate') || getToday();
  
  const [summary, currentMonth, alerts] = await Promise.all([
    getClientUsageSummary(params.clientId, startDate, endDate),
    getCurrentMonthUsage(params.clientId),
    getUnacknowledgedAlerts(params.clientId),
  ]);
  
  return NextResponse.json({
    ...summary,
    currentMonth,
    alerts,
  });
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
```

**CREATE** `src/app/api/admin/usage/alerts/[id]/acknowledge/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { acknowledgeAlert } from '@/lib/services/usage-alerts';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  await acknowledgeAlert(params.id, session.user.id);
  
  return NextResponse.json({ success: true });
}
```

---

## Step 7: Create Usage Dashboard Component

**CREATE** `src/components/admin/usage-dashboard.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, 
  MessageSquare, 
  Bot, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

interface UsageData {
  month: string;
  clients: Array<{
    clientId: string;
    clientName: string;
    totalCost: number;
    openaiCost: number;
    twilioSmsCost: number;
    totalMessages: number;
    totalAiCalls: number;
    costChange: number | null;
  }>;
  totals: {
    totalCost: number;
    openaiCost: number;
    twilioSmsCost: number;
    totalMessages: number;
    totalAiCalls: number;
  };
}

export function UsageDashboard() {
  const [data, setData] = useState<UsageData | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/usage?month=${month}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [month]);

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const months = getLast6Months();

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">API Usage & Costs</h2>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.totals.totalCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.clients.length} active clients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">OpenAI</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.totals.openaiCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.totals.totalAiCalls.toLocaleString()} calls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Twilio SMS</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.totals.twilioSmsCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.totals.totalMessages.toLocaleString()} messages
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg per Client</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.clients.length ? data.totals.totalCost / data.clients.length : 0)}
              </div>
              <p className="text-xs text-muted-foreground">per month</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Client breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Client</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">OpenAI</TableHead>
                  <TableHead className="text-right">SMS</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">vs Last Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.clients.map(client => (
                  <TableRow key={client.clientId}>
                    <TableCell>
                      <Link 
                        href={`/admin/usage/${client.clientId}`}
                        className="font-medium hover:underline"
                      >
                        {client.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(client.openaiCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(client.twilioSmsCost)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCost(client.totalCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {client.costChange !== null && (
                        <Badge
                          variant={client.costChange > 20 ? 'destructive' : 'secondary'}
                          className="gap-1"
                        >
                          {client.costChange > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {client.costChange > 0 ? '+' : ''}{client.costChange}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getLast6Months(): Array<{ value: string; label: string }> {
  const months = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }
  
  return months;
}
```

---

## Step 8: Create Client Usage Detail Page

**CREATE** `src/app/admin/usage/[clientId]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ClientUsageDetail } from '@/components/admin/client-usage-detail';

interface PageProps {
  params: { clientId: string };
}

export default async function ClientUsagePage({ params }: PageProps) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.clientId))
    .limit(1);

  if (!client) notFound();

  return (
    <div className="container py-6">
      <ClientUsageDetail clientId={params.clientId} clientName={client.businessName} />
    </div>
  );
}
```

**CREATE** `src/components/admin/client-usage-detail.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface UsageDetail {
  totalCostCents: number;
  byService: Record<string, number>;
  byDay: Array<{ date: string; costCents: number }>;
  topOperations: Array<{ operation: string; costCents: number; requests: number }>;
  currentMonth: {
    costCents: number;
    daysRemaining: number;
    projectedCostCents: number;
  };
  alerts: Array<{
    id: string;
    alertType: string;
    severity: string;
    message: string;
    createdAt: string;
  }>;
}

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientUsageDetail({ clientId, clientName }: Props) {
  const [data, setData] = useState<UsageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/admin/usage/${clientId}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const acknowledgeAlert = async (alertId: string) => {
    await fetch(`/api/admin/usage/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
    toast.success('Alert acknowledged');
    fetchData();
  };

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-8">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/usage">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{clientName}</h1>
          <p className="text-muted-foreground">Usage & Cost Details</p>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({data.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity}
                  </Badge>
                  <span>{alert.message}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => acknowledgeAlert(alert.id)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Acknowledge
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Current Month Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCost(data.currentMonth.costCents)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projected Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCost(data.currentMonth.projectedCostCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.currentMonth.daysRemaining} days remaining
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCost(Math.round(data.totalCostCents / (data.byDay.length || 1)))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Service */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Service</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(data.byService)
              .sort(([, a], [, b]) => b - a)
              .map(([service, costCents]) => {
                const percent = Math.round((costCents / data.totalCostCents) * 100);
                return (
                  <div key={service}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="capitalize">{service.replace('_', ' ')}</span>
                      <span className="font-medium">{formatCost(costCents)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Top Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Top Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topOperations.map(op => (
              <div
                key={op.operation}
                className="flex items-center justify-between p-2 rounded border"
              >
                <div>
                  <span className="font-medium">{op.operation}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({op.requests.toLocaleString()} calls)
                  </span>
                </div>
                <span className="font-medium">{formatCost(op.costCents)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 9: Add Cron Jobs

**MODIFY** `src/app/api/cron/hourly/route.ts`:

```typescript
import { checkAllClientAlerts, updateMonthlySummaries } from '@/lib/services/usage-alerts';

export async function GET(request: NextRequest) {
  // ... existing hourly tasks ...
  
  // Update monthly summaries and check alerts
  await updateMonthlySummaries();
  await checkAllClientAlerts();
  
  return NextResponse.json({ success: true });
}
```

---

## Step 10: Update Existing Services to Use Tracked Clients

**MODIFY** `src/lib/services/ai-response.ts`:

```typescript
// Replace direct OpenAI import with tracked client
import { chatCompletion } from '@/lib/clients/openai-tracked';

export async function generateAIResponse(options: {
  clientId: string;
  leadId: string;
  incomingMessage: string;
  // ...
}) {
  const response = await chatCompletion({
    clientId: options.clientId,
    operation: 'ai_response',
    leadId: options.leadId,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: options.incomingMessage },
    ],
  });
  
  return response.choices[0].message.content;
}
```

**MODIFY** `src/lib/services/twilio.ts`:

```typescript
// Replace direct Twilio calls with tracked client
import { sendSMS as sendTrackedSMS, trackInboundSMS } from '@/lib/clients/twilio-tracked';

export { sendTrackedSMS as sendSMS, trackInboundSMS };
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add usage tables |
| `src/lib/config/api-costs.ts` | Created |
| `src/lib/services/usage-tracking.ts` | Created |
| `src/lib/services/usage-alerts.ts` | Created |
| `src/lib/clients/openai-tracked.ts` | Created |
| `src/lib/clients/twilio-tracked.ts` | Created |
| `src/app/api/admin/usage/route.ts` | Created |
| `src/app/api/admin/usage/[clientId]/route.ts` | Created |
| `src/app/api/admin/usage/alerts/[id]/acknowledge/route.ts` | Created |
| `src/app/admin/usage/[clientId]/page.tsx` | Created |
| `src/components/admin/usage-dashboard.tsx` | Created |
| `src/components/admin/client-usage-detail.tsx` | Created |
| `src/app/api/cron/hourly/route.ts` | Modified |
| `src/lib/services/ai-response.ts` | Modified - Use tracked client |
| `src/lib/services/twilio.ts` | Modified - Use tracked client |

---

## Environment Variables

```bash
# Optional: Admin notification for critical alerts
ADMIN_PHONE_NUMBER=+14035551234
```

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Send test message (should track usage)
# Check api_usage table for new records

# 3. Verify daily rollup
SELECT * FROM api_usage_daily WHERE date = CURRENT_DATE;

# 4. View admin dashboard
open http://localhost:3000/admin/usage

# 5. Manually trigger monthly summary
curl http://localhost:3000/api/cron/hourly
```

---

## Success Criteria
- [ ] Every OpenAI call tracked with tokens and cost
- [ ] Every Twilio SMS tracked with segments and cost
- [ ] Daily rollups updating automatically
- [ ] Monthly summaries calculating correctly
- [ ] Usage dashboard showing per-client breakdown
- [ ] Alerts triggering for spikes and thresholds
- [ ] Cost projection calculating based on daily average
- [ ] Admin can drill into client-level detail
