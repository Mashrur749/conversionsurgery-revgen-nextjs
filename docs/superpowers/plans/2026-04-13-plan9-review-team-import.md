# Plan 9: Review Monitoring + Team + Import Fixes (First 30 Days)

**Source:** `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` — XDOM-18, 20, 21, 22, 23
**Target:** `src/lib/services/escalation.ts`, `src/lib/services/ring-group.ts`, `src/lib/automations/auto-review-response.ts`, `src/lib/services/review-monitoring.ts`, `src/app/api/leads/import/route.ts`, `src/db/schema/leads.ts`

---

## Context

This plan addresses five distinct issues across three domains. They share no files, making them the most parallelizable batch in the cross-domain audit. Two are one-line fixes (XDOM-20, XDOM-21); two require structural additions (XDOM-18, XDOM-22); one requires a schema change plus route logic (XDOM-23).

---

## Task Breakdown

### Task 1 — Atomic guard on escalation assignment/takeover (XDOM-18)

**Severity:** High — concurrent claims silently overwrite each other  
**Files:**
- `src/lib/services/escalation.ts`

**Current state:** `assignEscalation()` (line ~316) and `takeOverConversation()` (line ~347) both:
1. Select the escalation row to get `clientId`
2. Run a plain `db.update(...).set({...}).where(eq(escalationQueue.id, escalationId))`

The `update` has no status guard in the `WHERE` clause. If two team members simultaneously trigger assignment, both updates execute — the second silently overwrites the first's `assignedTo`. There is no `.returning()` check to detect a no-op.

**Contrast with working pattern:** `claimEscalation()` in `src/lib/services/team-escalation.ts` (line ~242) already solves this correctly using atomic UPDATE with `.returning()`:

```typescript
const [claimed] = await db
  .update(escalationClaims)
  .set({ ... })
  .where(
    and(
      eq(escalationClaims.claimToken, token),
      eq(escalationClaims.status, 'pending'), // <-- status guard
    )
  )
  .returning();

if (!claimed) {
  // Already claimed by someone else
}
```

**Approach:**

For `assignEscalation()`:

1. Add a status guard to the `WHERE` clause: only update if `status` is `'pending'` or `'unassigned'` (check the schema for the valid pre-assignment statuses).
2. Add `.returning()` to capture whether the update matched a row.
3. If `returned.length === 0`, fetch the current escalation to determine why — it's either already assigned, resolved, or doesn't exist — and throw a descriptive error: `'Escalation already assigned to another team member'`.

```typescript
const [updated] = await db.update(escalationQueue).set({
  assignedTo: teamMemberId,
  assignedAt: new Date(),
  status: 'assigned',
  updatedAt: new Date(),
}).where(
  and(
    eq(escalationQueue.id, escalationId),
    or(
      eq(escalationQueue.status, 'pending'),
      eq(escalationQueue.status, 'unassigned'),
    )
  )
).returning({ id: escalationQueue.id });

if (!updated) {
  throw new Error('Escalation already assigned or no longer available');
}
```

For `takeOverConversation()`:

Same approach, but the status guard should allow `'pending'`, `'assigned'`, or `'unassigned'` — a takeover can legitimately happen on an already-assigned escalation. Add `.returning()` and detect the no-op (escalation resolved or deleted mid-flight):

```typescript
const [updated] = await db.update(escalationQueue).set({
  status: 'in_progress',
  assignedTo: teamMemberId,
  firstResponseAt: new Date(),
  updatedAt: new Date(),
}).where(
  and(
    eq(escalationQueue.id, escalationId),
    not(eq(escalationQueue.status, 'resolved'))
  )
).returning({ id: escalationQueue.id });

if (!updated) {
  throw new Error('Escalation already resolved or not found');
}
```

**Dependencies:** Check `escalationQueue` status enum values in `src/db/schema/escalation-queue.ts` before implementing. The exact valid pre-assignment statuses must match the schema definition.

---

### Task 2 — Fix ring-status callback URL (XDOM-20)

**Severity:** High — Twilio 404s on status callbacks; call status never tracked  
**Files:**
- `src/lib/services/ring-group.ts`

**Current state:** Line 64:
```typescript
const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-status?attemptId=${callAttempt.id}`;
```

The route `/api/webhooks/twilio/ring-status` does not exist. Listing `/src/app/api/webhooks/twilio/` shows: `sms`, `agency-sms`, `status`, `voice`, `ring-connect`, `ring-result`, `agency-voice`, `member-answered`, `voice/ai`. No `ring-status`.

Twilio will receive a 404 on every status callback, which means call completion status (`initiated`, `ringing`, `answered`, `completed`) is never tracked in the `callAttempts` table.

**Approach — two options; pick one:**

**Option A (preferred):** Change the callback URL to point to the existing `ring-result` route, which handles the ring group outcome. Verify that `ring-result` can handle Twilio's call status callback payload (it may already handle it — read that route handler). If `ring-result` handles ring group completions rather than individual call status, it may be the correct destination.

**Option B:** Create a new minimal route at `/api/webhooks/twilio/ring-status/route.ts` that accepts Twilio's `CallStatus` callback body and updates `callAttempts.status` accordingly:

```typescript
// Receives: CallSid, CallStatus, from Twilio
// Updates callAttempts where callSid matches
```

Before implementing, read `src/app/api/webhooks/twilio/ring-result/route.ts` to determine which option fits.

**Dependencies:** Must read `ring-result/route.ts` before deciding approach. No other dependencies.

---

### Task 3 — Change review auto-approve threshold from 3 to 4 (XDOM-21)

**Severity:** Medium-High — 3-star (neutral/mixed) reviews get canned "thank you" posted publicly  
**Files:**
- `src/lib/automations/auto-review-response.ts`

**Current state:** Line 8:
```typescript
const POSITIVE_RATING_THRESHOLD = 3;
```

Line 71:
```typescript
if (rating >= POSITIVE_RATING_THRESHOLD) {
  // Auto-approve and post positive reviews
```

A 3-star review is ambiguous — it is the most common "disappointed but not angry" rating. Auto-posting a generic positive response to a 3-star review signals to the homeowner that the business didn't read their feedback, and signals to Google that responses may be automated.

**Approach:** Change the constant:
```typescript
const POSITIVE_RATING_THRESHOLD = 4;
```

The comment in the function header should be updated from:
```
- Positive reviews (rating >= 3): auto-approve and post immediately
- Negative reviews (rating <= 2): hold as pending_approval for operator review
```
to:
```
- Positive reviews (rating >= 4): auto-approve and post immediately
- Neutral/negative reviews (rating <= 3): hold as pending_approval for operator review
```

This is a one-line code change plus comment update. No other files affected.

**Dependencies:** None. This is the smallest fix in the plan.

---

### Task 4 — Real-time negative review alerting (XDOM-22)

**Severity:** High — 1-star reviews sit unnoticed for hours between batch sync runs  
**Files:**
- `src/lib/services/review-monitoring.ts`
- `src/app/api/cron/route.ts` (or wherever `syncAllReviews` is called)

**Current state:** `checkAndAlertNegativeReviews()` (line ~64) is correct logic — it finds unalerted negative reviews and sends SMS. The problem is when it is called. Currently it is called as part of the batch cron review sync, meaning a 1-star review posted Monday afternoon might not trigger an alert until the next cron run (potentially 24 hours later).

`syncAllReviews()` (line ~42) performs the Google Places sync and returns `{ google: { newReviews, totalReviews } }`. It does not call `checkAndAlertNegativeReviews()`.

**Approach:**

1. In `syncAllReviews()`, after completing the sync, call `checkAndAlertNegativeReviews(clientId)`. This means every sync run immediately checks for and alerts on any newly-synced negative reviews.

2. Alternatively, at the cron call site where `syncAllReviews` is invoked per client, chain `checkAndAlertNegativeReviews(clientId)` after each client's sync.

The cleanest approach is within `syncAllReviews` itself — it already has `clientId` in scope and the function returns after all syncs. Add:

```typescript
// After all provider syncs complete, immediately alert on any new negative reviews
await checkAndAlertNegativeReviews(clientId);
```

3. `checkAndAlertNegativeReviews` already deduplicates via the `alertSent` boolean on the review row — so calling it after every sync is idempotent for already-alerted reviews.

**Note on signature change:** `syncAllReviews` currently takes `clientId: string`. Verify the call site is already passing `clientId`. If `syncAllReviews` is called in a loop over all clients (e.g., in cron), the `checkAndAlertNegativeReviews` call will scope correctly to each client.

**Dependencies:** None — both functions are already in `review-monitoring.ts`. No new imports needed.

---

### Task 5 — Persist CASL consent for imported leads (XDOM-23)

**Severity:** High — no database record that imported leads have consent; compliance liability  
**Files:**
- `src/app/api/leads/import/route.ts`
- `src/db/schema/leads.ts`
- `src/db/schema/index.ts` (re-export if adding to schema)
- Possibly: `src/db/migrations/` via `npm run db:generate`

**Current state:**

The route (line ~48) validates `body.consentAttested === true` and returns a 400 if it's false. When true, it proceeds with the import. The response (line ~205) includes `_audit: { consentAttested: true }` as a JSON field — but this is a response body annotation, not a database write.

The `leads` schema (`src/db/schema/leads.ts`) has no `caslConsentAttested` or `importConsentAt` column. Once the response is sent, there is no persistent record that consent was collected.

**Approach:**

**Step 1 — Schema change:** Add two columns to `src/db/schema/leads.ts`:

```typescript
caslConsentAttested: boolean('casl_consent_attested').default(false),
caslConsentAttestedAt: timestamp('casl_consent_attested_at'),
```

**Step 2 — Run migration:**
```bash
npm run db:generate
```
Review the generated SQL. Ask user before `db:push` / `db:migrate`.

**Step 3 — Update insert:** In `src/app/api/leads/import/route.ts`, in the `toInsert.map(row => ...)` block (line ~159), add the consent fields to every inserted lead row:

```typescript
toInsert.map((row) => ({
  clientId,
  name: row.name || null,
  phone: row.phone,
  // ... existing fields ...
  source: 'csv_import' as const,
  status: row.status || 'new',
  caslConsentAttested: true,
  caslConsentAttestedAt: new Date(),
}))
```

**Step 4 — Update re-export:** Add the new columns to `src/db/schema/index.ts` if the schema file is re-exported there. Typically the full schema file is re-exported, so this is automatic — but verify.

**Step 5 — TypeScript types:** The schema change auto-generates updated `Lead` and `NewLead` types via Drizzle inference. No manual type changes needed. Run `npm run typecheck` to confirm.

**Note on the admin import route:** There is also `src/app/api/client/leads/import/route.ts` — check if it is a separate implementation or delegates to the same logic. If separate, apply the same schema fields there.

**Dependencies:**
- Schema change must happen before route change (otherwise TypeScript will error on the new fields)
- Must run `db:generate` before `typecheck`
- User must approve migration before `db:push`

---

## Parallelization

| Task | Files | Parallelizable with |
|------|-------|---------------------|
| Task 1 (XDOM-18) | `escalation.ts` | Tasks 2, 3, 4, 5 |
| Task 2 (XDOM-20) | `ring-group.ts`, possibly new route file | Tasks 1, 3, 4, 5 |
| Task 3 (XDOM-21) | `auto-review-response.ts` | All others |
| Task 4 (XDOM-22) | `review-monitoring.ts` | All others |
| Task 5 (XDOM-23) | `leads.ts` (schema), `import/route.ts` | All others |

All 5 tasks touch different files — full parallel execution is safe. Assign all five to separate agents simultaneously, or batch by size:

- **Agent A:** Tasks 1 + 2 (team/escalation domain)
- **Agent B:** Tasks 3 + 4 (review domain — same `auto-review-response.ts` and `review-monitoring.ts` service pair)
- **Agent C:** Task 5 alone (requires schema change coordination)

---

## Schema Changes

Task 5 requires a migration:

1. Add `caslConsentAttested` and `caslConsentAttestedAt` to `src/db/schema/leads.ts`
2. Run `npm run db:generate`
3. Review generated SQL in `src/db/migrations/`
4. Ask user before `db:push` or `db:migrate`

Do not run the migration without user confirmation — this is a production schema change.

---

## Doc Update Requirements

Per CLAUDE.md Change→Doc mapping:

| Change | Doc to update |
|--------|---------------|
| Escalation assignment atomic guard (Task 1) | `docs/product/PLATFORM-CAPABILITIES.md` — Section on Communication Hub / Team Escalation |
| Review threshold change (Task 3) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 12: Review Monitoring |
| Real-time negative review alerting (Task 4) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 12: Review Monitoring |
| CASL consent persistence (Task 5) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 6: Compliance; `docs/business-intel/OFFER-APPROVED-COPY.md` — flag to user if consent language changes (do not edit directly) |
| Schema migration (Task 5) | `docs/engineering/01-TESTING-GUIDE.md` — add preflight step: run `db:migrate` before deployment |
| Ring-status fix (Task 2) | `docs/engineering/01-TESTING-GUIDE.md` — update Step 16 (Voice AI) or equivalent if call status tracking is tested |

---

## Verification Gate

After implementation:
1. `npm run ms:gate` (fast check during development)
2. `npm run quality:no-regressions` (completion gate)

Key manual test vectors:
- Trigger two simultaneous assignment calls for the same escalation — verify second caller receives an error, first assignment is preserved
- Initiate a ring group call — verify Twilio status callbacks receive 200 responses (not 404)
- Confirm a 3-star review uses `pending_approval` mode for `operator_managed` clients (not auto-posted)
- Import a batch of leads — verify `casl_consent_attested = true` and `casl_consent_attested_at` are populated in the database for each imported lead
- Sync a client's Google reviews with a new 1-star review — verify the operator receives an SMS alert in the same sync run, not the next cron batch
