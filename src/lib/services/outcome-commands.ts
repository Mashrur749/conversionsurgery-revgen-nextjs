import { eq, and, notInArray, sql, desc, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { leads, scheduledMessages, appointments, auditLog } from '@/db/schema';
import { parseOutcomeCommand } from './outcome-command-parser';
import { resolveLeadByRefCode, ensureOutcomeRefCode } from './outcome-ref-codes';
import { startReviewRequest } from '@/lib/automations/review-request';

export interface OutcomeCommandResult {
  handled: boolean;
  success: boolean;
  message: string;
  leadId?: string;
}

const TERMINAL_STATUSES = ['won', 'lost', 'completed', 'opted_out'];

/**
 * Handle WON/LOST/WINS SMS commands from contractors.
 *
 * Returns { handled: false } if the message isn't an outcome command.
 * Returns { handled: true, success: true/false, message } otherwise.
 */
export async function handleOutcomeCommand(params: {
  clientId: string;
  messageBody: string;
}): Promise<OutcomeCommandResult> {
  const { clientId, messageBody } = params;
  const parsed = parseOutcomeCommand(messageBody);

  if (!parsed.matched) {
    return { handled: false, success: false, message: '' };
  }

  if (parsed.action === 'wins') {
    return handleWinsCommand(clientId);
  }

  if (parsed.action === 'won') {
    return handleWonCommand(clientId, parsed.refCode, parsed.revenueDollars);
  }

  if (parsed.action === 'lost') {
    return handleLostCommand(clientId, parsed.refCode);
  }

  return { handled: false, success: false, message: '' };
}

async function getClientAvgProjectValue(clientId: string): Promise<number> {
  const db = getDb();

  // Check if client has confirmed wins to compute average
  const wonLeads = await db
    .select({ confirmedRevenue: leads.confirmedRevenue })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'won'),
        isNotNull(leads.confirmedRevenue)
      )
    )
    .limit(50);

  const revenues = wonLeads
    .map((l) => l.confirmedRevenue)
    .filter((r): r is number => r !== null && r > 0);

  if (revenues.length >= 2) {
    const avg = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
    return Math.round(avg);
  }

  // Fallback: $35,000 (mid-range of ICP $25-60K projects), stored in cents
  return 3500000;
}

async function cancelActiveSequences(clientId: string, leadId: string): Promise<void> {
  const db = getDb();
  await db
    .update(scheduledMessages)
    .set({ cancelled: true })
    .where(
      and(
        eq(scheduledMessages.clientId, clientId),
        eq(scheduledMessages.leadId, leadId),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      )
    );
}

async function handleWonCommand(
  clientId: string,
  refCode: string,
  revenueDollars?: number
): Promise<OutcomeCommandResult> {
  const lead = await resolveLeadByRefCode(clientId, refCode);

  if (!lead) {
    return {
      handled: true,
      success: false,
      message: `No lead found with ref ${refCode}. Text WINS to see your recent leads.`,
    };
  }

  if (TERMINAL_STATUSES.includes(lead.status ?? '')) {
    return {
      handled: true,
      success: false,
      message: `${lead.name ?? 'Lead'} is already marked as ${lead.status}. Ref ${refCode}.`,
    };
  }

  const db = getDb();

  // Compute revenue in cents
  const revenueCents = revenueDollars
    ? revenueDollars * 100
    : await getClientAvgProjectValue(clientId);

  const revenueDollarsDisplay = Math.round(revenueCents / 100);

  // Update lead status + revenue
  await db
    .update(leads)
    .set({
      status: 'won',
      confirmedRevenue: revenueCents,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, lead.id));

  // Cancel active sequences
  await cancelActiveSequences(clientId, lead.id);

  // Log to audit
  await db.insert(auditLog).values({
    action: 'lead_outcome_won',
    resourceType: 'lead',
    resourceId: lead.id,
    clientId,
    metadata: {
      source: 'sms_command',
      refCode,
      revenueCents,
      revenueDollars: revenueDollarsDisplay,
      explicit: !!revenueDollars,
    },
  });

  // Track funnel event for AI attribution
  try {
    const { trackFunnelEvent } = await import('@/lib/services/funnel-tracking');
    await trackFunnelEvent({
      clientId,
      leadId: lead.id,
      eventType: 'job_won',
      valueCents: revenueCents,
    });
  } catch {
    // Attribution tracking is non-fatal
  }

  // Trigger review request (non-blocking)
  startReviewRequest({ leadId: lead.id, clientId }).catch(() => {
    // Review request is non-fatal
  });

  const displayName = lead.name ?? 'Lead';
  return {
    handled: true,
    success: true,
    leadId: lead.id,
    message: `Marked ${displayName} as WON ($${revenueDollarsDisplay.toLocaleString()}). Review request scheduled. Ref ${refCode}.`,
  };
}

async function handleLostCommand(
  clientId: string,
  refCode: string
): Promise<OutcomeCommandResult> {
  const lead = await resolveLeadByRefCode(clientId, refCode);

  if (!lead) {
    return {
      handled: true,
      success: false,
      message: `No lead found with ref ${refCode}. Text WINS to see your recent leads.`,
    };
  }

  if (TERMINAL_STATUSES.includes(lead.status ?? '')) {
    return {
      handled: true,
      success: false,
      message: `${lead.name ?? 'Lead'} is already marked as ${lead.status}. Ref ${refCode}.`,
    };
  }

  const db = getDb();

  // Update lead status
  await db
    .update(leads)
    .set({ status: 'lost', updatedAt: new Date() })
    .where(eq(leads.id, lead.id));

  // Cancel active sequences
  await cancelActiveSequences(clientId, lead.id);

  // Log to audit
  await db.insert(auditLog).values({
    action: 'lead_outcome_lost',
    resourceType: 'lead',
    resourceId: lead.id,
    clientId,
    metadata: { source: 'sms_command', refCode },
  });

  // Track funnel event
  try {
    const { trackFunnelEvent } = await import('@/lib/services/funnel-tracking');
    await trackFunnelEvent({
      clientId,
      leadId: lead.id,
      eventType: 'job_lost',
    });
  } catch {
    // Attribution tracking is non-fatal
  }

  const displayName = lead.name ?? 'Lead';
  return {
    handled: true,
    success: true,
    leadId: lead.id,
    message: `Marked ${displayName} as LOST. Follow-up cancelled. Ref ${refCode}.`,
  };
}

async function handleWinsCommand(clientId: string): Promise<OutcomeCommandResult> {
  const db = getDb();

  // Find recent leads with pending outcomes — those with appointments that aren't terminal
  const pendingLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      projectType: leads.projectType,
      outcomeRefCode: leads.outcomeRefCode,
      clientId: leads.clientId,
    })
    .from(leads)
    .innerJoin(appointments, eq(appointments.leadId, leads.id))
    .where(
      and(
        eq(leads.clientId, clientId),
        notInArray(leads.status, TERMINAL_STATUSES)
      )
    )
    .groupBy(leads.id, leads.name, leads.projectType, leads.outcomeRefCode, leads.clientId)
    .orderBy(desc(sql`max(${appointments.appointmentDate})`))
    .limit(10);

  if (pendingLeads.length === 0) {
    return {
      handled: true,
      success: true,
      message: 'No leads with pending outcomes right now.',
    };
  }

  // Ensure all leads have ref codes
  const lines: string[] = [];
  for (let i = 0; i < pendingLeads.length; i++) {
    const lead = pendingLeads[i];
    const refCode = await ensureOutcomeRefCode(lead.id, lead.clientId);
    const name = lead.name ?? 'Unknown';
    const project = lead.projectType ? ` (${lead.projectType})` : '';
    lines.push(`${i + 1}. ${name}${project} Ref ${refCode}`);
  }

  const message = `Recent leads:\n${lines.join('\n')}\nReply WON [ref] or LOST [ref]`;

  return {
    handled: true,
    success: true,
    message,
  };
}
