# Wave B — Standard Tier Code Gap Closure

**Status:** Draft for founder approval
**Goal:** Close PG-003 and PG-004 to unblock Standard-tier sales (client #4+).
**Out of scope:** All Premium-tier (PG-101..PG-106), microsite (PG-201), offline conversion export (PG-104). Premium work deferred until first Standard customer requests upgrade — clearer lens on real demand reduces mis-spec risk.
**Effort:** 10-16 hours (1.5-2 working days).
**Timing:** Run in parallel with Pilot #1 Days 1-30. Does not block Pilot launch (Pilot tier does not promise either gap's deliverable).

---

## Context

After Wave A and Wave A Hardening shipped, the gap register has two open P1 items that ship Standard-tier deliverables:

- **PG-003** — `lostReason` exists on `jobs` only, not `leads`. No structured capture surface in portal. Win-back AI uses raw conversation history without classified objections.
- **PG-004** — No `assignedEstimatorId` on `leads`. Portal cannot filter pipeline by estimator. Standard tier promises estimator-level visibility per Business Reference §6.3.

Standard pitches start at client #4+ — typically 30-60 days after Pilot #1 signs. Wave B has runway.

---

## Decisions made up front

Flag any to override before execution.

| # | Decision | Rationale |
|---|---|---|
| D1 | `leads.lostReason` is `varchar(255)` free-text | Mirrors existing `jobs.lostReason` pattern. No enum debate. Operator/contractor enters reason as text; future analytics can classify via downstream tooling. |
| D2 | `leads.lostReasonNotes` NOT added | One column is enough. If "other / detail" is needed, the existing free-text holds it. |
| D3 | `leads.assignedEstimatorId` FK targets `agency_memberships.id` | Estimator = an agency-membership row with appropriate role. No new `estimators` table. Permission gating via existing role/permission system. |
| D4 | Estimator scoping: FK on `leads` only, NOT on `appointments` | Lead flows with one estimator through pipeline. Appointment-level reassignment can be added later if a Standard buyer needs it. Keeps schema minimal. |
| D5 | Backfill of `lostReason` on existing `lost`-status leads: NULL for now | If a related `job.lostReason` exists, surface it as fallback display. No automated backfill script. |
| D6 | Win-back AI lostReason context: included in Phase 1 | Cheap to thread through; meaningful payoff for Standard-tier credibility. |
| D7 | Default estimator = NULL | Solo contractors don't need to set anyone. Filter shows "Unassigned" bucket. |

---

## Phase 1 — PG-003 Won/Lost Reason Capture

### P1.1 — Schema migration (15 min)

**File:** `src/db/schema/leads.ts`

Add column:
```ts
lostReason: varchar('lost_reason', { length: 255 }),
lostAt: timestamp('lost_at'),
```

Mirror the `jobs` shape exactly. `lostAt` enables time-based reporting (won/lost trend over time) without joining to `jobs`.

**Run:** `pnpm run db:generate` → migration 0032 → review SQL → request `db:push` confirmation in OPERATOR-ACTIONS.

**Verify:** SQL diff is two ADD COLUMN, both nullable.

---

### P1.2 — Lead status transition handler (1-2 hr)

**Files to find:** grep `status.*'lost'\|status:.*lost` in `src/app/api/admin/leads/`, `src/app/api/client/leads/`, `src/lib/services/`.

**Behavior:** when lead transitions to `status='lost'`, accept optional `lostReason` + auto-set `lostAt = now()`. If reason omitted, allow it (capture in UI is encouraged but not required at API level).

**API change:** lead PATCH route accepts optional `{ lostReason?: string }` in body. Zod schema with `.strict()` and max-length 255.

**Verify:** unit test — patch lead to `status='lost'` with reason → row has both columns set. Without reason → only status + lostAt set.

---

### P1.3 — Capture surface in admin lead detail (1-2 hr)

**File:** admin lead detail page (likely `src/app/(dashboard)/admin/leads/[id]/page.tsx` or similar — verify path).

**UI:**
- Existing "Mark as Lost" action (if it exists; otherwise add).
- Replace simple status-change with AlertDialog containing: status confirmation, optional reason textarea (placeholder: "Why was this lost? e.g., 'Went with cheaper bid' / 'Project postponed' / 'Never replied to follow-up'"), Submit button.
- On submit, PATCH `/api/admin/leads/[id]` with `{ status: 'lost', lostReason }`.

**Component:** new `<MarkLeadLostDialog />` in `src/components/leads/mark-lead-lost-dialog.tsx`.

**Verify:** manual smoke — operator can mark lost with and without reason; both persist correctly.

---

### P1.4 — Capture surface in client portal (30 min)

**File:** client portal lead detail (likely `src/app/(client-portal)/client/leads/[id]/page.tsx`).

**Behavior:** same dialog component, surfaced via "Mark Lost" action when contractor uses portal directly.

**Permission:** existing portal permission for lead status mutation already covers it.

**Verify:** manual smoke in client portal.

---

### P1.5 — Display lost reason in lead views (30 min)

**Files:** lead detail components (admin + portal), bi-weekly report payload.

**UI:**
- Lead detail page shows `Lost reason: <text>` if set, alongside `Lost at: <date>`.
- If `lostReason` is null but `jobs.lostReason` exists for a related job, show `(from job: <text>)` as fallback.
- Lead list does NOT need to show reason inline (avoids row clutter); tooltip on the "lost" status badge is sufficient.

**Verify:** manual smoke + snapshot test for badge tooltip.

---

### P1.6 — Win-back AI context inclusion (1-2 hr)

**Files:** win-back agent or automation in `src/lib/automations/`.

**Behavior:** when generating win-back outreach for a lead with `status='lost'`, include `lostReason` (if set) in the agent's context so the model can tailor the pitch.

**Example prompt change:**
```
Lead context:
- Status: lost
- Lost reason: "Went with cheaper bid"
- Days since lost: 47

Tailor the re-engagement message to address the reason without sounding defensive.
```

**Verify:** AI scenario test — lead with `lostReason='cheaper bid'` produces materially different outreach than `lostReason=null`. Use existing `*.ai-test.ts` pattern.

---

### P1.7 — Tests (1 hr)

**New tests:**
- `src/app/api/admin/leads/[id]/lost-reason.test.ts` — Zod schema, PATCH route, lostAt auto-set
- `src/components/leads/mark-lead-lost-dialog.test.tsx` — render, submit with/without reason, error state
- `src/lib/automations/winback.ai-test.ts` — extend existing test with lostReason variant

**Verify:** `pnpm run typecheck && pnpm test` clean. AI test runs separately via `pnpm run test:ai`.

---

### P1.8 — Doc sync (30 min)

Per CLAUDE.md doc-sync mandate:
- `docs/product/PLATFORM-CAPABILITIES.md` — add lost-reason capture under lead management
- `docs/engineering/01-TESTING-GUIDE.md` — new test paths
- `docs/product/02-OFFER-PARITY-GAPS.md` — mark PG-003 Done with commit reference
- `docs/product/FEATURE-BACKLOG.md` — mark BL-14 Done if it cross-refs

**Phase 1 total effort:** 4-7 hours.

---

## Phase 2 — PG-004 Estimator-Level Reporting

### P2.1 — Schema migration (30 min)

**File:** `src/db/schema/leads.ts`

Add column + index:
```ts
assignedEstimatorId: uuid('assigned_estimator_id')
  .references(() => agencyMemberships.id, { onDelete: 'set null' }),
```

```ts
// In the table builder:
index('leads_assigned_estimator_idx').on(table.assignedEstimatorId),
```

**Run:** `pnpm run db:generate` → migration 0033 → review SQL → request `db:push` confirmation.

**Verify:** SQL diff is one ADD COLUMN nullable + one CREATE INDEX.

---

### P2.2 — Estimator API endpoint (30 min)

**Files:**
- `src/app/api/admin/agency-users/route.ts` (verify exists; create if missing) — GET returns list of agency members eligible to be estimators.
- Filter: any member with role permission to be assigned leads (existing role system; pick the right permission flag).

**Response shape:** `{ estimators: Array<{ id: string; name: string; email: string; role: string }> }`.

**Verify:** unit test — admin route returns active members only.

---

### P2.3 — Estimator picker UI (1-2 hr)

**File:** admin lead detail page (same file edited in P1.3).

**Component:** new `<EstimatorPicker />` in `src/components/leads/estimator-picker.tsx`.

**UI:**
- Dropdown labeled "Assigned Estimator" with options: each agency member + "Unassigned" + "—".
- On change, PATCH `/api/admin/leads/[id]` with `{ assignedEstimatorId }`.
- Show current estimator name as a badge if assigned.

**Permission:** admin only. Contractor portal SEES the assigned estimator but cannot change it (read-only display).

**Verify:** manual smoke — assign + unassign + view in portal.

---

### P2.4 — Pipeline filter in admin lead list (1-2 hr)

**File:** admin leads list page (likely `src/app/(dashboard)/admin/leads/page.tsx`).

**UI:**
- Filter dropdown above list: "All estimators / Unassigned / <each member>".
- URL query param `?estimator=<id|unassigned>` — filter persists in URL.
- Existing list query extended with WHERE clause based on filter.

**Backend:** lead list API accepts `estimator` query param.

**Verify:** manual smoke + unit test for query param parsing.

---

### P2.5 — Pipeline filter in client portal lead list (1 hr)

**File:** client portal leads list (likely `src/app/(client-portal)/client/leads/page.tsx`).

**UI:** same filter component as admin, scoped to that client's agency members. Read-only — contractor cannot reassign from portal, but can filter to see "leads assigned to me" (matching contractor's own membership).

**Verify:** manual smoke in portal.

---

### P2.6 — Bi-weekly report estimator breakdown (2-3 hr)

**File:** `src/lib/services/report-generation.ts` (per `STATE.md`, this is where bi-weekly report payloads are built).

**Add:** `estimatorBreakdown` array — per-estimator metrics covering report period:
- `estimatorId`, `estimatorName`
- `leadsAssigned` (count of leads with this assignee in period)
- `appointmentsHeld`
- `wonCount`, `lostCount`
- `avgTimeToCloseDays` (won leads only)
- `pipelineDollarsConfirmed`, `pipelineDollarsProbable`

**UI:** new section in `/admin/reports/[id]` and `/client/reports/[id]` showing the breakdown table. If only one estimator (solo contractor), section is hidden to avoid clutter.

**Edge:** unassigned leads bucketed under "Unassigned" pseudo-estimator with same metrics shape.

**Verify:** unit test on `report-generation.ts` extending existing tests; snapshot test on report UI; manual smoke generating a report with assigned + unassigned leads.

---

### P2.7 — Onboarding flow note (15 min)

**File:** `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` and/or `docs/operations/launch-journey/19-onboarding.md`.

**Add:** during onboarding, ask contractor "do you have multiple estimators or is it just you?" If multiple, capture names + invite them to the agency. If solo, leave assignment empty — filter shows everything in "Unassigned" and the report breakdown section is hidden.

**No code change** — just a documented onboarding step.

---

### P2.8 — Tests (1-2 hr)

**New tests:**
- `src/app/api/admin/leads/[id]/estimator.test.ts` — assign / reassign / unassign FK behavior, set null on agency member deletion
- `src/lib/services/report-generation.test.ts` — extend with estimator breakdown shape + edge cases (solo, all unassigned, mixed)
- Component tests for `<EstimatorPicker />` + filter dropdown

**Verify:** `pnpm run typecheck && pnpm test` clean.

---

### P2.9 — Doc sync (30 min)

- `docs/product/PLATFORM-CAPABILITIES.md` — estimator assignment + filtering + reporting
- `docs/engineering/01-TESTING-GUIDE.md` — new test paths
- `docs/product/02-OFFER-PARITY-GAPS.md` — mark PG-004 Done
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` — operator workflow for assigning estimators
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` — onboarding step (if not already covered in P2.7)

**Phase 2 total effort:** 6-10 hours.

---

## Phase 3 — Verification + Final Quality Gate

### P3.1 — OFFER-APPROVED-COPY review (15 min)

Re-read OFFER-APPROVED-COPY.md §6 (reports), §12 (KPIs), §6.3 (Standard tier). Confirm "estimator-level reporting" and "won/lost reasons logged" claims now match platform behavior. Flag any remaining language mismatches for founder review — do NOT edit OFFER-APPROVED-COPY without explicit approval.

### P3.2 — Quality gate (5 min)

```
pnpm run typecheck
pnpm test
pnpm run quality:no-regressions
```

Expected: 0 typecheck errors, ~1000+ tests passing (983 baseline + ~15-20 new), all gates green.

### P3.3 — Manual end-to-end smoke (30 min)

1. Create test lead in admin.
2. Assign estimator from picker.
3. Mark lead lost with reason.
4. Generate bi-weekly report — verify estimator breakdown shows the lost lead under that estimator.
5. View lead from client portal — verify lost reason and estimator visible (read-only for estimator).
6. Trigger win-back AI on the lost lead — verify outreach references the lost reason.

### P3.4 — Gap register update (5 min)

- Mark PG-003 and PG-004 Done in `docs/product/02-OFFER-PARITY-GAPS.md` with commit references.
- Update `STATE.md` gap-register table.
- If `PLATFORM-GAP-REGISTER.md` (engineering register) cross-references these, update there too.

**Phase 3 total effort:** 1 hour.

---

## Sequence + Parallelization

```
P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6 → P1.7 → P1.8     (Phase 1: PG-003)
P2.1 → P2.2 → P2.3 → P2.4 → P2.5 → P2.6 → P2.7 → P2.8 → P2.9  (Phase 2: PG-004)
P3.1 → P3.2 → P3.3 → P3.4                                  (Phase 3: verification)
```

**Parallelization:** Phase 1 and Phase 2 are independent (different schema columns, different UI surfaces). Can execute as parallel waves with two agents if available. Phase 3 only runs after both phases complete.

**Branch strategy:** single feature branch `wave-B-standard-launch` OR two branches (`wave-B-pg-003`, `wave-B-pg-004`) merged before Phase 3.

---

## Out-of-scope (explicit defer list)

| Item | Defer reason |
|---|---|
| PG-101 (channel attribution) | Premium tier. Build on demand after first Standard customer requests upgrade. |
| PG-102 (GCLID/UTM capture) | Premium tier. Defer until PG-101 is scoped. |
| PG-103 (call tracking + DNI) | Premium tier. Without microsite, full DNI is moot. Lite version (per-listing tracking numbers) deferred until Premium demand validates the workflow. |
| PG-104 (offline conversion export) | Premium tier. Heavy ad-platform integrations (Google Ads + Meta CAPI). Defer until Premium customer requests. |
| PG-105 (revenue-by-source dashboard) | Premium tier. Blocked on PG-101. |
| PG-106 (multi-service-line dashboard) | Premium tier. `projectType` taxonomy work. Defer with rest of Premium. |
| PG-201 (microsite + tracking) | Founder excluded. |
| PG-202 (advanced attribution add-on) | Blocked on PG-101..104. |
| PG-203 (extra service-line dashboard add-on) | Blocked on PG-106. |

---

## Verification checklist

- [ ] Migration 0032 generated, reviewed, pushed
- [ ] Migration 0033 generated, reviewed, pushed
- [ ] Phase 1 (PG-003): all sub-items complete and tested
- [ ] Phase 2 (PG-004): all sub-items complete and tested
- [ ] Phase 3: typecheck + tests + manual smoke pass
- [ ] Gap register PG-003 and PG-004 marked Done
- [ ] Doc-sync map applied
- [ ] OFFER-APPROVED-COPY reviewed for consistency (no edits without founder approval)
- [ ] STATE.md updated to reflect Wave B closure

---

## Effort summary

| Phase | Effort | Notes |
|---|---|---|
| Phase 1 (PG-003) | 4-7 hr | Including win-back AI integration |
| Phase 2 (PG-004) | 6-10 hr | Including reporting layer |
| Phase 3 (verification) | 1 hr | Quality gate + smoke + gap register update |
| **Total** | **11-18 hr** | ~1.5-2 working days |

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| `agency_memberships` is the wrong FK target (existing pattern uses different table for member-as-estimator) | Quick grep before P2.1 to confirm — if a different table exists, swap the FK target with no other changes. |
| Win-back AI test (P1.6) requires `ANTHROPIC_API_KEY` and incurs LLM cost | Standard `*.ai-test.ts` pattern — runs only via `pnpm run test:ai`, not in default test run. Same cost profile as existing AI tests. |
| Migration 0032 + 0033 conflict if one fails mid-push | Both are nullable additive migrations. No conflict. If 0032 fails, fix and retry — 0033 only generated after 0032 lands. |
| Solo-contractor UX clutter (estimator filter on a 1-person agency) | P2.6 hides estimator breakdown section if only one estimator. Filter dropdown still exists but defaults to "All" — single tap dismisses. |
| Win-back AI context (P1.6) leaks lost reason to homeowner inappropriately | Prompt-engineer carefully — model should USE the reason to inform tone, not quote it back to the homeowner. AI test validates output does not include the literal `lostReason` text. |
