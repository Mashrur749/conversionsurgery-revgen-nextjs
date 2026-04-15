# Wave 5: Consensus FMA Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 6 highest-impact findings from the 8-reviewer adversarial red-team consensus FMA.

**Architecture:** Six independent changes: flip a feature flag default, add a health endpoint, simplify capacity tracking to raw metrics, add a volume-trend engagement signal, fix digest item ordering, and add appointment-based follow-up trigger. No cross-dependencies — any task can be implemented in any order.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon Postgres, TypeScript

**Source spec:** `docs/superpowers/specs/2026-04-15-consensus-fma-resolution-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/services/feature-flags.ts` | Add `SYSTEM_FLAG_DEFAULTS` map (Task 1) |
| Create | `src/app/api/health/route.ts` | Unauthenticated health check endpoint (Task 2) |
| Modify | `src/lib/services/capacity-tracking.ts` | Replace formula with raw metrics (Task 3) |
| Modify | `src/app/api/admin/capacity/route.ts` | Update to return `CapacitySnapshot` (Task 3) |
| Modify | `src/app/(dashboard)/admin/triage/operator-actions-panel.tsx` | Remove utilization display, use raw counts (Task 3) |
| Modify | `src/lib/services/monthly-health-digest.ts` | Update capacity section to raw metrics (Task 3) |
| Modify | `src/lib/services/engagement-signals.ts` | Add 6th signal, adjust dampening (Task 4) |
| Modify | `src/lib/services/contractor-digest.ts` | Priority-balanced ordering, 24h dedup (Task 5) |
| Modify | `src/lib/services/operator-actions.ts` | Add `digest_no_response` action type (Task 5) |
| Create | `src/lib/automations/appointment-followup-trigger.ts` | Appointment-age follow-up (Task 6) |
| Create | `src/app/api/cron/appointment-followup/route.ts` | Cron sub-endpoint (Task 6) |
| Modify | `src/app/api/cron/route.ts` | Register appointment-followup cron (Task 6) |
| Modify | `docs/product/PLATFORM-CAPABILITIES.md` | All 6 items (Task 7) |
| Modify | `docs/engineering/01-TESTING-GUIDE.md` | All 6 items (Task 7) |
| Modify | `docs/operations/01-OPERATIONS-GUIDE.md` | Items 1, 3, 6 (Task 7) |
| Modify | `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Items 2, 6 (Task 7) |
| Modify | `docs/operations/LAUNCH-CHECKLIST.md` | Item 4 (Task 7) |
| Modify | `docs/product/FEATURE-BACKLOG.md` | Item 1 (Task 7) |

---

### Task 1: FM-38 — Flip Quiet Hours Inbound-Reply Default

**Files:**
- Modify: `src/lib/services/feature-flags.ts:88-92`

- [ ] **Step 1: Add SYSTEM_FLAG_DEFAULTS map and use it in resolveFeatureFlag()**

In `src/lib/services/feature-flags.ts`, add a defaults map after the imports and update the fallback at line 92:

```typescript
// After the GLOBAL_PAUSE_KEY constant (line 23), add:

/** Per-flag hardcoded defaults. Flags not listed here default to false. */
const SYSTEM_FLAG_DEFAULTS: Partial<Record<SystemFeatureFlag, boolean>> = {
  inboundReplyExemptionEnabled: true,
};
```

Then change line 92 from:
```typescript
  // Step 4: safe default
  return false;
```
to:
```typescript
  // Step 4: per-flag default (or false)
  return SYSTEM_FLAG_DEFAULTS[flag] ?? false;
```

Also update `resolveFeatureFlags()` — change line 173 from:
```typescript
      acc[flag] = raw !== undefined ? raw === 'true' : false;
```
to:
```typescript
      acc[flag] = raw !== undefined ? raw === 'true' : (SYSTEM_FLAG_DEFAULTS[flag] ?? false);
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/feature-flags.ts
git commit -m "feat: flip inbound-reply quiet hours exemption default to ON (FM-38)"
```

---

### Task 2: NEWFM-E — Health Check Endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create the health endpoint**

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { cronJobCursors } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Public health check endpoint — no auth required.
 * External monitors (Cloudflare, BetterUptime, Cronitor) ping this every 5 min.
 *
 * Checks the heartbeat_check cron cursor to verify the platform is alive.
 * Returns 200 if healthy, 503 if degraded.
 */
export async function GET() {
  try {
    const db = getDb();
    const [cursor] = await db
      .select({
        lastRunAt: cronJobCursors.lastRunAt,
        status: cronJobCursors.status,
      })
      .from(cronJobCursors)
      .where(eq(cronJobCursors.jobKey, 'heartbeat_check'))
      .limit(1);

    if (!cursor || !cursor.lastRunAt) {
      return NextResponse.json(
        { status: 'degraded', issue: 'heartbeat never ran', lastHeartbeat: null },
        { status: 503 }
      );
    }

    const ageMs = Date.now() - new Date(cursor.lastRunAt).getTime();
    const maxAgeMs = 26 * 60 * 60 * 1000; // 26 hours (same buffer as heartbeat check)

    if (ageMs > maxAgeMs) {
      return NextResponse.json(
        {
          status: 'degraded',
          issue: 'heartbeat stale',
          lastHeartbeat: cursor.lastRunAt.toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      lastHeartbeat: cursor.lastRunAt.toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'degraded', issue: 'db unreachable' },
      { status: 503 }
    );
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add /api/health endpoint for external monitoring (NEWFM-E)"
```

---

### Task 3: NEWFM-A — Replace Capacity Formula with Raw Metrics

**Files:**
- Modify: `src/lib/services/capacity-tracking.ts` (rewrite)
- Modify: `src/app/api/admin/capacity/route.ts`
- Modify: `src/app/(dashboard)/admin/triage/operator-actions-panel.tsx`
- Modify: `src/lib/services/monthly-health-digest.ts`

- [ ] **Step 1: Rewrite capacity-tracking.ts**

Replace the entire file `src/lib/services/capacity-tracking.ts` with:

```typescript
import { getDb } from '@/db';
import { clients, escalationQueue, knowledgeGaps } from '@/db/schema';
import { eq, and, gte, count } from 'drizzle-orm';

export interface CapacitySnapshot {
  totalClients: number;
  byPhase: {
    onboarding: number;
    assist: number;
    autonomous: number;
    manual: number;
  };
  openEscalations: number;
  openKbGaps: number;
  smartAssistQueueDepth: number;
}

export async function getCapacitySnapshot(): Promise<CapacitySnapshot> {
  const db = getDb();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeClients, escalationRows, kbGapRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        aiAgentMode: clients.aiAgentMode,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(eq(clients.status, 'active')),

    db
      .select({ total: count(escalationQueue.id) })
      .from(escalationQueue)
      .where(gte(escalationQueue.createdAt, sevenDaysAgo)),

    db
      .select({ total: count(knowledgeGaps.id) })
      .from(knowledgeGaps)
      .where(eq(knowledgeGaps.status, 'new')),
  ]);

  const byPhase = { onboarding: 0, assist: 0, autonomous: 0, manual: 0 };
  for (const client of activeClients) {
    if (client.createdAt > fourteenDaysAgo) {
      byPhase.onboarding++;
    } else if (client.aiAgentMode === 'assist') {
      byPhase.assist++;
    } else if (client.aiAgentMode === 'autonomous') {
      byPhase.autonomous++;
    } else {
      byPhase.manual++;
    }
  }

  return {
    totalClients: activeClients.length,
    byPhase,
    openEscalations: Number(escalationRows[0]?.total ?? 0),
    openKbGaps: Number(kbGapRows[0]?.total ?? 0),
    smartAssistQueueDepth: activeClients.filter((c) => c.aiAgentMode === 'assist').length,
  };
}
```

- [ ] **Step 2: Update the API route**

In `src/app/api/admin/capacity/route.ts`, change:

```typescript
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getCapacitySnapshot } from '@/lib/services/capacity-tracking';
import { NextResponse } from 'next/server';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async () => {
    const result = await getCapacitySnapshot();
    return NextResponse.json(result);
  }
);
```

- [ ] **Step 3: Update the triage panel**

In `src/app/(dashboard)/admin/triage/operator-actions-panel.tsx`, replace the `CapacityData` interface (lines 15-19) with:

```typescript
interface CapacityData {
  totalClients: number;
  byPhase: { onboarding: number; assist: number; autonomous: number; manual: number };
  openEscalations: number;
  openKbGaps: number;
  smartAssistQueueDepth: number;
}
```

Then find where `utilizationPercent` and `alertLevel` are rendered and replace with raw counts display. The capacity section should show:

```
Clients: {totalClients} (Onboarding: {byPhase.onboarding}, Assist: {byPhase.assist}, Auto: {byPhase.autonomous})
Escalations: {openEscalations} | KB Gaps: {openKbGaps}
```

Remove the utilization percentage bar and alert-level color coding for capacity. Keep the health badge (it derives from operator actions, not capacity).

- [ ] **Step 4: Update monthly-health-digest.ts**

In `src/lib/services/monthly-health-digest.ts`, change the import from `getCapacityEstimate` to `getCapacitySnapshot`:

```typescript
import { getCapacitySnapshot } from '@/lib/services/capacity-tracking';
```

At line ~90, change:
```typescript
    getCapacitySnapshot(),
```

At lines ~150-155, change the capacity section from:
```typescript
  const capacity = {
    totalWeeklyHours: capacityEstimate.totalWeeklyHours,
    maxHours: capacityEstimate.maxCapacityHours,
    utilizationPercent: capacityEstimate.utilizationPercent,
    alertLevel: capacityEstimate.alertLevel,
  };
```
to:
```typescript
  const capacity = {
    totalClients: capacitySnapshot.totalClients,
    byPhase: capacitySnapshot.byPhase,
    openEscalations: capacitySnapshot.openEscalations,
    openKbGaps: capacitySnapshot.openKbGaps,
    smartAssistQueueDepth: capacitySnapshot.smartAssistQueueDepth,
  };
```

Update any template references to `utilizationPercent` or `alertLevel` in the digest output to use raw counts.

- [ ] **Step 5: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS — no references to `getCapacityEstimate`, `CapacityEstimate`, `utilizationPercent`, or `alertLevel` from capacity tracking remain.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/capacity-tracking.ts src/app/api/admin/capacity/route.ts src/app/(dashboard)/admin/triage/operator-actions-panel.tsx src/lib/services/monthly-health-digest.ts
git commit -m "refactor: replace capacity formula with raw metrics (NEWFM-A)"
```

---

### Task 4: NEWFM-B — Volume-Trend Engagement Signal

**Files:**
- Modify: `src/lib/services/engagement-signals.ts`

- [ ] **Step 1: Add volume trend classifier**

In `src/lib/services/engagement-signals.ts`, after the `contractorContactStatus` function (line 90), add:

```typescript
function volumeTrendStatus(currentCount: number, priorCount: number): SignalStatus {
  // No baseline — new client, can't compare
  if (priorCount === 0) return 'green';
  // Severe drop: volume went to zero from 5+, or dropped 75%+
  if ((currentCount === 0 && priorCount >= 5) || currentCount < priorCount * 0.25) return 'red';
  // Significant drop: 50%+ decline AND at least 3 fewer leads
  if (currentCount < priorCount * 0.5 && priorCount - currentCount >= 3) return 'yellow';
  return 'green';
}
```

- [ ] **Step 2: Add 8th parallel query (31-60 day lead count)**

In the `Promise.all` array inside `getEngagementSignals()` (starting around line 147), add a new entry after the `recentLeadCountRow` query:

```typescript
    // 7. Prior period lead count (31-60 days ago) — for volume trend signal
    db
      .select({ value: count() })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          gte(leads.createdAt, new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)),
          lt(leads.createdAt, thirtyDaysAgo)
        )
      )
      .then((rows) => rows[0] ?? { value: 0 }),
```

Add `lt` to the drizzle-orm imports at line 13:

```typescript
import { eq, and, gte, lt, inArray, max, count, isNotNull } from 'drizzle-orm';
```

Add `priorLeadCountRow` to the destructured result:

```typescript
  const [
    estRecencyRow,
    wonLostRecencyRow,
    kbTotalRow,
    kbResolvedRow,
    nudgeTotalRow,
    nudgeRespondedRow,
    contractorContactRow,
    recentLeadCountRow,
    priorLeadCountRow,
  ] = await Promise.all([
```

- [ ] **Step 3: Build signal 6 (volume trend)**

After building `signal5` (around line 307), add:

```typescript
  const currentLeadCount = Number(recentLeadCountRow.value);
  const priorLeadCount = Number(priorLeadCountRow.value);
  const signal6: EngagementSignal = {
    key: 'lead_volume_trend',
    label: 'Lead volume trend (30d vs prior 30d)',
    status: volumeTrendStatus(currentLeadCount, priorLeadCount),
    value: `${currentLeadCount} vs ${priorLeadCount}`,
    threshold: 'Green: stable/growing, Yellow: -50%+ (3+ drop), Red: -75%+ or zero from 5+',
  };
```

- [ ] **Step 4: Adjust dampening threshold**

Change line 314 from:
```typescript
  if (recentLeadCount < 3) {
```
to:
```typescript
  if (currentLeadCount < 1) {
```

(Use the `currentLeadCount` variable created in step 3 instead of `recentLeadCount`.)

- [ ] **Step 5: Update signal array and flagging**

Change line 319 from:
```typescript
  const signals = [signal1, signal2, signal3, signal4, signal5];
```
to:
```typescript
  const signals = [signal1, signal2, signal3, signal4, signal5, signal6];
```

The flagging threshold at line 324 stays the same — `yellowCount + redCount >= 4` now applies to 6 signals.

- [ ] **Step 6: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/engagement-signals.ts
git commit -m "feat: add volume-trend signal + reduce dampening threshold (NEWFM-B)"
```

---

### Task 5: NEWFM-C — Digest Item Ordering and Dedup Fix

**Files:**
- Modify: `src/lib/services/contractor-digest.ts`
- Modify: `src/lib/services/operator-actions.ts`

- [ ] **Step 1: Change dedup constant**

In `src/lib/services/contractor-digest.ts`, change line 27:

```typescript
const DIGEST_DEDUP_HOURS = 24;
```

- [ ] **Step 2: Refactor buildDigest() for priority-balanced slot allocation**

Replace the item assembly logic in `buildDigest()`. After the dedup query (line 70) and before `if (items.length === 0)` (line 184), replace the three query sections with:

```typescript
  // ── 1. Query all types independently (up to MAX_DIGEST_ITEMS each) ────────

  // 1a. KB gaps
  const gapWhere =
    recentlyDigestedIdsArray.length > 0
      ? and(
          eq(knowledgeGaps.clientId, clientId),
          eq(knowledgeGaps.status, 'new'),
          notInArray(knowledgeGaps.id, recentlyDigestedIdsArray)
        )
      : and(eq(knowledgeGaps.clientId, clientId), eq(knowledgeGaps.status, 'new'));

  const gaps = await db
    .select({ id: knowledgeGaps.id, question: knowledgeGaps.question })
    .from(knowledgeGaps)
    .where(gapWhere)
    .orderBy(desc(knowledgeGaps.priorityScore))
    .limit(MAX_DIGEST_ITEMS);

  const kbItems: DigestItem[] = gaps.map((gap) => ({
    type: 'kb_gap' as const,
    id: gap.id,
    label: gap.question,
  }));

  // 1b. Stale estimate_sent leads (14+ days, unresolved)
  const estimateCutoff = new Date(now.getTime() - ESTIMATE_STALE_DAYS * 24 * 60 * 60 * 1000);

  const staleEstimates = await db
    .select({ id: leads.id, name: leads.name })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.status, 'estimate_sent'),
        lt(leads.updatedAt, estimateCutoff)
      )
    )
    .limit(MAX_DIGEST_ITEMS);

  const estimateItems: DigestItem[] = staleEstimates
    .filter((lead) => !recentlyDigestedIds.has(lead.id))
    .map((lead) => ({
      type: 'estimate_prompt' as const,
      id: lead.id,
      label: abbreviateName(lead.name),
    }));

  // 1c. Post-appointment unresolved leads (7+ days old appointment)
  const appointmentCutoff = new Date(now.getTime() - APPOINTMENT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const cutoffDate = appointmentCutoff.toISOString().split('T')[0];

  const qualifyingAppointments = await db
    .select({ leadId: appointments.leadId })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, clientId),
        inArray(appointments.status, ['completed', 'confirmed']),
        lte(appointments.appointmentDate, cutoffDate)
      )
    );

  const appointmentLeadIds = [...new Set(qualifyingAppointments.map((a) => a.leadId))];
  let wonLostItems: DigestItem[] = [];

  if (appointmentLeadIds.length > 0) {
    const estimateLeadIds = new Set(estimateItems.map((i) => i.id));
    const unresolvedLeadIds = appointmentLeadIds.filter(
      (id) => !estimateLeadIds.has(id) && !recentlyDigestedIds.has(id)
    );

    if (unresolvedLeadIds.length > 0) {
      const unresolvedLeads = await db
        .select({ id: leads.id, name: leads.name })
        .from(leads)
        .where(
          and(
            inArray(leads.id, unresolvedLeadIds),
            notInArray(leads.status, [...RESOLVED_STATUSES])
          )
        )
        .limit(MAX_DIGEST_ITEMS);

      wonLostItems = unresolvedLeads.map((lead) => ({
        type: 'won_lost_prompt' as const,
        id: lead.id,
        label: abbreviateName(lead.name),
      }));
    }
  }

  // ── 2. Priority-balanced slot allocation ──────────────────────────────────
  // Reserve at least 2 slots for WON/LOST, 2 for estimates (if available).
  // Remaining slots go to KB gaps.
  const wonLostSlots = Math.min(2, wonLostItems.length);
  const estimateSlots = Math.min(2, estimateItems.length);
  const kbSlots = MAX_DIGEST_ITEMS - wonLostSlots - estimateSlots;

  const items: DigestItem[] = [
    ...wonLostItems.slice(0, wonLostSlots),
    ...estimateItems.slice(0, estimateSlots),
    ...kbItems.slice(0, kbSlots),
  ];

  // Fill remaining slots if any type had fewer items than reserved
  const remaining = MAX_DIGEST_ITEMS - items.length;
  if (remaining > 0) {
    const usedIds = new Set(items.map((i) => i.id));
    const overflow = [
      ...wonLostItems.filter((i) => !usedIds.has(i.id)),
      ...estimateItems.filter((i) => !usedIds.has(i.id)),
      ...kbItems.filter((i) => !usedIds.has(i.id)),
    ];
    items.push(...overflow.slice(0, remaining));
  }
```

Then update the rest of the function — remove the old `cappedItems` line and use `items` directly (it is already capped at MAX_DIGEST_ITEMS by the slot allocation):

Replace:
```typescript
  if (items.length === 0) return null;

  // Cap at MAX_DIGEST_ITEMS
  const cappedItems = items.slice(0, MAX_DIGEST_ITEMS);
```

With:
```typescript
  if (items.length === 0) return null;
```

And change all references to `cappedItems` to `items` in the dedup write block.

- [ ] **Step 3: Add digest_no_response operator action**

In `src/lib/services/operator-actions.ts`, add a new fetch function before `getOperatorActions()`:

```typescript
/**
 * Items included in 3+ daily digests in the last 10 days without contractor response.
 */
async function fetchDigestNoResponse(): Promise<OperatorAction[]> {
  const db = getDb();
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  // Find resourceIds that appeared in 3+ digests
  const repeatedItems = await db
    .select({
      resourceId: auditLog.resourceId,
      clientId: auditLog.clientId,
      appearances: count(auditLog.id),
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, 'digest_item_included'),
        gte(auditLog.createdAt, tenDaysAgo)
      )
    )
    .groupBy(auditLog.resourceId, auditLog.clientId)
    .having(sql`count(${auditLog.id}) >= 3`);

  if (repeatedItems.length === 0) return [];

  // Resolve client names
  const clientIds = [...new Set(repeatedItems.map((r) => r.clientId).filter((id): id is string => id !== null))];
  if (clientIds.length === 0) return [];

  const clientRows = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(inArray(clients.id, clientIds));

  const clientNameMap = new Map(clientRows.map((c) => [c.id, c.businessName]));

  return repeatedItems
    .filter((r) => r.clientId !== null && r.resourceId !== null)
    .map((r) => ({
      id: `digest_no_response_${r.clientId}_${r.resourceId}`,
      type: 'digest_no_response',
      clientId: r.clientId!,
      clientName: clientNameMap.get(r.clientId!) ?? 'Unknown',
      urgency: 'yellow' as const,
      title: 'Digest item ignored 3+ times',
      detail: `Item ${r.resourceId!.slice(0, 8)}... appeared in ${Number(r.appearances)} digests without response`,
      actionUrl: `/admin/clients/${r.clientId}`,
      createdAt: new Date(),
    }));
}
```

Then wire it into `getOperatorActions()` — add to the `Promise.all` array:

```typescript
    fetchDigestNoResponse().catch((err: unknown) => {
      logSanitizedConsoleError('[OperatorActions] digest_no_response query failed:', err, {});
      return [] as OperatorAction[];
    }),
```

And spread it into the `all` array:

```typescript
  const all: OperatorAction[] = [
    ...escalationActions,
    ...onboardingActions,
    ...forwardingActions,
    ...kbGapActions,
    ...digestResponseActions,
    ...guaranteeActions,
    ...callPrepActions,
    ...listingMigrationActions,
    ...paymentNotCapturedActions,
    ...digestNoResponseActions,
  ];
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/contractor-digest.ts src/lib/services/operator-actions.ts
git commit -m "feat: priority-balanced digest ordering + 24h dedup + no-response escalation (NEWFM-C)"
```

---

### Task 6: FM-40 — Appointment-Based Follow-Up Trigger

**Files:**
- Create: `src/lib/automations/appointment-followup-trigger.ts`
- Create: `src/app/api/cron/appointment-followup/route.ts`
- Modify: `src/app/api/cron/route.ts`

- [ ] **Step 1: Create the automation**

Create `src/lib/automations/appointment-followup-trigger.ts`:

```typescript
import { getDb } from '@/db';
import { appointments, leads, scheduledMessages, conversations, auditLog } from '@/db/schema';
import { eq, and, inArray, lte, gte, desc, notInArray } from 'drizzle-orm';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';
import { detectCompetitorChosenSignal } from '@/lib/automations/estimate-auto-trigger';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const TRIGGER_AFTER_DAYS = 3;
const MAX_APPOINTMENT_AGE_DAYS = 30;
const CONVERSATION_SILENCE_HOURS = 48;
const RESOLVED_STATUSES = ['won', 'lost', 'closed', 'estimate_sent'] as const;

/**
 * Daily cron: find appointments 3-30 days old where no estimate follow-up
 * has been triggered. Infers that the estimate was given at/after the
 * appointment and starts the follow-up sequence automatically.
 *
 * This removes the dependency on contractors flagging "estimate sent."
 */
export async function runAppointmentFollowupTrigger(): Promise<{
  processed: number;
  triggered: number;
  skipped: number;
}> {
  const db = getDb();
  const now = new Date();
  const triggerCutoff = new Date(now.getTime() - TRIGGER_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const maxAgeCutoff = new Date(now.getTime() - MAX_APPOINTMENT_AGE_DAYS * 24 * 60 * 60 * 1000);
  const silenceCutoff = new Date(now.getTime() - CONVERSATION_SILENCE_HOURS * 60 * 60 * 1000);

  const triggerDate = triggerCutoff.toISOString().split('T')[0];
  const maxAgeDate = maxAgeCutoff.toISOString().split('T')[0];

  // 1. Query qualifying appointments: completed/confirmed, 3-30 days old
  const qualifyingAppointments = await db
    .select({
      id: appointments.id,
      leadId: appointments.leadId,
      clientId: appointments.clientId,
      appointmentDate: appointments.appointmentDate,
    })
    .from(appointments)
    .where(
      and(
        inArray(appointments.status, ['completed', 'confirmed']),
        lte(appointments.appointmentDate, triggerDate),
        gte(appointments.appointmentDate, maxAgeDate)
      )
    );

  if (qualifyingAppointments.length === 0) {
    return { processed: 0, triggered: 0, skipped: 0 };
  }

  // Deduplicate by leadId (one lead may have multiple appointments)
  const seenLeads = new Set<string>();
  const uniqueAppointments = qualifyingAppointments.filter((a) => {
    if (seenLeads.has(a.leadId)) return false;
    seenLeads.add(a.leadId);
    return true;
  });

  let triggered = 0;
  let skipped = 0;

  for (const appt of uniqueAppointments) {
    try {
      // Filter 1: Lead status not resolved
      const [lead] = await db
        .select({ status: leads.status })
        .from(leads)
        .where(eq(leads.id, appt.leadId))
        .limit(1);

      if (!lead || (RESOLVED_STATUSES as readonly string[]).includes(lead.status ?? '')) {
        skipped++;
        continue;
      }

      // Filter 2: No active estimate follow-up sequence
      const [activeSequence] = await db
        .select({ id: scheduledMessages.id })
        .from(scheduledMessages)
        .where(
          and(
            eq(scheduledMessages.leadId, appt.leadId),
            eq(scheduledMessages.sequenceType, 'estimate_followup'),
            eq(scheduledMessages.sent, false),
            eq(scheduledMessages.cancelled, false)
          )
        )
        .limit(1);

      if (activeSequence) {
        skipped++;
        continue;
      }

      // Filter 3: No outbound conversation in last 48h
      const [recentOutbound] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.leadId, appt.leadId),
            eq(conversations.direction, 'outbound'),
            gte(conversations.createdAt, silenceCutoff)
          )
        )
        .limit(1);

      if (recentOutbound) {
        skipped++;
        continue;
      }

      // Filter 4: Competitor-chosen guard
      const recentInbound = await db
        .select({ content: conversations.content })
        .from(conversations)
        .where(
          and(
            eq(conversations.leadId, appt.leadId),
            eq(conversations.direction, 'inbound')
          )
        )
        .orderBy(desc(conversations.createdAt))
        .limit(5);

      const competitorDetected = recentInbound.some(
        (conv) => conv.content !== null && detectCompetitorChosenSignal(conv.content)
      );

      if (competitorDetected) {
        skipped++;
        continue;
      }

      // Action: update lead status to estimate_sent
      await db
        .update(leads)
        .set({ status: 'estimate_sent', updatedAt: now })
        .where(eq(leads.id, appt.leadId));

      // Action: start estimate follow-up sequence
      const result = await startEstimateFollowup({
        leadId: appt.leadId,
        clientId: appt.clientId,
      });

      if (result.success) {
        triggered++;

        // Audit log
        await db.insert(auditLog).values({
          clientId: appt.clientId,
          action: 'appointment_followup_triggered',
          resourceType: 'lead',
          resourceId: appt.leadId,
          metadata: {
            appointmentId: appt.id,
            appointmentDate: appt.appointmentDate,
            scheduledCount: result.scheduledCount,
          } as Record<string, unknown>,
        });
      } else {
        skipped++;
      }
    } catch (err) {
      logSanitizedConsoleError('[AppointmentFollowup] Error processing appointment:', err, {
        appointmentId: appt.id,
        leadId: appt.leadId,
      });
      skipped++;
    }
  }

  console.log('[AppointmentFollowup] Complete:', { processed: uniqueAppointments.length, triggered, skipped });
  return { processed: uniqueAppointments.length, triggered, skipped };
}
```

- [ ] **Step 2: Create the cron sub-endpoint**

Create `src/app/api/cron/appointment-followup/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { runAppointmentFollowupTrigger } from '@/lib/automations/appointment-followup-trigger';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAppointmentFollowupTrigger();
    return NextResponse.json(result);
  } catch (error) {
    logSanitizedConsoleError('[Cron] Appointment followup trigger failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Register in cron orchestrator**

In `src/app/api/cron/route.ts`, in the daily 7am UTC block (around line 286-291), add after the `onboardingPriming` dispatch:

```typescript
      results.appointmentFollowup = await dispatch(baseUrl, '/api/cron/appointment-followup', cronSecret!, 'GET', failedJobs);
```

Also add the import at the top if needed (it uses the dispatch helper, so no import needed).

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/automations/appointment-followup-trigger.ts src/app/api/cron/appointment-followup/route.ts src/app/api/cron/route.ts
git commit -m "feat: appointment-based estimate follow-up trigger (FM-40)"
```

---

### Task 7: Documentation Updates

**Files:**
- Modify: `docs/product/PLATFORM-CAPABILITIES.md`
- Modify: `docs/engineering/01-TESTING-GUIDE.md`
- Modify: `docs/operations/01-OPERATIONS-GUIDE.md`
- Modify: `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md`
- Modify: `docs/operations/LAUNCH-CHECKLIST.md`
- Modify: `docs/product/FEATURE-BACKLOG.md`

- [ ] **Step 1: Update PLATFORM-CAPABILITIES.md**

Updates needed:
- **Section 2 (Follow-Up Automation)**: Add appointment-age trigger as primary estimate follow-up trigger. Update daily digest: priority-balanced ordering (WON/LOST and estimates get reserved slots), 24h dedup.
- **Section 6 (Compliance)**: Update quiet hours — inbound-reply exemption now enabled by default.
- **Section 11 (Agency Operations)**: Update capacity tracking to raw metrics (no utilization percentage). Add `/api/health` endpoint. Add `digest_no_response` to operator action types. Update engagement signals from 5 to 6 signals (add `lead_volume_trend`), note dampening threshold changed to < 1 lead.

- [ ] **Step 2: Update TESTING-GUIDE.md**

Add/update test steps for:
- Health endpoint: verify `/api/health` returns 200 when heartbeat cursor is recent, 503 when stale
- Capacity: verify `/api/admin/capacity` returns raw counts (totalClients, byPhase, openEscalations, openKbGaps)
- Engagement signals: test volume-trend signal (stable volume = green, -50% = yellow, -75% = red). Test dampening only fires at 0 leads (not 1-2).
- Digest: verify WON/LOST prompts appear even when 10+ KB gaps exist. Verify 24h dedup (item reappears next day).
- Quiet hours: update default test — exemption is now ON by default, test with flag OFF for strict mode.
- Appointment follow-up: verify lead with completed appointment 3+ days old gets estimate follow-up triggered. Verify dedup (no double-trigger if conversation signal already fired). Verify competitor-chosen guard.

- [ ] **Step 3: Update OPERATIONS-GUIDE.md**

- Add appointment-followup-trigger to daily cron table
- Update capacity section: raw metrics, no percentage
- Add `digest_no_response` to operator action descriptions

- [ ] **Step 4: Update MANAGED-SERVICE-PLAYBOOK.md**

- Update at-risk detection: 6 signals (add volume trend), dampening threshold < 1
- Update estimate follow-up section: system auto-detects post-appointment leads, no contractor flagging required

- [ ] **Step 5: Update LAUNCH-CHECKLIST.md**

- In Phase 0 (Infrastructure): add "Configure external health monitor to ping `/api/health` every 5 minutes"

- [ ] **Step 6: Update FEATURE-BACKLOG.md**

- Update FMA-W4-3 (Capacity Tracking): "Simplified to raw metrics (client counts, escalations, KB gaps). Utilization formula removed — operator uses raw data points."

- [ ] **Step 7: Commit**

```bash
git add docs/product/PLATFORM-CAPABILITIES.md docs/engineering/01-TESTING-GUIDE.md docs/operations/01-OPERATIONS-GUIDE.md docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md docs/operations/LAUNCH-CHECKLIST.md docs/product/FEATURE-BACKLOG.md
git commit -m "docs: update all docs for Wave 5 consensus FMA resolution"
```

---

## Verification

After all tasks, run the completion gate:

```bash
npm run quality:no-regressions
```

Expected: all green (typecheck + build + tests + runtime smoke).
