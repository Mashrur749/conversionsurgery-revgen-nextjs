import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { getAgencyField } from '@/lib/services/agency-settings';
import { sendInternalSMS } from '@/lib/compliance/compliance-gateway';

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
  return await getAgencyField('operatorPhone') ?? null;
}

async function getAgencyTwilioNumber(): Promise<string | null> {
  return await getAgencyField('twilioNumber') ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an SMS alert to the operator's personal phone.
 *
 * - Reads `operator_phone` from agencies table — skips silently if not set.
 * - Reads agency Twilio number as the sender (same pattern as agency-communication.ts).
 * - Deduplicates by subject: at most one alert per subject per hour.
 * - Routes through `sendInternalSMS` (compliance gateway) so kill switch,
 *   opt-out, and platform DNC sentinels apply. Sentinel blocks are logged
 *   loudly because an operator alert being suppressed indicates misconfiguration.
 */
export async function alertOperator(subject: string, detail: string): Promise<void> {
  if (isDuplicate(subject)) {
    console.log(`[OperatorAlert] Suppressed duplicate alert: "${subject}"`);
    return;
  }

  const operatorPhone = await getOperatorPhone();
  if (!operatorPhone) {
    console.warn('[OperatorAlert] operator_phone not configured — skipping alert');
    return;
  }

  const agencyNumber = await getAgencyTwilioNumber();
  if (!agencyNumber) {
    console.warn('[OperatorAlert] agency twilio number not configured — skipping alert');
    return;
  }

  const body = `[ConversionSurgery] ${subject}\n\n${detail}`;

  try {
    const result = await sendInternalSMS({
      to: operatorPhone,
      from: agencyNumber,
      body,
      subject,
    });

    if (result.blocked) {
      // Operator alert suppressed by sentinel — surface loudly. The operator
      // must know an alert was withheld (probably misconfiguration, e.g.
      // operator phone accidentally on opt-out / DNC, or kill switch on).
      logSanitizedConsoleError(
        '[OperatorAlert] Sentinel blocked operator alert',
        new Error(`blocked: ${result.blockReason ?? 'unknown'}`),
        { subject, blockReason: result.blockReason },
      );
      return;
    }

    markSent(subject);
    console.log(`[OperatorAlert] Sent alert to operator: "${subject}"`);
  } catch (error) {
    logSanitizedConsoleError('[OperatorAlert] Failed to send operator alert:', error, { subject });
  }
}
