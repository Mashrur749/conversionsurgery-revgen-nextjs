# Wave A Hardening — Pre-Launch Compliance + Observability

## Phase Goal

**Wave A Hardening — close all known compliance, UX, and observability gaps before first paying client signs.** The platform code already enforces CASL 6-month implied-consent at outbound send. This phase closes the remaining surfaces where (a) compliance can be bypassed in code, (b) intake UX exposes preventable contractor friction, and (c) post-launch observability would be retrofitted under load. After this phase ships, the platform is sales-ready with no known critical gaps.

## Why This Phase Exists

A pre-launch audit surfaced three categories of risk: (1) seven verified call sites send SMS via direct `twilio.messages.create`, bypassing the compliance gateway entirely (regulatory exposure that compounds the moment Pilot #1's volume hits production); (2) the CASL 6-month gate that shipped in commit `3cde5bc` left the lead-detail UI, operator quick-add, and CSV uploaders without surfaces for inquiry_date warnings, the 24-month customer-consent path, or the new required columns; (3) sentinel metrics and an immutable consent-audit export are standard expectations for a regulated outbound system and are dramatically cheaper to build before traffic than after. Skipping any of these means either taking on legal exposure that grows with revenue or paying retrofit cost while operating live.

## Prerequisites Before Execution Starts

- [ ] Migration 0030 (`drizzle/0030_flawless_stingray.sql` — adds `leads.inquiry_date`, `leads.dormant_reengagement_sent_at`, `consent_records.consent_evidence`) pushed to production DB via `pnpm run db:push`. **All Phase 0/1/2 tasks reference columns that do not exist in production until this migration runs.**
- [ ] All current tests passing (`pnpm test` — 312 deterministic tests on `main` at `3cde5bc`).
- [ ] No uncommitted code in `src/` (clean working tree on `main`).
- [ ] Branch created: `wave-A-hardening` (work on a branch; merge to `main` only after the full no-regressions gate passes).

## Sub-Phases

---

### Phase 0 — Compliance Bypass Fix (P0)

**Goal:** Eliminate every code path that sends SMS without going through the compliance gateway. After this sub-phase: the only places `twilio.messages.create` may legally appear are inside `src/lib/services/twilio.ts` (which is itself only callable from `compliance-gateway.ts`) and the read-only/Voice whitelist in `twilio-provisioning.ts` / `ring-group.ts` / webhook signature handlers.

**Verified call sites to be migrated (the full enumeration — these seven are the entire bypass surface):**

| # | File | Line | Direction | Target |
|---|------|------|-----------|--------|
| 1 | `src/lib/services/operator-alerts.ts` | 71 | Operator alert | `sendInternalSMS()` |
| 2 | `src/lib/services/agency-communication.ts` | 89 (`sendAgencySMS`) | Lead-facing (contractor's phone) | `sendCompliantMessage()` |
| 3 | `src/lib/services/agency-communication.ts` | 697 (`handleWonLostNudgeYesPrompt`) | Lead-facing | `sendCompliantMessage()` |
| 4 | `src/lib/services/agency-communication.ts` | 913 (`executeNumberedReply`) | Lead-facing | `sendCompliantMessage()` |
| 5 | `src/app/api/admin/agency/messages/route.ts` | 137 | Lead-facing | `sendCompliantMessage()` |
| 6 | `src/lib/clients/twilio-tracked.ts` | 27 (`sendTrackedSMS`) | Duplicate — delete | Redirect callers to `services/twilio.ts:sendTrackedSMS` |
| 7 | `src/lib/services/twilio.ts` | 72 (`sendSMS`) | Public API surface | Make private; only callable from gateway |

**Whitelist (untouched, do NOT refactor):**
- `src/lib/services/twilio.ts` — owns the Twilio client. After Phase 0 task 4, only the gateway calls it.
- `src/lib/services/twilio-provisioning.ts` — phone-number provisioning (admin, no message send).
- `src/lib/services/ring-group.ts` — Voice routing (different surface — TwiML, not SMS).
- `src/app/api/webhooks/twilio/*` — signature validation only (no `messages.create`).
- `src/app/api/cron/check-missed-calls/route.ts` — fetches Call resources (read, no send).

**Tasks:**

#### Phase 0 Task 1 — Audit fixture: snapshot current bypass surface
- **Files:** `.scratch/wave-a-bypass-baseline.txt` (write-only — temporary)
- **Action:** Run `grep -rn "import twilio from" src/ > .scratch/wave-a-bypass-baseline.txt` and `grep -rn "messages\.create" src/ >> .scratch/wave-a-bypass-baseline.txt`. This is the baseline against which the CI gate (task 9) will be calibrated. File is gitignored (lives under `.scratch/`).
- **Verification:** Baseline file contains exactly the 10 import sites and 9 `messages.create` sites we have already enumerated above (plus 2 in `anthropic.ts` which are unrelated AI calls — confirm those are excluded by the CI gate's allowlist).
- **Done:** Baseline written, manually inspected for completeness.
- **Dependencies:** None — runs first.

#### Phase 0 Task 2 — Add `sendInternalSMS()` to compliance gateway
- **Files (new function in existing file):** `src/lib/compliance/compliance-gateway.ts`
- **Action:** Append a new exported function `sendInternalSMS(params: SendInternalSMSParams)` after `sendCompliantMessage`. Signature:
  ```ts
  export interface SendInternalSMSParams {
    to: string;             // operator personal phone
    from: string;           // agency Twilio number
    body: string;
    subject: string;        // for audit log + dedup
    metadata?: Record<string, unknown>;
  }
  export interface SendInternalSMSResult {
    sent: boolean;
    blocked: boolean;
    blockReason?: string;
    messageSid?: string;
    auditId?: string;
  }
  ```
  Sentinel checks (in order — each block must increment the `compliance_sentinel_blocked_total` counter introduced in Phase 2 task 1; for Phase 0 just record into `compliance_audit_log` with `category='internal_sms_sentinel_block'`):
    1. **Kill switch:** if `OPS_KILL_SWITCH_KEYS.OUTBOUND_AUTOMATIONS` enabled → block.
    2. **Opt-out check:** call `ComplianceService.isOptedOut(to)` — if true, block. (An operator phone should never be opted-out, but if it is, that's a misconfiguration we MUST surface.)
    3. **Platform DNC check:** call `ComplianceService.isOnPlatformDNC(to)` — if true, block.
    4. If all checks pass → call `sendSMS()` from `services/twilio.ts` (private API after task 4) → log success to `compliance_audit_log` with `category='internal_sms_sent'`.
  Write a JSDoc block at the top: "For OPERATOR-FACING and INTERNAL alerts only. For lead-facing sends, use sendCompliantMessage(). Adding callers other than operator alerts requires explicit security review."
- **Verification:** `pnpm run typecheck` passes. New unit test in `src/lib/compliance/compliance-gateway.internal.test.ts` (Phase 0 Task 10) covers the sentinel.
- **Done:** Function exported from `compliance-gateway.ts`, no lint errors.
- **Dependencies:** None. **Blocks:** tasks 3, 6.

#### Phase 0 Task 3 — Migrate `operator-alerts.ts` to `sendInternalSMS()`
- **Files modified:** `src/lib/services/operator-alerts.ts`
- **Action:** Remove `import twilio from 'twilio';` (line 1). Remove the `client = twilio(...)` construction (lines 66-69 inside `alertOperator`). Replace the `client.messages.create({ to, from, body })` call (lines 71-75) with `await sendInternalSMS({ to: operatorPhone, from: agencyNumber, body, subject })`. Update import: add `import { sendInternalSMS } from '@/lib/compliance/compliance-gateway'`. Keep dedup logic and `markSent()`. If `result.blocked === true`, log via `logSanitizedConsoleError` with `result.blockReason` (do NOT swallow silently — operator must know an alert was suppressed by the sentinel).
- **Verification:** `grep -n "import twilio\|messages\.create" src/lib/services/operator-alerts.ts` returns zero matches. `pnpm run typecheck` clean.
- **Done:** File compiles, no twilio import, alert path goes through `sendInternalSMS`.
- **Dependencies:** Task 2.

#### Phase 0 Task 4 — Make `sendSMS()` and `sendTrackedSMS()` in `services/twilio.ts` package-private
- **Files modified:** `src/lib/services/twilio.ts`
- **Action:** Rename `export async function sendSMS(...)` → `export async function _sendSmsToTwilio(...)` (underscore prefix marks it as private API). Add a JSDoc block: `/** Internal: do NOT call directly. Use sendCompliantMessage() (lead-facing) or sendInternalSMS() (operator). */`. Same treatment for `sendTrackedSMS` at line 123 → `_sendTrackedSmsToTwilio`. Update the one in-file consumer (the gateway already imports via the `getTwilioClient`-style raw-client pattern; verify by grep). Update all callers (compliance-gateway uses `sendSMS` — there is exactly ONE legitimate caller after this phase).
- **Verification:** `grep -rn "sendSMS\b\|sendTrackedSMS\b" src/ --include="*.ts" --include="*.tsx"` returns zero matches in `src/`. `grep -rn "_sendSmsToTwilio\b" src/` returns matches only in `services/twilio.ts` (definition) and `compliance/compliance-gateway.ts` (one caller). `pnpm run typecheck` clean.
- **Done:** Public-name shadowing is gone; only the gateway can reach Twilio for SMS.
- **Dependencies:** Task 2 (gateway must already export `sendInternalSMS`, which itself now calls `_sendSmsToTwilio`). **Blocks:** task 6.

#### Phase 0 Task 5 — Migrate `agency-communication.ts` lead-facing sends (3 sites) to `sendCompliantMessage()`
- **Files modified:** `src/lib/services/agency-communication.ts`
- **Action:** Three `twilioClient.messages.create` sites:
    - **Line 89 (`sendAgencySMS`):** the central helper. Replace direct call with `sendCompliantMessage({ clientId, to: params.toPhone, from: agencyNumber, body: params.body, messageClassification: 'agency_alert', messageCategory: 'transactional', metadata: { category: params.category, promptType: params.promptType } })`. The function returns a `SendCompliantMessageResult`; map `messageSid` to the `agencyMessages.twilioSid` field on success, `delivered: result.sent`. If blocked (e.g., contractor's own phone is on platform DNC — should never happen but the gateway is the source of truth), log with reason and persist `delivered: false`. Remove the top-level `twilio` import + `twilioClient` construction at lines 1, 21-24 ONLY after the other two sites are also migrated.
    - **Line 690-697 (`handleWonLostNudgeYesPrompt`):** This site already inserts an `agencyMessages` row first then sends — refactor to call `sendAgencySMS` instead (which now goes through the gateway after the line 89 fix). The `(await import("twilio")).default(...)` dynamic import pattern is removed.
    - **Line 909-921 (`executeNumberedReply` — won_revenue_entry follow-up):** Same treatment — call `sendAgencySMS` instead of constructing twilio client inline.
  After all three sites are migrated, delete the top-level `import twilio from "twilio"` (line 1) and `const twilioClient = twilio(...)` (lines 21-24). The file should have ZERO twilio references.
- **Verification:** `grep -n "import twilio\|messages\.create\|twilioClient" src/lib/services/agency-communication.ts` returns zero matches. `pnpm run typecheck` clean. Existing agency tests still pass: `pnpm test agency-communication`.
- **Done:** All three lead-facing sends in this file route through the gateway.
- **Dependencies:** None (uses already-existing `sendCompliantMessage`). Independent of tasks 2/3/4.

#### Phase 0 Task 6 — Migrate `admin/agency/messages/route.ts` POST handler
- **Files modified:** `src/app/api/admin/agency/messages/route.ts`
- **Action:** Lines 124-141 do a dynamic `import('twilio')` and call `messages.create` directly. Replace the whole block with a call to `sendCompliantMessage({ clientId: data.clientId, to: client.phone, from: agencyNumber, body: data.message, messageClassification: 'manual_admin_send', messageCategory: 'transactional', metadata: { source: 'admin_custom_message', adminUserId: session.user.id } })`. Map the result the same way as in task 5 (twilioSid + delivered). If blocked, return 409 with `result.blockReason` so the admin sees why the gateway refused (e.g., past_due, kill switch, opt-out).
- **Verification:** `grep -n "import twilio\|messages\.create\|twilioClient" src/app/api/admin/agency/messages/route.ts` returns zero matches.
- **Done:** Admin custom-message path goes through gateway.
- **Dependencies:** None (uses `sendCompliantMessage`). Independent.

#### Phase 0 Task 7 — De-duplicate `sendTrackedSMS` — delete `src/lib/clients/twilio-tracked.ts`
- **Files modified:** `src/lib/clients/twilio-tracked.ts` (delete sendTrackedSMS export), all callers
- **Action:** First, find all callers: `grep -rn "from '@/lib/clients/twilio-tracked'\|from '@/lib/clients/twilio-tracked.ts'" src/`. For every caller of `sendTrackedSMS` from this file, change the import to `import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway'` and rewrite the call to use the gateway. Note: the legacy `sendTrackedSMS` did not enforce compliance — these callers were the bypass. Audit each caller to determine `messageClassification` correctly (most are likely `marketing` or `transactional`). Keep `trackInboundSMS` and `trackPhoneProvisioning` exports (those are observability, not message-send). Remove the `sendTrackedSMS` function and the `twilioClient` construction at lines 1, 4-7. Remove `export { twilioClient }` at line 104.
- **Verification:** `grep -rn "from '@/lib/clients/twilio-tracked'" src/` shows callers importing only `trackInboundSMS` / `trackPhoneProvisioning`. `grep -rn "sendTrackedSMS" src/` returns matches only in `services/twilio.ts` (now `_sendTrackedSmsToTwilio` per task 4). `pnpm run typecheck` clean.
- **Done:** Duplicate `sendTrackedSMS` removed; tracking utilities preserved.
- **Dependencies:** Task 4 (so the gateway's underlying `_sendTrackedSmsToTwilio` is the one privileged path).

#### Phase 0 Task 8 — Add ESLint rule banning unauthorized `twilio` imports
- **Files modified:** `eslint.config.mjs`
- **Action:** Append a custom rule. The simplest path is `no-restricted-imports` with allow-list overrides:
  ```js
  {
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'twilio',
          message: 'Direct twilio imports are forbidden. Use sendCompliantMessage() (lead-facing) or sendInternalSMS() (operator) from @/lib/compliance/compliance-gateway.',
        }],
      }],
    },
  },
  ```
  Add file-specific overrides that allow `twilio` imports only in:
  - `src/lib/services/twilio.ts`
  - `src/lib/services/twilio-provisioning.ts`
  - `src/lib/services/ring-group.ts`
  - `src/app/api/webhooks/twilio/**/*.ts`
  - `src/app/api/cron/check-missed-calls/route.ts`
  Use `overrides:` blocks at the top level of `eslintConfig` array (FlatCompat format) to disable the rule for those paths only.
- **Verification:** `pnpm run lint` passes (after Phase 0 tasks 3, 5, 6, 7 are done — order matters). Then introduce a deliberate violation by adding `import twilio from 'twilio'` to a non-whitelisted file (e.g., `src/lib/services/operator-alerts.ts`) — `pnpm run lint` MUST fail with the custom message. Revert the deliberate violation.
- **Done:** Lint catches new bypasses.
- **Dependencies:** Tasks 3, 5, 6, 7 (so existing imports don't trip the rule). **Blocks:** task 9.

#### Phase 0 Task 9 — Add CI gate script `scripts/quality/twilio-bypass-guard.sh`
- **Files created:** `scripts/quality/twilio-bypass-guard.sh`
- **Files modified:** `scripts/quality/no-regressions.sh` (wire in), `package.json` (add `quality:twilio-guard` script)
- **Action:** Bash script that:
  1. Greps for `import twilio from 'twilio'` (and `import twilio from "twilio"`) in `src/`. Filter through an allowlist: the 5 paths from task 8.
  2. Greps for `\.messages\.create` in `src/`, excluding `services/twilio.ts` (the only legitimate site after Phase 0) and `lib/ai/providers/anthropic.ts` (Anthropic SDK has unrelated `messages.create` — explicit exclusion).
  3. Exits 1 with a numbered list of unauthorized matches if any found; exits 0 if clean.
  Make executable: `chmod +x scripts/quality/twilio-bypass-guard.sh`. Add to `package.json` scripts: `"quality:twilio-guard": "bash scripts/quality/twilio-bypass-guard.sh"`. Wire into `scripts/quality/no-regressions.sh` immediately after `quality:logging-guard`.
- **Verification:** `pnpm run quality:twilio-guard` exits 0 on clean main. Add a deliberate violation (e.g., a new direct `client.messages.create({})` in a non-whitelisted file), confirm script exits 1 with a clear error citing the file:line, then revert.
- **Done:** Bypass attempts blocked at CI; pre-push hook will catch any future regression.
- **Dependencies:** Tasks 3, 5, 6, 7 (must be clean before gate is wired). **Blocks:** Phase 0 verification.

#### Phase 0 Task 10 — Unit tests for `sendInternalSMS()` sentinel behavior
- **Files created:** `src/lib/compliance/compliance-gateway.internal.test.ts`
- **Action:** Vitest suite (~6 tests) using the existing test patterns in `intake-gate.test.ts` for inspiration:
  1. Happy path: valid phone, no kill switch, not opted-out, not on DNC → sends, returns `{ sent: true, blocked: false }`.
  2. Kill switch on → returns `{ sent: false, blocked: true, blockReason: 'kill_switch' }` and logs to `compliance_audit_log`.
  3. Recipient on platform DNC → blocked with `blockReason: 'platform_dnc'`.
  4. Recipient opted-out → blocked with `blockReason: 'opted_out'`.
  5. Audit log entry written for every call (sent or blocked) with `category` matching the outcome.
  6. The function does NOT mistakenly check for lead-side consent (it's an operator path — consent records are not consulted; only opt-out / DNC / kill switch). Assert by mocking `ComplianceService.recordConsent` and ensuring it is never called.
  Mock the underlying `_sendSmsToTwilio` so tests don't actually hit Twilio.
- **Verification:** `pnpm test compliance-gateway.internal` shows 6 passing tests.
- **Done:** Sentinel behavior has regression coverage.
- **Dependencies:** Task 2.

**Phase 0 verification (gate before moving to Phase 1):**
- `grep -rn "import twilio from" src/` returns exactly 5 matches — all in the whitelist.
- `grep -rn "messages\.create" src/` returns matches only in `services/twilio.ts` (1 surviving call — the privileged one) and `lib/ai/providers/anthropic.ts` (Anthropic, unrelated).
- `pnpm run lint` passes.
- `pnpm run quality:twilio-guard` exits 0.
- `pnpm test` passes (312 + 6 new = 318).
- `pnpm run typecheck` clean.

---

### Phase 1 — 5-Gap Resolution (P1)

**Goal:** Close the 3 actionable pre-launch gaps. Gaps 1 and 5 are explicitly skipped (legacy backfill: no production data; React component test infra: Wave B).

These gaps are independent — Gap 2 (lead UI), Gap 3 (24-month customer-consent path), and Gap 4 (CSV uploaders) touch disjoint files and may be done in parallel by separate sessions.

#### Phase 1 Task 1 — Gap 2: Display `inquiry_date` + boundary badges on lead detail
- **Files modified:** `src/app/(dashboard)/leads/[id]/lead-header.tsx`
- **Action:** In the `LeadHeader` component, immediately after the existing `Created` field (around line 250-254), add a new field `Inquiry`. Two derived values:
  - `inquiryDateFormatted = lead.inquiryDate ? format(new Date(lead.inquiryDate), 'MMM d, yyyy') : '—'`
  - `daysSinceInquiry = lead.inquiryDate ? Math.floor((Date.now() - new Date(lead.inquiryDate).getTime()) / 86_400_000) : null`
  Render:
  ```tsx
  <div>
    <label className="text-muted-foreground text-xs">Inquiry</label>
    <p className="text-sm font-medium mt-1">
      {inquiryDateFormatted}
      {daysSinceInquiry !== null && (
        <span className="text-xs text-muted-foreground"> ({daysSinceInquiry} days ago)</span>
      )}
    </p>
  </div>
  ```
  Below the existing `<LeadTags>` section in `page.tsx` OR at the top of the lead-header card (operator's call — pick whichever is more visible — recommend below the name in `lead-header.tsx`), add boundary badges:
  - `daysSinceInquiry >= 150 && daysSinceInquiry < 180` → sienna badge: "Approaching CASL window — {180 - daysSinceInquiry} days until consent expires"
  - `daysSinceInquiry >= 180` → red/destructive badge: "Express consent required for further outbound"
  Use existing brand-palette classes: sienna = `bg-[#FFF3E0] text-sienna border-sienna/30` (already in use elsewhere in this file); red = `bg-[#FDEAE4] text-[#C15B2E]` (already used at line 35). NO raw Tailwind `red-500` etc.
- **Verification:** Visit `/leads/{id}` for a test lead with `inquiry_date = 155 days ago` — sienna badge shows. With `inquiry_date = 200 days ago` — red badge shows. With `inquiry_date = today` — no badge. Mobile (375px) — text wraps cleanly. `pnpm run typecheck` clean.
- **Done:** Inquiry date + boundary badges visible on lead detail in both admin (`/leads/[id]`) and client portal contexts (the same `LeadHeader` is reused).
- **Dependencies:** Migration 0030 must be live (column `inquiry_date` exists). Independent of Phase 0.
- **Estimated effort:** 1.5h.

#### Phase 1 Task 2 — Gap 3a: Extend `/api/leads` POST schema to discriminated union (3 modes)
- **Files modified:** `src/app/api/leads/route.ts`
- **Action:** Replace the current `createLeadSchema` (lines 161-174) with a Zod discriminated union:
  ```ts
  const createLeadSchema = z.discriminatedUnion('consentMode', [
    z.object({
      consentMode: z.literal('inquiry'),
      // … existing fields (name, phone, email, clientId, notes, projectType, address) …
      inquiryDate: z.string().min(1),                 // <= 180 days; rejects older
    }).strict(),
    z.object({
      consentMode: z.literal('express_consent'),
      // … same shared fields …
      inquiryDate: z.string().min(1),                 // any age
      expressConsentEvidence: z.string().min(MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH),
    }).strict(),
    z.object({
      consentMode: z.literal('existing_customer'),
      // … same shared fields …
      transactionDate: z.string().min(1),             // when contractor was paid
      customerNotes: z.string().optional(),           // e.g., "Kitchen reno Jul 2024, $52K"
    }).strict(),
  ]);
  ```
  Update the POST handler:
  - For `consentMode: 'existing_customer'`: parse `transactionDate`. Reject if older than 730 days (24-month window). Insert lead with `inquiryDate = transactionDate` (so dormant-reengagement automation continues to work). Call `ComplianceService.recordConsent` with `type: 'implied'`, `source: 'existing_customer'`, `consentTimestamp: transactionDate`, `language: 'Past paid customer relationship; ${customerNotes ?? "no notes"}'`. The compliance service already auto-applies the 24-month window for `consent_source = 'existing_customer'` (verified in `compliance-service.ts:308-342`).
  - For `consentMode: 'inquiry'` and `'express_consent'`: preserve the existing logic, just route through the new union variant. The 180-day cutoff for `inquiry` mode and the evidence requirement for `express_consent` are now enforced by Zod, not procedurally.
  - **Backward compatibility:** if `consentMode` is missing, default to `'inquiry'` and run the legacy `isOld` branch logic. This prevents breaking the in-flight `create-lead-dialog.tsx` until Task 3 lands. Add a TODO comment to remove the fallback after Task 3 ships.
- **Verification:** Run the test suite: `pnpm test api/leads`. Add a new test file `src/app/api/leads/route.test.ts` (if not present — verify with `ls`) covering all three modes:
  1. `consentMode: 'inquiry'` with recent date → 201, consent record `type=implied`, `source=inquiry` (or whatever the manual_entry source is).
  2. `consentMode: 'express_consent'` with old date + 50-char evidence → 201, consent record `type=express_written`, evidence persisted.
  3. `consentMode: 'existing_customer'` with `transactionDate=300 days ago` → 201, consent record `consent_source=existing_customer`, `inquiryDate` matches `transactionDate`.
  4. `consentMode: 'existing_customer'` with `transactionDate=800 days ago` → 400 "transaction must be within last 24 months".
- **Done:** API supports all three intake modes via discriminated union. All four test cases pass.
- **Dependencies:** Migration 0030 live. Independent of Phase 0.
- **Estimated effort:** 1.5h.

#### Phase 1 Task 3 — Gap 3b: Three-radio quick-add UI in `create-lead-dialog.tsx`
- **Files modified:** `src/app/(dashboard)/leads/create-lead-dialog.tsx`
- **Action:** Replace the single `inquiryDate` input + conditional `expressConsentEvidence` block with a three-radio selector at the top of the form:
  ```
  Consent basis (required):
    ( ) New inquiry (last 6 months)        — captures inquiry_date
    ( ) Older inquiry (express consent on file) — captures inquiry_date + evidence
    ( ) Past paid customer (within 24 months)   — captures transaction_date + notes
  ```
  Render conditional fields based on the selected radio (use a `useState` for `consentMode: 'inquiry' | 'express_consent' | 'existing_customer'`):
  - **inquiry:** date picker (existing `inquiryDate` input). Auto-promote to `express_consent` mode IF user picks a date >= 180 days old (existing `requiresExpressConsent` logic — preserve).
  - **express_consent:** date picker + evidence textarea (existing UI from lines 133-155).
  - **existing_customer:** date picker labeled "Transaction date (when you were paid by this customer) *", helper text "CASL §10(2) allows outbound for 24 months from transaction date", `max={today}`, plus an optional `customerNotes` textarea labeled "Notes (e.g., Kitchen renovation completed Jul 2024, $52K)".
  Use native HTML `<input type="radio">` styled with brand classes (per Learned Rule 3: Radix Select doesn't work with FormData; native radios are the safe pattern). Group with `<fieldset>` + `<legend>` for accessibility.
  Update `handleSubmit` (lines 55-89) to POST `consentMode` plus the mode-specific fields. The shared fields (name, phone, email, projectType, notes) stay the same.
  Validate per mode client-side: existing_customer requires `transactionDate <= 730 days ago` — show inline error if not.
- **Verification:** Visit `/leads`, click "Add Lead". All three radios render. Selecting each shows the right conditional fields. Submitting:
  - Inquiry + today's date → lead created, no warning.
  - Inquiry + 200 days ago → UI auto-flips to express_consent, demands evidence.
  - Existing_customer + 300 days ago + "Kitchen reno Jul 2024" → lead created, consent record has `consent_source='existing_customer'`.
  - Existing_customer + 800 days ago → submit disabled, error shown.
  Mobile (375px): radio + conditional fields stack cleanly.
- **Done:** Operator can intake via all three modes from the quick-add dialog.
- **Dependencies:** Phase 1 Task 2 (API must accept `consentMode`).
- **Estimated effort:** 2h.

#### Phase 1 Task 4 — Gap 3c: Add `existing_customer` to CSV bulk-import API
- **Files modified:** `src/app/api/leads/import/route.ts`, `src/app/api/client/leads/import/route.ts`
- **Action:** In both files, extend `intakeMode` from the current 2-mode (`'standard' | 'express_consent'`) to 3-mode union (`'standard' | 'express_consent' | 'existing_customer'`). For the new `existing_customer` mode:
  - Required CSV column: `transaction_date` (replaces `inquiry_date` semantically).
  - Optional CSV column: `notes`.
  - Reject any row with `transaction_date > 730 days ago` (return 400 with row count, same pattern as the existing `tooOld` check at lines 129-139).
  - On insert: write `inquiryDate = transaction_date` (so dormant-reengagement keeps working), and call `ComplianceService.recordConsent` with `type: 'implied'`, `source: 'csv_import'`, `consentSource: 'existing_customer'` (the field on the consent record), `consentTimestamp: transaction_date`, `language: 'Past paid customer relationship; CSV import attestation. ${row.notes ?? ""}'`.
  - Reuse the existing batched insert pattern; the only difference is the mode-specific validation and the `recordConsent` call.
- **Verification:** Add to existing `src/app/api/leads/import/route.test.ts` two cases:
  1. Valid existing_customer CSV (3 rows, all within 730 days) → 200, all rows imported, consent records have `consent_source='existing_customer'`.
  2. Invalid existing_customer CSV (1 row at 800 days) → 400, "Existing-customer CSV requires transaction_date within last 24 months".
  Run `pnpm test api/leads/import`.
- **Done:** CSV API accepts the third intake mode.
- **Dependencies:** Migration 0030 live (uses `inquiry_date` and `consent_source = 'existing_customer'` — both schema-supported per `db/schema/compliance.ts:32`).
- **Estimated effort:** 1.5h.

#### Phase 1 Task 5 — Gap 4: CSV uploader UI (BOTH admin + client portal) — surface required columns + intakeMode toggle
- **Files modified:**
  - `src/app/(dashboard)/leads/import-leads-dialog.tsx` (admin)
  - `src/app/(client)/client/leads/import/import-wizard.tsx` (client portal)
- **Action:** **NB: this gap is bigger than the audit indicated.** Verified by grep — both files have ZERO references to `inquiryDate`, `expressConsentEvidence`, or `intakeMode`. The frontends are missing the column mapping AND the mode toggle entirely; the API is fully built but neither UI surfaces it. Expected work: ~2-3 hours per UI.

  For **each file** (admin dialog and client wizard):
  1. Add an `intakeMode` state (`'standard' | 'express_consent' | 'existing_customer'`), default `'standard'`. Render as a three-radio selector before the file dropzone, with explanatory help text per mode (paraphrase from the API: standard = inquiry within 6mo, express = older inquiry with evidence, existing_customer = paid customer within 24mo).
  2. Update the `parseCSV` function to recognize new column aliases:
     - For `inquiry_date` (and aliases: `inquirydate`, `dateofinquiry`, `inquired`)
     - For `express_consent_evidence` (aliases: `consentevidence`, `evidence`, `consentnotes`)
     - For `transaction_date` (aliases: `transactiondate`, `dateofservice`, `paid`, `closeddate`)
     - For `notes` (aliases: `customernotes`, `note`, `comments`)
  3. Update help/instructions text shown to the user before file upload to list the required columns per mode:
     - **standard:** required `phone`, `inquiry_date`. Recommended `name`, `email`, `project_type`.
     - **express_consent:** all of standard PLUS `express_consent_evidence` (>= 10 chars per row).
     - **existing_customer:** required `phone`, `transaction_date`. Recommended `name`, `email`, `notes`.
  4. POST the selected `intakeMode` to the API alongside `rows` and `consentAttested`. The payload key is already `intakeMode` per the existing API at line 84 of `import/route.ts`.
  5. Display per-row errors returned by the API (the existing UI already handles the `errors[]` array shape).
  6. Mobile (375px): radios stack vertically; help text remains readable.
- **Verification:**
  - Admin: navigate to `/leads`, open import dialog, switch mode three times, confirm conditional help text changes, upload a sample CSV per mode, confirm rows imported.
  - Client portal: same flow at `/client/leads/import`.
  - Mobile both at 375px: all controls reachable, no overflow.
  - `pnpm run typecheck` clean.
- **Done:** Both upload paths surface the new columns and mode toggle.
- **Dependencies:** Phase 1 Task 4 (API must accept `existing_customer`).
- **Estimated effort:** 2-3h per UI = 4-6h total.

**Phase 1 verification (gate before Phase 2):**
- Lead detail page renders inquiry_date + boundary badge correctly for sample data (155-day, 200-day, fresh).
- Operator quick-add form shows three-radio selector and conditional fields per mode.
- Both CSV uploaders (admin + client portal) accept new columns and show intakeMode toggle.
- Manual smoke test of all 3 intake paths via UI: inquiry, express_consent, existing_customer (verify a `consent_records` row is written for each with the correct `consent_source`).
- All new tests pass: `pnpm test`.

---

### Phase 2 — Observability (P2)

**Goal:** Sentinel metric counter + immutable consent-audit export ready before first paid client volume hits production.

> **IMPLEMENTATION NOTE (Wave 2 actual):** Phase 2 Task 2 originally specified a Neon-DB-backed snapshot table (`compliance_audit_snapshots`) because Cloudflare Workers has no fs access. **Actual delivery uses Cloudflare R2 with COMPLIANCE-mode Object Lock (7-year retention, 2557 days) at `src/lib/clients/r2.ts` + `src/app/api/cron/audit-log-export/route.ts`.** R2 provides cryptographic immutability + S3-compatible API + Cloudflare-ecosystem pricing. The DB-snapshot fallback was redundant once R2 was greenlit. Operator provisioning steps live in `OPERATOR-ACTIONS.md` Action 1B/1C. Decision F (per-client `contractor_alert_quiet_hours_enabled`) added to clients schema via migration `0031_big_boom_boom.sql`. React component test infra (jsdom + @testing-library/react) added under Wave 2B.

#### Phase 2 Task 1 — Sentinel block counter `compliance_sentinel_blocked_total`
- **Files modified:** `src/lib/compliance/compliance-gateway.ts`, `src/app/(dashboard)/admin/compliance/compliance-dashboard-client.tsx`, `src/app/api/compliance/check/route.ts` (or new endpoint)
- **Action:** Implement the counter in the simplest way that survives Cloudflare Workers' single-threaded, no-global-state runtime: **DERIVE it from `compliance_audit_log`**. No new in-memory counter needed.
  1. In `sendInternalSMS` (added in Phase 0 task 2), every blocked send already writes a row to `compliance_audit_log` with `category='internal_sms_sentinel_block'` and `metadata.blockReason`. Confirm this is the case; if not, add it.
  2. Add a query helper `getSentinelBlockedTotal(since: Date): Promise<{ total: number; byReason: Record<string, number> }>` to `src/lib/compliance/compliance-service.ts` that runs a single grouped count against `complianceAuditLog` filtered by `category='internal_sms_sentinel_block'` and `created_at >= since`.
  3. Surface in the existing `/admin/compliance` dashboard: add a card "Sentinel: Internal SMS Blocks (last 30 days)" showing total + breakdown by reason. Non-zero count is the alert signal — investigate immediately. Place adjacent to existing compliance KPIs in `compliance-dashboard-client.tsx`.
  4. Expose via API: extend `/api/compliance/check/route.ts` (or add `/api/compliance/sentinel-stats/route.ts`) returning `{ total, byReason, since }`.
- **Verification:** Trigger a manual sentinel block (e.g., set kill switch to ON, invoke an operator alert via existing flow, set kill switch back OFF). Confirm `compliance_audit_log` row is present. Refresh `/admin/compliance` — the new card shows count = 1 with `byReason: { kill_switch: 1 }`.
- **Done:** Operator can see, at a glance, whether the runtime sentinel is blocking anything.
- **Dependencies:** Phase 0 task 2.
- **Estimated effort:** 1.5h.

#### Phase 2 Task 2 — Immutable consent-audit snapshot (DB-backed, NOT filesystem)
- **Files created:**
  - `src/db/schema/compliance-snapshots.ts` (new schema)
  - `src/app/api/cron/compliance-audit-snapshot/route.ts` (cron handler)
- **Files modified:**
  - `src/db/schema/index.ts` (re-export new table)
  - `src/lib/cron/dispatcher.ts` (or wherever cron routes are registered — locate by grepping for existing `guarantee-21day` registration)
  - `wrangler.toml` or equivalent cron schedule config (add weekly trigger)
- **Action:** **The audit's spec said `.audit-export/YYYY-MM-DD.json` (local file). This will not work — the runtime is Cloudflare Workers, which has no fs access (per CLAUDE.md and PROJECT.md constraint).** Use Neon as the immutable store instead. The data already lives in `compliance_audit_log` and `consent_records`; the "export" is a content-hashed snapshot row in a sibling table.

  1. New schema `compliance_audit_snapshots`:
     ```ts
     export const complianceAuditSnapshots = pgTable('compliance_audit_snapshots', {
       id: uuid('id').primaryKey().defaultRandom(),
       periodStart: timestamp('period_start').notNull(),
       periodEnd: timestamp('period_end').notNull(),
       consentRecordCount: integer('consent_record_count').notNull(),
       auditLogCount: integer('audit_log_count').notNull(),
       contentHash: text('content_hash').notNull(),    // sha256 of the serialized snapshot
       payload: jsonb('payload').notNull(),            // {consents: [...], auditLog: [...]}
       createdAt: timestamp('created_at').notNull().defaultNow(),
     }, (t) => ({
       byPeriod: index('idx_snapshot_period').on(t.periodStart, t.periodEnd),
       byHash: uniqueIndex('idx_snapshot_hash').on(t.contentHash),
     }));
     ```
     Run `pnpm run db:generate` — review SQL — ASK USER before `pnpm run db:push`.
  2. New cron route at `src/app/api/cron/compliance-audit-snapshot/route.ts`:
     - `verifyCronSecret()` (existing pattern — see other cron routes for the import).
     - Snapshot window = last 7 days.
     - Query `consent_records` where `created_at >= periodStart AND created_at < periodEnd` — serialize.
     - Query `compliance_audit_log` for the same window — serialize.
     - Compute `contentHash = sha256(JSON.stringify({consents, auditLog}))`.
     - Insert one row in `compliance_audit_snapshots`.
     - On unique-constraint conflict (re-running the same week), return 200 with `{ skipped: true, reason: 'already_snapshotted' }`.
  3. Schedule: weekly, Mondays 00:00 UTC. Add to whatever `wrangler.toml` / Cron Triggers config drives the existing cron dispatcher. Locate by grep: `grep -rn "guarantee-21day\|guarantee-30day" --include="*.toml" --include="*.json"`.
- **Verification:**
  - Manually invoke the cron route locally with a valid `CRON_SECRET` header: confirm one new row in `compliance_audit_snapshots` with non-zero counts and a stable `contentHash`.
  - Re-invoke immediately: confirm 200 with `skipped: true`.
  - `pnpm run typecheck` clean. `pnpm test` passes.
- **Done:** Weekly snapshot of consent + audit data is durable, immutable (uniqueness on hash prevents tampering rewrites), queryable.
- **Dependencies:** Migration 0030 live (no, this is independent — adds a new table). However, the new table itself requires its own migration via `db:generate` + `db:push` — coordinate with user.
- **Estimated effort:** 2h (longer than the original 1h spec because we're shipping a real durable mechanism, not a fs hack).

**Phase 2 verification:**
- `compliance_sentinel_blocked_total` card visible on `/admin/compliance`; manually triggering a block increments the count.
- `compliance_audit_snapshots` table exists; running the cron route populates it.

---

## Build Sequence

| Step | Action | Blocking | Notes |
|------|--------|----------|-------|
| 0 | Push migration 0030 (`pnpm run db:push` after user approval) | YES — blocks all of Phase 0/1/2 | Operator action; ~1 min. |
| 1 | Phase 0 Task 1 (baseline snapshot) | — | Independent. |
| 2a | Phase 0 Task 2 (`sendInternalSMS`) | Blocks 3, 10 | — |
| 2b | Phase 0 Task 4 (`sendSMS` private) | Blocks 7 | Independent of 2a (both modify `services/twilio.ts` and `compliance-gateway.ts` — coordinate the two edits in the same session to avoid merge conflict). |
| 3 | Phase 0 Task 3 (migrate `operator-alerts.ts`) | Blocks 8 | Depends on 2a. |
| 4 | Phase 0 Task 5 (migrate `agency-communication.ts`) | Blocks 8 | Independent of 2a/2b/3 — uses existing `sendCompliantMessage`. PARALLEL CANDIDATE. |
| 5 | Phase 0 Task 6 (migrate admin/agency/messages route) | Blocks 8 | Independent. PARALLEL CANDIDATE. |
| 6 | Phase 0 Task 7 (delete duplicate `sendTrackedSMS`) | Blocks 8 | Depends on 2b. |
| 7 | Phase 0 Task 8 (ESLint rule) | Blocks 9 | Depends on 3, 4, 5, 6 (otherwise lint fails on legacy imports). |
| 8 | Phase 0 Task 9 (CI gate) | Blocks Phase 0 verification | Depends on 7. |
| 9 | Phase 0 Task 10 (sendInternalSMS tests) | — | Depends on 2a. PARALLEL with 3-7. |
| 10 | Phase 0 verification gate (run all greps + lint + tests) | Blocks Phase 1 | — |
| 11 | Phase 1 Task 1 (Gap 2 — lead UI) | — | Independent. PARALLEL CANDIDATE with 12, 14. |
| 12 | Phase 1 Task 2 (Gap 3a — API) | Blocks 13 | Independent. PARALLEL CANDIDATE with 11, 14. |
| 13 | Phase 1 Task 3 (Gap 3b — quick-add UI) | — | Depends on 12. |
| 14 | Phase 1 Task 4 (Gap 3c — CSV API) | Blocks 15 | Independent. PARALLEL CANDIDATE with 11, 12. |
| 15 | Phase 1 Task 5 (Gap 4 — CSV UIs) | — | Depends on 14. |
| 16 | Phase 1 verification gate (manual smoke test all 3 intake paths) | Blocks Phase 2 | — |
| 17 | Phase 2 Task 1 (sentinel counter) | — | Depends on Phase 0 task 2. |
| 18 | Phase 2 Task 2 (audit snapshot — db migration + cron) | — | Independent of all other tasks except its own sub-migration. |
| 19 | Full regression: `pnpm run quality:no-regressions` | — | Includes new `quality:twilio-guard` gate. |
| 20 | Manual smoke test of all 3 intake paths (final) | — | UI + DB inspection. |
| 21 | Commit + push + merge to main | — | Pre-push hook re-runs the full gate. |

**Parallelization notes:** A single Claude session should NOT attempt to parallelize within Phase 0 — too many shared files (`compliance-gateway.ts`, `services/twilio.ts`). Phase 1 Tasks 1, 2, and 4 are genuinely independent and could be split across sessions if needed. Phase 2 Tasks 1 and 2 are independent.

---

## Files To Be Modified (full list)

**Phase 0:**
- `src/lib/services/operator-alerts.ts`
- `src/lib/services/agency-communication.ts`
- `src/lib/services/twilio.ts`
- `src/lib/clients/twilio-tracked.ts`
- `src/app/api/admin/agency/messages/route.ts`
- `src/lib/compliance/compliance-gateway.ts` (extend with `sendInternalSMS`)
- `eslint.config.mjs`
- `scripts/quality/no-regressions.sh`
- `package.json` (new script entry)
- *Plus any external callers of `sendTrackedSMS` from `lib/clients/twilio-tracked.ts` — enumerate during Phase 0 Task 7.*

**Phase 1:**
- `src/app/(dashboard)/leads/[id]/lead-header.tsx`
- `src/app/api/leads/route.ts`
- `src/app/(dashboard)/leads/create-lead-dialog.tsx`
- `src/app/api/leads/import/route.ts`
- `src/app/api/client/leads/import/route.ts`
- `src/app/(dashboard)/leads/import-leads-dialog.tsx`
- `src/app/(client)/client/leads/import/import-wizard.tsx`
- `src/app/api/leads/import/route.test.ts` (extend)

**Phase 2:**
- `src/lib/compliance/compliance-gateway.ts` (sentinel counter helper)
- `src/lib/compliance/compliance-service.ts` (`getSentinelBlockedTotal` helper)
- `src/app/(dashboard)/admin/compliance/compliance-dashboard-client.tsx`
- `src/app/api/compliance/check/route.ts` (or new sentinel-stats route)
- `src/db/schema/index.ts` (re-export `complianceAuditSnapshots`)
- Cron dispatcher / `wrangler.toml` (locate during execution)

**Docs:**
- `docs/operations/LAUNCH-CHECKLIST.md` (mark Wave A Hardening complete)
- `docs/engineering/01-TESTING-GUIDE.md` (add Phase 0 Task 10 / Phase 1 / Phase 2 verification steps if checklists drift)
- Per Change→Doc mapping table — confirm during execution.

---

## Files To Be Created

**Phase 0:**
- `scripts/quality/twilio-bypass-guard.sh`
- `src/lib/compliance/compliance-gateway.internal.test.ts`

**Phase 2:**
- `src/db/schema/compliance-snapshots.ts`
- `src/app/api/cron/compliance-audit-snapshot/route.ts`
- New Drizzle migration file (auto-generated by `db:generate`)

**Temporary (not committed):**
- `.scratch/wave-a-bypass-baseline.txt`

---

## Risks + Mitigations

1. **Risk:** `sendInternalSMS()` adds latency to operator alerts (DB query for opt-out + DNC check).
   **Mitigation:** ~5ms is below human-perceptible threshold; operator alerts are not realtime-critical (they're SMS, already async). Sentinel block path on misconfig is rare; happy path is one indexed lookup on `consent_records`. Acceptable.

2. **Risk:** Migrating `agency-communication.ts:sendAgencySMS` to the gateway changes contractor-facing message latency, since the gateway runs the full 7-step pipeline (kill switch, DNC, consent, quiet hours, etc.). Some agency messages are alerts that don't currently go through quiet-hours enforcement.
   **Mitigation:** Use `messageClassification: 'agency_alert'` and pass `messageCategory: 'transactional'`. The gateway's quiet-hours policy already exempts transactional messages. Confirm by reading `quiet-hours-policy.ts` during execution. If quiet-hours enforcement DOES kick in for a contractor's own phone, that's actually correct behavior under TCPA — surface to user before deciding to override.

3. **Risk:** ESLint rule (Phase 0 Task 8) may trip pre-commit hook on legacy code we haven't touched yet, blocking unrelated commits during Phase 0 work.
   **Mitigation:** Tasks 8 and 9 are explicitly sequenced AFTER tasks 3, 5, 6, 7. Do NOT add the rule until those four migrations are complete. Verify clean lint before adding.

4. **Risk:** Phase 1 Task 2's discriminated-union schema change is breaking — old `create-lead-dialog.tsx` (pre-Task 3) sends payloads without `consentMode` and will hit Zod validation.
   **Mitigation:** Backward-compat default in Task 2: missing `consentMode` defaults to `'inquiry'` and runs legacy logic. Remove the fallback only after Task 3 ships and is merged.

5. **Risk:** Phase 2 Task 2 (audit snapshot table) requires a new DB migration. Migration 0030 just landed; chaining another migration mid-phase risks coordination errors.
   **Mitigation:** Treat the snapshot migration as its own approval gate. After `pnpm run db:generate`, ASK user to review SQL before `db:push`. Do NOT auto-push. Phase 2 Task 2 explicitly has a pause point.

---

## Out-of-Scope (explicitly deferred)

- **Gap 1 (legacy lead backfill):** No production leads exist; the `COALESCE(inquiry_date, created_at)` fallback in compliance-service handles dev/test data. No-op.
- **Gap 5 (React component test infra):** Wave B. Pre-launch quality is covered by API tests + manual smoke + visual check.
- **Filesystem-based audit export:** explicitly replaced by the DB-backed snapshot in Phase 2 Task 2 because Cloudflare Workers has no fs access. S3 with object lock is a Wave B upgrade; the Neon snapshot table provides equivalent immutability for Pilot.
- **Showing `transaction_date` in lead detail UI for existing_customer leads:** Wave B. Phase 1 Task 1 displays `inquiry_date` only (which equals transaction_date for existing_customer mode anyway).
- **Legacy `sendSMS` callers outside the seven enumerated sites:** if Phase 0 Task 4's grep finds any, surface to user. The audit verified 7 sites; if more exist, add them to the migration list.
- **Backfilling `consent_source='existing_customer'` for existing data:** no production data, n/a.
- **Premium tier intake flows:** out of scope per PROJECT.md ("Out of Scope: Premium/Booked Estimate OS tier").

---

## Success Criteria

After Phase 0:
- [ ] `grep -rn "import twilio from" src/` returns exactly 5 matches, all in the whitelist.
- [ ] `grep -rn "messages\.create" src/` returns exactly 2 SMS-related matches: 1 in `services/twilio.ts` (the one privileged call) and 0 elsewhere. (Anthropic's 2 `messages.create` matches are unrelated and excluded by the CI gate.)
- [ ] `pnpm run quality:twilio-guard` exits 0 on a clean checkout AND exits 1 with a clear error when a deliberate violation is added.
- [ ] `pnpm run lint` passes with no new warnings.
- [ ] `pnpm test` passes — at least 6 new tests for `sendInternalSMS()` added.
- [ ] `pnpm run typecheck` clean.

After Phase 1:
- [ ] Lead detail page shows `inquiry_date` and the correct boundary badge (none / sienna / red) at 0d, 155d, 200d.
- [ ] Operator quick-add dialog shows three radios; submitting each results in a `consent_records` row with the correct `consent_source` (`text_optin`/`web_form`/`phone_recording` for inquiry, `web_form` for express_consent, `existing_customer` for existing_customer — verify exact mapping in `compliance-gateway.ts:670-707` during execution).
- [ ] CSV admin import dialog and CSV client portal wizard both surface the three-mode toggle and accept the new column aliases.
- [ ] All three intake paths smoke-tested end-to-end against dev DB.

After Phase 2:
- [ ] `/admin/compliance` page shows a `Sentinel: Internal SMS Blocks (last 30 days)` card.
- [ ] Manually triggering a sentinel block (via kill switch) produces a measurable count change on the dashboard.
- [ ] `compliance_audit_snapshots` table exists; the cron route populates it; re-running the same week returns 200 with `skipped: true`.
- [ ] `pnpm run quality:no-regressions` passes end-to-end.

After full phase:
- [ ] Manual UAT run-through: operator can intake a lead via all three modes, contractor can upload a CSV via all three modes, lead detail correctly warns at 150-180-day boundary.
- [ ] `git log` shows clean commit history per task; no force-pushes; no `--no-verify` skips.

---

## Estimated Effort

| Sub-Phase | Estimate | Notes |
|-----------|----------|-------|
| Phase 0 (10 tasks) | 6-8h | Most of the cost is auditing call sites + de-shadowing `sendTrackedSMS`. The ESLint rule + CI gate are mechanical. |
| Phase 1 Task 1 (Gap 2) | 1.5h | UI change, single file. |
| Phase 1 Tasks 2-3 (Gap 3) | 3.5h | API + UI for 24-month customer-consent path. |
| Phase 1 Tasks 4-5 (Gap 4) | 5.5-7.5h | **Larger than original audit estimate** — both CSV uploaders need full intakeMode UI + column mapping rebuilds. ~1.5h API + 4-6h UI work. |
| Phase 2 Task 1 (sentinel counter) | 1.5h | Reuses existing audit log; mostly query + dashboard wiring. |
| Phase 2 Task 2 (audit snapshot) | 2h | New schema + cron route. |
| **Total** | **20-24h** | Original audit estimated ~13-18h; Gap 4 underestimate accounts for the diff. |

---

## Notes for Future Executor

1. **Migration 0030 must be live before any task in this plan touches code.** If you start work and migration 0030 has not been pushed, STOP and ask the user to run `pnpm run db:push`.
2. **Pre-commit / pre-push hooks are your safety net.** Don't skip them. If they fail, fix the underlying issue and create a new commit; do not amend.
3. **For Phase 0, do tasks 2 and 4 in the same editing session** — both modify `services/twilio.ts` and `compliance-gateway.ts`. Working on them separately invites merge conflicts.
4. **Consult Context7** before touching the `twilio` SDK behavior in tasks 2-7 — the SDK pattern hasn't changed, but verify against current docs (per CLAUDE.md "External API Integration" rule).
5. **Doc sync is mandatory** — after each Phase, check `.claude/references/doc-sync-map.md` and update mapped docs in the same change (Learned Rule 7).
