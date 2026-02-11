import { getDb, usageAlerts, apiUsageMonthly, clients } from '@/db';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentMonthUsage } from './usage-tracking';
import { sendSMS } from './twilio';

interface AlertThresholds {
  monthlyWarning: number;  // cents
  monthlyCritical: number; // cents
  spikePercent: number;    // e.g., 50 = 50% increase
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  monthlyWarning: 5000,    // $50
  monthlyCritical: 10000,  // $100
  spikePercent: 50,        // 50% increase from previous month
};

/**
 * Check a client's current month usage against thresholds and create alerts.
 *
 * Evaluates three alert conditions:
 * 1. Absolute cost thresholds (warning / critical)
 * 2. Month-over-month spend spike percentage
 * 3. Projected overage based on daily average
 *
 * Duplicate alerts of the same type and severity within 24 hours are skipped.
 *
 * @param clientId   - UUID of the client to check
 * @param thresholds - Optional custom thresholds (defaults to $50 warning, $100 critical, 50% spike)
 */
export async function checkUsageAlerts(
  clientId: string,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Promise<void> {
  const usage = await getCurrentMonthUsage(clientId);

  // Check threshold alerts
  if (usage.costCents >= thresholds.monthlyCritical) {
    await createAlert({
      clientId,
      alertType: 'threshold',
      severity: 'critical',
      message: `Monthly usage has exceeded $${(thresholds.monthlyCritical / 100).toFixed(2)}`,
      details: {
        currentCost: usage.costCents,
        threshold: thresholds.monthlyCritical,
      },
    });
  } else if (usage.costCents >= thresholds.monthlyWarning) {
    await createAlert({
      clientId,
      alertType: 'threshold',
      severity: 'warning',
      message: `Monthly usage has exceeded $${(thresholds.monthlyWarning / 100).toFixed(2)}`,
      details: {
        currentCost: usage.costCents,
        threshold: thresholds.monthlyWarning,
      },
    });
  }

  // Check for spikes
  const db = getDb();
  const now = new Date();
  const prevMonthStr = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  const [prevMonth] = await db
    .select()
    .from(apiUsageMonthly)
    .where(and(
      eq(apiUsageMonthly.clientId, clientId),
      eq(apiUsageMonthly.month, prevMonthStr)
    ))
    .limit(1);

  if (prevMonth && prevMonth.totalCostCents > 0) {
    const percentChange = ((usage.costCents - prevMonth.totalCostCents) / prevMonth.totalCostCents) * 100;

    if (percentChange >= thresholds.spikePercent) {
      await createAlert({
        clientId,
        alertType: 'spike',
        severity: percentChange >= 100 ? 'critical' : 'warning',
        message: `Usage is ${Math.round(percentChange)}% higher than last month`,
        details: {
          currentCost: usage.costCents,
          previousCost: prevMonth.totalCostCents,
          percentChange: Math.round(percentChange),
        },
      });
    }
  }

  // Check projected overage
  if (usage.projectedCostCents >= thresholds.monthlyCritical * 1.5) {
    await createAlert({
      clientId,
      alertType: 'anomaly',
      severity: 'warning',
      message: `Projected monthly cost: $${(usage.projectedCostCents / 100).toFixed(2)}`,
      details: {
        currentCost: usage.costCents,
        projectedCost: usage.projectedCostCents,
      },
    });
  }
}

/**
 * Create a usage alert with 24-hour deduplication.
 * Sends an SMS to the admin phone for critical-severity alerts.
 */
async function createAlert(params: {
  clientId: string;
  alertType: string;
  severity: string;
  message: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();

  // Check for recent duplicate alert (same type within 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [existing] = await db
    .select()
    .from(usageAlerts)
    .where(and(
      eq(usageAlerts.clientId, params.clientId),
      eq(usageAlerts.alertType, params.alertType),
      eq(usageAlerts.severity, params.severity)
    ))
    .orderBy(desc(usageAlerts.createdAt))
    .limit(1);

  if (existing && existing.createdAt && existing.createdAt > oneDayAgo) {
    console.log(`[UsageAlerts] Skipping duplicate ${params.alertType}/${params.severity} alert for client ${params.clientId}`);
    return;
  }

  // Create alert
  await db.insert(usageAlerts).values({
    clientId: params.clientId,
    alertType: params.alertType,
    severity: params.severity,
    message: params.message,
    details: params.details,
  });

  // Notify admin for critical alerts
  if (params.severity === 'critical') {
    await notifyAdminOfAlert(params.clientId, params.message);
  }
}

/**
 * Notify the admin via SMS about a critical usage alert.
 */
async function notifyAdminOfAlert(clientId: string, message: string): Promise<void> {
  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const adminPhone = process.env.ADMIN_PHONE_NUMBER;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!adminPhone || !twilioNumber) {
    console.warn('[UsageAlerts] Missing ADMIN_PHONE_NUMBER or TWILIO_PHONE_NUMBER env vars, skipping SMS notification');
    return;
  }

  try {
    await sendSMS(
      adminPhone,
      twilioNumber,
      `Usage Alert for ${client?.businessName || 'Unknown'}: ${message}`
    );
  } catch (error) {
    console.error(`[UsageAlerts] Failed to send SMS notification for client ${clientId}:`, error);
  }
}

/**
 * Get all unacknowledged usage alerts for a client, newest first.
 *
 * @param clientId - UUID of the client
 * @returns Array of unacknowledged alert records
 */
export async function getUnacknowledgedAlerts(clientId: string) {
  const db = getDb();
  return db
    .select()
    .from(usageAlerts)
    .where(and(
      eq(usageAlerts.clientId, clientId),
      eq(usageAlerts.acknowledged, false)
    ))
    .orderBy(desc(usageAlerts.createdAt));
}

/**
 * Mark a usage alert as acknowledged.
 *
 * @param alertId - UUID of the alert to acknowledge
 * @param userId  - UUID of the admin user acknowledging the alert
 */
export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(usageAlerts)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    })
    .where(eq(usageAlerts.id, alertId));
}

/**
 * Run usage alert checks for every active client.
 *
 * Intended to be called from a cron job. Errors for individual
 * clients are logged but do not stop processing of remaining clients.
 */
export async function checkAllClientAlerts(): Promise<void> {
  const db = getDb();
  const allClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.status, 'active'));

  for (const client of allClients) {
    try {
      await checkUsageAlerts(client.id);
    } catch (error) {
      console.error(`[UsageAlerts] Error checking alerts for client ${client.id}:`, error);
    }
  }
}
