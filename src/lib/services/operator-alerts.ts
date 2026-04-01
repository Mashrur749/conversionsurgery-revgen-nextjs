import twilio from 'twilio';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ---------------------------------------------------------------------------
// Deduplication — in-memory, per process
// ---------------------------------------------------------------------------

const recentAlerts = new Map<string, number>();
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isDuplicate(subject: string): boolean {
  const lastSent = recentAlerts.get(subject);
  if (lastSent === undefined) return false;
  return Date.now() - lastSent < DEDUP_WINDOW_MS;
}

function markSent(subject: string): void {
  recentAlerts.set(subject, Date.now());
}

// ---------------------------------------------------------------------------
// Helpers — read settings
// ---------------------------------------------------------------------------

async function getOperatorPhone(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'operator_phone'))
    .limit(1);
  return row?.value ?? null;
}

async function getAgencyTwilioNumber(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'agency_twilio_number'))
    .limit(1);
  return row?.value ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an SMS alert to the operator's personal phone.
 *
 * - Reads `operator_phone` from system_settings — skips silently if not set.
 * - Reads agency Twilio number as the sender (same pattern as agency-communication.ts).
 * - Deduplicates by subject: at most one alert per subject per hour.
 */
export async function alertOperator(subject: string, detail: string): Promise<void> {
  if (isDuplicate(subject)) {
    console.log(`[OperatorAlert] Suppressed duplicate alert: "${subject}"`);
    return;
  }

  const operatorPhone = await getOperatorPhone();
  if (!operatorPhone) {
    console.warn('[OperatorAlert] operator_phone not configured in system_settings — skipping alert');
    return;
  }

  const agencyNumber = await getAgencyTwilioNumber();
  if (!agencyNumber) {
    console.warn('[OperatorAlert] agency_twilio_number not configured in system_settings — skipping alert');
    return;
  }

  const body = `[ConversionSurgery] ${subject}\n\n${detail}`;

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );

    await client.messages.create({
      to: operatorPhone,
      from: agencyNumber,
      body,
    });

    markSent(subject);
    console.log(`[OperatorAlert] Sent alert to operator: "${subject}"`);
  } catch (error) {
    logSanitizedConsoleError('[OperatorAlert] Failed to send operator alert:', error, { subject });
  }
}
