import { getDb } from '@/db';
import { jobs, revenueEvents, leads } from '@/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';

/**
 * Creates a new job from a lead and records the revenue event.
 * @param leadId - The lead ID to convert to a job
 * @param clientId - The client ID for the job
 * @param description - Optional job description
 * @returns The newly created job ID
 */
export async function createJobFromLead(
  leadId: string,
  clientId: string,
  description?: string
): Promise<string> {
  const db = getDb();

  const [job] = await db
    .insert(jobs)
    .values({
      leadId,
      clientId,
      status: 'lead',
      description,
    })
    .returning();

  await db.insert(revenueEvents).values({
    jobId: job.id,
    clientId,
    eventType: 'job_created',
  });

  return job.id;
}

/**
 * Updates a job's status and records the revenue event.
 * @param jobId - The job ID to update
 * @param status - The new status for the job
 * @param data - Optional additional data (quote amount, final amount, lost reason)
 */
export async function updateJobStatus(
  jobId: string,
  status: 'lead' | 'quoted' | 'won' | 'lost' | 'completed',
  data?: {
    quoteAmount?: number;
    finalAmount?: number;
    lostReason?: string;
  }
): Promise<void> {
  const db = getDb();
  const updates: Record<string, Date | string | number | undefined> = { status, updatedAt: new Date() };

  if (status === 'quoted' && data?.quoteAmount) {
    updates.quoteAmount = data.quoteAmount;
  }

  if (status === 'won') {
    updates.wonAt = new Date();
    if (data?.finalAmount) updates.finalAmount = data.finalAmount;
  }

  if (status === 'lost') {
    updates.lostAt = new Date();
    updates.lostReason = data?.lostReason;
  }

  if (status === 'completed') {
    updates.completedDate = new Date().toISOString().split('T')[0];
  }

  const [job] = await db
    .update(jobs)
    .set(updates)
    .where(eq(jobs.id, jobId))
    .returning();

  await db.insert(revenueEvents).values({
    jobId,
    clientId: job.clientId!,
    eventType: `status_${status}`,
    amount: status === 'won' ? (data?.finalAmount || job.quoteAmount) : undefined,
  });
}

/**
 * Records a payment for a job and updates the paid amount.
 * @param jobId - The job ID to record payment for
 * @param amount - The payment amount in cents
 * @param notes - Optional payment notes
 */
export async function recordPayment(
  jobId: string,
  amount: number,
  notes?: string
): Promise<void> {
  const db = getDb();

  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) throw new Error('Job not found');

  const newPaidAmount = (job.paidAmount || 0) + amount;

  await db
    .update(jobs)
    .set({ paidAmount: newPaidAmount, updatedAt: new Date() })
    .where(eq(jobs.id, jobId));

  await db.insert(revenueEvents).values({
    jobId,
    clientId: job.clientId!,
    eventType: 'payment_received',
    amount,
    notes,
  });
}

export interface RevenueStats {
  period: string;
  totalLeads: number;
  totalQuotes: number;
  totalWon: number;
  totalLost: number;
  totalCompleted: number;
  conversionRate: number;
  totalQuoteValue: number;
  totalWonValue: number;
  totalPaid: number;
  avgJobValue: number;
}

/**
 * Retrieves revenue statistics for a client within a date range.
 * @param clientId - The client ID to get stats for
 * @param startDate - Optional start date (defaults to 30 days ago)
 * @returns Revenue statistics including leads, quotes, wins, and values
 */
export async function getRevenueStats(
  clientId: string,
  startDate?: Date
): Promise<RevenueStats> {
  const db = getDb();
  const dateFilter = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({
      totalLeads: sql<number>`count(*) filter (where status = 'lead')`,
      totalQuotes: sql<number>`count(*) filter (where status = 'quoted')`,
      totalWon: sql<number>`count(*) filter (where status = 'won' or status = 'completed')`,
      totalLost: sql<number>`count(*) filter (where status = 'lost')`,
      totalCompleted: sql<number>`count(*) filter (where status = 'completed')`,
      totalQuoteValue: sql<number>`coalesce(sum(quote_amount) filter (where status = 'quoted'), 0)`,
      totalWonValue: sql<number>`coalesce(sum(coalesce(final_amount, quote_amount)) filter (where status = 'won' or status = 'completed'), 0)`,
      totalPaid: sql<number>`coalesce(sum(paid_amount), 0)`,
    })
    .from(jobs)
    .where(and(
      eq(jobs.clientId, clientId),
      gte(jobs.createdAt, dateFilter)
    ));

  const totalLeads = Number(stats?.totalLeads || 0);
  const totalWon = Number(stats?.totalWon || 0);

  return {
    period: '30 days',
    totalLeads,
    totalQuotes: Number(stats?.totalQuotes || 0),
    totalWon,
    totalLost: Number(stats?.totalLost || 0),
    totalCompleted: Number(stats?.totalCompleted || 0),
    conversionRate: totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0,
    totalQuoteValue: Number(stats?.totalQuoteValue || 0),
    totalWonValue: Number(stats?.totalWonValue || 0),
    totalPaid: Number(stats?.totalPaid || 0),
    avgJobValue: totalWon > 0 ? Math.round(Number(stats?.totalWonValue || 0) / totalWon) : 0,
  };
}

/**
 * Retrieves recent jobs for a client with lead information.
 * @param clientId - The client ID to get jobs for
 * @param limit - Maximum number of jobs to return (default 10)
 * @returns Array of jobs with associated lead data
 */
export async function getRecentJobs(clientId: string, limit: number = 10) {
  const db = getDb();

  return db
    .select({
      job: jobs,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(jobs)
    .leftJoin(leads, eq(jobs.leadId, leads.id))
    .where(eq(jobs.clientId, clientId))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}
