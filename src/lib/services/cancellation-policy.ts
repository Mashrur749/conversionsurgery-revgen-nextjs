export const CANCELLATION_NOTICE_DAYS = 30;
export const EXPORT_SLA_BUSINESS_DAYS = 5;
export const EXPORT_DOWNLOAD_TOKEN_TTL_DAYS = 7;

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function calculateEffectiveCancellationDate(
  noticeReceivedAt: Date,
  noticeDays: number = CANCELLATION_NOTICE_DAYS
): Date {
  const effective = new Date(noticeReceivedAt);
  effective.setDate(effective.getDate() + noticeDays);
  return effective;
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function addBusinessDays(start: Date, businessDays: number): Date {
  if (businessDays <= 0) {
    return new Date(start);
  }

  let remaining = businessDays;
  let cursor = startOfDay(start);

  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + MS_IN_DAY);
    if (isBusinessDay(cursor)) {
      remaining -= 1;
    }
  }

  const result = new Date(start);
  result.setFullYear(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  return result;
}
