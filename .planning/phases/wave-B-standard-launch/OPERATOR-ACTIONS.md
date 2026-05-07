# Wave B — Operator Actions

**Audience:** You.
**Purpose:** Every action only YOU can take during Wave B. Claude cannot do these — they involve schema-push authorization, decisions on backfill scope, and final smoke-test sign-off.
**Total operator effort:** ~30 minutes spread across 3 checkpoints.

---

## CHECKPOINT 1 — Schema Migrations

### Action 1A — Push Migration 0032 (PG-003 lost reason columns)

**Why:** Phase 1 ships `leads.lostReason` (varchar 255) and `leads.lostAt` (timestamp). Both nullable, back-compat-safe. Code references columns that don't exist in prod until pushed.

**Trigger:** I'll commit migration 0032 during P1.1 execution. Commit message will read: `feat(leads): add lostReason and lostAt columns (PG-003)`.

**Steps:**
1. After commit lands, run: `pnpm run db:push`
2. Confirm prompt: `Yes`
3. Verify:
   ```
   psql $DATABASE_URL -c "\d leads" | grep -E "lost_reason|lost_at"
   ```
   Expected: two matching column lines.

**Done when:** Both columns exist in prod.

**Time:** 1 minute.

**Required before:** P1.2 (lead status transition handler) deploys to prod.

---

### Action 1B — Push Migration 0033 (PG-004 estimator FK)

**Why:** Phase 2 ships `leads.assignedEstimatorId` (uuid FK to `agency_memberships.id`, nullable, on-delete set null) plus an index. Back-compat-safe.

**Trigger:** I'll commit migration 0033 during P2.1 execution. Commit message: `feat(leads): add assignedEstimatorId FK (PG-004)`.

**Steps:**
1. After commit lands, run: `pnpm run db:push`
2. Confirm prompt: `Yes`
3. Verify:
   ```
   psql $DATABASE_URL -c "\d leads" | grep assigned_estimator
   psql $DATABASE_URL -c "\di leads_assigned_estimator_idx" | head -3
   ```
   Expected: column line + index line.

**Done when:** Column and index both exist.

**Time:** 1 minute.

**Required before:** P2.2 (estimator API endpoint) deploys to prod.

---

## CHECKPOINT 2 — Backfill Decisions

### Action 2A — Lost-reason backfill scope

**Why:** Existing leads with `status='lost'` have NULL `lostReason` after migration 0032. Decide whether to backfill from related `jobs.lostReason` (when a job exists for the lead) or leave NULL.

**Steps:**
1. Measure scope:
   ```
   psql $DATABASE_URL -c "SELECT count(*) FROM leads WHERE status='lost' AND lost_reason IS NULL"
   ```
2. Cross-reference with job lostReason:
   ```
   psql $DATABASE_URL -c "SELECT count(*) FROM leads l
     JOIN jobs j ON j.lead_id = l.id
     WHERE l.status='lost'
       AND l.lost_reason IS NULL
       AND j.lost_reason IS NOT NULL"
   ```
3. **Decide:**
   - If second count is small (<20): leave NULL. Display logic in P1.5 already shows the job's reason as fallback.
   - If second count is meaningful (>20) and you want it surfaced cleanly in reports: ask Claude to write a one-off backfill script that copies `jobs.lost_reason` into `leads.lost_reason` where the lead is NULL. Should be ~10 min of work.

**Done when:** Decision logged. If backfill chosen, script written + run.

**Time:** 5 minutes (decision); 10 minutes (script if chosen).

**Required before:** Phase 1 considered complete.

---

### Action 2B — Estimator assignment backfill

**Why:** Existing leads have NULL `assignedEstimatorId`. Filter UI shows them under "Unassigned." Decide whether to set a default estimator.

**Steps:**
1. Per-client assessment: for each active client, ask the contractor on next operator touchpoint:
   - "Are leads assigned to a specific estimator on your team, or do you handle them all?"
   - If solo: leave all NULL. Filter "Unassigned" bucket holds everything; report breakdown section auto-hides.
   - If team: identify the default estimator and bulk-assign existing in-progress leads:
     ```
     UPDATE leads
     SET assigned_estimator_id = '<member-uuid>'
     WHERE client_id = '<client-uuid>'
       AND status NOT IN ('won', 'lost', 'completed')
       AND assigned_estimator_id IS NULL;
     ```

**Done when:** Decision logged per active client. Existing leads either bulk-assigned or left NULL with note.

**Time:** 5 minutes per active client (during their next operator check-in).

**Required before:** First Standard pitch goes out — pitch claim is "we filter your pipeline by estimator," so the existing pipeline must reflect actual estimator assignment.

---

## CHECKPOINT 3 — Final Sign-Off

### Action 3A — Manual end-to-end smoke

**Why:** Code-level testing is comprehensive (typecheck + ~1000 tests). The smoke test verifies real-world UX before the first Standard pitch.

**Steps (15 min):**

1. **Estimator assignment:**
   - Open `/admin/clients/[active-client-id]/leads/[any-lead-id]`
   - Open the new estimator picker → assign yourself or a team member
   - Verify: assignment persists on refresh

2. **Lost reason capture:**
   - Same lead → "Mark as Lost" → enter reason "Test: contractor went with cheaper bid" → submit
   - Verify: lead detail shows `Lost reason:` and `Lost at:` populated

3. **Pipeline filter (admin):**
   - Open `/admin/leads`
   - Filter by the estimator you assigned → list shows the test lead
   - Filter by "Unassigned" → list excludes the test lead

4. **Pipeline filter (portal):**
   - Open client portal as that contractor → leads list
   - Filter by estimator → see same filtered result (read-only)

5. **Bi-weekly report:**
   - Generate or open most recent report for that client
   - Verify: estimator breakdown section shows your assignment (1 lead, 1 lost, lostReason populated)
   - For solo client (no estimator assignment), verify section is hidden

6. **Win-back AI (optional but recommended):**
   - Trigger win-back automation on the test lead (or wait for the cron, ~24h)
   - Verify: outreach message references the lost reason in tone WITHOUT quoting it literally to the homeowner
   - Run via `pnpm run test:ai` to validate the AI scenario test passes

**Done when:** All 6 smoke steps pass. Reset test data afterwards (un-mark test lead as lost, unassign estimator, delete test report if generated).

**Time:** 15 minutes.

**Required before:** First Standard tier proposal sent.

---

### Action 3B — Confirm gap register updated

**Why:** Process obligation per CLAUDE.md doc-sync rule. Wave B is closed only when registers are reconciled.

**Steps:**
1. Open `docs/product/02-OFFER-PARITY-GAPS.md`. Verify PG-003 and PG-004 rows show **Done** with commit references.
2. Open `.planning/STATE.md`. Verify Wave B section under "Recently Completed" with Phase 1 + Phase 2 commits referenced.
3. Open `docs/product/FEATURE-BACKLOG.md`. If `BL-14` was a cross-ref for PG-003, mark Done.

**Done when:** Three docs reconciled.

**Time:** 5 minutes.

**Required before:** Wave B can be archived.

---

## Summary Table

| Checkpoint | Action | Time | Trigger |
|---|---|---|---|
| 1A | Push migration 0032 (lost reason columns) | 1 min | After P1.1 commit lands |
| 1B | Push migration 0033 (estimator FK) | 1 min | After P2.1 commit lands |
| 2A | Lost-reason backfill scope decision | 5 min (+10 min if backfill) | After Phase 1 code lands |
| 2B | Estimator assignment per active client | 5 min × N clients | Before first Standard pitch |
| 3A | Manual end-to-end smoke | 15 min | After all code lands |
| 3B | Confirm gap register updated | 5 min | After 3A passes |

**Total operator time:** ~30-45 minutes spread across the execution window.

Most of this can run in parallel with my agent work. I'll signal each checkpoint via commit messages and the Wave B closure summary at the end.

---

## Dependencies on prior waves

- Wave A (billing) — A5/A6 cron handlers must remain functional. Wave B does not modify guarantee-gates code.
- Wave A Hardening — CASL gate, R2 audit export, Decision F all unchanged. Wave B introduces no new compliance surface area.

If pre-Wave-B test count is not 983 passing (current baseline), do NOT start Wave B execution. Investigate the regression first.
