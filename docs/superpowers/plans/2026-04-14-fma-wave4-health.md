# FMA Wave 4: System Health — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add system-level health monitoring, capacity tracking, monthly operator digest, and quiet hours inbound-reply classification. Completes the FMA resolution implementation.

**Architecture:** Extend existing ops kill switches (`ops-kill-switches.ts`) with per-client circuit breakers and rate anomaly detection. Build capacity estimation model as a new service. Add monthly digest generator reusing existing report patterns. Enhance compliance gateway with message classification at call sites.

**Tech Stack:** Drizzle ORM, existing `systemSettings` cache pattern, existing compliance gateway, existing cron catchup infrastructure.

**Prerequisites:** Wave 3 cockpit (provides display surface). All complete.

**Key codebase findings:**
- Cron heartbeat tracking exists via `cronJobCursors` table + `cron-catchup.ts` — tracks status, backlog, errors per job
- Kill switches exist in `ops-kill-switches.ts` — cached booleans in `systemSettings`
- Reliability dashboard exists at `/admin/settings` with 5-metric summary
- Compliance gateway already has `messageClassification` param and quiet hours policy modes
- `QUIET_HOURS_MESSAGE_CLASSIFICATIONS` with `INBOUND_REPLY` and `PROACTIVE_OUTREACH` already defined
- No capacity tracking or monthly digest exists

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/services/ops-health-monitor.ts` | Circuit breaker logic, rate anomaly detection, health badge computation |
| Create | `src/lib/automations/heartbeat-check.ts` | Daily meta-cron checking all expected crons fired |
| Create | `src/app/api/cron/heartbeat-check/route.ts` | Cron endpoint |
| Create | `src/lib/services/capacity-tracking.ts` | Per-client weekly hours estimation, utilization calculation, alerts |
| Create | `src/app/api/admin/capacity/route.ts` | GET endpoint for capacity data |
| Create | `src/lib/services/monthly-health-digest.ts` | Monthly operator report generation |
| Create | `src/app/api/admin/system-health/route.ts` | GET endpoint for monthly digest data |
| Create | `src/app/(dashboard)/admin/system-health/page.tsx` | System health page showing monthly digest |
| Modify | `src/app/api/cron/route.ts` | Register heartbeat-check cron |
| Modify | `src/app/(dashboard)/admin/triage/operator-actions-panel.tsx` | Add health badge + capacity KPI |
| Modify | `src/lib/compliance/compliance-gateway.ts` | Ensure classification is passed through consistently |
| Modify | `src/lib/features/check-feature.ts` | No changes — `opsHealthMonitor`, `capacityTracking` already in SystemFeatureFlag |

---

### Task 1: Ops health monitor service

**Intent:** Circuit breaker logic for per-client automation pauses, rate anomaly detection, and health badge computation. Extends existing kill switch infrastructure.

**What to build — `src/lib/services/ops-health-monitor.ts`:**

**Function 1: `getHealthBadge(): Promise<HealthBadge>`**
- Queries `cronJobCursors` for any jobs with `status = 'failed'` or `backlogCount > 0`
- Checks ops kill switches (existing `isOpsKillSwitchEnabled()`)
- Returns `{ status: 'green' | 'yellow' | 'red', details: string[], activeCircuitBreakers: string[] }`
- Green: all crons healthy, no kill switches active
- Yellow: any cron failed/backlogged, or any single-client circuit breaker active
- Red: any system-wide kill switch active, or 3+ clients with circuit breakers

**Function 2: `checkClientCircuitBreaker(clientId: string): Promise<{ tripped: boolean; reason?: string }>`**
- Query `auditLog` for errors in last 24h for this client (action containing 'error' or 'failed')
- If count >= 3 different automation errors: circuit breaker tripped
- Return result

**Function 3: `checkRateAnomaly(): Promise<{ anomaly: boolean; detail?: string }>`**
- Count total outbound `agencyMessages` in last 24h
- Compare to average daily count over last 7 days
- If today > 2x average: anomaly detected
- Return result

**Feature flag:** `resolveFeatureFlag` is not per-client here — use system-level check via `systemSettings` key `feature.opsHealthMonitor.enabled`.

**Steps:**
- [ ] **Step 1:** Create `src/lib/services/ops-health-monitor.ts` with 3 functions
- [ ] **Step 2:** Run typecheck
- [ ] **Step 3:** Commit: `feat: ops health monitor with circuit breakers and rate anomaly detection (FMA 6.1)`

---

### Task 2: Heartbeat check cron

**Intent:** Daily meta-cron that verifies all expected crons fired in the last 24 hours. Alerts operator if any are missing.

**What to build — `src/lib/automations/heartbeat-check.ts`:**

`runHeartbeatCheck()` function:
1. Query `cronJobCursors` table — get all jobs
2. For each job, check if `lastRunAt` is within last 26 hours (24h + 2h buffer for timing drift)
3. Jobs with stale `lastRunAt` or `status = 'failed'` → collect as issues
4. Check rate anomaly via `checkRateAnomaly()` from ops-health-monitor
5. If any issues found: write audit_log entry with action `'heartbeat_check_alert'` and metadata listing stale/failed jobs
6. Return `{ healthy: boolean; issues: string[] }`

**Cron registration:** Run daily at midnight UTC (hour === 0, in the daily block). Create `src/app/api/cron/heartbeat-check/route.ts` following existing pattern. Register in `src/app/api/cron/route.ts`.

**Steps:**
- [ ] **Step 1:** Create `src/lib/automations/heartbeat-check.ts`
- [ ] **Step 2:** Create `src/app/api/cron/heartbeat-check/route.ts`
- [ ] **Step 3:** Register in cron orchestrator
- [ ] **Step 4:** Run typecheck
- [ ] **Step 5:** Commit: `feat: daily heartbeat check cron for automation health (FMA 6.1)`

---

### Task 3: Capacity tracking service

**Intent:** Estimate operator hours per client based on lifecycle phase and activity. Show total utilization. Alert when approaching capacity wall.

**What to build — `src/lib/services/capacity-tracking.ts`:**

**Function: `getCapacityEstimate(): Promise<CapacityEstimate>`**

Per-client estimation model:
| Lifecycle phase | Base hours/week |
|----------------|----------------|
| Onboarding (< 14 days old) | 5.0 |
| Smart Assist active (`aiAgentMode = 'assist'`) | 2.5 |
| Autonomous (`aiAgentMode = 'autonomous'`) | 1.5 |
| Paused (`status = 'paused'`) | 0.25 |

Activity multipliers (additive):
- Escalation count last 7 days > 5: +1.0h
- Open KB gaps > 5: +0.5h
- Engagement health `at_risk` or `disengaged`: +0.5h

**Return type:**
```typescript
interface ClientCapacity {
  clientId: string;
  clientName: string;
  phase: string;
  baseHours: number;
  activityAdjustment: number;
  totalHours: number;
}

interface CapacityEstimate {
  clients: ClientCapacity[];
  totalWeeklyHours: number;
  maxCapacityHours: number;     // 40h (single operator)
  utilizationPercent: number;
  alertLevel: 'green' | 'yellow' | 'red';  // green < 80%, yellow 80-99%, red >= 100%
  smartAssistQueueDepth: number;  // count of clients in assist mode
}
```

Query all active clients, compute per-client hours, sum. `maxCapacityHours = 40` (single operator assumption).

**Feature flag:** `resolveFeatureFlag` not applicable — this is an operator tool, not per-client. Check `systemSettings` key `feature.capacityTracking.enabled`.

**API endpoint:** `GET /api/admin/capacity` — uses `adminRoute` with `CLIENTS_VIEW`.

**Steps:**
- [ ] **Step 1:** Create `src/lib/services/capacity-tracking.ts`
- [ ] **Step 2:** Create `src/app/api/admin/capacity/route.ts`
- [ ] **Step 3:** Run typecheck
- [ ] **Step 4:** Commit: `feat: capacity tracking with per-client hours estimation (FMA 6.3)`

---

### Task 4: Monthly health digest

**Intent:** Auto-generated monthly system health report for operator. Accessible at `/admin/system-health`.

**What to build — `src/lib/services/monthly-health-digest.ts`:**

**Function: `generateMonthlyDigest(): Promise<MonthlyDigest>`**

Content sections (all from DB queries, no AI):
1. **Client overview:** Total active, paused, cancelled. New this month. Churned this month.
2. **Capacity utilization:** Use `getCapacityEstimate()` from capacity-tracking
3. **Automation performance:** Query `cronJobCursors` — jobs that ran successfully, failed, skipped. Group by job key.
4. **Engagement signal distribution:** For each active client, compute engagement signals. Count green/yellow/red across all clients.
5. **Guarantee tracker:** Clients with active guarantees, approaching deadlines (< 30 days), fulfilled, refunded.
6. **Key metrics:** Total messages sent this month, total leads created, total appointments, total revenue (won leads).

**Return type:** `MonthlyDigest` with sections matching above. Each section has a `title`, `data` (typed per section), and `summary` string.

**API endpoint:** `GET /api/admin/system-health` — generates digest on demand (not pre-computed).

**Page:** `src/app/(dashboard)/admin/system-health/page.tsx` — RSC page displaying the digest in card layout.

**Steps:**
- [ ] **Step 1:** Create `src/lib/services/monthly-health-digest.ts`
- [ ] **Step 2:** Create `src/app/api/admin/system-health/route.ts`
- [ ] **Step 3:** Create `src/app/(dashboard)/admin/system-health/page.tsx`
- [ ] **Step 4:** Run typecheck
- [ ] **Step 5:** Commit: `feat: monthly health digest with system-wide metrics (FMA 6.2)`

---

### Task 5: Cockpit KPI updates (health badge + capacity)

**Intent:** Add health badge and capacity utilization to the triage dashboard KPI row.

**What to modify — `src/app/(dashboard)/admin/triage/operator-actions-panel.tsx`:**

1. Fetch `GET /api/admin/capacity` alongside the operator actions fetch
2. Add a 4th KPI card: "Capacity" showing `utilizationPercent`% with color coding (green/yellow/red)
3. Add health badge indicator — fetch from a new lightweight endpoint or compute from operator actions (if actions have 0 red = green, any red = yellow/red)
4. The capacity card should link to `/admin/system-health` for details

**Steps:**
- [ ] **Step 1:** Add capacity fetch + KPI card to operator actions panel
- [ ] **Step 2:** Run typecheck
- [ ] **Step 3:** Commit: `feat: capacity and health KPIs in operator cockpit (FMA 6.1/6.3)`

---

### Task 6: Quiet hours inbound-reply classification

**Intent:** Ensure all outbound message call sites properly classify messages as `inbound_reply` or `proactive_outreach`. The compliance gateway already supports this — we need to verify and fix call sites that don't pass the classification.

**What to do:**

The compliance gateway at `src/lib/compliance/compliance-gateway.ts` already accepts `messageClassification` param with `INBOUND_REPLY` and `PROACTIVE_OUTREACH` values. The quiet hours policy already handles the logic.

**Task:** Audit all call sites of `sendCompliantMessage()` and ensure they pass the correct classification:

1. **Inbound-reply (should send immediately, any hour):**
   - First response to missed call → `INBOUND_REPLY`
   - First response to form submission → `INBOUND_REPLY`
   - Direct reply to inbound SMS (within 4h) → `INBOUND_REPLY`
   - AI agent responses to homeowner messages → `INBOUND_REPLY`

2. **Proactive-outreach (queue for next compliant window):**
   - Estimate follow-up sequences → `PROACTIVE_OUTREACH`
   - Win-back messages → `PROACTIVE_OUTREACH`
   - Review requests → `PROACTIVE_OUTREACH`
   - Payment reminders → `PROACTIVE_OUTREACH`
   - Dormant reactivation → `PROACTIVE_OUTREACH`
   - Quarterly campaigns → `PROACTIVE_OUTREACH`

**Approach:** Grep for all `sendCompliantMessage()` calls. Check which ones pass `messageClassification`. For those that don't, determine the correct classification and add it.

**Feature flag:** `inboundReplyExemptionEnabled` — NEW flag. Add to `SystemFeatureFlag` type in `check-feature.ts`. When disabled, all messages treated as proactive (current default behavior). When enabled, inbound-reply messages bypass quiet hours.

**Steps:**
- [ ] **Step 1:** Add `inboundReplyExemptionEnabled` to SystemFeatureFlag type
- [ ] **Step 2:** Audit all `sendCompliantMessage()` call sites
- [ ] **Step 3:** Add `messageClassification` param to call sites that are missing it
- [ ] **Step 4:** In compliance gateway, check the feature flag before allowing inbound-reply bypass
- [ ] **Step 5:** Run typecheck + tests
- [ ] **Step 6:** Commit: `feat: quiet hours inbound-reply classification at all call sites (FMA 6.4)`

---

### Task 7: Documentation updates

**Docs to update:**
1. **PLATFORM-CAPABILITIES.md** — Section 11: ops health monitor, circuit breakers, heartbeat check. New section or subsection for capacity tracking. Mention monthly digest.
2. **TESTING-GUIDE.md** — Test steps for health badge API, capacity API, monthly digest, heartbeat cron, quiet hours classification.
3. **OPERATIONS-GUIDE.md** — How to use system health page, interpret capacity alerts, respond to circuit breakers.
4. **MANAGED-SERVICE-PLAYBOOK.md** — Monthly health review references system health page instead of manual checklist. Capacity management procedures.
5. **FEATURE-BACKLOG.md** — Mark Wave 4 items as shipped.

**Steps:**
- [ ] **Step 1:** Update each doc
- [ ] **Step 2:** Commit: `docs: update platform docs for FMA Wave 4 system health`

---

### Task 8: Quality gate

**Steps:**
- [ ] **Step 1:** Run `npm run typecheck`
- [ ] **Step 2:** Run `npm test`
- [ ] **Step 3:** Run `npm run build`
- [ ] **Step 4:** Run `npm run quality:no-regressions`
