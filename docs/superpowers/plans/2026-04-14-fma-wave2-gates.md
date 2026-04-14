# FMA Wave 2: Gates & Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce critical onboarding and operational gates that prevent the highest-severity failure modes — wrong ICP onboarded (FM-01), premature autonomous mode (FM-33), exclusion list skipped (FM-14, S=10), forwarding failures (FM-08/09/18).

**Architecture:** Extend existing onboarding quality system (`onboarding-quality.ts`) with new gate checks. Add ICP qualification fields to client creation wizard. Build forwarding verification as a new Twilio outbound call service with daily cron. All gates use `resolveFeatureFlag()` from Wave 1 infrastructure.

**Tech Stack:** Drizzle ORM schema additions, Next.js API routes, React wizard steps, Twilio voice `calls.create()`, existing onboarding quality policy system.

**Prerequisites:** Wave 1 feature flag infrastructure (complete). `resolveFeatureFlag()`, `SystemFeatureFlag` type, `system_settings` table all in place.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/services/readiness-check.ts` | Autonomous readiness checklist evaluation (6 items, critical/warning) |
| Create | `src/lib/services/onboarding-checklist.ts` | Platform-enforced onboarding checklist (10 items, blocking/advisory) |
| Create | `src/lib/services/forwarding-verification.ts` | Twilio outbound verification call + result handling |
| Create | `src/lib/automations/forwarding-verification-cron.ts` | Daily cron for first-7-days verification calls |
| Create | `src/app/api/cron/forwarding-verification/route.ts` | Cron endpoint for forwarding verification |
| Create | `src/app/api/admin/clients/[id]/readiness/route.ts` | GET endpoint returning readiness checklist state |
| Create | `src/app/api/admin/clients/[id]/onboarding-checklist/route.ts` | GET endpoint returning onboarding checklist state |
| Create | `src/app/api/webhooks/twilio/verification-status/route.ts` | Webhook for verification call result |
| Modify | `src/db/schema/clients.ts` | Add `exclusionListReviewed`, `exclusionListReviewedAt`, `exclusionListReviewedByPersonId`, `estimatedLeadVolume`, `averageProjectValue`, `deadQuoteCount`, `lowVolumeDisclosureAcknowledged`, `forwardingVerifiedAt`, `forwardingVerificationStatus` |
| Modify | `src/lib/services/onboarding-quality.ts` | Add exclusion list gate to `evaluateAutonomousModeTransitionDecision()` |
| Modify | `src/app/api/admin/clients/[id]/route.ts` | Add exclusion list confirmation endpoint logic, integrate readiness check into autonomous transition |
| Modify | `src/app/(dashboard)/admin/clients/[id]/feature-toggles.tsx` | Show readiness checklist inline when autonomous mode selected |
| Modify | `src/app/(dashboard)/admin/clients/new/wizard/setup-wizard.tsx` | Add ICP qualification step |
| Modify | `src/app/(dashboard)/admin/clients/new/wizard/steps/step-business-info.tsx` | Add ICP fields to step 1 |
| Modify | `src/app/api/admin/clients/route.ts` | Accept + persist ICP fields on client creation |
| Modify | `src/app/(dashboard)/admin/clients/[id]/page.tsx` | Add onboarding checklist card |
| Modify | `src/app/api/cron/route.ts` | Register forwarding verification cron |
| Modify | `src/lib/features/check-feature.ts` | No changes needed — `forwardingVerification` already in `SystemFeatureFlag` |

---

### Task 1: Schema — Add exclusion list + ICP + forwarding columns to clients

**Intent:** Add all new columns needed for Wave 2 gates to the clients table in one migration.

**Columns to add (all on `clients` table):**
- `exclusionListReviewed: boolean().default(false)` — gate for autonomous mode
- `exclusionListReviewedAt: timestamp()` — nullable, when it was confirmed
- `exclusionListReviewedByPersonId: uuid()` — nullable FK to `people.id`, who confirmed it
- `estimatedLeadVolume: integer()` — nullable, monthly lead volume estimate (ICP)
- `averageProjectValue: integer()` — nullable, in dollars (ICP)
- `deadQuoteCount: integer()` — nullable, how many dead quotes available (ICP)
- `lowVolumeDisclosureAcknowledged: boolean().default(false)` — if sub-15 volume, disclosure confirmed
- `forwardingVerifiedAt: timestamp()` — nullable, last successful verification
- `forwardingVerificationStatus: varchar(20)` — nullable, `'pending' | 'passed' | 'failed' | 'skipped'`

**Constraints:**
- `exclusionListReviewedByPersonId` → FK to `people.id` with `onDelete: 'set null'`
- No defaults that change existing behavior — all nullable or `default(false)`

**Steps:**
- [ ] **Step 1:** Add columns to `src/db/schema/clients.ts`. Follow existing column patterns (see `dailyDigestEnabled` for nullable boolean pattern, `scheduledOnboardingCallAt` for nullable timestamp pattern)
- [ ] **Step 2:** Run `npm run db:generate` to create migration
- [ ] **Step 3:** Review generated SQL — verify no destructive changes
- [ ] **Step 4:** Run `npm run typecheck` to verify schema types propagate
- [ ] **Step 5:** Commit: `feat: add exclusion list, ICP qualification, and forwarding verification columns (FMA 4.1-4.5)`

---

### Task 2: Exclusion list gate on autonomous mode transition

**Intent:** Block autonomous mode activation until operator explicitly confirms exclusion list was reviewed with the contractor. This is the highest-severity prevention in the system (FM-14, S=10).

**What to build:**
- Add `exclusionListReviewed` check into the existing autonomous mode transition flow in `src/app/api/admin/clients/[id]/route.ts` (lines 97-121)
- When `autonomousTransitionRequested` is true AND `exclusionListReviewed` is false on the client, return 409 with message: "Exclusion list not reviewed. Confirm you asked the contractor about family, friends, and personal numbers before enabling autonomous mode."
- Add a new PATCH field `exclusionListReviewed: z.boolean().optional()` to `updateClientSchema` — when set to true, also set `exclusionListReviewedAt` and `exclusionListReviewedByPersonId` from session
- Write audit_log entry when exclusion list is marked reviewed (action: `exclusion_list_reviewed`)

**Constraints:**
- Gate check happens BEFORE the existing onboarding quality readiness check (line 100-121)
- Setting `exclusionListReviewed: false` should NOT be possible once it's true (one-way latch)
- The exclusion list can be empty — the gate confirms the conversation happened, not that entries exist

**Pattern:** Follow the existing `autonomousTransitionRequested` guard pattern already in the route

**Test criteria:**
- PATCH with `aiAgentMode: 'autonomous'` when `exclusionListReviewed` is false → 409
- PATCH with `exclusionListReviewed: true` → sets timestamp + personId + audit log
- PATCH with `aiAgentMode: 'autonomous'` when `exclusionListReviewed` is true → proceeds to existing quality gate check
- Cannot set `exclusionListReviewed` back to false

**Steps:**
- [ ] **Step 1:** Write tests for exclusion list gate behavior
- [ ] **Step 2:** Modify the PATCH handler in `src/app/api/admin/clients/[id]/route.ts` — add exclusion list check before autonomous transition, add schema field
- [ ] **Step 3:** Run tests + typecheck
- [ ] **Step 4:** Commit: `feat: exclusion list gate blocks autonomous mode until reviewed (FMA 4.1)`

---

### Task 3: Autonomous readiness checklist service

**Intent:** Auto-calculate readiness before AI mode transition. Shows pass/fail per item. Blocks on critical failures. This prevents premature autonomous mode (FM-33).

**What to build — `src/lib/services/readiness-check.ts`:**

A `getAutonomousReadiness(clientId)` function that evaluates 6 checklist items and returns structured results:

| # | Item | Threshold | Severity | Data source |
|---|------|-----------|----------|-------------|
| 1 | KB entry count | >= 10 | critical (blocks) | `knowledgeBase` table, count where `clientId` matches and entry is active |
| 2 | Pricing range exists | >= 1 service with pricing | critical (blocks) | `clientServices` table, count where `canDiscussPrice = 'yes_range'` and min/max valid |
| 3 | Reviewed interactions in Smart Assist | >= 30 | critical (blocks) | `smartAssistDecisions` table (or `audit_log` with action containing 'smart_assist'), count approved/rejected decisions |
| 4 | Escalation rate last 7 days | < 20% | warning (doesn't block) | `leads` table: escalated / total in last 7 days |
| 5 | Exclusion list reviewed | must be true | critical (blocks) | `clients.exclusionListReviewed` column (from Task 2) |
| 6 | Business hours configured | >= 1 day | critical (blocks) | `businessHours` table, count where `clientId` matches |

**Return type:** `ReadinessResult` with `items: ReadinessItem[]`, `allCriticalPassed: boolean`, `passedCount: number`, `totalCount: number`. Each `ReadinessItem` has `key`, `label`, `description`, `passed`, `severity: 'critical' | 'warning'`, `currentValue`, `requiredValue`.

**Important — Smart Assist interaction count:** Check how Smart Assist decisions are tracked. Look for `smart_assist` entries in `audit_log` or a dedicated table. The spec says "30 reviewed interactions in Smart Assist" — this means the operator has reviewed (approved or rejected) 30+ AI draft messages. Search for the tracking mechanism and use it.

**API endpoint:** `GET /api/admin/clients/[id]/readiness` — returns the readiness result. Uses `adminClientRoute` with `CLIENTS_VIEW` permission.

**Constraints:**
- Pure data queries — no side effects
- All queries in parallel (Promise.all)
- This does NOT replace the existing `onboarding-quality.ts` gates — it's an additional layer shown in the UI. The existing gates still block at the API level.

**Test criteria:**
- Client with < 10 KB entries → item 1 fails, `allCriticalPassed` is false
- Client with all items passing → `allCriticalPassed` is true
- Warning items failing don't affect `allCriticalPassed`
- API returns 200 with structured result

**Steps:**
- [ ] **Step 1:** Research how Smart Assist review tracking works — grep for `smart_assist` in audit_log actions or find the decisions table
- [ ] **Step 2:** Write tests for readiness check evaluation logic (pure function, mock data)
- [ ] **Step 3:** Implement `src/lib/services/readiness-check.ts`
- [ ] **Step 4:** Create API route `src/app/api/admin/clients/[id]/readiness/route.ts`
- [ ] **Step 5:** Run tests + typecheck
- [ ] **Step 6:** Commit: `feat: autonomous readiness checklist with 6-item evaluation (FMA 4.2)`

---

### Task 4: Readiness checklist UI in feature toggles

**Intent:** When operator selects "Autonomous" in the AI agent mode dropdown, show the readiness checklist inline with pass/fail indicators. Block the save if critical items fail (client-side + server-side).

**What to modify — `src/app/(dashboard)/admin/clients/[id]/feature-toggles.tsx`:**

- When `aiAgentMode` changes to `'autonomous'`, fetch `GET /api/admin/clients/{clientId}/readiness`
- Show checklist results inline below the Agent Mode select:
  - Green checkmark + label for passing items
  - Red X + label + explanation for failing critical items
  - Yellow warning + label for failing warning items
  - Summary: "4 of 6 passed. Resolve the following before enabling autonomous mode:"
- If `allCriticalPassed` is false, disable the Save button with tooltip explaining why
- If exclusion list not reviewed, show a confirmation button: "I have reviewed the exclusion list with the contractor" — clicking it PATCHes `exclusionListReviewed: true`, then re-fetches readiness

**Constraints:**
- Fetch readiness on mode change, not on page load (avoid unnecessary queries)
- Show loading skeleton while fetching
- If mode is changed away from `'autonomous'`, hide the checklist
- Follow existing error/success banner pattern in the component
- Brand colors only — green (#3D7A50) for pass, sienna (#C15B2E) for fail, olive (#6B7E54) for warning

**Steps:**
- [ ] **Step 1:** Add readiness fetch + state to `FeatureTogglesCard`
- [ ] **Step 2:** Render checklist UI below agent mode select (conditionally when autonomous selected)
- [ ] **Step 3:** Add exclusion list confirmation button with PATCH call
- [ ] **Step 4:** Disable save when critical items fail
- [ ] **Step 5:** Test in browser — verify flow works end-to-end
- [ ] **Step 6:** Run typecheck
- [ ] **Step 7:** Commit: `feat: readiness checklist UI in feature toggles (FMA 4.2)`

---

### Task 5: ICP qualification fields on client creation wizard

**Intent:** Add required ICP fields to the client creation wizard step 1. If monthly lead volume < 15, show guarantee extension disclosure and require acknowledgment. Prevents FM-01 (wrong ICP) and FM-02 (volume disclosure skipped).

**What to modify:**

1. **`WizardData` interface** in `setup-wizard.tsx` — add `estimatedLeadVolume: number | null`, `averageProjectValue: number | null`, `deadQuoteCount: number | null`, `lowVolumeDisclosureAcknowledged: boolean`

2. **`step-business-info.tsx`** — add 3 new fields in a new section "Lead Volume & Pipeline" below the existing fields:
   - "Estimated Monthly Leads" — number input, required, placeholder "e.g. 25"
   - "Average Project Value ($)" — number input, required, placeholder "e.g. 5000"
   - "Dead Quotes Available" — number input, required, placeholder "e.g. 10", with helper text "Quotes sent in last 6 months that never closed"
   - When `estimatedLeadVolume < 15`, show a warning card (yellow/sienna border): "Low lead volume detected. Guarantee windows will be extended. Confirm you disclosed this to the contractor." with a checkbox that maps to `lowVolumeDisclosureAcknowledged`
   - Validation: all 3 fields required (> 0). If volume < 15, disclosure checkbox required.

3. **`POST /api/admin/clients` route** — add the 3 ICP fields + `lowVolumeDisclosureAcknowledged` to the create schema. Persist to clients table.

4. **`PATCH /api/admin/clients/[id]` route** — add the 3 ICP fields to the update schema so they can be edited later.

**Constraints:**
- Fields are required on wizard — wizard won't proceed without them
- Fields are optional on PATCH (editing later)
- Low-volume is NOT a hard block — contractor CAN be signed. The gate ensures disclosure happened.
- Use existing grid layout pattern (`grid gap-4 md:grid-cols-2`)

**Test criteria:**
- Wizard step 1 won't proceed if ICP fields are empty
- Volume < 15 shows disclosure warning, requires checkbox
- Volume >= 15 hides disclosure warning
- POST creates client with ICP fields persisted
- PATCH can update ICP fields

**Steps:**
- [ ] **Step 1:** Update `WizardData` interface with ICP fields
- [ ] **Step 2:** Add ICP input fields to `step-business-info.tsx` with validation
- [ ] **Step 3:** Add low-volume disclosure conditional UI
- [ ] **Step 4:** Update POST `/api/admin/clients` route schema + insert
- [ ] **Step 5:** Update PATCH `/api/admin/clients/[id]` route schema
- [ ] **Step 6:** Test in browser — verify wizard flow + low-volume trigger
- [ ] **Step 7:** Run typecheck + build
- [ ] **Step 8:** Commit: `feat: ICP qualification fields on client creation wizard (FMA 4.3)`

---

### Task 6: Onboarding checklist service

**Intent:** Platform-enforced onboarding checklist tracking completion of mandatory steps. Some items block progression (Smart Assist, autonomous mode), others are advisory. Surfaces on client detail page.

**What to build — `src/lib/services/onboarding-checklist.ts`:**

A `getOnboardingChecklist(clientId)` function that evaluates 10 items:

| # | Item | Auto-checked? | Blocks what? | Data source |
|---|------|--------------|-------------|-------------|
| 1 | Phone number assigned | Yes | Nothing (advisory) | `clientPhoneNumbers` table, any active+primary |
| 2 | Operator phone configured | Yes | Smart Assist | `clientMemberships` where `receiveEscalations=true` AND person has phone |
| 3 | Call forwarding tested | Yes (after 4.5) | Smart Assist (after verification) | `clients.forwardingVerificationStatus = 'passed'` |
| 4 | Voicemail disabled verified | Manual | Smart Assist (after verification) | Could reuse `forwardingVerificationStatus` or add separate flag — use `forwardingVerificationStatus = 'passed'` as proxy since verification call would detect voicemail intercept |
| 5 | KB minimum entries >= 5 | Yes | Smart Assist activation | `knowledgeBase` table count |
| 6 | Pricing range set | Yes | Autonomous mode | `clientServices` with `canDiscussPrice = 'yes_range'` and valid ranges (reuse readiness check logic) |
| 7 | Exclusion list reviewed | Yes | Autonomous mode | `clients.exclusionListReviewed` |
| 8 | Payment captured | Yes | Nothing (advisory) | `subscriptions` table, any active/trialing for client |
| 9 | Quote import completed | Manual marker | Nothing (advisory) | Need a way to mark this — use audit_log with action `quote_import_completed` |
| 10 | Revenue Leak Audit sent | Yes | Nothing (advisory, surfaces in cockpit if overdue) | `revenueLeakAudits` table, any for client |

**Return type:** `OnboardingChecklistResult` with `items: ChecklistItem[]`, `completedCount`, `totalCount`, `blockedCapabilities: string[]`. Each `ChecklistItem` has `key`, `label`, `completed`, `blocking: string | null` (what it blocks, or null if advisory), `description`.

**API endpoint:** `GET /api/admin/clients/[id]/onboarding-checklist` — uses `adminClientRoute` with `CLIENTS_VIEW` permission.

**Constraints:**
- All queries in parallel
- Items 3 and 4 only become relevant after forwarding verification is set up (Task 7). Before that, show as "Pending setup" rather than failed.
- Item 9 (quote import) needs a manual completion mechanism — simplest is an audit_log entry check. Add a note that a future PATCH endpoint can mark it complete.

**Test criteria:**
- New client with nothing set up → most items incomplete, correct blocks listed
- Client with phone + escalation contacts + KB + pricing + exclusion list → Smart Assist and autonomous unblocked
- `blockedCapabilities` correctly reflects which items block what

**Steps:**
- [ ] **Step 1:** Write tests for checklist evaluation
- [ ] **Step 2:** Implement `src/lib/services/onboarding-checklist.ts`
- [ ] **Step 3:** Create API route `src/app/api/admin/clients/[id]/onboarding-checklist/route.ts`
- [ ] **Step 4:** Run tests + typecheck
- [ ] **Step 5:** Commit: `feat: platform-enforced onboarding checklist service (FMA 4.4)`

---

### Task 7: Onboarding checklist UI on client detail page

**Intent:** Show the onboarding checklist as a progress card on the client detail page. Green checkmarks accumulate. Blocking items show lock icon on the capability they gate.

**What to build:**
- New component `src/app/(dashboard)/admin/clients/[id]/onboarding-checklist-card.tsx`
- Fetches from `GET /api/admin/clients/{id}/onboarding-checklist` on mount
- Card with title "Onboarding Checklist" and progress bar (X/10 complete)
- Each item as a row: checkmark (green) or circle (gray) + label + optional lock icon with tooltip showing what it blocks
- Blocking items that are incomplete show in sienna/warning color
- Advisory items that are incomplete show in muted gray
- Add card to `page.tsx` — place it prominently (near top, after stats cards)

**Constraints:**
- Use existing `Card` + `Progress` components from shadcn
- Use `CheckCircle` (lucide) for completed, `Circle` for pending, `Lock` for blocking
- Mobile-responsive: single column stack
- Follow brand colors (green #3D7A50 for complete, sienna #C15B2E for blocking-incomplete, muted for advisory-incomplete)

**Steps:**
- [ ] **Step 1:** Create `onboarding-checklist-card.tsx` component
- [ ] **Step 2:** Add to client detail page.tsx
- [ ] **Step 3:** Test in browser at desktop + 375px
- [ ] **Step 4:** Run typecheck
- [ ] **Step 5:** Commit: `feat: onboarding checklist progress card on client detail (FMA 4.4)`

---

### Task 8: Forwarding verification service + webhook

**Intent:** After phone setup, auto-call the contractor's business number to verify forwarding works. If the call doesn't forward to the Twilio number, alert the operator. Costs ~$0.14 per onboarding.

**What to build:**

1. **`src/lib/services/forwarding-verification.ts`:**
   - `initiateVerificationCall(clientId)` — places an outbound Twilio call to the contractor's business phone number (NOT the Twilio number). The call should ring and, if forwarding is set up correctly, forward to the Twilio number.
   - Uses Twilio `client.calls.create()` — the Twilio client is already instantiated in `src/lib/services/twilio.ts`. Import and extend or use `getTwilioClient()` if exported.
   - The `from` number should be the client's assigned Twilio number (so it looks like a real inbound call)
   - The `to` number is the contractor's business landline/number that should forward to Twilio
   - Set `statusCallback` to `/api/webhooks/twilio/verification-status`
   - Set a reasonable `timeout` (20 seconds)
   - The TwiML response for the call should be a brief message: "This is an automated test call from ConversionSurgery to verify your call forwarding. No action needed."
   - Store the call SID on the client or in a tracking mechanism (simplest: update `clients.forwardingVerificationStatus` to `'pending'` and store call SID in metadata)
   - On error, set status to `'failed'` and log

2. **`src/app/api/webhooks/twilio/verification-status/route.ts`:**
   - Receives Twilio status callback
   - If call status is `completed` AND the call was answered by Twilio (forwarding worked): set `forwardingVerificationStatus` to `'passed'`, set `forwardingVerifiedAt`
   - If call status is `no-answer`, `busy`, `failed`, or `canceled`: set status to `'failed'`
   - Write audit_log entry with action `forwarding_verification_result`

3. **Need to determine:** How to detect whether the call actually forwarded to Twilio vs. was answered by voicemail. Options:
   - Check if the call triggered an inbound webhook on the Twilio number (indicates forwarding worked)
   - Use `AnsweredBy` detection (`machineDetection: 'Enable'` on the call) — if `AnsweredBy` is `human` or `unknown`, likely forwarded. If `machine_start`, voicemail intercepted.
   - Simplest: use AMD (Answering Machine Detection). Query Context7 for Twilio AMD patterns before implementing.

**Constraints:**
- Feature-flagged via `resolveFeatureFlag(clientId, 'forwardingVerification')`
- Need the contractor's business phone number — this should be a field on the client or phone numbers table. Check if `clients.phone` is the owner's personal number (it is, per wizard) vs. the business number. May need to use a different field or add one.
- Verify Twilio signature on the webhook (follow existing webhook patterns in `src/app/api/webhooks/twilio/`)

**Test criteria:**
- `initiateVerificationCall` creates a Twilio call with correct from/to/callback
- Webhook correctly updates status based on call result
- Feature flag check prevents calls when disabled

**Steps:**
- [ ] **Step 1:** Query Context7 for Twilio outbound calls + AMD patterns
- [ ] **Step 2:** Check how Twilio client is accessed — grep for Twilio client instantiation
- [ ] **Step 3:** Write tests for verification service (mock Twilio client)
- [ ] **Step 4:** Implement `src/lib/services/forwarding-verification.ts`
- [ ] **Step 5:** Implement webhook route `src/app/api/webhooks/twilio/verification-status/route.ts`
- [ ] **Step 6:** Run tests + typecheck
- [ ] **Step 7:** Commit: `feat: forwarding verification service with Twilio outbound call (FMA 4.5)`

---

### Task 9: Forwarding verification daily cron

**Intent:** Run verification calls daily for the first 7 days after phone setup. Creates a cron job that finds clients needing verification and initiates calls.

**What to build — `src/lib/automations/forwarding-verification-cron.ts`:**

- `runForwardingVerificationCron()` function
- Queries clients where:
  - Status is `active`
  - Has an assigned Twilio phone number (primary, active)
  - `createdAt` is within last 7 days
  - `forwardingVerificationStatus` is NOT `'passed'` AND NOT `'skipped'`
  - No verification call today (dedup via audit_log action `forwarding_verification_attempt` with today's date)
- For each matching client: check `resolveFeatureFlag(clientId, 'forwardingVerification')`, then call `initiateVerificationCall(clientId)`
- Write audit_log entry for each attempt

**Cron registration:** Add to `src/app/api/cron/route.ts` in the daily block (hour === 10, business hours). Create `src/app/api/cron/forwarding-verification/route.ts` following the day3-checkin pattern.

**Constraints:**
- Only during business hours (10am-4pm client local time) — don't call contractors at midnight
- Max 1 attempt per client per day
- If status is `'passed'`, never call again
- If status is `'skipped'`, never call again (operator manually skipped)

**Test criteria:**
- New client within 7 days, no verification → gets called
- Client older than 7 days → skipped
- Client with `passed` status → skipped
- Client already called today → skipped
- Feature flag disabled → skipped

**Steps:**
- [ ] **Step 1:** Write tests for cron logic
- [ ] **Step 2:** Implement `src/lib/automations/forwarding-verification-cron.ts`
- [ ] **Step 3:** Create cron route `src/app/api/cron/forwarding-verification/route.ts`
- [ ] **Step 4:** Register in `src/app/api/cron/route.ts`
- [ ] **Step 5:** Run tests + typecheck
- [ ] **Step 6:** Commit: `feat: daily forwarding verification cron for first 7 days (FMA 4.5)`

---

### Task 10: Documentation updates

**Intent:** Update all relevant docs to reflect Wave 2 changes.

**Docs to update (per Change-to-Doc mapping):**

1. **`docs/product/PLATFORM-CAPABILITIES.md`** — Section 9 (Onboarding): add onboarding checklist, ICP qualification gates, exclusion list gate, forwarding verification. Section 1 (AI Agent): mention autonomous readiness checklist blocking transition.
2. **`docs/engineering/01-TESTING-GUIDE.md`** — Add test steps for: exclusion list gate, autonomous readiness check, ICP qualification wizard fields, forwarding verification, onboarding checklist API.
3. **`docs/operations/01-OPERATIONS-GUIDE.md`** — Add operational procedures: how to review exclusion list, how to handle low-volume clients, how to interpret forwarding verification failures, how to use onboarding checklist.
4. **`docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md`** — Update Section 10 (Onboarding Call): add exclusion list review step, ICP qualification fields, forwarding verification check.
5. **`docs/product/FEATURE-BACKLOG.md`** — Mark Wave 2 items as shipped if they were tracked there.

**Steps:**
- [ ] **Step 1:** Read each doc to find the right insertion point
- [ ] **Step 2:** Update PLATFORM-CAPABILITIES.md
- [ ] **Step 3:** Update TESTING-GUIDE.md
- [ ] **Step 4:** Update OPERATIONS-GUIDE.md
- [ ] **Step 5:** Update MANAGED-SERVICE-PLAYBOOK.md
- [ ] **Step 6:** Update FEATURE-BACKLOG.md
- [ ] **Step 7:** Commit: `docs: update platform docs for FMA Wave 2 gates and enforcement`

---

### Task 11: Quality gate

**Intent:** Verify everything works together.

**Steps:**
- [ ] **Step 1:** Run `npm run typecheck`
- [ ] **Step 2:** Run `npm test`
- [ ] **Step 3:** Run `npm run build`
- [ ] **Step 4:** Run `npm run quality:no-regressions`
- [ ] **Step 5:** Verify no red gates. If any fail, fix and re-run.
