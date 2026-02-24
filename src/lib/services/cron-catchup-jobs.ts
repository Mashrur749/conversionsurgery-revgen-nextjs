import {
  buildCronCatchupStatusSnapshot,
  type CronCatchupRunResult,
} from '@/lib/services/cron-catchup';
import {
  BIWEEKLY_REPORTS_CATCHUP_JOB,
  runBiweeklyReportsCatchup,
} from '@/lib/services/biweekly-report-job';
import {
  MONTHLY_RESET_CATCHUP_JOB,
  runMonthlyResetCatchup,
} from '@/lib/services/monthly-reset-job';

export const CRON_CATCHUP_JOB_DEFINITIONS = [
  MONTHLY_RESET_CATCHUP_JOB,
  BIWEEKLY_REPORTS_CATCHUP_JOB,
] as const;

export type CronCatchupJobKey = (typeof CRON_CATCHUP_JOB_DEFINITIONS)[number]['jobKey'];

export async function getCronCatchupStatusSnapshot(now: Date = new Date()) {
  return buildCronCatchupStatusSnapshot([...CRON_CATCHUP_JOB_DEFINITIONS], now);
}

export async function runCronCatchupJobByKey(
  jobKey: CronCatchupJobKey,
  options?: { now?: Date; maxPeriodsPerRun?: number }
): Promise<CronCatchupRunResult> {
  if (jobKey === MONTHLY_RESET_CATCHUP_JOB.jobKey) {
    return runMonthlyResetCatchup(options);
  }

  if (jobKey === BIWEEKLY_REPORTS_CATCHUP_JOB.jobKey) {
    return runBiweeklyReportsCatchup(options);
  }

  throw new Error(`Unsupported catch-up job: ${jobKey}`);
}
