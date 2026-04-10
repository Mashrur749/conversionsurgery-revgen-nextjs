import { getDb } from '@/db';
import { jobs, revenueEvents, leads, clientServices, invoices, clientMemberships, people } from '@/db/schema';
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
  description?: string,
  serviceId?: string
): Promise<string> {
  const db = getDb();

  const [job] = await db
    .insert(jobs)
    .values({
      leadId,
      clientId,
      serviceId: serviceId || undefined,
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
  status: 'lead' | 'quoted' | 'won' | 'in_progress' | 'lost' | 'completed',
  data?: {
    quoteAmount?: number;
    finalAmount?: number;
    lostReason?: string;
    startDate?: string; // YYYY-MM-DD, used when transitioning to in_progress
  }
): Promise<void> {
  const db = getDb();

  // Validate status transitions
  const [currentJob] = await db
    .select({ status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!currentJob) throw new Error('Job not found');

  const VALID_TRANSITIONS: Record<string, string[]> = {
    lead: ['quoted', 'lost'],
    quoted: ['won', 'lost'],
    won: ['in_progress', 'completed', 'lost'],
    in_progress: ['completed', 'lost'],
    lost: [],
    completed: [],
  };

  const allowed = VALID_TRANSITIONS[currentJob.status ?? 'lead'] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(
      `Invalid status transition: ${currentJob.status} → ${status}. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }

  const updates: Record<string, Date | string | number | undefined> = { status, updatedAt: new Date() };

  if (status === 'quoted' && data?.quoteAmount) {
    updates.quoteAmount = data.quoteAmount;
  }

  if (status === 'won') {
    updates.wonAt = new Date();
    if (data?.finalAmount) updates.finalAmount = data.finalAmount;
  }

  if (status === 'in_progress') {
    updates.startDate = data?.startDate ?? new Date().toISOString().split('T')[0];
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

  // Track funnel event with AI attribution for outcome-bearing status changes
  if (job.leadId && job.clientId) {
    try {
      const { trackFunnelEvent } = await import('@/lib/services/funnel-tracking');
      if (status === 'won') {
        await trackFunnelEvent({
          clientId: job.clientId,
          leadId: job.leadId,
          eventType: 'job_won',
          valueCents: data?.finalAmount || job.quoteAmount || undefined,
        });
      } else if (status === 'in_progress') {
        await trackFunnelEvent({
          clientId: job.clientId,
          leadId: job.leadId,
          eventType: 'job_started',
          eventData: { startDate: updates.startDate },
        });
      } else if (status === 'lost') {
        await trackFunnelEvent({
          clientId: job.clientId,
          leadId: job.leadId,
          eventType: 'job_lost',
          eventData: { lostReason: data?.lostReason },
        });
      } else if (status === 'quoted') {
        await trackFunnelEvent({
          clientId: job.clientId,
          leadId: job.leadId,
          eventType: 'quote_sent',
          valueCents: data?.quoteAmount,
        });
      }
    } catch {} // Never block revenue operations on tracking failure
  }
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

  // Track funnel event with AI attribution
  if (job.leadId && job.clientId) {
    try {
      const { trackPaymentReceived } = await import(
        '@/lib/services/funnel-tracking'
      );
      await trackPaymentReceived(job.clientId, job.leadId, amount);
    } catch {} // Never block payment recording on tracking failure
  }
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

export interface ServiceRevenueBreakdown {
  serviceId: string | null;
  serviceName: string;
  leadCount: number;
  wonCount: number;
  totalPipeline: number;
  totalWonValue: number;
}

/**
 * Revenue breakdown by service type for a client.
 * Groups jobs by their matched service and computes pipeline + won values.
 */
export async function getRevenueByService(
  clientId: string,
  startDate?: Date
): Promise<ServiceRevenueBreakdown[]> {
  const db = getDb();
  const dateFilter = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      serviceId: jobs.serviceId,
      serviceName: clientServices.name,
      leadCount: sql<number>`count(*)`,
      wonCount: sql<number>`count(*) filter (where ${jobs.status} = 'won' or ${jobs.status} = 'completed')`,
      totalPipeline: sql<number>`coalesce(sum(coalesce(${jobs.finalAmount}, ${jobs.quoteAmount}, 0)), 0)`,
      totalWonValue: sql<number>`coalesce(sum(coalesce(${jobs.finalAmount}, ${jobs.quoteAmount}, 0)) filter (where ${jobs.status} = 'won' or ${jobs.status} = 'completed'), 0)`,
    })
    .from(jobs)
    .leftJoin(clientServices, eq(jobs.serviceId, clientServices.id))
    .where(and(
      eq(jobs.clientId, clientId),
      gte(jobs.createdAt, dateFilter)
    ))
    .groupBy(jobs.serviceId, clientServices.name);

  return rows.map(r => ({
    serviceId: r.serviceId,
    serviceName: r.serviceName || 'Unclassified',
    leadCount: Number(r.leadCount),
    wonCount: Number(r.wonCount),
    totalPipeline: Number(r.totalPipeline),
    totalWonValue: Number(r.totalWonValue),
  }));
}

/**
 * Creates a deposit invoice for a job.
 * The invoice has milestoneType 'deposit' and is linked to the job.
 * @param jobId - The job ID this deposit is for
 * @param depositAmountCents - Deposit amount in cents
 * @param clientId - The client ID
 * @param leadId - The lead ID
 * @returns The created invoice ID
 */
export async function createDepositInvoice(
  jobId: string,
  depositAmountCents: number,
  clientId: string,
  leadId: string
): Promise<string> {
  const db = getDb();

  const [invoice] = await db
    .insert(invoices)
    .values({
      jobId,
      clientId,
      leadId,
      invoiceNumber: `DEP-${Date.now()}`,
      totalAmount: depositAmountCents,
      remainingAmount: depositAmountCents,
      paidAmount: 0,
      milestoneType: 'deposit',
      status: 'pending',
      dueDate: new Date().toISOString().split('T')[0],
    })
    .returning();

  return invoice.id;
}

export interface MemberJobStats {
  totalJobs: number;
  wonJobs: number;
  completedJobs: number;
  totalRevenueCents: number;
}

/**
 * Retrieves job performance stats for a specific team member on a client.
 * @param clientId - The client ID (used to scope results to one client)
 * @param membershipId - The clientMemberships.id of the assigned member
 * @param since - Optional date filter on jobs.createdAt
 */
export async function getJobsByMember(
  clientId: string,
  membershipId: string,
  since?: Date
): Promise<MemberJobStats> {
  const db = getDb();

  const conditions = [
    eq(jobs.clientId, clientId),
    eq(jobs.assignedMembershipId, membershipId),
  ];
  if (since) {
    conditions.push(gte(jobs.createdAt, since));
  }

  const [stats] = await db
    .select({
      totalJobs: sql<number>`count(*)`,
      wonJobs: sql<number>`count(*) filter (where ${jobs.status} = 'won' or ${jobs.status} = 'completed')`,
      completedJobs: sql<number>`count(*) filter (where ${jobs.status} = 'completed')`,
      totalRevenueCents: sql<number>`coalesce(sum(coalesce(${jobs.finalAmount}, ${jobs.quoteAmount}, 0)) filter (where ${jobs.status} = 'won' or ${jobs.status} = 'completed'), 0)`,
    })
    .from(jobs)
    .where(and(...conditions));

  return {
    totalJobs: Number(stats?.totalJobs || 0),
    wonJobs: Number(stats?.wonJobs || 0),
    completedJobs: Number(stats?.completedJobs || 0),
    totalRevenueCents: Number(stats?.totalRevenueCents || 0),
  };
}

export interface TeamMemberPerformance {
  membershipId: string;
  memberName: string;
  memberRole: string | null;
  totalJobs: number;
  wonJobs: number;
  completedJobs: number;
  revenueCents: number;
}

/**
 * Retrieves per-member job performance for all active team members on a client.
 * Members with zero assigned jobs are omitted from the result.
 * @param clientId - The client ID
 * @param since - Optional date filter on jobs.createdAt
 */
export async function getTeamPerformanceSummary(
  clientId: string,
  since?: Date
): Promise<TeamMemberPerformance[]> {
  const db = getDb();

  // Fetch all active memberships for this client in a single query
  const activeMembers = await db
    .select({
      id: clientMemberships.id,
      name: people.name,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(and(
      eq(clientMemberships.clientId, clientId),
      eq(clientMemberships.isActive, true)
    ));

  if (activeMembers.length === 0) return [];

  // Fetch per-member stats in parallel
  const results = await Promise.all(
    activeMembers.map(async (member) => {
      const stats = await getJobsByMember(clientId, member.id, since);
      return {
        membershipId: member.id,
        memberName: member.name,
        memberRole: null as string | null, // role is template-based in new auth model
        totalJobs: stats.totalJobs,
        wonJobs: stats.wonJobs,
        completedJobs: stats.completedJobs,
        revenueCents: stats.totalRevenueCents,
      };
    })
  );

  // Omit members with no assigned jobs
  return results.filter((r) => r.totalJobs > 0);
}

/**
 * Creates the final invoice for a job, chained from a deposit invoice.
 * Reads the deposit invoice and job to compute the remaining balance
 * (job.finalAmount - deposit invoice.totalAmount).
 * @param depositInvoiceId - The deposit invoice ID to chain from
 * @returns The created final invoice ID
 */
export async function createFinalInvoice(depositInvoiceId: string): Promise<string> {
  const db = getDb();

  // Fetch deposit invoice
  const [depositInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, depositInvoiceId))
    .limit(1);

  if (!depositInvoice) throw new Error('Deposit invoice not found');
  if (!depositInvoice.jobId) throw new Error('Deposit invoice is not linked to a job');

  // Fetch the job to get final amount
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, depositInvoice.jobId))
    .limit(1);

  if (!job) throw new Error('Job not found for deposit invoice');

  const depositPaid = depositInvoice.totalAmount ?? 0;
  const totalJobValue = job.finalAmount ?? job.quoteAmount ?? depositPaid;
  const remainingCents = Math.max(0, totalJobValue - depositPaid);

  const [finalInvoice] = await db
    .insert(invoices)
    .values({
      jobId: depositInvoice.jobId,
      clientId: depositInvoice.clientId,
      leadId: depositInvoice.leadId,
      invoiceNumber: `FIN-${Date.now()}`,
      totalAmount: remainingCents,
      remainingAmount: remainingCents,
      paidAmount: 0,
      milestoneType: 'final',
      parentInvoiceId: depositInvoiceId,
      status: 'pending',
      dueDate: new Date().toISOString().split('T')[0],
    })
    .returning();

  return finalInvoice.id;
}
