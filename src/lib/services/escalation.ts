import { getDb } from '@/db';
import {
  escalationQueue,
  escalationRules,
  leadContext,
  teamMembers,
  leads,
  clients,
} from '@/db';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import { sendTrackedSMS } from '@/lib/clients/twilio-tracked';
import { sendEmail } from '@/lib/services/resend';

interface CreateEscalationParams {
  leadId: string;
  clientId: string;
  reason: string;
  reasonDetails?: string;
  triggerMessageId?: string;
  priority?: number;
  conversationSummary?: string;
  suggestedResponse?: string;
}

/**
 * Create a new escalation and notify appropriate team members
 */
export async function createEscalation(params: CreateEscalationParams): Promise<string> {
  const {
    leadId,
    clientId,
    reason,
    reasonDetails,
    triggerMessageId,
    priority = 3,
    conversationSummary,
    suggestedResponse,
  } = params;

  const db = getDb();

  // Check for existing pending escalation for this lead
  const [existing] = await db
    .select()
    .from(escalationQueue)
    .where(and(
      eq(escalationQueue.leadId, leadId),
      eq(escalationQueue.status, 'pending')
    ))
    .limit(1);

  if (existing) {
    // Update priority if new one is higher
    if (priority < existing.priority) {
      await db.update(escalationQueue).set({
        priority,
        reasonDetails: reasonDetails || existing.reasonDetails,
        updatedAt: new Date(),
      }).where(eq(escalationQueue.id, existing.id));
    }
    return existing.id;
  }

  // Find matching rule for assignment
  const rules = await db
    .select()
    .from(escalationRules)
    .where(and(
      eq(escalationRules.clientId, clientId),
      eq(escalationRules.enabled, true)
    ))
    .orderBy(escalationRules.priority);

  let assignTo: string | null = null;
  let notifyVia: string[] = ['sms'];
  let autoResponse: string | null = null;

  for (const rule of rules) {
    const conditions = rule.conditions as any;
    const action = rule.action as any;

    // Check if rule matches
    const reasonMatches = conditions.triggers?.some((t: any) =>
      t.type === 'keyword' && reason.toLowerCase().includes(t.value?.toString().toLowerCase())
    );

    if (reasonMatches || conditions.triggers?.some((t: any) => t.type === reason)) {
      assignTo = action.assignTo || null;
      notifyVia = action.notifyVia || ['sms'];
      autoResponse = action.autoResponse || null;

      // Update rule stats
      await db.update(escalationRules).set({
        timesTriggered: (rule.timesTriggered || 0) + 1,
        lastTriggeredAt: new Date(),
      }).where(eq(escalationRules.id, rule.id));

      break;
    }
  }

  // Resolve assignment
  let assignedTo: string | null = null;

  if (assignTo === 'round_robin') {
    // Get next available team member
    const members = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.clientId, clientId),
        eq(teamMembers.isActive, true)
      ));

    if (members.length > 0) {
      // Simple round-robin based on who has fewest pending
      const withCounts = await Promise.all(members.map(async (m) => {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(escalationQueue)
          .where(and(
            eq(escalationQueue.assignedTo, m.id),
            eq(escalationQueue.status, 'pending')
          ));
        return { ...m, pendingCount: Number(result?.count) || 0 };
      }));

      withCounts.sort((a, b) => a.pendingCount - b.pendingCount);
      assignedTo = withCounts[0]?.id || null;
    }
  } else if (assignTo) {
    assignedTo = assignTo;
  }

  // Calculate SLA deadline (default 1 hour for priority 1-2, 4 hours for others)
  const slaHours = priority <= 2 ? 1 : 4;
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  // Create escalation
  const [escalation] = await db.insert(escalationQueue).values({
    leadId,
    clientId,
    reason: reason as any,
    reasonDetails,
    triggerMessageId,
    priority,
    conversationSummary,
    suggestedResponse,
    status: assignedTo ? 'assigned' : 'pending',
    assignedTo,
    assignedAt: assignedTo ? new Date() : null,
    slaDeadline,
  }).returning();

  // Update lead context
  await db.update(leadContext).set({
    stage: 'escalated',
    stageChangedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(leadContext.leadId, leadId));

  // Send notifications
  await notifyEscalation(escalation.id, assignedTo, notifyVia);

  // Send auto-response if configured
  if (autoResponse) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);

    if (lead && client?.twilioNumber) {
      try {
        await sendTrackedSMS({
          clientId,
          to: lead.phone,
          from: client.twilioNumber,
          body: autoResponse,
          leadId,
        });
      } catch (error) {
        console.error('[Escalation] Failed to send auto-response:', error);
      }
    }
  }

  return escalation.id;
}

/**
 * Send notifications for an escalation
 */
async function notifyEscalation(
  escalationId: string,
  assignedTo: string | null,
  channels: string[]
): Promise<void> {
  const db = getDb();

  const [escalation] = await db
    .select()
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) return;

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, escalation.leadId))
    .limit(1);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, escalation.clientId))
    .limit(1);

  // Get recipients - assigned person or all team members who receive escalations
  let recipients: any[] = [];

  if (assignedTo) {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, assignedTo))
      .limit(1);
    if (member) recipients.push(member);
  } else {
    recipients = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.clientId, escalation.clientId),
        eq(teamMembers.isActive, true),
        eq(teamMembers.receiveEscalations, true)
      ));
  }

  const priorityLabel = escalation.priority === 1 ? 'URGENT'
    : escalation.priority === 2 ? 'High Priority'
    : 'Normal';

  const message = `[${priorityLabel}] ${lead?.name || 'Lead'} needs attention. Reason: ${escalation.reason.replace(/_/g, ' ')}`;

  for (const recipient of recipients) {
    // SMS notification
    if (channels.includes('sms') && recipient.phone && client?.twilioNumber) {
      try {
        await sendTrackedSMS({
          clientId: escalation.clientId,
          to: recipient.phone,
          from: client.twilioNumber,
          body: `${message}\nView: ${process.env.NEXT_PUBLIC_APP_URL}/escalations/${escalation.id}`,
        });
      } catch (error) {
        console.error(`[Escalation] Failed to send SMS to ${recipient.name}:`, error);
      }
    }

    // Email notification
    if (channels.includes('email') && recipient.email) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: `[${client?.businessName}] Escalation: ${lead?.name || 'Lead'}`,
          html: `
            <h2>${priorityLabel}</h2>
            <p><strong>Lead:</strong> ${lead?.name || 'Unknown'}</p>
            <p><strong>Phone:</strong> ${lead?.phone}</p>
            <p><strong>Reason:</strong> ${escalation.reason.replace(/_/g, ' ')}</p>
            <p><strong>Details:</strong> ${escalation.reasonDetails || 'None'}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/escalations/${escalation.id}">View Escalation</a></p>
          `,
        });
      } catch (error) {
        console.error(`[Escalation] Failed to send email to ${recipient.name}:`, error);
      }
    }
  }
}

/**
 * Assign an escalation to a team member
 */
export async function assignEscalation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();
  await db.update(escalationQueue).set({
    assignedTo: teamMemberId,
    assignedAt: new Date(),
    status: 'assigned',
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}

/**
 * Take over a conversation (human starts responding)
 */
export async function takeOverConversation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();
  await db.update(escalationQueue).set({
    status: 'in_progress',
    assignedTo: teamMemberId,
    firstResponseAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}

/**
 * Resolve an escalation
 */
export async function resolveEscalation(
  escalationId: string,
  teamMemberId: string,
  resolution: string,
  notes?: string,
  returnToAi: boolean = true
): Promise<void> {
  const db = getDb();

  const [escalation] = await db
    .select()
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) throw new Error('Escalation not found');

  await db.update(escalationQueue).set({
    status: 'resolved',
    resolvedAt: new Date(),
    resolvedBy: teamMemberId,
    resolution: resolution as any,
    resolutionNotes: notes,
    returnToAi,
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));

  // Update lead context based on resolution
  let newStage: 'qualifying' | 'booked' | 'lost' | 'nurturing' = 'qualifying';
  if (resolution === 'converted') newStage = 'booked';
  if (resolution === 'lost') newStage = 'lost';
  if (resolution === 'returned_to_ai') newStage = 'nurturing';

  await db.update(leadContext).set({
    stage: newStage,
    stageChangedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(leadContext.leadId, escalation.leadId));
}

/**
 * Get escalation queue for a client
 */
export async function getEscalationQueue(
  clientId: string,
  options?: {
    status?: string;
    assignedTo?: string;
    priority?: number;
  }
) {
  const db = getDb();
  const conditions = [eq(escalationQueue.clientId, clientId)];

  if (options?.status) {
    conditions.push(eq(escalationQueue.status, options.status));
  }

  if (options?.assignedTo) {
    conditions.push(eq(escalationQueue.assignedTo, options.assignedTo));
  }

  if (options?.priority) {
    conditions.push(eq(escalationQueue.priority, options.priority));
  }

  return db
    .select({
      escalation: escalationQueue,
      lead: leads,
      assignee: teamMembers,
    })
    .from(escalationQueue)
    .leftJoin(leads, eq(escalationQueue.leadId, leads.id))
    .leftJoin(teamMembers, eq(escalationQueue.assignedTo, teamMembers.id))
    .where(and(...conditions))
    .orderBy(escalationQueue.priority, desc(escalationQueue.createdAt));
}

/**
 * Check for SLA breaches
 */
export async function checkSlaBreaches(): Promise<number> {
  const db = getDb();
  const now = new Date();

  // Find escalations that have breached SLA
  const breached = await db
    .select()
    .from(escalationQueue)
    .where(and(
      or(
        eq(escalationQueue.status, 'pending'),
        eq(escalationQueue.status, 'assigned')
      ),
      eq(escalationQueue.slaBreach, false),
      sql`${escalationQueue.slaDeadline} < ${now}`
    ));

  for (const escalation of breached) {
    // Mark as breached
    await db.update(escalationQueue).set({
      slaBreach: true,
      updatedAt: new Date(),
    }).where(eq(escalationQueue.id, escalation.id));

    // Notify team members for this client
    const members = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.clientId, escalation.clientId),
        eq(teamMembers.isActive, true),
        eq(teamMembers.receiveEscalations, true)
      ));

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, escalation.clientId))
      .limit(1);

    for (const member of members) {
      if (member.email) {
        try {
          await sendEmail({
            to: member.email,
            subject: `[SLA Breach] Escalation overdue - ${client?.businessName}`,
            html: `
              <h2>SLA Breach Alert</h2>
              <p>An escalation has exceeded the response time SLA.</p>
              <p><strong>Reason:</strong> ${escalation.reason.replace(/_/g, ' ')}</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/escalations/${escalation.id}">View Escalation</a></p>
            `,
          });
        } catch (error) {
          console.error(`[Escalation] Failed to send SLA breach notification:`, error);
        }
      }
    }
  }

  return breached.length;
}
