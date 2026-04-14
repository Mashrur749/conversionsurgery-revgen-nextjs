/**
 * Timezone-aware send window check.
 * Returns true if current time is within the specified hour range on a weekday
 * in the given timezone.
 *
 * @param timezone - IANA timezone string (e.g., 'America/Edmonton')
 * @param startHour - Window open hour (inclusive, 0-23)
 * @param endHour - Window close hour (exclusive, 0-23)
 */
export function isWithinLocalSendWindow(
  timezone: string,
  startHour: number,
  endHour: number,
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
  if (hour < startHour || hour >= endHour) return false;

  return true;
}
