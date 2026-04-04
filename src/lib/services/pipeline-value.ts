import { getDb } from '@/db';
import { leads, appointments } from '@/db/schema';
import { and, count, eq, gte, isNotNull, lte, ne, sum } from 'drizzle-orm';

function toPeriodStartUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toPeriodEndUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Calculates the probable pipeline value in cents for a client over a date range.
 *
 * Formula: (appointments booked + reactivated csv_import leads) × avg project value
 * - avgProjectValue defaults to $40,000 (4,000,000 cents) when no confirmed revenue exists
 * - When confirmed revenue exists, uses actual average job value
 */
export async function calculateProbablePipelineValueCents(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const db = getDb();
  const periodStart = toPeriodStartUtc(startDate);
  const periodEnd = toPeriodEndUtc(endDate);

  // COUNT appointments created in the period
  const [appointmentsBookedRow] = await db
    .select({ total: count(appointments.id) })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        gte(appointments.createdAt, periodStart),
        lte(appointments.createdAt, periodEnd)
      )
    );
  const appointmentsBooked = appointmentsBookedRow?.total ?? 0;

  // COUNT csv_import leads that moved past 'new' status during the period (reactivated)
  const [reactivatedResponsesRow] = await db
    .select({ total: count(leads.id) })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.source, 'csv_import'),
        ne(leads.status, 'new'),
        gte(leads.updatedAt, periodStart),
        lte(leads.updatedAt, periodEnd)
      )
    );
  const reactivatedResponses = reactivatedResponsesRow?.total ?? 0;

  // Derive avgProjectValue from all-time won leads (same logic as report-generation)
  const [confirmedRevenueAllTimeRow] = await db
    .select({ total: sum(leads.confirmedRevenue) })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'won'),
        isNotNull(leads.confirmedRevenue)
      )
    );

  const [totalWonJobsRow] = await db
    .select({ total: count(leads.id) })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'won'),
        isNotNull(leads.confirmedRevenue)
      )
    );

  const confirmedRevenueCentsAllTime =
    typeof confirmedRevenueAllTimeRow?.total === 'string' &&
    confirmedRevenueAllTimeRow.total !== null
      ? Number(confirmedRevenueAllTimeRow.total)
      : 0;

  const totalWonJobs = totalWonJobsRow?.total ?? 0;

  // avgProjectValue in cents — default $40,000 = 4,000,000 cents
  const DEFAULT_AVG_PROJECT_VALUE_CENTS = 4_000_000;
  const avgProjectValueCents =
    confirmedRevenueCentsAllTime > 0 && totalWonJobs > 0
      ? Math.round(confirmedRevenueCentsAllTime / totalWonJobs)
      : DEFAULT_AVG_PROJECT_VALUE_CENTS;

  return (appointmentsBooked + reactivatedResponses) * avgProjectValueCents;
}

/**
 * Calculates confirmed revenue in cents for a client over a date range.
 *
 * Sums confirmedRevenue for leads marked 'won' and updated within the period.
 */
export async function calculateConfirmedRevenueCents(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const db = getDb();
  const periodStart = toPeriodStartUtc(startDate);
  const periodEnd = toPeriodEndUtc(endDate);

  const [confirmedRevenueRow] = await db
    .select({ total: sum(leads.confirmedRevenue) })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'won'),
        isNotNull(leads.confirmedRevenue),
        gte(leads.updatedAt, periodStart),
        lte(leads.updatedAt, periodEnd)
      )
    );

  return typeof confirmedRevenueRow?.total === 'string' && confirmedRevenueRow.total !== null
    ? Math.round(Number(confirmedRevenueRow.total))
    : 0;
}
