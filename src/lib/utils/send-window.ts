export interface DayOverride {
  /** Day of week: 0=Sunday, 1=Monday ... 6=Saturday */
  day: number;
  /** Override start hour for this day (inclusive, 0-23) */
  startHour?: number;
  /** Override end hour for this day (exclusive, 0-23) */
  endHour?: number;
}

/**
 * Timezone-aware send window check.
 * Returns true if current time is within the specified hour range on a weekday
 * in the given timezone, respecting optional day-specific overrides.
 *
 * @param timezone - IANA timezone string (e.g., 'America/Edmonton')
 * @param startHour - Default window open hour (inclusive, 0-23)
 * @param endHour - Default window close hour (exclusive, 0-23)
 * @param dayOverrides - Optional per-day start/end hour overrides
 */
export function isWithinLocalSendWindow(
  timezone: string,
  startHour: number,
  endHour: number,
  dayOverrides?: DayOverride[],
): boolean {
  const now = new Date();

  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);

  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(now);

  const isWeekend = dayStr === 'Sat' || dayStr === 'Sun';
  if (isWeekend) return false;

  // Map day string to number for override lookup
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayNum = dayMap[dayStr];

  // Apply day-specific overrides if present
  let effectiveStart = startHour;
  let effectiveEnd = endHour;

  if (dayOverrides && dayNum !== undefined) {
    const override = dayOverrides.find((o) => o.day === dayNum);
    if (override) {
      if (override.startHour !== undefined) effectiveStart = override.startHour;
      if (override.endHour !== undefined) effectiveEnd = override.endHour;
    }
  }

  if (hour < effectiveStart || hour >= effectiveEnd) return false;

  return true;
}
