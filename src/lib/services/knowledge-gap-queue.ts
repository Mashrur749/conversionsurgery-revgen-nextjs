import { getDb } from '@/db';
import {
  clientMemberships,
  clients,
  knowledgeBase,
  knowledgeGaps,
  people,
  roleTemplates,
  agencyMemberships,
  systemSettings,
} from '@/db/schema';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { sendEmail } from '@/lib/services/resend';
import {
  KNOWLEDGE_GAP_HIGH_PRIORITY_THRESHOLD,
  KNOWLEDGE_GAP_STATUSES,
  type KnowledgeGapStatus,
  calculateKnowledgeGapPriorityScore,
  computeKnowledgeGapDueAt,
  isHighPriorityKnowledgeGap,
  validateKnowledgeGapTransition,
} from '@/lib/services/knowledge-gap-validation';

const OPEN_KNOWLEDGE_GAP_STATUSES: KnowledgeGapStatus[] = [
  'new',
  'in_progress',
  'blocked',
];

const STALE_GAP_ALERT_SETTING_KEY = 'last_knowledge_gap_stale_alert_date';

export interface KnowledgeGapQueueRow {
  id: string;
  clientId: string;
  question: string;
  category: string | null;
  occurrences: number;
  confidenceLevel: string;
  status: KnowledgeGapStatus;
  ownerPersonId: string | null;
  ownerName: string | null;
  dueAt: Date | null;
  priorityScore: number;
  reviewRequired: boolean;
  resolutionNote: string | null;
  kbEntryId: string | null;
  kbEntryTitle: string | null;
  resolvedByPersonId: string | null;
  resolvedAt: Date | null;
  verifiedByPersonId: string | null;
  verifiedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isStale: boolean;
  ageDays: number;
}

export interface KnowledgeGapQueueSummary {
  total: number;
  open: number;
  byStatus: Record<KnowledgeGapStatus, number>;
  highPriorityOpen: number;
  staleHighPriority: number;
}

export interface KnowledgeGapQueueMetrics {
  openedLast7Days: number;
  closedLast7Days: number;
  averageOpenAgeDays: number;
}

export interface KnowledgeGapAssignee {
  personId: string;
  name: string;
  email: string | null;
}

export interface ListKnowledgeGapQueueInput {
  statuses?: KnowledgeGapStatus[];
  ownerPersonId?: string;
  search?: string;
  onlyHighPriority?: boolean;
  onlyStale?: boolean;
  limit?: number;
}

export interface UpsertKnowledgeGapDetectionInput {
  clientId: string;
  question: string;
  confidenceLevel: 'low' | 'medium';
  category?: string | null;
  detectedAt?: Date;
}

export interface UpdateKnowledgeGapLifecycleInput {
  status?: KnowledgeGapStatus;
  ownerPersonId?: string | null;
  dueAt?: Date | null;
  resolutionNote?: string | null;
  kbEntryId?: string | null;
}

function normalizeQuestion(question: string): string {
  return question
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 500);
}

function buildSimilaritySeed(normalizedQuestion: string): string {
  return normalizedQuestion.slice(0, 80);
}

export function isKnowledgeGapStale(
  row: { dueAt: Date | null; status: string },
  now: Date = new Date()
): boolean {
  if (!row.dueAt) return false;
  if (!OPEN_KNOWLEDGE_GAP_STATUSES.includes(row.status as KnowledgeGapStatus)) return false;
  return row.dueAt.getTime() < now.getTime();
}

export function getKnowledgeGapAgeDays(
  firstSeenAt: Date,
  now: Date = new Date()
): number {
  const diffMs = Math.max(0, now.getTime() - firstSeenAt.getTime());
  return Number((diffMs / (1000 * 60 * 60 * 24)).toFixed(1));
}

async function validateOwnerBelongsToClient(clientId: string, ownerPersonId: string) {
  const db = getDb();
  const [membership] = await db
    .select({ personId: clientMemberships.personId })
    .from(clientMemberships)
    .where(and(
      eq(clientMemberships.clientId, clientId),
      eq(clientMemberships.personId, ownerPersonId),
      eq(clientMemberships.isActive, true)
    ))
    .limit(1);

  if (!membership) {
    throw new Error('Owner must be an active team member for this client');
  }
}

async function validateKnowledgeBaseLink(clientId: string, kbEntryId: string) {
  const db = getDb();
  const [entry] = await db
    .select({ id: knowledgeBase.id })
    .from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.id, kbEntryId),
      eq(knowledgeBase.clientId, clientId),
      eq(knowledgeBase.isActive, true)
    ))
    .limit(1);

  if (!entry) {
    throw new Error('KB entry link must reference an active entry for this client');
  }
}

function resolveConfidenceLevel(
  currentConfidence: string,
  incomingConfidence: 'low' | 'medium'
): 'low' | 'medium' {
  if (currentConfidence === 'low' || incomingConfidence === 'low') return 'low';
  return 'medium';
}

export async function upsertKnowledgeGapFromDetection(
  input: UpsertKnowledgeGapDetectionInput
) {
  const db = getDb();
  const detectedAt = input.detectedAt ?? new Date();
  const normalizedQuestion = normalizeQuestion(input.question);
  const similaritySeed = buildSimilaritySeed(normalizedQuestion);

  const [existing] = await db
    .select()
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, input.clientId),
      sql`LOWER(${knowledgeGaps.question}) LIKE ${`%${similaritySeed}%`}`
    ))
    .orderBy(desc(knowledgeGaps.lastSeenAt))
    .limit(1);

  if (existing) {
    const nextOccurrences = existing.occurrences + 1;
    const nextConfidence = resolveConfidenceLevel(existing.confidenceLevel, input.confidenceLevel);
    const nextPriority = calculateKnowledgeGapPriorityScore({
      occurrences: nextOccurrences,
      confidenceLevel: nextConfidence,
    });
    const shouldReopen = existing.status === 'resolved' || existing.status === 'verified';

    const [updated] = await db
      .update(knowledgeGaps)
      .set({
        question: input.question.slice(0, 500),
        category: input.category ?? existing.category,
        occurrences: nextOccurrences,
        confidenceLevel: nextConfidence,
        priorityScore: nextPriority,
        reviewRequired: isHighPriorityKnowledgeGap(nextPriority),
        dueAt: computeKnowledgeGapDueAt(nextPriority, detectedAt),
        lastSeenAt: detectedAt,
        status: shouldReopen ? 'new' : existing.status,
        resolutionNote: shouldReopen ? null : existing.resolutionNote,
        kbEntryId: shouldReopen ? null : existing.kbEntryId,
        resolvedByPersonId: shouldReopen ? null : existing.resolvedByPersonId,
        resolvedAt: shouldReopen ? null : existing.resolvedAt,
        verifiedByPersonId: shouldReopen ? null : existing.verifiedByPersonId,
        verifiedAt: shouldReopen ? null : existing.verifiedAt,
      })
      .where(eq(knowledgeGaps.id, existing.id))
      .returning();

    return updated;
  }

  const priorityScore = calculateKnowledgeGapPriorityScore({
    occurrences: 1,
    confidenceLevel: input.confidenceLevel,
  });

  const [created] = await db
    .insert(knowledgeGaps)
    .values({
      clientId: input.clientId,
      question: input.question.slice(0, 500),
      category: input.category ?? null,
      occurrences: 1,
      confidenceLevel: input.confidenceLevel,
      status: 'new',
      priorityScore,
      reviewRequired: isHighPriorityKnowledgeGap(priorityScore),
      dueAt: computeKnowledgeGapDueAt(priorityScore, detectedAt),
      firstSeenAt: detectedAt,
      lastSeenAt: detectedAt,
    })
    .returning();

  return created;
}

export async function listKnowledgeGapAssignees(
  clientId: string
): Promise<KnowledgeGapAssignee[]> {
  const db = getDb();
  return db
    .select({
      personId: people.id,
      name: people.name,
      email: people.email,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(and(
      eq(clientMemberships.clientId, clientId),
      eq(clientMemberships.isActive, true)
    ))
    .orderBy(people.name);
}

function buildQueueFilters(
  clientId: string,
  input: ListKnowledgeGapQueueInput,
  now: Date
): SQL[] {
  const filters: SQL[] = [eq(knowledgeGaps.clientId, clientId)];

  if (input.statuses?.length) {
    filters.push(inArray(knowledgeGaps.status, input.statuses));
  }

  if (input.ownerPersonId) {
    filters.push(eq(knowledgeGaps.ownerPersonId, input.ownerPersonId));
  }

  if (input.search?.trim()) {
    const term = `%${input.search.trim().toLowerCase()}%`;
    filters.push(or(
      sql`LOWER(${knowledgeGaps.question}) LIKE ${term}`,
      sql`LOWER(COALESCE(${knowledgeGaps.category}, '')) LIKE ${term}`
    )!);
  }

  if (input.onlyHighPriority) {
    filters.push(gte(knowledgeGaps.priorityScore, KNOWLEDGE_GAP_HIGH_PRIORITY_THRESHOLD));
  }

  if (input.onlyStale) {
    filters.push(inArray(knowledgeGaps.status, OPEN_KNOWLEDGE_GAP_STATUSES));
    filters.push(isNotNull(knowledgeGaps.dueAt));
    filters.push(lt(knowledgeGaps.dueAt, now));
  }

  return filters;
}

async function getKnowledgeGapSummary(clientId: string, now: Date): Promise<KnowledgeGapQueueSummary> {
  const db = getDb();
  const statusRows = await db
    .select({
      status: knowledgeGaps.status,
      count: sql<number>`count(*)`,
    })
    .from(knowledgeGaps)
    .where(eq(knowledgeGaps.clientId, clientId))
    .groupBy(knowledgeGaps.status);

  const byStatus = KNOWLEDGE_GAP_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<KnowledgeGapStatus, number>);

  let total = 0;
  for (const row of statusRows) {
    const status = row.status as KnowledgeGapStatus;
    const count = Number(row.count || 0);
    total += count;
    if (status in byStatus) {
      byStatus[status] = count;
    }
  }

  const [highPriorityOpen] = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, clientId),
      inArray(knowledgeGaps.status, OPEN_KNOWLEDGE_GAP_STATUSES),
      gte(knowledgeGaps.priorityScore, KNOWLEDGE_GAP_HIGH_PRIORITY_THRESHOLD)
    ));

  const [staleHighPriority] = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, clientId),
      inArray(knowledgeGaps.status, OPEN_KNOWLEDGE_GAP_STATUSES),
      gte(knowledgeGaps.priorityScore, KNOWLEDGE_GAP_HIGH_PRIORITY_THRESHOLD),
      isNotNull(knowledgeGaps.dueAt),
      lt(knowledgeGaps.dueAt, now)
    ));

  return {
    total,
    open: byStatus.new + byStatus.in_progress + byStatus.blocked,
    byStatus,
    highPriorityOpen: Number(highPriorityOpen?.count || 0),
    staleHighPriority: Number(staleHighPriority?.count || 0),
  };
}

export async function getKnowledgeGapQueueMetrics(
  clientId: string,
  now: Date = new Date()
): Promise<KnowledgeGapQueueMetrics> {
  const db = getDb();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 7);

  const [opened] = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, clientId),
      gte(knowledgeGaps.firstSeenAt, windowStart)
    ));

  const [closed] = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, clientId),
      inArray(knowledgeGaps.status, ['resolved', 'verified']),
      or(
        gte(knowledgeGaps.resolvedAt, windowStart),
        gte(knowledgeGaps.verifiedAt, windowStart)
      )
    ));

  const openRows = await db
    .select({ firstSeenAt: knowledgeGaps.firstSeenAt })
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, clientId),
      inArray(knowledgeGaps.status, OPEN_KNOWLEDGE_GAP_STATUSES)
    ));

  const averageOpenAgeDays = openRows.length > 0
    ? Number(
        (
          openRows.reduce((sum, row) => sum + getKnowledgeGapAgeDays(row.firstSeenAt, now), 0) /
          openRows.length
        ).toFixed(1)
      )
    : 0;

  return {
    openedLast7Days: Number(opened?.count || 0),
    closedLast7Days: Number(closed?.count || 0),
    averageOpenAgeDays,
  };
}

export async function listKnowledgeGapQueue(
  clientId: string,
  input: ListKnowledgeGapQueueInput = {}
) {
  const db = getDb();
  const now = new Date();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 300);
  const filters = buildQueueFilters(clientId, input, now);

  const rows = await db
    .select()
    .from(knowledgeGaps)
    .where(and(...filters))
    .orderBy(desc(knowledgeGaps.priorityScore), knowledgeGaps.dueAt, desc(knowledgeGaps.lastSeenAt))
    .limit(limit);

  const owners = await listKnowledgeGapAssignees(clientId);
  const ownerMap = new Map(owners.map((owner) => [owner.personId, owner.name]));

  const kbEntryIds = [...new Set(rows.map((row) => row.kbEntryId).filter(Boolean))] as string[];
  const kbEntries = kbEntryIds.length > 0
    ? await db
        .select({
          id: knowledgeBase.id,
          title: knowledgeBase.title,
        })
        .from(knowledgeBase)
        .where(and(
          eq(knowledgeBase.clientId, clientId),
          inArray(knowledgeBase.id, kbEntryIds)
        ))
    : [];
  const kbMap = new Map(kbEntries.map((entry) => [entry.id, entry.title]));

  const mappedRows: KnowledgeGapQueueRow[] = rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    question: row.question,
    category: row.category,
    occurrences: row.occurrences,
    confidenceLevel: row.confidenceLevel,
    status: row.status as KnowledgeGapStatus,
    ownerPersonId: row.ownerPersonId,
    ownerName: row.ownerPersonId ? ownerMap.get(row.ownerPersonId) ?? null : null,
    dueAt: row.dueAt,
    priorityScore: row.priorityScore,
    reviewRequired: row.reviewRequired,
    resolutionNote: row.resolutionNote,
    kbEntryId: row.kbEntryId,
    kbEntryTitle: row.kbEntryId ? kbMap.get(row.kbEntryId) ?? null : null,
    resolvedByPersonId: row.resolvedByPersonId,
    resolvedAt: row.resolvedAt,
    verifiedByPersonId: row.verifiedByPersonId,
    verifiedAt: row.verifiedAt,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    isStale: isKnowledgeGapStale(row, now),
    ageDays: getKnowledgeGapAgeDays(row.firstSeenAt, now),
  }));

  const [summary, metrics] = await Promise.all([
    getKnowledgeGapSummary(clientId, now),
    getKnowledgeGapQueueMetrics(clientId, now),
  ]);

  return {
    rows: mappedRows,
    owners,
    summary,
    metrics,
  };
}

async function getKnowledgeGapById(clientId: string, gapId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(knowledgeGaps)
    .where(and(eq(knowledgeGaps.clientId, clientId), eq(knowledgeGaps.id, gapId)))
    .limit(1);
  return row ?? null;
}

export async function updateKnowledgeGapLifecycle(
  clientId: string,
  gapId: string,
  actorPersonId: string,
  input: UpdateKnowledgeGapLifecycleInput
) {
  const db = getDb();
  const now = new Date();
  const current = await getKnowledgeGapById(clientId, gapId);
  if (!current) {
    throw new Error('Knowledge gap not found');
  }

  if (input.ownerPersonId) {
    await validateOwnerBelongsToClient(clientId, input.ownerPersonId);
  }

  const nextStatus = input.status ?? (current.status as KnowledgeGapStatus);
  const nextKbEntryId = input.kbEntryId ?? current.kbEntryId;
  const nextResolutionNote = input.resolutionNote ?? current.resolutionNote;
  const nextResolvedByPersonId =
    nextStatus === 'resolved' && current.status !== 'resolved'
      ? actorPersonId
      : current.resolvedByPersonId;
  const nextVerifiedByPersonId =
    nextStatus === 'verified' && current.status !== 'verified'
      ? actorPersonId
      : current.verifiedByPersonId;

  if (nextKbEntryId) {
    await validateKnowledgeBaseLink(clientId, nextKbEntryId);
  }

  const transitionCheck = validateKnowledgeGapTransition({
    currentStatus: current.status as KnowledgeGapStatus,
    nextStatus,
    priorityScore: current.priorityScore,
    resolutionNote: nextResolutionNote,
    kbEntryId: nextKbEntryId,
    resolvedByPersonId: nextResolvedByPersonId,
    verifiedByPersonId: nextVerifiedByPersonId,
  });

  if (!transitionCheck.valid) {
    throw new Error(transitionCheck.errors.join('; '));
  }

  const patch: Partial<typeof knowledgeGaps.$inferInsert> = {
    ownerPersonId:
      input.ownerPersonId !== undefined ? input.ownerPersonId : current.ownerPersonId,
    dueAt: input.dueAt !== undefined ? input.dueAt : current.dueAt,
    status: nextStatus,
  };

  if (nextStatus === 'resolved') {
    patch.kbEntryId = nextKbEntryId;
    patch.resolutionNote = nextResolutionNote?.trim() ?? null;
    patch.resolvedByPersonId = nextResolvedByPersonId;
    patch.resolvedAt = current.status === 'resolved' ? current.resolvedAt : now;
    patch.reviewRequired = isHighPriorityKnowledgeGap(current.priorityScore);
  }

  if (nextStatus === 'verified') {
    patch.kbEntryId = nextKbEntryId;
    patch.resolutionNote = nextResolutionNote?.trim() ?? null;
    patch.resolvedByPersonId = nextResolvedByPersonId;
    patch.resolvedAt = current.resolvedAt ?? now;
    patch.verifiedByPersonId = nextVerifiedByPersonId;
    patch.verifiedAt = current.status === 'verified' ? current.verifiedAt : now;
    patch.reviewRequired = false;
  }

  if (OPEN_KNOWLEDGE_GAP_STATUSES.includes(nextStatus)) {
    if (!patch.dueAt) {
      patch.dueAt = computeKnowledgeGapDueAt(current.priorityScore, now);
    }
    if (current.status === 'resolved' || current.status === 'verified') {
      patch.kbEntryId = null;
      patch.resolutionNote = null;
      patch.resolvedByPersonId = null;
      patch.resolvedAt = null;
      patch.verifiedByPersonId = null;
      patch.verifiedAt = null;
      patch.reviewRequired = isHighPriorityKnowledgeGap(current.priorityScore);
    } else if (nextStatus !== 'verified') {
      patch.verifiedByPersonId = null;
      patch.verifiedAt = null;
    }
  }

  const [updated] = await db
    .update(knowledgeGaps)
    .set(patch)
    .where(and(eq(knowledgeGaps.id, gapId), eq(knowledgeGaps.clientId, clientId)))
    .returning();

  return updated;
}

export async function bulkUpdateKnowledgeGapLifecycle(
  clientId: string,
  gapIds: string[],
  actorPersonId: string,
  input: UpdateKnowledgeGapLifecycleInput
) {
  const uniqueIds = [...new Set(gapIds)].slice(0, 200);
  const updated: string[] = [];
  const failed: Array<{ gapId: string; error: string }> = [];

  for (const gapId of uniqueIds) {
    try {
      await updateKnowledgeGapLifecycle(clientId, gapId, actorPersonId, input);
      updated.push(gapId);
    } catch (error) {
      failed.push({
        gapId,
        error: error instanceof Error ? error.message : 'Failed to update gap',
      });
    }
  }

  return {
    requested: uniqueIds.length,
    updated,
    failed,
  };
}

export async function listStaleHighPriorityKnowledgeGaps(now: Date = new Date()) {
  const db = getDb();
  return db
    .select({
      id: knowledgeGaps.id,
      clientId: knowledgeGaps.clientId,
      question: knowledgeGaps.question,
      priorityScore: knowledgeGaps.priorityScore,
      dueAt: knowledgeGaps.dueAt,
      status: knowledgeGaps.status,
      ownerPersonId: knowledgeGaps.ownerPersonId,
      clientBusinessName: clients.businessName,
    })
    .from(knowledgeGaps)
    .innerJoin(clients, eq(clients.id, knowledgeGaps.clientId))
    .where(and(
      inArray(knowledgeGaps.status, OPEN_KNOWLEDGE_GAP_STATUSES),
      gte(knowledgeGaps.priorityScore, KNOWLEDGE_GAP_HIGH_PRIORITY_THRESHOLD),
      isNotNull(knowledgeGaps.dueAt),
      lt(knowledgeGaps.dueAt, now)
    ))
    .orderBy(desc(knowledgeGaps.priorityScore), knowledgeGaps.dueAt);
}

export async function processStaleKnowledgeGapAlerts(now: Date = new Date()) {
  const db = getDb();
  const today = now.toISOString().slice(0, 10);

  const [lastAlert] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, STALE_GAP_ALERT_SETTING_KEY))
    .limit(1);

  if (lastAlert?.value === today) {
    return { scanned: 0, staleCount: 0, sent: 0, skipped: true };
  }

  const staleRows = await listStaleHighPriorityKnowledgeGaps(now);
  if (staleRows.length === 0) {
    return { scanned: 0, staleCount: 0, sent: 0, skipped: true };
  }

  const owners = await db
    .select({
      email: people.email,
      name: people.name,
    })
    .from(agencyMemberships)
    .innerJoin(people, eq(agencyMemberships.personId, people.id))
    .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id))
    .where(and(
      eq(agencyMemberships.isActive, true),
      eq(roleTemplates.slug, 'agency_owner'),
      isNotNull(people.email)
    ));

  const rowsHtml = staleRows
    .slice(0, 30)
    .map((row) => {
      return `<li><strong>${row.clientBusinessName}</strong> — ${row.question} (priority ${row.priorityScore}, due ${row.dueAt?.toISOString().slice(0, 10) ?? 'n/a'})</li>`;
    })
    .join('');

  let sent = 0;
  for (const owner of owners) {
    if (!owner.email) continue;
    const result = await sendEmail({
      to: owner.email,
      subject: `[Alert] Stale high-priority knowledge gaps (${staleRows.length})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Stale High-Priority Knowledge Gaps</h2>
          <p>${staleRows.length} open high-priority gap(s) are past due and need operator action.</p>
          <ul>${rowsHtml}</ul>
          <p>Action: open the client Knowledge Base queue tab and triage/resolve these gaps.</p>
        </div>
      `,
    });
    if (result.success) {
      sent++;
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: STALE_GAP_ALERT_SETTING_KEY,
      value: today,
      description: 'Last date stale high-priority knowledge gap alert digest was sent',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: today,
        updatedAt: now,
      },
    });

  return {
    scanned: staleRows.length,
    staleCount: staleRows.length,
    sent,
    skipped: false,
  };
}
