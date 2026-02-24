const IDEMPOTENCY_KEY_VERSION = 'v1';

function normalizeSegment(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, '-');
}

export function buildMonthlyOverageIdempotencyKey(clientId: string, billingMonth: string): string {
  return [
    IDEMPOTENCY_KEY_VERSION,
    'billing',
    'overage',
    normalizeSegment(clientId),
    normalizeSegment(billingMonth),
  ].join(':');
}

export function buildCronPeriodIdempotencyKey(jobKey: string, periodKey: string): string {
  return [
    IDEMPOTENCY_KEY_VERSION,
    'cron',
    normalizeSegment(jobKey),
    normalizeSegment(periodKey),
  ].join(':');
}
