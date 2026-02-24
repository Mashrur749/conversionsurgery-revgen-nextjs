import {
  describeBiweeklyPeriod,
  getLatestBiweeklyPeriodEnd,
  getNextBiweeklyPeriodEnd,
  parseDateLegacyPeriod,
  runCronCatchupJob,
  type CronCatchupJobDefinition,
  type CronCatchupRunResult,
} from '@/lib/services/cron-catchup';
import { processBiWeeklyReportPeriod } from '@/lib/services/report-generation';

export const BIWEEKLY_REPORTS_CATCHUP_JOB: CronCatchupJobDefinition = {
  jobKey: 'biweekly_reports',
  periodType: 'biweekly',
  defaultMaxPeriodsPerRun: 2,
  backlogStaleAfterHours: 72,
  legacySettingKey: 'last_biweekly_report_period_end',
  parseLegacyPeriod: parseDateLegacyPeriod,
  getLatestPeriod: getLatestBiweeklyPeriodEnd,
  getNextPeriod: getNextBiweeklyPeriodEnd,
  describePeriod: describeBiweeklyPeriod,
  processPeriod: async ({ period }) => {
    const result = await processBiWeeklyReportPeriod(period);

    return {
      status: result.failed > 0 ? 'partial' : 'success',
      summary: result,
    };
  },
};

export async function runBiweeklyReportsCatchup(options?: {
  now?: Date;
  maxPeriodsPerRun?: number;
}): Promise<CronCatchupRunResult> {
  return runCronCatchupJob(BIWEEKLY_REPORTS_CATCHUP_JOB, options);
}
