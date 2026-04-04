import {
  agencyMessages,
  clients,
  onboardingMilestoneActivities,
  onboardingMilestones,
  onboardingSlaAlerts,
  revenueLeakAudits,
  type Client,
} from '@/db';
import { getDb } from '@/db';
import { and, asc, desc, eq, lt } from 'drizzle-orm';
import {
  DAY_ONE_MILESTONE_KEYS,
  type DayOneMilestoneKey,
  listDayOneMilestoneDefinitions,
} from './day-one-policy';

// Milestone keys that warrant a contractor SMS nudge when overdue
const CONTRACTOR_SMS_NUDGE_MILESTONES = new Set<string>([
  DAY_ONE_MILESTONE_KEYS.NUMBER_LIVE,
]);

export {
  DAY_ONE_MILESTONE_KEYS,
  DAY_ONE_SLA_POLICY,
  computeDayOneMilestoneTargetAt,
  listDayOneMilestoneDefinitions,
} from './day-one-policy';

export interface RevenueLeakFinding {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpactCentsLow?: number;
  estimatedImpactCentsHigh?: number;
}

export interface DayOneMilestoneSummary {
  id: string;
  key: DayOneMilestoneKey;
  title: string;
  status: 'pending' | 'completed' | 'overdue';
  targetAt: Date;
  completedAt: Date | null;
  completedBy: string | null;
  evidence: {
    link?: string;
    note?: string;
    source?: string;
  } | null;
}

export interface DayOneAuditSummary {
  status: 'draft' | 'delivered';
  summary: string | null;
  findings: RevenueLeakFinding[] | null;
  estimatedImpactLowCents: number | null;
  estimatedImpactBaseCents: number | null;
  estimatedImpactHighCents: number | null;
  artifactUrl: string | null;
  deliveredAt: Date | null;
  deliveredBy: string | null;
  updatedAt: Date | null;
}

export interface DayOneOpenAlertSummary {
  id: string;
  milestoneKey: string;
  reason: string;
  detectedAt: Date;
}

export interface DayOneActivitySummary {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  notes: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface DayOneActivationSummary {
  milestones: DayOneMilestoneSummary[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  audit: DayOneAuditSummary | null;
  openAlerts: DayOneOpenAlertSummary[];
  activities: DayOneActivitySummary[];
}

interface UpsertRevenueLeakAuditInput {
  clientId: string;
  summary?: string | null;
  findings?: RevenueLeakFinding[];
  estimatedImpactLowCents?: number | null;
  estimatedImpactBaseCents?: number | null;
  estimatedImpactHighCents?: number | null;
  artifactUrl?: string | null;
  deliver?: boolean;
  actorId?: string | null;
  actorType?: 'agency_user' | 'system';
}

export interface CompleteMilestoneInput {
  clientId: string;
  milestoneKey: DayOneMilestoneKey;
  completedBy?: string | null;
  actorType?: 'agency_user' | 'system' | 'client_owner';
  notes?: string | null;
  evidence?: {
    link?: string;
    note?: string;
    source?: string;
  } | null;
}

async function getClientCreatedAt(clientId: string): Promise<Date> {
  const db = getDb();
  const [client] = await db
    .select({ createdAt: clients.createdAt })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.createdAt) {
    throw new Error(`Client ${clientId} not found for day-one milestones`);
  }

  return new Date(client.createdAt);
}

export async function recordDayOneActivity(params: {
  clientId: string;
  milestoneId?: string | null;
  eventType: string;
  actorType?: 'agency_user' | 'system' | 'client_owner';
  actorId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(onboardingMilestoneActivities).values({
    clientId: params.clientId,
    milestoneId: params.milestoneId ?? null,
    eventType: params.eventType,
    actorType: params.actorType ?? 'system',
    actorId: params.actorId ?? null,
    notes: params.notes ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function ensureDayOneMilestones(
  clientId: string,
  clientCreatedAt: Date
): Promise<void> {
  const db = getDb();
  const definitions = listDayOneMilestoneDefinitions(clientCreatedAt);

  await db
    .insert(onboardingMilestones)
    .values(
      definitions.map((definition) => ({
        clientId,
        milestoneKey: definition.key,
        title: definition.title,
        status: 'pending' as const,
        targetAt: definition.targetAt,
      }))
    )
    .onConflictDoNothing({
      target: [onboardingMilestones.clientId, onboardingMilestones.milestoneKey],
    });
}

export async function completeDayOneMilestone(
  input: CompleteMilestoneInput
): Promise<void> {
  const db = getDb();

  const createdAt = await getClientCreatedAt(input.clientId);
  await ensureDayOneMilestones(input.clientId, createdAt);

  const [milestone] = await db
    .select()
    .from(onboardingMilestones)
    .where(
      and(
        eq(onboardingMilestones.clientId, input.clientId),
        eq(onboardingMilestones.milestoneKey, input.milestoneKey)
      )
    )
    .limit(1);

  if (!milestone) {
    throw new Error(
      `Day-one milestone ${input.milestoneKey} missing for client ${input.clientId}`
    );
  }

  if (milestone.completedAt) {
    return;
  }

  const completedAt = new Date();
  await db
    .update(onboardingMilestones)
    .set({
      status: 'completed',
      completedAt,
      completedBy: input.completedBy ?? null,
      evidence: input.evidence ?? milestone.evidence,
      updatedAt: completedAt,
    })
    .where(eq(onboardingMilestones.id, milestone.id));

  await recordDayOneActivity({
    clientId: input.clientId,
    milestoneId: milestone.id,
    eventType: 'milestone_completed',
    actorType: input.actorType ?? 'system',
    actorId: input.completedBy ?? null,
    notes: input.notes ?? null,
    metadata: {
      milestoneKey: input.milestoneKey,
      title: milestone.title,
      completedAt: completedAt.toISOString(),
      evidence: input.evidence ?? undefined,
    },
  });

  const resolvedAlerts = await db
    .update(onboardingSlaAlerts)
    .set({
      status: 'resolved',
      resolvedAt: completedAt,
    })
    .where(
      and(
        eq(onboardingSlaAlerts.clientId, input.clientId),
        eq(onboardingSlaAlerts.milestoneKey, input.milestoneKey),
        eq(onboardingSlaAlerts.status, 'open')
      )
    )
    .returning({ id: onboardingSlaAlerts.id });

  if (resolvedAlerts.length > 0) {
    await recordDayOneActivity({
      clientId: input.clientId,
      milestoneId: milestone.id,
      eventType: 'sla_alert_resolved',
      actorType: input.actorType ?? 'system',
      actorId: input.completedBy ?? null,
      notes: `Resolved ${resolvedAlerts.length} open SLA alert(s).`,
      metadata: {
        milestoneKey: input.milestoneKey,
        resolvedCount: resolvedAlerts.length,
      },
    });
  }
}

export async function syncDayOneSystemMilestones(
  client: Pick<Client, 'id' | 'createdAt' | 'twilioNumber' | 'missedCallSmsEnabled'>
): Promise<void> {
  await ensureDayOneMilestones(client.id, new Date(client.createdAt!));

  if (client.twilioNumber) {
    await completeDayOneMilestone({
      clientId: client.id,
      milestoneKey: DAY_ONE_MILESTONE_KEYS.NUMBER_LIVE,
      completedBy: 'system:twilio_provisioning',
      actorType: 'system',
      evidence: {
        source: 'twilio_number_assigned',
        note: `Assigned ${client.twilioNumber}`,
      },
    });
  }

  if (client.twilioNumber && client.missedCallSmsEnabled) {
    await completeDayOneMilestone({
      clientId: client.id,
      milestoneKey: DAY_ONE_MILESTONE_KEYS.MISSED_CALL_TEXT_BACK_LIVE,
      completedBy: 'system:missed_call_enabled',
      actorType: 'system',
      evidence: {
        source: 'feature_flag',
        note: 'Missed-call SMS feature enabled with active Twilio number.',
      },
    });
  }
}

export async function upsertRevenueLeakAudit(
  input: UpsertRevenueLeakAuditInput
): Promise<void> {
  const db = getDb();
  const now = new Date();
  const shouldDeliver = input.deliver === true;

  const [existing] = await db
    .select({
      id: revenueLeakAudits.id,
      status: revenueLeakAudits.status,
      summary: revenueLeakAudits.summary,
      findings: revenueLeakAudits.findings,
      estimatedImpactLowCents: revenueLeakAudits.estimatedImpactLowCents,
      estimatedImpactBaseCents: revenueLeakAudits.estimatedImpactBaseCents,
      estimatedImpactHighCents: revenueLeakAudits.estimatedImpactHighCents,
      artifactUrl: revenueLeakAudits.artifactUrl,
      deliveredAt: revenueLeakAudits.deliveredAt,
      deliveredBy: revenueLeakAudits.deliveredBy,
    })
    .from(revenueLeakAudits)
    .where(eq(revenueLeakAudits.clientId, input.clientId))
    .limit(1);

  if (existing) {
    const updatePatch: Partial<typeof revenueLeakAudits.$inferInsert> = {
      updatedAt: now,
    };

    if (input.summary !== undefined) {
      updatePatch.summary = input.summary ?? null;
    }
    if (input.findings !== undefined) {
      updatePatch.findings = input.findings;
    }
    if (input.estimatedImpactLowCents !== undefined) {
      updatePatch.estimatedImpactLowCents = input.estimatedImpactLowCents ?? null;
    }
    if (input.estimatedImpactBaseCents !== undefined) {
      updatePatch.estimatedImpactBaseCents = input.estimatedImpactBaseCents ?? null;
    }
    if (input.estimatedImpactHighCents !== undefined) {
      updatePatch.estimatedImpactHighCents = input.estimatedImpactHighCents ?? null;
    }
    if (input.artifactUrl !== undefined) {
      updatePatch.artifactUrl = input.artifactUrl ?? null;
    }
    if (shouldDeliver) {
      updatePatch.status = 'delivered';
      updatePatch.deliveredAt = now;
      updatePatch.deliveredBy = input.actorId ?? null;
    }

    await db
      .update(revenueLeakAudits)
      .set(updatePatch)
      .where(eq(revenueLeakAudits.id, existing.id));
  } else {
    await db.insert(revenueLeakAudits).values({
      clientId: input.clientId,
      summary: input.summary ?? null,
      findings: input.findings ?? null,
      estimatedImpactLowCents: input.estimatedImpactLowCents ?? null,
      estimatedImpactBaseCents: input.estimatedImpactBaseCents ?? null,
      estimatedImpactHighCents: input.estimatedImpactHighCents ?? null,
      artifactUrl: input.artifactUrl ?? null,
      status: shouldDeliver ? 'delivered' : 'draft',
      deliveredAt: shouldDeliver ? now : null,
      deliveredBy: shouldDeliver ? input.actorId ?? null : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  await recordDayOneActivity({
    clientId: input.clientId,
    eventType: shouldDeliver
      ? 'revenue_leak_audit_delivered'
      : 'revenue_leak_audit_updated',
    actorType: input.actorType ?? 'agency_user',
    actorId: input.actorId ?? null,
      notes: shouldDeliver
      ? 'Revenue Leak Audit delivered to client.'
      : 'Revenue Leak Audit draft updated.',
    metadata: {
      summary: input.summary ?? existing?.summary ?? null,
      artifactUrl: input.artifactUrl ?? existing?.artifactUrl ?? null,
      delivered: shouldDeliver,
    },
  });

  if (shouldDeliver) {
    await completeDayOneMilestone({
      clientId: input.clientId,
      milestoneKey: DAY_ONE_MILESTONE_KEYS.REVENUE_LEAK_AUDIT_DELIVERED,
      completedBy: input.actorId ?? null,
      actorType: input.actorType ?? 'agency_user',
      evidence: {
        link: input.artifactUrl ?? undefined,
        source: 'revenue_leak_audit',
        note: 'Revenue Leak Audit delivered.',
      },
    });
  }
}

export async function resolveDayOneSlaAlert(input: {
  clientId: string;
  alertId: string;
  reason?: string | null;
  resolvedBy?: string | null;
  actorType?: 'agency_user' | 'system';
}): Promise<boolean> {
  const db = getDb();
  const [alert] = await db
    .select()
    .from(onboardingSlaAlerts)
    .where(
      and(
        eq(onboardingSlaAlerts.id, input.alertId),
        eq(onboardingSlaAlerts.clientId, input.clientId),
        eq(onboardingSlaAlerts.status, 'open')
      )
    )
    .limit(1);

  if (!alert) {
    return false;
  }

  const resolvedAt = new Date();
  await db
    .update(onboardingSlaAlerts)
    .set({
      status: 'resolved',
      resolvedAt,
    })
    .where(eq(onboardingSlaAlerts.id, alert.id));

  await recordDayOneActivity({
    clientId: input.clientId,
    milestoneId: alert.milestoneId,
    eventType: 'sla_alert_resolved_manual',
    actorType: input.actorType ?? 'agency_user',
    actorId: input.resolvedBy ?? null,
    notes: input.reason ?? 'SLA alert manually resolved by operator.',
    metadata: {
      alertId: alert.id,
      milestoneKey: alert.milestoneKey,
    },
  });

  return true;
}

export async function getDayOneActivationSummary(
  clientId: string
): Promise<DayOneActivationSummary> {
  const db = getDb();
  const now = new Date();
  const createdAt = await getClientCreatedAt(clientId);
  await ensureDayOneMilestones(clientId, createdAt);

  const [milestones, [audit], activities, alerts] = await Promise.all([
    db
      .select()
      .from(onboardingMilestones)
      .where(eq(onboardingMilestones.clientId, clientId))
      .orderBy(asc(onboardingMilestones.targetAt)),
    db
      .select()
      .from(revenueLeakAudits)
      .where(eq(revenueLeakAudits.clientId, clientId))
      .limit(1),
    db
      .select()
      .from(onboardingMilestoneActivities)
      .where(eq(onboardingMilestoneActivities.clientId, clientId))
      .orderBy(desc(onboardingMilestoneActivities.createdAt))
      .limit(20),
    db
      .select()
      .from(onboardingSlaAlerts)
      .where(
        and(
          eq(onboardingSlaAlerts.clientId, clientId),
          eq(onboardingSlaAlerts.status, 'open')
        )
      ),
  ]);

  const definitions = listDayOneMilestoneDefinitions(createdAt);
  const milestoneByKey = new Map(
    milestones.map((milestone) => [
      milestone.milestoneKey as DayOneMilestoneKey,
      milestone,
    ])
  );

  const normalizedMilestones = definitions.map((definition) => {
    const milestone = milestoneByKey.get(definition.key);
    const status: DayOneMilestoneSummary['status'] =
      milestone?.status === 'completed'
        ? 'completed'
        : milestone?.status === 'overdue' ||
            definition.targetAt < now
          ? 'overdue'
          : 'pending';

    return {
      id: milestone?.id ?? '',
      key: definition.key,
      title: definition.title,
      status,
      targetAt: milestone?.targetAt ?? definition.targetAt,
      completedAt: milestone?.completedAt ?? null,
      completedBy: milestone?.completedBy ?? null,
      evidence: (milestone?.evidence as
        | {
            link?: string;
            note?: string;
            source?: string;
          }
        | null
        | undefined) ?? null,
    };
  });

  const completedCount = normalizedMilestones.filter(
    (milestone) => milestone.status === 'completed'
  ).length;

  return {
    milestones: normalizedMilestones,
    progress: {
      completed: completedCount,
      total: normalizedMilestones.length,
      percent:
        normalizedMilestones.length === 0
          ? 0
          : Math.round((completedCount / normalizedMilestones.length) * 100),
    },
    audit: audit
      ? {
          status: audit.status,
          summary: audit.summary,
          findings: (audit.findings as RevenueLeakFinding[] | null) ?? null,
          estimatedImpactLowCents: audit.estimatedImpactLowCents,
          estimatedImpactBaseCents: audit.estimatedImpactBaseCents,
          estimatedImpactHighCents: audit.estimatedImpactHighCents,
          artifactUrl: audit.artifactUrl,
          deliveredAt: audit.deliveredAt,
          deliveredBy: audit.deliveredBy,
          updatedAt: audit.updatedAt,
        }
      : null,
    openAlerts: alerts.map((alert) => ({
      id: alert.id,
      milestoneKey: alert.milestoneKey,
      reason: alert.reason,
      detectedAt: alert.detectedAt,
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      eventType: activity.eventType,
      actorType: activity.actorType,
      actorId: activity.actorId,
      notes: activity.notes,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
    })),
  };
}

export async function runDayOneActivationSlaCheck(): Promise<{
  overdueMarked: number;
  alertsCreated: number;
}> {
  const db = getDb();
  const now = new Date();

  const overdue = await db
    .select({
      id: onboardingMilestones.id,
      clientId: onboardingMilestones.clientId,
      milestoneKey: onboardingMilestones.milestoneKey,
      title: onboardingMilestones.title,
      targetAt: onboardingMilestones.targetAt,
      businessName: clients.businessName,
    })
    .from(onboardingMilestones)
    .innerJoin(clients, eq(onboardingMilestones.clientId, clients.id))
      .where(
        and(
          eq(onboardingMilestones.status, 'pending'),
          lt(onboardingMilestones.targetAt, now)
        )
      );

  let overdueMarked = 0;
  let alertsCreated = 0;

  for (const milestone of overdue) {
    await db
      .update(onboardingMilestones)
      .set({
        status: 'overdue',
        updatedAt: now,
      })
      .where(eq(onboardingMilestones.id, milestone.id));
    overdueMarked++;

    const [existingAlert] = await db
      .select({ id: onboardingSlaAlerts.id })
      .from(onboardingSlaAlerts)
      .where(
        and(
          eq(onboardingSlaAlerts.clientId, milestone.clientId),
          eq(onboardingSlaAlerts.milestoneKey, milestone.milestoneKey),
          eq(onboardingSlaAlerts.status, 'open')
        )
      )
      .limit(1);

    if (!existingAlert) {
      const reason = `Day-one milestone overdue: ${milestone.title}`;
      await db.insert(onboardingSlaAlerts).values({
        clientId: milestone.clientId,
        milestoneId: milestone.id,
        milestoneKey: milestone.milestoneKey,
        status: 'open',
        reason,
        detectedAt: now,
      });

      await db.insert(agencyMessages).values({
        clientId: milestone.clientId,
        direction: 'outbound',
        channel: 'email',
        category: 'alert',
        subject: `Onboarding SLA breach: ${milestone.title}`,
        content: `${milestone.businessName}: "${milestone.title}" is overdue (target was ${milestone.targetAt.toISOString()}).`,
        delivered: false,
      });

      // Nudge the contractor via SMS for milestones they need to action themselves
      if (CONTRACTOR_SMS_NUDGE_MILESTONES.has(milestone.milestoneKey)) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';
        void (async () => {
          try {
            const { sendAlert } = await import('./agency-communication');
            await sendAlert({
              clientId: milestone.clientId,
              message: `Quick reminder: your dedicated business phone number has not been set up yet. It takes about 2 minutes to activate. Go here to get started: ${appUrl}/client/settings/phone`,
            });
          } catch {
            // Non-fatal — operator SLA alert is already created
          }
        })();
      }

      alertsCreated++;
    }

    await recordDayOneActivity({
      clientId: milestone.clientId,
      milestoneId: milestone.id,
      eventType: 'sla_breach_detected',
      actorType: 'system',
      notes: `Milestone overdue: ${milestone.title}`,
      metadata: {
        milestoneKey: milestone.milestoneKey,
        targetAt: milestone.targetAt.toISOString(),
      },
    });
  }

  return {
    overdueMarked,
    alertsCreated,
  };
}
