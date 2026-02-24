import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminClientRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';
import {
  DAY_ONE_MILESTONE_KEYS,
  completeDayOneMilestone,
  getDayOneActivationSummary,
  resolveDayOneSlaAlert,
  upsertRevenueLeakAudit,
} from '@/lib/services/day-one-activation';

const completeMilestoneSchema = z.object({
  action: z.literal('complete_milestone'),
  milestoneKey: z.enum([
    DAY_ONE_MILESTONE_KEYS.NUMBER_LIVE,
    DAY_ONE_MILESTONE_KEYS.MISSED_CALL_TEXT_BACK_LIVE,
    DAY_ONE_MILESTONE_KEYS.CALL_YOUR_NUMBER_PROOF,
    DAY_ONE_MILESTONE_KEYS.REVENUE_LEAK_AUDIT_DELIVERED,
  ]),
  notes: z.string().max(500).optional(),
  evidenceLink: z.string().url().optional(),
  evidenceNote: z.string().max(500).optional(),
});

const findingSchema = z.object({
  title: z.string().min(1).max(180),
  detail: z.string().min(1).max(1500),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedImpactCentsLow: z.number().int().nonnegative().optional(),
  estimatedImpactCentsHigh: z.number().int().nonnegative().optional(),
});

const upsertAuditSchema = z.object({
  action: z.literal('upsert_audit'),
  summary: z.string().max(4000).optional(),
  findings: z.array(findingSchema).max(10).optional(),
  estimatedImpactLowCents: z.number().int().nonnegative().optional(),
  estimatedImpactBaseCents: z.number().int().nonnegative().optional(),
  estimatedImpactHighCents: z.number().int().nonnegative().optional(),
  artifactUrl: z.string().url().optional(),
  deliver: z.boolean().optional(),
});

const resolveAlertSchema = z.object({
  action: z.literal('resolve_alert'),
  alertId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const patchSchema = z.discriminatedUnion('action', [
  completeMilestoneSchema,
  upsertAuditSchema,
  resolveAlertSchema,
]);

export const GET = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_VIEW,
    clientIdFrom: (params) => params.id,
  },
  async ({ clientId }) => {
    const summary = await getDayOneActivationSummary(clientId);
    return NextResponse.json({ summary });
  }
);

export const PATCH = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_EDIT,
    clientIdFrom: (params) => params.id,
  },
  async ({ clientId, request, session }) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;

    if (body.action === 'complete_milestone') {
      await completeDayOneMilestone({
        clientId,
        milestoneKey: body.milestoneKey,
        completedBy: session.userId,
        actorType: 'agency_user',
        notes: body.notes,
        evidence:
          body.evidenceLink || body.evidenceNote
            ? {
                link: body.evidenceLink,
                note: body.evidenceNote,
                source: 'admin_operator',
              }
            : null,
      });
    }

    if (body.action === 'upsert_audit') {
      await upsertRevenueLeakAudit({
        clientId,
        summary: body.summary ?? null,
        findings: body.findings,
        estimatedImpactLowCents: body.estimatedImpactLowCents ?? null,
        estimatedImpactBaseCents: body.estimatedImpactBaseCents ?? null,
        estimatedImpactHighCents: body.estimatedImpactHighCents ?? null,
        artifactUrl: body.artifactUrl ?? null,
        deliver: body.deliver === true,
        actorId: session.userId,
        actorType: 'agency_user',
      });
    }

    if (body.action === 'resolve_alert') {
      const resolved = await resolveDayOneSlaAlert({
        clientId,
        alertId: body.alertId,
        reason: body.reason,
        resolvedBy: session.userId,
        actorType: 'agency_user',
      });

      if (!resolved) {
        return NextResponse.json(
          { error: 'Open SLA alert not found for client' },
          { status: 404 }
        );
      }
    }

    const summary = await getDayOneActivationSummary(clientId);
    return NextResponse.json({ success: true, summary });
  }
);
