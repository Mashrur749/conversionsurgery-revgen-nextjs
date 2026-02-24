import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { applyMonthlyOverages } from '@/lib/services/overage-billing';
import {
  describeMonthlyPeriod,
  getNextUtcMonthPeriod,
  getUtcMonthPeriodStart,
  parseMonthlyLegacyPeriod,
  runCronCatchupJob,
  type CronCatchupJobDefinition,
  type CronCatchupRunResult,
} from '@/lib/services/cron-catchup';

export const MONTHLY_RESET_CATCHUP_JOB: CronCatchupJobDefinition = {
  jobKey: 'monthly_reset',
  periodType: 'monthly',
  defaultMaxPeriodsPerRun: 3,
  backlogStaleAfterHours: 72,
  legacySettingKey: 'last_monthly_reset_period',
  parseLegacyPeriod: parseMonthlyLegacyPeriod,
  getLatestPeriod: getUtcMonthPeriodStart,
  getNextPeriod: getNextUtcMonthPeriod,
  describePeriod: describeMonthlyPeriod,
  processPeriod: async ({ period }) => {
    const db = getDb();
    const overage = await applyMonthlyOverages({ cyclePeriodStart: period });

    const resetClients = await db
      .update(clients)
      .set({
        messagesSentThisMonth: 0,
        updatedAt: new Date(),
      })
      .where(eq(clients.status, 'active'))
      .returning({ id: clients.id });

    return {
      status: 'success',
      summary: {
        resetClients: resetClients.length,
        overage,
        period: period.toISOString().slice(0, 10),
      },
    };
  },
};

export async function runMonthlyResetCatchup(options?: {
  now?: Date;
  maxPeriodsPerRun?: number;
}): Promise<CronCatchupRunResult> {
  return runCronCatchupJob(MONTHLY_RESET_CATCHUP_JOB, options);
}
