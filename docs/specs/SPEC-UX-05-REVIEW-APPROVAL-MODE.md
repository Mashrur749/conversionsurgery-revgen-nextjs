# SPEC-UX-05: Review Approval Mode

> **Status:** Approved
> **Priority:** Next
> **Estimated scope:** Schema change (1 column) + ~6 files
> **Depends on:** SPEC-UX-04 (service model gating must be in place)
> **Blocks:** Nothing

---

## Overview

For managed-service clients, the operator should own review response approval — not the contractor. The contractor bought "we handle everything," so they shouldn't be reviewing AI-drafted Google review responses unless the review is negative/sensitive.

**Current flow (all clients):**
1. Cron runs `autoGenerateReviewDrafts()` for clients with `autoReviewResponseEnabled`
2. AI generates draft response → status = `draft`
3. Contractor sees pending responses on `/client/reviews`
4. Contractor edits/approves → status = `approved`
5. System posts to Google → status = `posted`

**New flow for managed-service clients:**
1. Same cron generates drafts → status = `draft`
2. For positive reviews (rating >= 3): auto-approve and post without human review
3. For negative reviews (rating <= 2): mark as `pending_approval`, notify operator
4. Operator batch-approves from `/admin/clients/[id]/reviews` or edits before posting
5. Contractor only sees negative reviews that need their personal input (forwarded by operator)
6. Self-serve clients keep the current flow (contractor approves everything)

---

## Schema Change

### Add `reviewApprovalMode` to clients table

```
reviewApprovalMode: varchar('review_approval_mode', { length: 20 }).default('operator_managed').notNull()
// Values: 'operator_managed' | 'client_approves'
```

**Default:** `operator_managed` (matches managed-service model)

**Derived from serviceModel:**
- When `serviceModel = 'managed'` → default `reviewApprovalMode = 'operator_managed'`
- When `serviceModel = 'self_serve'` → default `reviewApprovalMode = 'client_approves'`
- Can be overridden per client (some managed clients may prefer to approve reviews themselves)

**Files:**
- `src/db/schema/clients.ts` — add column
- Run `npm run db:generate` → review migration → user confirms before `db:push`

---

## Service Changes

### 1. Auto-approve positive reviews (operator_managed mode)

**File:** `src/lib/automations/auto-review-response.ts`

After `createDraftResponse()` succeeds, check the client's `reviewApprovalMode`:
- If `operator_managed` AND review `rating >= 3`:
  - Set response status to `approved` immediately
  - Call `postResponseToGoogle()` to post
  - Log as auto-posted
- If `operator_managed` AND review `rating <= 2`:
  - Set response status to `pending_approval`
  - Send operator notification (SMS to agency operator phone): "Negative review (X star) for [Client]. Review and approve at [admin link]."
- If `client_approves`:
  - Keep current behavior (status stays `draft`, contractor sees it on portal)

### 2. Operator batch-approve API

**File:** `src/app/api/admin/clients/[id]/reviews/approve/route.ts` (new)

POST endpoint that accepts an array of review response IDs to approve:
```json
{ "responseIds": ["uuid1", "uuid2", ...] }
```

- Validates all responses belong to the client
- Sets status = `approved`, `approvedAt` = now
- Triggers `postResponseToGoogle()` for each
- Returns results (posted count, error count)

### 3. Operator edit + approve

The admin reviews page already shows reviews. Add:
- Inline edit capability for response text before approving
- "Approve & Post" button per response
- "Approve All" batch button for positive reviews
- "Forward to Client" button for negative reviews (sends contractor a notification asking for their input)

---

## UI Changes

### Admin: `/admin/clients/[id]/reviews`

**Current:** Shows review dashboard + Google connection card + review source config.

**Add:**
- "Pending Responses" section at top (before the review dashboard)
- Shows draft/pending_approval responses with:
  - Review author, rating (star display), review text
  - AI-drafted response (editable textarea)
  - Actions: "Approve & Post" | "Edit" | "Forward to Client" | "Reject"
- "Approve All Positive" batch button (approves all rating >= 3 drafts)
- Counter badge: "3 pending" in the section header

### Client: `/client/reviews`

**Current:** Shows all pending responses for contractor approval.

**Change for `operator_managed` clients:**
- Show only responses with status `pending_approval` that were explicitly forwarded by operator (add a `forwardedToClient` boolean on review_responses)
- If no forwarded responses: show "Your account manager handles review responses. Negative reviews that need your personal touch will appear here."
- Self-serve clients: no change (see all drafts as before)

### Admin: Client PATCH API

**File:** `src/app/api/admin/clients/[id]/route.ts`

Add `reviewApprovalMode` to the update schema:
```typescript
reviewApprovalMode: z.enum(['operator_managed', 'client_approves']).optional(),
```

### Admin: Client Configuration Tab

Add a toggle in the Configuration tab for `reviewApprovalMode`:
- "Review Approval: Operator manages (auto-post positive, flag negative) / Client approves all"
- Only visible when `autoReviewResponseEnabled` is true

---

## Notification

When a negative review arrives for an `operator_managed` client:
- SMS to operator: "[Client Name] received a [X]-star review. Review the AI response and approve or edit: [admin link]"
- Use `sendCompliantMessage()` via compliance gateway
- No contractor notification (operator handles it)

When operator forwards to client:
- SMS to contractor: "You received a [X]-star review from [Author]. We drafted a response — please review and personalize: [portal link]"

---

## Acceptance Criteria

- [ ] `reviewApprovalMode` column exists on clients (default: `operator_managed`)
- [ ] Existing clients backfilled: managed → `operator_managed`, self-serve → `client_approves`
- [ ] Positive reviews (rating >= 3) auto-posted for operator_managed clients
- [ ] Negative reviews (rating <= 2) held for operator approval
- [ ] Operator sees pending responses on admin reviews page with edit/approve/forward actions
- [ ] "Approve All Positive" batch button works
- [ ] "Forward to Client" sends notification and makes response visible on client portal
- [ ] Client portal for managed clients: only shows forwarded responses + empty state message
- [ ] Self-serve clients: unchanged behavior
- [ ] Operator notified via SMS for negative reviews
- [ ] `reviewApprovalMode` editable from admin client configuration tab
- [ ] `npm run quality:no-regressions` passes

---

## Doc Sync Checklist

| Doc | What to update |
|-----|---------------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 12 (Review Monitoring) — add approval modes, auto-post behavior |
| `docs/product/PLATFORM-CAPABILITIES.md` | Section 5 (Client Portal) — update service model table with review gating |
| `docs/engineering/01-TESTING-GUIDE.md` | Add test steps for review approval flow (positive auto-post, negative hold, forward) |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Add review management to operator workflow |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Add review triage to daily operator routine |
| `docs/business-intel/OFFER-APPROVED-COPY.md` | **Flag to user** — "we handle review responses" claim needs confirmation |
| `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` | Mark SPEC-UX-04 review approval as complete |

---

## Migration Checklist

- [ ] Add column with `npm run db:generate`
- [ ] Review migration SQL (additive — new column with default, no data loss)
- [ ] User confirms before `npm run db:migrate`
- [ ] Backfill: UPDATE clients SET review_approval_mode = 'client_approves' WHERE service_model = 'self_serve'
- [ ] Verify: all managed clients have `operator_managed`, all self-serve have `client_approves`
