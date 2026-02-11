import { getDb } from '@/db';
import { businessHours } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Initialize default business hours for a client.
 * Creates 7 rows (one per day of week) with Mon-Fri 9AM-5PM open
 * and Saturday/Sunday closed. Uses onConflictDoNothing so it is
 * safe to call multiple times for the same client.
 *
 * @param clientId - UUID of the client to initialize hours for
 */
export async function initializeBusinessHours(clientId: string) {
  const db = getDb();

  const defaults = [
    { day: 0, isOpen: false }, // Sunday
    { day: 1, isOpen: true }, // Monday
    { day: 2, isOpen: true }, // Tuesday
    { day: 3, isOpen: true }, // Wednesday
    { day: 4, isOpen: true }, // Thursday
    { day: 5, isOpen: true }, // Friday
    { day: 6, isOpen: false }, // Saturday
  ];

  try {
    for (const { day, isOpen } of defaults) {
      await db
        .insert(businessHours)
        .values({
          clientId,
          dayOfWeek: day,
          openTime: isOpen ? '09:00' : null,
          closeTime: isOpen ? '17:00' : null,
          isOpen,
        })
        .onConflictDoNothing();
    }

    console.log('[Business Hours] Initialized for client:', clientId);
  } catch (error) {
    console.error('[Business Hours] Error initializing:', error);
  }
}

/**
 * Check if the current time falls within the configured business hours
 * for a given client, accounting for the client's timezone.
 *
 * Returns `false` if the day is marked closed, if the current time is
 * outside the open/close window, or if no hours are configured.
 *
 * @param clientId - UUID of the client to check hours for
 * @param timezone - IANA timezone string (defaults to America/Edmonton)
 * @returns `true` when the current moment is within business hours
 */
export async function isWithinBusinessHours(
  clientId: string,
  timezone: string = 'America/Edmonton'
): Promise<boolean> {
  try {
    const db = getDb();
    const now = new Date();

    // Format current time in client's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    const hour = parts.find((p) => p.type === 'hour')?.value || '09';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';

    const dayMap: Record<string, number> = {
      'Sun': 0,
      'Mon': 1,
      'Tue': 2,
      'Wed': 3,
      'Thu': 4,
      'Fri': 5,
      'Sat': 6,
    };

    const dayOfWeek = dayMap[weekdayStr];
    const currentTime = `${hour}:${minute}`;

    const [hours] = await db
      .select()
      .from(businessHours)
      .where(
        and(
          eq(businessHours.clientId, clientId),
          eq(businessHours.dayOfWeek, dayOfWeek)
        )
      )
      .limit(1);

    if (!hours || !hours.isOpen) {
      console.log(`[Business Hours] Outside hours - day=${weekdayStr}, time=${currentTime}`);
      return false;
    }

    const openTime = hours.openTime || '00:00';
    const closeTime = hours.closeTime || '23:59';
    const isWithin = currentTime >= openTime && currentTime <= closeTime;

    console.log(
      `[Business Hours] Check complete - within=${isWithin}, time=${currentTime}, hours=${openTime}-${closeTime}`
    );

    return isWithin;
  } catch (error) {
    console.error('[Business Hours] Error checking:', error);
    return false;
  }
}

/**
 * Retrieve the full set of business hours rows for a client (up to 7 days).
 *
 * @param clientId - UUID of the client
 * @returns Array of business hour rows, or empty array on error
 */
export async function getBusinessHours(clientId: string) {
  try {
    const db = getDb();
    const hours = await db
      .select()
      .from(businessHours)
      .where(eq(businessHours.clientId, clientId));

    return hours;
  } catch (error) {
    console.error('[Business Hours] Error fetching:', error);
    return [];
  }
}

/**
 * Upsert business hours for a specific day of the week.
 * If a row for (clientId, dayOfWeek) already exists it is updated;
 * otherwise a new row is inserted.
 *
 * @param clientId  - UUID of the client
 * @param dayOfWeek - Day number (0=Sun through 6=Sat)
 * @param openTime  - Opening time as HH:MM string, or null when closed
 * @param closeTime - Closing time as HH:MM string, or null when closed
 * @param isOpen    - Whether the business is open on this day
 * @returns `true` on success, `false` on error
 */
export async function updateBusinessHours(
  clientId: string,
  dayOfWeek: number,
  openTime: string | null,
  closeTime: string | null,
  isOpen: boolean
) {
  try {
    const db = getDb();

    await db
      .insert(businessHours)
      .values({
        clientId,
        dayOfWeek,
        openTime,
        closeTime,
        isOpen,
      })
      .onConflictDoUpdate({
        target: [businessHours.clientId, businessHours.dayOfWeek],
        set: {
          openTime,
          closeTime,
          isOpen,
        },
      });

    console.log(`[Business Hours] Updated - client=${clientId}, day=${dayOfWeek}`);
    return true;
  } catch (error) {
    console.error('[Business Hours] Error updating:', error);
    return false;
  }
}
