# Plan 9: Review Monitoring + Team + Import Fixes (First 30 Days)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 issues across 3 domains — concurrent escalation assignment race condition, broken ring-status callback URL, wrong review auto-approve threshold, missing real-time negative review alerts, and absent CASL consent persistence in the database.

**Architecture:** Surgical fixes to existing files. One new webhook route. One schema migration (Task 5).

**Tech Stack:** TypeScript, Drizzle ORM, Zod, Twilio, Vitest

**Source specs:**
- `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` (XDOM-18, XDOM-20, XDOM-21, XDOM-22, XDOM-23)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/services/escalation.ts` | XDOM-18: atomic guard on assignment and takeover |
| Modify | `src/lib/services/ring-group.ts` | XDOM-20: fix broken ring-status callback URL |
| Create | `src/app/api/webhooks/twilio/ring-status/route.ts` | XDOM-20: new minimal status-callback handler |
| Modify | `src/lib/automations/auto-review-response.ts` | XDOM-21: change threshold from 3 to 4 |
| Modify | `src/lib/services/review-monitoring.ts` | XDOM-22: call checkAndAlertNegativeReviews inside syncAllReviews |
| Modify | `src/db/schema/leads.ts` | XDOM-23: add caslConsentAttested + caslConsentAttestedAt columns |
| Modify | `src/app/api/leads/import/route.ts` | XDOM-23: persist consent fields on insert |
| Modify | `src/app/api/client/leads/import/route.ts` | XDOM-23: persist consent fields on portal insert |

---

## Task 1 — Atomic Guard on Escalation Assignment/Takeover (XDOM-18)

**Severity:** High — concurrent claims silently overwrite each other  
**Files:**
- Modify: `src/lib/services/escalation.ts` lines 316–370

### Background

`escalationQueueStatusEnum` values (confirmed from `src/db/schema/agent-enums.ts` lines 56–62):
- `'pending'` — waiting for assignment
- `'assigned'` — assigned to a team member
- `'in_progress'` — actively being handled
- `'resolved'` — fully resolved
- `'dismissed'` — dismissed without resolution

`not` is not yet imported in `escalation.ts` (line 12 imports: `eq, and, desc, sql, or`). It must be added.

**Current `assignEscalation` (lines 316–340):**
```typescript
export async function assignEscalation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();

  // Get the escalation's clientId for ownership check
  const [escalation] = await db
    .select({ clientId: escalationQueue.clientId })
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) throw new Error('Escalation not found');

  // Verify team member belongs to the same client
  await assertSameClient(db, 'client_memberships', teamMemberId, escalation.clientId, 'team member');

  await db.update(escalationQueue).set({
    assignedTo: teamMemberId,
    assignedAt: new Date(),
    status: 'assigned',
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}
```

**Current `takeOverConversation` (lines 347–371):**
```typescript
export async function takeOverConversation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();

  // Get the escalation's clientId for ownership check
  const [escalation] = await db
    .select({ clientId: escalationQueue.clientId })
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) throw new Error('Escalation not found');

  // Verify team member belongs to the same client
  await assertSameClient(db, 'client_memberships', teamMemberId, escalation.clientId, 'team member');

  await db.update(escalationQueue).set({
    status: 'in_progress',
    assignedTo: teamMemberId,
    firstResponseAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}
```

- [ ] **Step 1: Add `not` to the drizzle-orm import**

File: `src/lib/services/escalation.ts`, line 12

```typescript
// Old (line 12):
import { eq, and, desc, sql, or } from 'drizzle-orm';

// New:
import { eq, and, desc, sql, or, not } from 'drizzle-orm';
```

- [ ] **Step 2: Rewrite `assignEscalation` with atomic status guard**

File: `src/lib/services/escalation.ts`, lines 316–340

```typescript
// Old — lines 316–340:
export async function assignEscalation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();

  // Get the escalation's clientId for ownership check
  const [escalation] = await db
    .select({ clientId: escalationQueue.clientId })
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) throw new Error('Escalation not found');

  // Verify team member belongs to the same client
  await assertSameClient(db, 'client_memberships', teamMemberId, escalation.clientId, 'team member');

  await db.update(escalationQueue).set({
    assignedTo: teamMemberId,
    assignedAt: new Date(),
    status: 'assigned',
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}
```

```typescript
// New — replaces lines 316–340:
export async function assignEscalation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();

  // Get the escalation's clientId for ownership check
  const [escalation] = await db
    .select({ clientId: escalationQueue.clientId, status: escalationQueue.status })
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) throw new Error('Escalation not found');

  // Verify team member belongs to the same client
  await assertSameClient(db, 'client_memberships', teamMemberId, escalation.clientId, 'team member');

  // Atomic update: only succeeds if escalation is still pending or unassigned.
  // .returning() lets us detect a no-op (row matched but status guard failed → 0 rows returned).
  const [updated] = await db
    .update(escalationQueue)
    .set({
      assignedTo: teamMemberId,
      assignedAt: new Date(),
      status: 'assigned',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(escalationQueue.id, escalationId),
        or(
          eq(escalationQueue.status, 'pending'),
          eq(escalationQueue.status, 'assigned'),
        )
      )
    )
    .returning({ id: escalationQueue.id });

  if (!updated) {
    throw new Error('Escalation already assigned to another team member or no longer available');
  }
}
```

- [ ] **Step 3: Rewrite `takeOverConversation` with atomic resolved guard**

File: `src/lib/services/escalation.ts`, lines 347–371

```typescript
// Old — lines 347–371:
export async function takeOverConversation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();

  // Get the escalation's clientId for ownership check
  const [escalation] = await db
    .select({ clientId: escalationQueue.clientId })
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) throw new Error('Escalation not found');

  // Verify team member belongs to the same client
  await assertSameClient(db, 'client_memberships', teamMemberId, escalation.clientId, 'team member');

  await db.update(escalationQueue).set({
    status: 'in_progress',
    assignedTo: teamMemberId,
    firstResponseAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}
```

```typescript
// New — replaces lines 347–371:
export async function takeOverConversation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  const db = getDb();

  // Get the escalation's clientId for ownership check
  const [escalation] = await db
    .select({ clientId: escalationQueue.clientId })
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);

  if (!escalation) throw new Error('Escalation not found');

  // Verify team member belongs to the same client
  await assertSameClient(db, 'client_memberships', teamMemberId, escalation.clientId, 'team member');

  // Atomic update: takeover is allowed on pending/assigned/in_progress escalations.
  // Blocked only if already resolved or dismissed. .returning() detects the no-op.
  const [updated] = await db
    .update(escalationQueue)
    .set({
      status: 'in_progress',
      assignedTo: teamMemberId,
      firstResponseAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(escalationQueue.id, escalationId),
        not(eq(escalationQueue.status, 'resolved')),
        not(eq(escalationQueue.status, 'dismissed')),
      )
    )
    .returning({ id: escalationQueue.id });

  if (!updated) {
    throw new Error('Escalation already resolved or dismissed');
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS — `not` is a valid Drizzle export; no other changes to types.

- [ ] **Step 5: Run tests**

Run: `npm test`  
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/escalation.ts
git commit -m "fix: atomic status guard on escalation assign/takeover to prevent silent overwrites (XDOM-18)"
```

---

## Task 2 — Fix Ring-Status Callback URL (XDOM-20)

**Severity:** High — Twilio 404s on status callbacks; call completion status never tracked  
**Files:**
- Modify: `src/lib/services/ring-group.ts` line 64
- Create: `src/app/api/webhooks/twilio/ring-status/route.ts`

### Background

Analysis of `ring-result/route.ts`: that route handles **TwiML dial completion** (it reads `DialCallStatus` from the body and returns TwiML `<Hangup/>`). It is the callback Twilio calls when the `<Dial>` verb completes inside the TwiML document — not when the outer outbound call changes status.

The `statusCallbackUrl` in `ring-group.ts` (line 64) is set as `statusCallback` on `twilioClient.calls.create(...)`. Twilio calls this URL with `CallStatus` events (`initiated`, `ringing`, `answered`, `completed`) for the outbound call leg. `ring-result` expects a TwiML response and reads `DialCallStatus` — it cannot handle the flat `CallStatus` event payload. A new, minimal route is required.

**Current state (line 64 of `ring-group.ts`):**
```typescript
const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-status?attemptId=${callAttempt.id}`;
```

The path `/api/webhooks/twilio/ring-status` does not exist — Twilio receives 404 on every event.

- [ ] **Step 1: Create the new route file**

Create: `src/app/api/webhooks/twilio/ring-status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { callAttempts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/**
 * [Voice] Twilio status callback for outbound ring group calls.
 *
 * Twilio posts CallStatus events (initiated, ringing, answered, completed)
 * to this URL when the outer call leg changes state. The attemptId query
 * param identifies which callAttempts row to update.
 *
 * Returns a plain 204 — Twilio does not expect TwiML from status callbacks.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return new NextResponse(null, { status: 400 });
    }

    const url = new URL(request.url);
    const attemptId = url.searchParams.get('attemptId');

    if (!attemptId) {
      return new NextResponse(null, { status: 204 });
    }

    const callStatus = payload.CallStatus as string | undefined;
    if (!callStatus) {
      return new NextResponse(null, { status: 204 });
    }

    // Map Twilio CallStatus values to our internal status column
    const statusMap: Record<string, string> = {
      initiated: 'initiated',
      ringing: 'ringing',
      answered: 'answered',
      completed: 'answered',
      'no-answer': 'no-answer',
      busy: 'no-answer',
      failed: 'failed',
      canceled: 'failed',
    };

    const internalStatus = statusMap[callStatus];
    if (!internalStatus) {
      return new NextResponse(null, { status: 204 });
    }

    const db = getDb();
    await db
      .update(callAttempts)
      .set({
        status: internalStatus,
        ...(callStatus === 'completed' || callStatus === 'answered'
          ? { endedAt: new Date() }
          : {}),
      })
      .where(eq(callAttempts.id, attemptId));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    void logInternalError({
      source: '[Voice] Ring status callback',
      error,
      context: { route: '/api/webhooks/twilio/ring-status' },
    });
    logSanitizedConsoleError('[Voice] Ring status callback failed', error, {
      route: '/api/webhooks/twilio/ring-status',
    });
    return new NextResponse(null, { status: 204 });
  }
}
```

- [ ] **Step 2: Verify the ring-group.ts callback URL (no change needed)**

Open `src/lib/services/ring-group.ts` and confirm line 64 reads:
```typescript
const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-status?attemptId=${callAttempt.id}`;
```

The URL already points at `/api/webhooks/twilio/ring-status`. Now that the route exists, no change to `ring-group.ts` is needed. The URL was correct; the route was missing.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS — new route file uses only existing imports.

- [ ] **Step 4: Run tests**

Run: `npm test`  
Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/twilio/ring-status/route.ts
git commit -m "fix: add missing ring-status webhook route so Twilio call status callbacks return 204 not 404 (XDOM-20)"
```

---

## Task 3 — Change Review Auto-Approve Threshold from 3 to 4 (XDOM-21)

**Severity:** Medium-High — 3-star reviews auto-post a generic positive reply  
**Files:**
- Modify: `src/lib/automations/auto-review-response.ts` lines 8 and 13–14

### Background

A 3-star review is ambiguous or mildly dissatisfied. Auto-posting a canned "thank you" to a 3-star review looks automated and signals the business didn&apos;t read the feedback. Only unambiguously positive reviews (4+ stars) should auto-post.

**Current state (`auto-review-response.ts` lines 7–19):**
```typescript
/** Rating threshold: reviews at or above this are auto-approved for operator_managed clients. */
const POSITIVE_RATING_THRESHOLD = 3;

/**
 * Auto-generate draft review responses for clients with autoReviewResponseEnabled.
 * Finds reviews that have no response record yet and creates AI/template drafts.
 *
 * For operator_managed clients:
 * - Positive reviews (rating >= 3): auto-approve and post immediately
 * - Negative reviews (rating <= 2): hold as pending_approval for operator review
 *
 * For client_approves clients:
 * - All drafts stay as 'draft' for contractor approval
 */
```

- [ ] **Step 1: Change the constant value**

File: `src/lib/automations/auto-review-response.ts`, line 8

```typescript
// Old (line 8):
const POSITIVE_RATING_THRESHOLD = 3;

// New:
const POSITIVE_RATING_THRESHOLD = 4;
```

- [ ] **Step 2: Update the JSDoc comment to match the new threshold**

File: `src/lib/automations/auto-review-response.ts`, lines 13–14

```typescript
// Old (lines 13–14):
 * - Positive reviews (rating >= 3): auto-approve and post immediately
 * - Negative reviews (rating <= 2): hold as pending_approval for operator review

// New:
 * - Positive reviews (rating >= 4): auto-approve and post immediately
 * - Neutral/negative reviews (rating <= 3): hold as pending_approval for operator review
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS — pure constant change, no type impact.

- [ ] **Step 4: Run tests**

Run: `npm test`  
Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/automations/auto-review-response.ts
git commit -m "fix: raise review auto-approve threshold from 3 to 4 stars (XDOM-21)"
```

---

## Task 4 — Real-Time Negative Review Alerting (XDOM-22)

**Severity:** High — 1-star reviews sit unalerted until the next cron batch  
**Files:**
- Modify: `src/lib/services/review-monitoring.ts` lines 42–55

### Background

`syncAllReviews(clientId)` currently returns after syncing Google reviews without alerting. `checkAndAlertNegativeReviews(clientId)` exists and is idempotent (uses `alertSent` boolean to prevent duplicate alerts). Calling it inside `syncAllReviews` immediately after each sync ensures a newly-synced 1-star review triggers an SMS alert in the same run — not the next cron batch.

**Current `syncAllReviews` (lines 42–55):**
```typescript
export async function syncAllReviews(clientId: string): Promise<{
  google: SyncResult;
}> {
  const results: { google: SyncResult } = {
    google: { newReviews: 0, totalReviews: 0 },
  };

  // Sync Google
  results.google = await syncGoogleReviews(clientId);

  // Future: Yelp, Facebook review sync (requires separate API integrations)

  return results;
}
```

- [ ] **Step 1: Add alert call inside syncAllReviews**

File: `src/lib/services/review-monitoring.ts`, lines 42–55

```typescript
// Old (lines 42–55):
export async function syncAllReviews(clientId: string): Promise<{
  google: SyncResult;
}> {
  const results: { google: SyncResult } = {
    google: { newReviews: 0, totalReviews: 0 },
  };

  // Sync Google
  results.google = await syncGoogleReviews(clientId);

  // Future: Yelp, Facebook review sync (requires separate API integrations)

  return results;
}
```

```typescript
// New (lines 42–57 after change):
export async function syncAllReviews(clientId: string): Promise<{
  google: SyncResult;
}> {
  const results: { google: SyncResult } = {
    google: { newReviews: 0, totalReviews: 0 },
  };

  // Sync Google
  results.google = await syncGoogleReviews(clientId);

  // Future: Yelp, Facebook review sync (requires separate API integrations)

  // Immediately alert on any new negative reviews after each sync run.
  // checkAndAlertNegativeReviews is idempotent — alertSent flag prevents duplicates.
  await checkAndAlertNegativeReviews(clientId);

  return results;
}
```

Note: `checkAndAlertNegativeReviews` is defined later in the same file (line 64). No import change is needed — it is a module-level function call within the same file.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS — function signatures unchanged, same-file call.

- [ ] **Step 3: Run tests**

Run: `npm test`  
Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/review-monitoring.ts
git commit -m "fix: alert on negative reviews immediately after sync instead of waiting for next cron batch (XDOM-22)"
```

---

## Task 5 — Persist CASL Consent for Imported Leads (XDOM-23)

**Severity:** High — no database record that imported leads have consent; compliance liability  
**Files:**
- Modify: `src/db/schema/leads.ts`
- Run: `npm run db:generate`
- Modify: `src/app/api/leads/import/route.ts` lines 159–171
- Modify: `src/app/api/client/leads/import/route.ts` lines 146–155

### Background

Both import routes validate `body.consentAttested === true` and return 400 if false — but when true they proceed without writing consent to the database. The response body includes `_audit: { consentAttested: true }` as an annotation-only field. There is no `caslConsentAttested` column in `src/db/schema/leads.ts`. Once the response is sent, there is no auditable record of consent.

**Schema change must happen first** — TypeScript will error on the new fields in the insert if the schema does not already define them.

### Sub-task A: Add consent columns to schema

- [ ] **Step 1: Add two columns to `src/db/schema/leads.ts`**

File: `src/db/schema/leads.ts`

Current last two columns before the closing `}` of the column definition (lines 53–56):
```typescript
    optedOut: boolean('opted_out').default(false),
    optedOutAt: timestamp('opted_out_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
```

```typescript
// Old (lines 53–56):
    optedOut: boolean('opted_out').default(false),
    optedOutAt: timestamp('opted_out_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

// New — insert two lines before createdAt:
    optedOut: boolean('opted_out').default(false),
    optedOutAt: timestamp('opted_out_at'),
    caslConsentAttested: boolean('casl_consent_attested').default(false),
    caslConsentAttestedAt: timestamp('casl_consent_attested_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
```

- [ ] **Step 2: Run migration generation**

```bash
npm run db:generate
```

Review the generated SQL in `src/db/migrations/`. It should contain two `ALTER TABLE leads ADD COLUMN` statements:
```sql
ALTER TABLE "leads" ADD COLUMN "casl_consent_attested" boolean DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "casl_consent_attested_at" timestamp;
```

**Do not run `db:push` or `db:migrate` yet.** Show the generated SQL to the user and wait for explicit confirmation before applying to the database.

- [ ] **Step 3: Run typecheck to confirm schema types are valid**

Run: `npm run typecheck`  
Expected: PASS — Drizzle re-infers `Lead` and `NewLead` types automatically from the updated table definition.

### Sub-task B: Update admin import route

- [ ] **Step 4: Add consent fields to the insert map in the admin route**

File: `src/app/api/leads/import/route.ts`, lines 159–171

```typescript
// Old — the .values() map (lines 160–171):
          toInsert.map((row) => ({
            clientId,
            name: row.name || null,
            phone: row.phone,
            email: row.email || null,
            address: row.address || null,
            projectType: row.projectType || null,
            notes: row.notes || null,
            source: 'csv_import' as const,
            status: row.status || 'new',
          }))

// New — add two fields at the end of the object:
          toInsert.map((row) => ({
            clientId,
            name: row.name || null,
            phone: row.phone,
            email: row.email || null,
            address: row.address || null,
            projectType: row.projectType || null,
            notes: row.notes || null,
            source: 'csv_import' as const,
            status: row.status || 'new',
            caslConsentAttested: true,
            caslConsentAttestedAt: new Date(),
          }))
```

### Sub-task C: Update portal import route

- [ ] **Step 5: Add consent fields to the insert map in the portal route**

File: `src/app/api/client/leads/import/route.ts`, lines 146–155

```typescript
// Old — the .values() map (lines 146–155):
            toInsert.map((row) => ({
              clientId,
              name: row.name || null,
              phone: row.phone,
              email: row.email || null,
              projectType: row.projectType || null,
              source: 'csv_import' as const,
              status: row.status || 'new',
            }))

// New — add two fields at the end of the object:
            toInsert.map((row) => ({
              clientId,
              name: row.name || null,
              phone: row.phone,
              email: row.email || null,
              projectType: row.projectType || null,
              source: 'csv_import' as const,
              status: row.status || 'new',
              caslConsentAttested: true,
              caslConsentAttestedAt: new Date(),
            }))
```

### Sub-task D: Verify and commit

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS — `caslConsentAttested` and `caslConsentAttestedAt` are now valid on `NewLead`.

- [ ] **Step 7: Run tests**

Run: `npm test`  
Expected: All existing tests pass.

- [ ] **Step 8: Commit schema + route changes**

```bash
git add src/db/schema/leads.ts src/app/api/leads/import/route.ts src/app/api/client/leads/import/route.ts
git commit -m "feat: persist CASL consent attestation on imported leads (XDOM-23) — awaiting db:migrate approval"
```

- [ ] **Step 9: Show migration SQL to user and request approval**

Display the contents of the generated migration file in `src/db/migrations/`. Ask:

> "The migration adds `casl_consent_attested boolean DEFAULT false` and `casl_consent_attested_at timestamp` to the `leads` table. Both are nullable/defaulted so existing rows are unaffected. Ready to run `db:migrate`?"

Do **not** run `db:migrate` or `db:push` until the user confirms.

---

## Doc Updates (mandatory after all tasks)

Per CLAUDE.md Change→Doc mapping — these updates must happen in the same session:

| Task | Change | Doc to update |
|------|--------|---------------|
| Task 1 (XDOM-18) | Escalation assignment is now atomic | `docs/product/PLATFORM-CAPABILITIES.md` — Section 4: Communication Hub / Team Escalation |
| Task 2 (XDOM-20) | Ring-status webhook now exists and tracks call state | `docs/engineering/01-TESTING-GUIDE.md` — update or add step for voice ring group call status tracking |
| Task 3 (XDOM-21) | Review auto-approve threshold is now 4 stars | `docs/product/PLATFORM-CAPABILITIES.md` — Section 12: Review Monitoring |
| Task 4 (XDOM-22) | Negative review alerts fire in the same sync run | `docs/product/PLATFORM-CAPABILITIES.md` — Section 12: Review Monitoring |
| Task 5 (XDOM-23) | CASL consent persisted to DB on import | `docs/product/PLATFORM-CAPABILITIES.md` — Section 6: Compliance; `docs/engineering/01-TESTING-GUIDE.md` — add preflight step: run `db:migrate` before deployment |

**Note on `OFFER-APPROVED-COPY.md`:** Do not edit it directly. If CASL consent persistence changes how consent is described in sales materials, flag it to the user.

---

## Parallelization

All 5 tasks touch non-overlapping files. They can be assigned to separate agents simultaneously:

| Agent | Tasks | Files touched |
|-------|-------|---------------|
| Agent A | Task 1 (XDOM-18) | `escalation.ts` only |
| Agent B | Task 2 (XDOM-20) | `ring-group.ts` (verify only), new `ring-status/route.ts` |
| Agent C | Task 3 + Task 4 (XDOM-21 + XDOM-22) | `auto-review-response.ts`, `review-monitoring.ts` |
| Agent C (or D) | Task 5 (XDOM-23) | `leads.ts`, `api/leads/import/route.ts`, `api/client/leads/import/route.ts` |

Tasks 3 and 4 share the review domain but different files — safe for one agent. Task 5 requires the schema change to complete before the route changes (TypeScript will error otherwise) — keep sequential within the agent.

---

## Verification Checklist

After all tasks are implemented:

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm test` passes — all 312+ deterministic tests green
- [ ] `npm run ms:gate` passes
- [ ] `npm run quality:no-regressions` passes (completion gate — run last)

### Manual test vectors

**Task 1 — Concurrent assignment race:**
- [ ] Create an escalation in `pending` status
- [ ] Fire two simultaneous POST requests to the assign endpoint with different `teamMemberId` values
- [ ] Verify exactly one succeeds; the second receives an error message `'Escalation already assigned to another team member or no longer available'`
- [ ] Verify the `assignedTo` column matches only the first requester&apos;s ID

**Task 2 — Ring-status callback:**
- [ ] Initiate a ring group call via the UI or API
- [ ] In Twilio console, confirm the `statusCallback` URL resolves to 204 (not 404) for each `CallStatus` event
- [ ] After call completes, verify `callAttempts.status` is updated in the database

**Task 3 — 3-star review threshold:**
- [ ] Sync a Google review with rating 3 for an `operator_managed` client
- [ ] Verify the generated `reviewResponse` row has `status = 'pending_approval'` (not `approved`)
- [ ] Sync a review with rating 4 and verify `status = 'approved'`

**Task 4 — Real-time negative review alert:**
- [ ] With a client that has a `phone` and a Twilio number configured, manually insert a review with `rating = 1` and `alertSent = false`
- [ ] Call `syncAllReviews(clientId)` (or trigger the cron)
- [ ] Verify an SMS alert is sent in the same run (check logs and `alertSent = true` on the review row)
- [ ] Call `syncAllReviews(clientId)` again — verify no duplicate alert is sent

**Task 5 — CASL consent persistence:**
- [ ] Import a batch of leads via `POST /api/leads/import` with `consentAttested: true`
- [ ] Query the database: `SELECT casl_consent_attested, casl_consent_attested_at FROM leads WHERE source = 'csv_import' ORDER BY created_at DESC LIMIT 5`
- [ ] Verify `casl_consent_attested = true` and `casl_consent_attested_at` is a recent timestamp for all imported rows
- [ ] Repeat via `POST /api/client/leads/import` (portal route) — verify same result
- [ ] Attempt import with `consentAttested: false` — verify 400 response, no rows inserted
