import { getDb, apiUsage, apiUsageDaily, apiUsageMonthly } from '@/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { calculateCostCents, type ApiService } from '@/lib/config/api-costs';

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
  metadata?: Record<string, unknown>;
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

  const db = getDb();

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
  await updateDailyRollup(db, params.clientId, params.service, params.operation, {
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
  db: ReturnType<typeof getDb>,
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
  const db = getDb();

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
  const db = getDb();
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
