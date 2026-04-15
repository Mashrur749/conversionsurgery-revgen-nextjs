# Consensus FMA Resolution — Wave 5 Design Spec

**Goal**: Resolve the 6 highest-impact findings from the 8-reviewer adversarial red-team consensus FMA report.

**Source**: `active/fma/managed-service-fma-consensus.md`

**Date**: 2026-04-15

---

## 1. NEWFM-A: Replace Capacity Formula with Raw Metrics

### Problem

`src/lib/services/capacity-tracking.ts` hardcodes `maxCapacityHours = 40` and computes a utilization percentage using phase-based `baseHours` per client. The real operator capacity is ~20-25h/week for ops work, making the percentage systematically wrong (shows 50% when operator is at 100%). The formula also becomes stale every time operations change, automations are added, or workflows evolve.

### Decision

Rip out the formula. Show raw facts instead of computed percentages. The operator knows when they are overloaded — give them data points, not a number that lies the moment processes change.

### Design

Replace the current `CapacityEstimate` interface with a simpler `CapacitySnapshot`:

```typescript
export interface CapacitySnapshot {
  totalClients: number;
  byPhase: {
    onboarding: number;   // clients created < 14 days ago
    assist: number;        // aiAgentMode === 'assist'
    autonomous: number;    // aiAgentMode === 'autonomous'
    manual: number;        // other
  };
  openEscalations: number;    // escalation_queue rows from last 7 days
  openKbGaps: number;         // knowledge_gaps with status = 'new'
  smartAssistQueueDepth: number; // clients in assist mode
}
```

Remove: `totalWeeklyHours`, `maxCapacityHours`, `utilizationPercent`, `alertLevel`, `ClientCapacity` per-client hour estimates, the graduated formula (`escalationAdjustment`, `kbGapAdjustment`).

Keep: The parallel queries for escalation counts and KB gap counts — but aggregate them as totals, not per-client hour adjustments.

### Files

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/lib/services/capacity-tracking.ts` | Rewrite: new `CapacitySnapshot` interface, remove hour computation, return raw counts |
| Modify | Any consumer of `getCapacityEstimate()` | Update to use `CapacitySnapshot` fields instead of `utilizationPercent`/`alertLevel` |

### Doc updates

| Doc | Section | Change |
|-----|---------|--------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 11: Agency Operations | Update capacity tracking description: raw metrics instead of utilization percentage |
| `docs/product/FEATURE-BACKLOG.md` | FMA-W4-3 row | Update: capacity tracking simplified to raw metrics, no utilization formula |
| `docs/engineering/01-TESTING-GUIDE.md` | Capacity tracking test steps | Update expected outputs: no percentage, no alert level |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Capacity section (if exists) | Update operator guidance: watch raw metrics, no percentage |

---

## 2. NEWFM-B: Volume-Trend Engagement Signal

### Problem

`src/lib/services/engagement-signals.ts` caps EST recency and WON/LOST recency at yellow when `recentLeadCount < 3` (lines 313-317). A contractor going from 12 leads/month to 2 (genuine disengagement hiding behind seasonal slowdown) has their most telling signals dampened. With the 4/5 flagging threshold, they may never be flagged.

### Design

**a) Add 6th signal: `lead_volume_trend`**

New query: count leads created in last 30 days (`currentCount`) and leads created 31-60 days ago (`priorCount`).

Status logic:
- `priorCount === 0`: green (no baseline to compare — new client)
- `currentCount >= priorCount * 0.5`: green (volume stable or growing)
- `currentCount < priorCount * 0.5` AND `priorCount - currentCount >= 3`: yellow (significant drop)
- `currentCount < priorCount * 0.25` OR (`currentCount === 0` AND `priorCount >= 5`): red (severe drop)

This signal fires independent of the recency dampening. A contractor going from 10 leads to 1 shows red on volume trend even if recency signals are capped at yellow.

**b) Reduce dampening threshold**

Change `recentLeadCount < 3` to `recentLeadCount < 1`. Only dampen recency signals when there are literally zero leads in 30 days — not "few leads." A contractor with 1-2 leads who ignores them is genuinely disengaging, not seasonally quiet.

**c) Update flagging threshold**

With 6 signals, keep the threshold at 4+ non-green = flagged. This is actually slightly less sensitive per-signal (4/6 vs 4/5), which compensates for adding the new signal — we don't want the volume trend alone to push borderline cases over the edge without other supporting signals.

### Files

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/lib/services/engagement-signals.ts` | Add 7th parallel query (31-60 day lead count), add `volumeTrendStatus()` classifier, add signal6 to array, change dampening threshold to `< 1`, update `EngagementSignalsResult` to include 6 signals |

### Doc updates

| Doc | Section | Change |
|-----|---------|--------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 11: Observability / Engagement Signals | Add 6th signal description, update dampening threshold |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | At-risk detection section | Add volume-trend signal to triage criteria |
| `docs/engineering/01-TESTING-GUIDE.md` | Engagement signals test steps | Add volume trend test scenarios |

---

## 3. NEWFM-C: Digest Item Ordering and Dedup Fix

### Problem

`src/lib/services/contractor-digest.ts` queries items in fixed order: KB gaps first, then estimates, then WON/LOST. With `MAX_DIGEST_ITEMS = 8`, WON/LOST prompts are consistently displaced by KB gaps on active clients. `DIGEST_DEDUP_HOURS = 48` means ignored items vanish for a full day before reappearing.

### Design

**a) Priority-balanced slot allocation**

Instead of fill-in-order, allocate slots by type priority:

1. Count available items per type (before applying the cap)
2. Reserve slots: min(2, available) for WON/LOST, min(2, available) for estimates, fill remainder with KB gaps
3. If a type has fewer items than its reservation, unused slots flow to other types

This ensures WON/LOST and estimate prompts always appear when they exist, even if there are 10+ KB gaps.

Implementation:
```
const wonLostItems = queryWonLostItems();   // up to MAX_DIGEST_ITEMS
const estimateItems = queryEstimateItems(); // up to MAX_DIGEST_ITEMS
const kbItems = queryKbItems();             // up to MAX_DIGEST_ITEMS

// Reserve: 2 WON/LOST, 2 estimates, 4 KB gaps (adjusts if fewer available)
const wonLostSlots = Math.min(2, wonLostItems.length);
const estimateSlots = Math.min(2, estimateItems.length);
const kbSlots = MAX_DIGEST_ITEMS - wonLostSlots - estimateSlots;

const items = [
  ...wonLostItems.slice(0, wonLostSlots),
  ...estimateItems.slice(0, estimateSlots),
  ...kbItems.slice(0, kbSlots),
];
```

**b) Reduce dedup window to 24h**

Change `DIGEST_DEDUP_HOURS` from 48 to 24. Items reappear the next day if unresolved.

**c) Escalate persistently ignored items**

Add a query to `operator-actions.ts`: check `audit_log` for items with `action = 'digest_item_included'` that appeared in 3+ digests (3+ rows with the same `resourceId`) within the last 10 days AND are still unresolved. Surface these as a `digest_no_response` operator action at yellow urgency.

This breaks the silent cycle: if a contractor ignores an item across 3 digests, the operator is explicitly notified.

### Files

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/lib/services/contractor-digest.ts` | Reorder: query all types first, then allocate slots proportionally. Change `DIGEST_DEDUP_HOURS` from 48 to 24. |
| Modify | `src/lib/services/operator-actions.ts` | Add `fetchDigestNoResponse()` query and wire into `getOperatorActions()` |

### Doc updates

| Doc | Section | Change |
|-----|---------|--------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 2: Follow-Up Automation / Daily Digest | Update: priority-balanced ordering, 24h dedup |
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 11: Agency Operations / Operator Actions | Add `digest_no_response` action type |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Digest section | Update dedup timing, explain new operator action |

---

## 4. NEWFM-E: Health Check Endpoint

### Problem

The heartbeat cron monitors all other crons but nothing external monitors the heartbeat. If the cron orchestrator fails (bad deploy, Cloudflare timeout), the platform goes silently dead.

### Design

New endpoint: `GET /api/health`

- **No auth required** (health checks must be publicly accessible for external monitors)
- Queries `cronJobCursors` for the `heartbeat_check` row
- If `lastRunAt` is within 26 hours: `200 { status: 'ok', lastHeartbeat: '<ISO timestamp>' }`
- If `lastRunAt` is stale or missing: `503 { status: 'degraded', issue: 'heartbeat stale', lastHeartbeat: '<ISO or null>' }`
- If DB query itself fails: `503 { status: 'degraded', issue: 'db unreachable' }`

The endpoint is intentionally minimal — it answers one question: "Is the platform alive?" External monitors (Cloudflare health check, BetterUptime, Cronitor) ping this endpoint on a 5-minute interval.

**Not in scope**: Building the external monitor integration. That's a Cloudflare/BetterUptime configuration step done at deploy time.

### Files

| Action | File | What changes |
|--------|------|-------------|
| Create | `src/app/api/health/route.ts` | New endpoint, no auth, queries cronJobCursors |

### Doc updates

| Doc | Section | Change |
|-----|---------|--------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 11: Observability | Add health endpoint description |
| `docs/engineering/01-TESTING-GUIDE.md` | Cron / health section | Add test step: verify `/api/health` returns 200 when heartbeat is recent |
| `docs/operations/LAUNCH-CHECKLIST.md` | Phase 0: Infrastructure | Add: configure external health monitor to ping `/api/health` every 5 minutes |

---

## 5. FM-38: Flip Quiet Hours Inbound-Reply Default

### Problem

`inboundReplyExemptionEnabled` defaults to `false`. The compliance gateway at `compliance-gateway.ts:278` checks this flag and downgrades inbound replies to proactive outreach when off. Result: leads who text at 10pm wait until 9am for a reply.

### Decision

Flip the system default to `true`. First responses to inbound contacts send immediately regardless of quiet hours. Proactive automations (estimate follow-ups, win-backs, review requests) still respect quiet hours — only direct responses to inbound messages bypass.

The per-client toggle remains available if an operator wants strict quiet hours for a specific client.

### Design

Change the hardcoded default in the feature flag resolution. The `resolveFeatureFlag()` function in `src/lib/services/feature-flags.ts` falls back to `false` when no system-settings row and no client override exists. For `inboundReplyExemptionEnabled` specifically, change this default to `true`.

Implementation: Add an explicit default map for system feature flags that overrides the generic `false` fallback.

### Files

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/lib/services/feature-flags.ts` | Add `SYSTEM_FLAG_DEFAULTS` map with `inboundReplyExemptionEnabled: true`. Use this in `resolveFeatureFlag()` fallback. |

### Doc updates

| Doc | Section | Change |
|-----|---------|--------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 6: Compliance / Quiet Hours | Update: inbound-reply exemption enabled by default |
| `docs/engineering/01-TESTING-GUIDE.md` | Quiet hours test steps | Update: default is now exemption-enabled, test with flag OFF for strict mode |

---

## 6. FM-40: Appointment-Based Follow-Up Trigger

### Problem

`estimate-auto-trigger.ts` only fires when conversation text matches signal patterns (homeowner says "waiting on quote"). If the contractor sends the estimate offline (Jobber, email, in-person at appointment) and the homeowner says nothing about it, the follow-up automation never triggers. This is the highest-value automation — post-estimate follow-up catches leads who went cold after getting a quote.

### Decision

Reframe the trigger: for home service contractors, the appointment IS the estimate event. A roofer inspects and quotes on-site. If an appointment happened 3+ days ago and no outcome is recorded, the lead is almost certainly in "estimate sent, waiting for decision" state. Use appointment age as the primary trigger instead of depending on the contractor to flag it.

### Design

New daily cron automation: `appointment-followup-trigger.ts`

**Query**: Appointments with status `completed` or `confirmed` where `appointmentDate` is 3-30 days ago.

**Filters** (all must pass):
1. Lead status NOT in `won`, `lost`, `closed`, `estimate_sent` (already being tracked)
2. No active estimate follow-up sequence scheduled (`scheduledMessages` with `sequenceType = 'estimate_followup'`, `sent = false`, `cancelled = false`)
3. No outbound conversation in last 48h for this lead (don't interrupt active AI threads)
4. Competitor-chosen guard: scan last 5 inbound messages for rejection signals (reuse `detectCompetitorChosenSignal()` from `estimate-auto-trigger.ts`)

**Action for qualifying leads**:
1. Update lead status to `estimate_sent` (marks it in the pipeline)
2. Call `startEstimateFollowup({ leadId, clientId })` — reuses the existing 4-touch sequence (Day 2, 5, 10, 14 from trigger point)
3. Write audit log entry: `action: 'appointment_followup_triggered'`, `metadata: { appointmentId, daysSinceAppointment }`

**Effective timing from appointment**: Since the trigger fires at appointment + 3 days, and the estimate follow-up sequence sends at Day 2, 5, 10, 14 from trigger, the homeowner receives follow-ups at approximately Day 5, 8, 13, 17 post-appointment.

**Relationship to existing triggers**: The conversation-based `maybeAutoTriggerEstimateFollowup()` remains as a secondary trigger for leads that get quotes without appointments (phone quotes, email quotes). If a conversation signal fires before the appointment-age trigger, the dedup check (step 2 above) prevents double-triggering.

**Cron schedule**: Daily, after the daily digest cron. Register in `src/app/api/cron/route.ts`.

### Files

| Action | File | What changes |
|--------|------|-------------|
| Create | `src/lib/automations/appointment-followup-trigger.ts` | New automation: query qualifying appointments, filter, trigger follow-up |
| Modify | `src/app/api/cron/route.ts` | Register `appointment-followup-trigger` in daily cron schedule |

### Doc updates

| Doc | Section | Change |
|-----|---------|--------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 2: Follow-Up Automation / Estimate Follow-Up | Add appointment-age trigger as primary trigger, conversation signal as secondary |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Estimate follow-up section | Update: system auto-detects post-appointment leads, no contractor flagging required |
| `docs/engineering/01-TESTING-GUIDE.md` | Estimate follow-up test steps | Add: appointment-age trigger test scenarios (happy path, dedup, competitor guard) |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Cron jobs list | Add `appointment-followup-trigger` to daily cron table |

---

## Implementation Order

No dependencies between items — all 6 can be implemented in parallel. Recommended order if sequential:

1. **FM-38** (XS — one-line default change, immediate value)
2. **NEWFM-E** (S — new file, no existing code touched)
3. **NEWFM-A** (S — simplification, removes code)
4. **NEWFM-B** (S — modify existing service)
5. **NEWFM-C** (S — modify existing service + add operator action)
6. **FM-40** (M — new automation + cron registration)

---

## Complete Doc Update Matrix

| Doc | Changes from which items |
|-----|-------------------------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Items 1, 2, 3, 4, 5, 6 |
| `docs/engineering/01-TESTING-GUIDE.md` | Items 1, 2, 3, 4, 5, 6 |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Items 1, 3, 6 |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Items 2, 6 |
| `docs/operations/LAUNCH-CHECKLIST.md` | Item 4 |
| `docs/product/FEATURE-BACKLOG.md` | Item 1 |

---

## Out of Scope

- **NEWFM-D** (auto-resolve stale KB): Deferred — KB not old enough yet to matter
- **FM-01** (ICP validation): Deferred — operator is the salesperson at current scale
- **FM-59** (attribution policy): Policy decision, not code — documented in consensus report recommendations
- **Split findings** (action queue staleness, digest reply race): Low RPN, deferred to 15+ clients
- **External monitor setup** (Cloudflare/BetterUptime config): Ops task at deploy time, not application code
