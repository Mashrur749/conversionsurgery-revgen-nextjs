# Wave A Hardening — Operator Actions

**Audience:** You.
**Purpose:** Every action in this phase only YOU can take. Claude cannot do these — they involve external dashboards, schema-push authorization, or env-var configuration.
**Total operator effort:** ~45 minutes spread across 3 checkpoints.

---

## CHECKPOINT 1 — Before Any Code Execution Starts

### Action 1A — Push Migration 0030 to Production DB

**Why:** The CASL 6-month intake gate (commit `3cde5bc`) added three nullable columns to production schema. Code currently references columns that don't exist in prod. Until this migration runs, any new lead creation triggers a 500 error.

**What's in it:**
```sql
ALTER TABLE "leads" ADD COLUMN "inquiry_date" timestamp;
ALTER TABLE "leads" ADD COLUMN "dormant_reengagement_sent_at" timestamp;
ALTER TABLE "consent_records" ADD COLUMN "consent_evidence" text;
```

All three columns are nullable. Back-compat with existing rows. Safe migration.

**Steps:**
1. Open terminal in project root.
2. Run: `pnpm run db:push`
3. Confirm prompt: `Yes`
4. Verify with: `psql $DATABASE_URL -c "\d leads"` — should show `inquiry_date` and `dormant_reengagement_sent_at` columns.

**Done when:** Three new columns exist in production DB.

**Time:** 2 minutes.

**Required before:** Any Phase 0/1/2 execution starts. Phase 0 work blocks on this.

---

### Action 1A.1 — Verify Migration 0030 Post-Push

**Why:** You ran `db:push` for migration 0030. Action 1A step 4 was the verification — formalizing it here as its own action so it gets logged and isn't skipped.

**Steps:**

1. Confirm the three columns exist:
   ```
   psql $DATABASE_URL -c "\d leads" | grep -E "inquiry_date|dormant_reengagement_sent_at"
   psql $DATABASE_URL -c "\d consent_records" | grep consent_evidence
   ```
   Each grep should return one matching line. If any return empty, the push didn't apply — re-run.

2. Measure your legacy-lead population (rows with `inquiry_date IS NULL`):
   ```
   psql $DATABASE_URL -c "SELECT count(*) FROM leads WHERE inquiry_date IS NULL"
   ```
   This number drives the backfill decision in Action 4D. Code uses `COALESCE(inquiry_date, created_at)` so legacy rows do not break automation, but the operator UI cannot show a boundary badge without a real `inquiry_date`.

3. Spot-check that no automation has written to the new columns yet (sanity, before rehearsal):
   ```
   psql $DATABASE_URL -c "SELECT count(*) FROM leads WHERE inquiry_date IS NOT NULL"
   psql $DATABASE_URL -c "SELECT count(*) FROM leads WHERE dormant_reengagement_sent_at IS NOT NULL"
   ```
   Both should be 0 immediately post-push (or match your seed data).

**Done when:** All three columns confirmed in prod, legacy count noted in your ops log.

**Time:** 2 minutes.

**Required before:** Phase 0/1/2 execution and any rehearsal pass.

---

### Action 1B — Create Cloudflare R2 Bucket for Audit Logs

**Why:** Phase 2 ships audit-log export to immutable storage with object-lock. Cloudflare R2 is the chosen target (Cloudflare ecosystem already in use, ~$0.50/year cost at expected volume).

**Steps:**
1. Sign in to Cloudflare Dashboard → R2 → Overview
2. Click **Create bucket**
3. Bucket name: `conversionsurgery-audit-logs`
4. Region: `Automatic` (Cloudflare picks closest)
5. After creation, click into the bucket → **Settings** tab → **Object Lock**
6. Enable Object Lock with these settings:
   - Default retention mode: **Compliance** (not Governance — Compliance is non-overridable)
   - Default retention period: **2557 days** (= 7 years)
7. Click **Save**

**Generate API credentials:**

8. Cloudflare Dashboard → R2 → **Manage R2 API Tokens**
9. Click **Create API Token**
10. Token name: `conversionsurgery-audit-export`
11. Permissions: **Object Read and Write**
12. Specify bucket: `conversionsurgery-audit-logs`
13. TTL: leave unlimited
14. Copy the **Access Key ID** and **Secret Access Key** — you'll only see the secret once
15. Note the **Account ID** from the R2 dashboard sidebar

**Done when:** Bucket exists with object-lock + you have the 3 credentials saved.

**Time:** 10 minutes.

**Required before:** Phase 2 audit-export wiring (Wave 3 of execution).

---

### Action 1C — Add R2 Environment Variables

**Why:** The audit-export cron needs these credentials at runtime.

**Steps:**

1. Open `.env.local` (do not commit).
2. Add:
   ```
   R2_ACCOUNT_ID=<your account id from Action 1B step 15>
   R2_ACCESS_KEY_ID=<from Action 1B step 14>
   R2_SECRET_ACCESS_KEY=<from Action 1B step 14>
   R2_AUDIT_BUCKET=conversionsurgery-audit-logs
   R2_AUDIT_RETENTION_DAYS=2557
   ```
3. After production deployment, set the same vars in Cloudflare Workers env (if Cloudflare Workers) or Vercel env (if Vercel).

**Done when:** Local + production env have all 5 R2 vars set.

**Time:** 5 minutes.

**Required before:** Phase 2 audit-export wiring runs end-to-end test.

---

## CHECKPOINT 2 — Mid-Execution (After Phase 0 Completes, Before Phase 2)

### Action 2A — Push Migration 0031 (Decision F: Per-Client Quiet-Hours Preference)

**Why:** Decision F adds `clients.contractor_alert_quiet_hours_enabled` boolean column (default `false` = exempt from quiet hours, contractor-opt-in to enable). Schema migration required.

**Trigger:** I'll commit migration 0031 during Phase 1 execution. You'll see a commit message: `feat(compliance): add contractorAlertQuietHoursEnabled per-client preference`. After that commit lands, push the migration before Phase 2 wiring runs.

**Steps:**
1. After commit `feat(compliance): add contractorAlertQuietHoursEnabled` lands, run:
   ```
   pnpm run db:push
   ```
2. Confirm prompt: `Yes`
3. Verify: `psql $DATABASE_URL -c "\d clients" | grep contractor_alert`

**Done when:** New column exists, defaults to `false`.

**Time:** 1 minute.

**Required before:** Phase 2 task that wires the per-client preference into `sendInternalSMS()`.

---

## CHECKPOINT 2.5 — Pre-Rehearsal Code Sanity

These verify that the CASL gate code (commit `3cde5bc`) actually does what the v2.2 copy promises. Run before the full E2E rehearsal — failures here invalidate the rehearsal.

### Action 2.5A — CASL Code Path Audit

Run these grep checks from project root. Any unexpected result is a defect to fix before rehearsal.

1. **180-day cutoff is exact, not "6 calendar months":**
   ```
   grep -rn "180" src/lib/compliance/ src/app/api/leads/ | grep -v ".test."
   ```
   Cutoff must be a constant `180` (days). Reject any pattern like `setMonth(-6)` or `6 * 30` — those drift across leap years and 31-day months.

2. **Implied-consent timestamp anchored to `inquiry_date`, not `NOW()`:**
   ```
   grep -B 2 -A 6 "type.*implied" src/lib/compliance/compliance-service.ts
   ```
   Implied path must use the lead's `inquiryDate` as `consentTimestamp`. Anchoring to `NOW()` resets the CASL clock on import and is the original laundering vector.

3. **Express-consent evidence required and stored:**
   ```
   grep -rn "consentEvidence\|consent_evidence\|express_consent_evidence" src/app/api/leads/ src/lib/compliance/
   ```
   Zod schemas must require evidence ≥10 chars when `inquiryDate` is older than 180 days. Evidence column must be persisted.

4. **CSV laundering path removed:**
   ```
   grep -rn "caslConsentAttested" src/
   ```
   Should return zero matches in route handlers (only test fixtures permitted, if any). The previous laundering path auto-recorded `express_written` consent on every CSV row.

5. **Dormant-reengagement uses COALESCE for legacy rows:**
   ```
   grep -rn "COALESCE\|coalesce" src/lib/automations/dormant-reengagement.ts
   ```
   Confirm dormancy clock falls back to `created_at` when `inquiry_date` is null. Without this, every legacy lead would suddenly be "fresh" and re-enter the reactivation window.

6. **No raw Twilio outside compliance-gateway (backstop until ESLint rule lands):**
   ```
   grep -rn "client\.messages\.create\|client\.calls\.create\|conversations\.\|twilio()" src/ --include="*.ts" | grep -v "compliance-gateway.ts" | grep -v ".test."
   ```
   Should return zero matches. This catches Voice and Conversations bypass paths that an SMS-only ESLint rule would miss.

7. **Welcome SMS still uses operator's personal Twilio number, not the client's business line:**
   ```
   grep -B 3 -A 8 "12.1\|welcome.*sms\|checkout.session.completed" src/ -r --include="*.ts"
   ```
   Per OFFER-APPROVED-COPY §12.1, sender identity is the operator's personal Twilio number. Sending the welcome SMS from the dedicated business line breaks the "this number is mine" line in the message.

**Done when:** All 7 checks return expected results (zero matches where required, consistent constants where required).

**Time:** 5 minutes.

---

### Action 2.5B — Test Suite Sanity

Run before rehearsal:
```
pnpm run typecheck
pnpm test
```

Expected:
- Typecheck: 0 errors.
- Test suite: 911+ passing, 0 failures (skipped count noted in commit `3cde5bc` was 7).

If either is red, do not proceed to rehearsal. Investigate the failure first — a regression here indicates that something in Phase 0/1 broke the gate after `3cde5bc`.

**Done when:** Both green, count matches commit baseline or higher.

**Time:** 1-2 minutes.

---

### Action 2.5C — Confirm Out-of-Scope Gap Decisions Are Resolved

Commit `3cde5bc` flagged 5 known gaps as "out of scope for this commit." Two of them block rehearsal Tests 3, 5, 6, 7. Before running rehearsal, confirm Action 4D decisions have been made and any block-launch builds are complete.

If 4D not yet decided, jump to it now. Otherwise:

| Gap | Required before rehearsal? |
|---|---|
| Lead detail UI: inquiry_date display + sienna/red boundary badges | YES — Test 7 fails without it |
| CSV upload UI: intakeMode toggle (standard / express / existing-customer) | YES — Tests 5, 6 fail without it |
| 24-month customer-consent UI option | Only if Test 3 must pass — see 4D |
| Legacy lead backfill | Only if 1A.1 count is large — see 4D |
| React component test infra (vitest .tsx + jsdom) | NO — manual rehearsal covers UI |

**Done when:** Block-launch UI items are built OR rehearsal scope is explicitly reduced (decision documented).

**Time:** 5 minutes to confirm; 4-8 hours to build the two UI items if not yet done.

---

## CHECKPOINT 3 — After All Code Lands

### Action 3A — Run Full E2E Rehearsal

**Why:** Code-level testing is comprehensive (911+ tests will pass), but the rehearsal verifies real-world UX of the new intake paths, R2 export cron, and per-client preferences.

**Steps:**

Reference: `docs/operations/launch-journey/08-platform-rehearsal.md`. Execute Phase 6 of `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` with these new tests added:

**New tests to add to your rehearsal pass:**

1. **Operator quick-add: standard mode (<180 days inquiry)**
   - Open `/admin/clients/[id]` → New Lead
   - Select "New inquiry (last 6 months)"
   - Pick a date 30 days ago
   - Submit
   - Verify: lead created with `inquiry_date` set, consent record `type='implied'`, source `'manual_entry'`

2. **Operator quick-add: express-consent mode (>=180 days)**
   - New Lead
   - Select "Older inquiry (express consent on file)"
   - Pick a date 240 days ago
   - Evidence text: "Test express consent attestation, signed estimate request 2024-09-01"
   - Submit
   - Verify: lead created, consent type `'express_written'`, evidence stored

3. **Operator quick-add: existing-customer mode (within 24 months)**
   - New Lead
   - Select "Past paid customer (within 24 months)"
   - Pick a date 14 months ago
   - Notes: "Test customer, kitchen reno completed Mar 2025"
   - Submit
   - Verify: lead created, consent source `'existing_customer'`, expiry computed at +24 months from transaction date

4. **CSV import: standard mode rejection**
   - Upload CSV with one row inquiry_date 200 days ago
   - Verify: rejected with clear error "Standard CSV requires all inquiries within last 180 days"

5. **CSV import: express-consent mode acceptance**
   - Upload CSV with `intakeMode=express_consent` + evidence column populated
   - Verify: leads created with `'express_written'` consent

6. **CSV import: existing-customer mode acceptance**
   - Upload CSV with `intakeMode=existing_customer` + transaction_date column
   - Verify: leads created with `'existing_customer'` source

7. **Lead detail UI: inquiry_date + boundary warning**
   - Open lead with inquiry_date 155 days ago
   - Verify: sienna badge shows "Approaching CASL window — 25 days until consent expires"
   - Open lead with inquiry_date 200 days ago + no express consent
   - Verify: red badge shows "Express consent required for further outbound"
   - Open lead with consent_source `'existing_customer'`
   - Verify: shows "Customer consent (transaction date: ..., 18 months remaining)"

8. **Operator alerts: sentinel block**
   - Add operator's own phone to platform DNC manually
   - Trigger any operator alert (e.g., escalation cron)
   - Verify: SMS NOT sent, `compliance_audit_log` shows category `'internal_sms_sentinel_block'`, `compliance_sentinel_blocked_total` counter incremented
   - Remove from DNC, retry, verify SMS sends

9. **Compliance bypass attempt: ESLint + CI gate**
   - Add a temporary file `src/lib/services/test-bypass.ts` with `import twilio from 'twilio'` and `client.messages.create({...})`
   - Run `pnpm run lint` — verify ESLint blocks with custom rule message
   - Run `pnpm run quality:no-regressions` — verify CI gate fails
   - Delete the temporary file

10. **R2 audit log export**
    - Run cron manually: `curl -H "Authorization: Bearer $CRON_SECRET" $PROD_URL/api/cron/audit-log-export`
    - Verify: response 200, file uploaded to R2 bucket with object-lock retention applied
    - Open Cloudflare Dashboard → R2 → bucket → confirm new object exists, retention shown
    - Verify: file has correct content hash header

11. **Per-client quiet hours toggle (Decision F)**
    - Open `/client/settings/notifications` (as the contractor)
    - Toggle "Respect quiet hours for SMS alerts to me" → ON
    - At 11pm contractor local time, trigger an operator alert
    - Verify: SMS queued (not sent immediately)
    - Toggle OFF, retry at 11pm
    - Verify: SMS sent immediately

12. **Boundary: inquiry_date exactly 180 days ago**
    - Operator quick-add → inquiry_date = today minus exactly 180 days
    - Verify: which path fires (standard or express) and document it explicitly. Whatever the implementation does, it must be deterministic — off-by-one bugs hide here.
    - Repeat with 179 days and 181 days. Confirm clean transition between paths.

13. **Boundary: inquiry_date in the future**
    - Operator quick-add → inquiry_date = tomorrow
    - Verify: Zod validation rejects with a clear error (max=today). Date pickers occasionally let this through if `max` attr is missing.

14. **Idempotency: same phone imported twice**
    - CSV import a row with phone +14035551234. Re-import the identical CSV.
    - Verify: dedup behavior is documented. Either rejected with "duplicate phone" or merged into existing lead with new conversation entry. Document which it is — silently creating duplicates breaks attribution and inflates lead counts.

15. **Mid-sequence STOP on dormant reactivation**
    - Trigger dormant-reengagement on a test lead. Wait for touch 1 to send. From the test homeowner number, reply STOP.
    - Verify: touches 2, 3, 4 do NOT send. `compliance_audit_log` shows opt-out applied. `lead.optedOutAt` populated. Subsequent operator attempts to message this number are blocked at the gateway.

16. **Timezone correctness on dormancy boundary**
    - Create a test lead with `inquiry_date = '2025-12-01T00:00:00Z'` (UTC midnight).
    - Set client timezone to America/Edmonton (MST/MDT).
    - Advance system clock (or wait) to a moment where UTC says day 180 has passed but Edmonton local says day 179, and vice versa.
    - Verify: dormant-reengagement cron fires consistently with the documented policy (UTC-anchored or local-anchored — pick one and verify the code matches the choice).

17. **Audit log redaction in R2 export**
    - Run audit log export (Test 10). Download the R2 object.
    - Inspect: are phone numbers, message bodies, and consent evidence text in plaintext, hashed, or redacted?
    - Verify: PII handling is an explicit policy decision, not accidental. CASL audit defense favors plaintext retention. PIPEDA favors minimum necessary. Document the policy in `docs/operations/AUDIT-LOG-PII-POLICY.md` (create if missing).

18. **ESLint rule covers Twilio Voice + Conversations, not just SMS**
    - Add a temporary file `src/lib/services/test-bypass-voice.ts`:
      ```
      import twilio from 'twilio';
      const client = twilio('sid', 'token');
      await client.calls.create({ to: '+15551234567', from: '+15559999999', url: '...' });
      ```
    - Run `pnpm run lint`. Verify the rule blocks this — not just `messages.create`.
    - Repeat with `client.conversations.v1.conversations.create(...)` — verify blocked.
    - Delete the temp files.
    - If the rule only matches `messages.create`, broaden it before launch (any `import twilio from 'twilio'` outside `compliance-gateway.ts` is the safest match).

19. **getTrackedAI / getAIProvider enforcement (learned rule #2)**
    - Add a temporary file with a direct `new Anthropic(...)` call outside `src/lib/ai/`.
    - Run `pnpm run lint`. If no lint rule blocks it, this is a missing enforcement worth adding before scale.
    - Not block-launch, but log as a follow-up: "ESLint rule for direct Anthropic SDK use outside getTrackedAI/getAIProvider."

**Done when:** All 19 new tests pass. Existing 16 production tests in Phase 6 of E2E guide also still pass.

**Time:** 110-150 minutes for the full rehearsal pass.

**Required before:** First paid client signs.

---

## CHECKPOINT 4 — Documentation Sync + Out-of-Scope Decisions

CLAUDE.md "Documentation Sync" rule is mandatory for any change touching product behavior, schema, automations, compliance, or routes. Wave A touches all five. Run after code rehearsal completes, before signing the first paid client.

### Action 4A — Confirm Approved-Copy Changelog Entries

OFFER-APPROVED-COPY.md should carry both v2.1 (commit `ddcef64`, 2026-05-06) and v2.2 (commit `3cde5bc`, 2026-05-06) entries in the change log table.

**Steps:**
```
grep -E "^\| 2\.[12]" docs/business-intel/OFFER-APPROVED-COPY.md
```

Expected: two rows. If either is missing, add the row using the commit message body as source.

**Done when:** Both changelog rows present. Doc version line at top reflects current version.

**Time:** 2 minutes.

---

### Action 4B — Public Offer Page Parity

`docs/business-intel/offer-page.html` is in modified state per git status. Confirm the public-facing offer page matches v2.2 approved copy on the four sections that changed.

**Steps:**
```
grep -i "6 month\|express consent\|180 day\|first 3 client" docs/business-intel/offer-page.html
```

Expected: matches consistent with §2 dormant reactivation, §4 Pilot/Standard differentiation, §6 quiet hours, §7 CASL window.

If the page lags the approved copy, update it. Public page contradicting the proposal copy is a credibility leak.

**Done when:** offer-page.html copy matches OFFER-APPROVED-COPY.md v2.2 on §2, §4, §6, §7.

**Time:** 10 minutes.

---

### Action 4C — Other Mapped Docs (per `.claude/references/doc-sync-map.md`)

Review and update each. These are not optional — CLAUDE.md "Doc sync is mandatory" learned rule #7.

| Doc | Update needed |
|---|---|
| `docs/product/PLATFORM-CAPABILITIES.md` | Add CASL 6-month gate, audit-export retention policy, per-client quiet-hours preference as built capabilities |
| `docs/engineering/01-TESTING-GUIDE.md` | Add the 19 new rehearsal tests as runnable steps |
| `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` | CASL clause must reflect 6-month implied / 24-month customer / express-consent-with-evidence framing |
| `docs/operations/ACQUISITION-PLAYBOOK-0-TO-5.md` | If the playbook references reactivation outreach, add the 6-month rule and operator script for handling pushback |
| `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` | Onboarding step for dead-quote import must reference the intake-mode switch and the express-consent attestation requirement |
| `docs/product/02-OFFER-PARITY-GAPS.md` | Mark Wave A items resolved with reference to commit `3cde5bc` |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Already updated in `3cde5bc` per commit message — verify §1.7 reads correctly |

**Done when:** All seven docs reflect current code. Run `pnpm run quality:no-regressions` after edits.

**Time:** 30-45 minutes.

---

### Action 4D — Out-of-Scope Gap Decisions (from commit 3cde5bc)

Author flagged 5 gaps as out of scope for the gate commit. Two of them block the rehearsal as written. Decide block-launch vs post-launch for each.

| Gap | Block-launch? | Rationale | Effort if built now |
|---|---|---|---|
| Lead detail UI: `inquiry_date` display + sienna/red boundary badges | **YES** | Test 7 in Action 3A depends on it. Operators cannot triage CASL expiry without visible boundary. Section 7 copy now promises this control exists. | 2-3 hours |
| CSV upload UI: `intakeMode` toggle + required-column hints | **YES** | Backend wired but frontend uploader doesn't expose the toggle. Tests 5, 6 fail. Operator and contractor cannot use express-consent path until UI exists. | 2-3 hours |
| 24-month customer-consent intake UI ("past paid customer" toggle) | **DEFER** | Pilot #1-3 dead-quote lists are unlikely to include >6mo paid customers. Schema supports it; build when first Pilot needs it. | 2-4 hours when needed |
| Legacy lead backfill (NULL `inquiry_date` rows from Action 1A.1) | **CONDITIONAL** | If 1A.1 count is <100, COALESCE fallback handles it; defer. If ≥100 OR if any active client has legacy rows, write a one-off backfill script that sets `inquiry_date = created_at`. | 1 hour for script |
| React component test infra (vitest .tsx + jsdom) | **DEFER** | Manual rehearsal Tests 1-3 cover create-lead-dialog. Add infra in a later observability/quality phase. | 4-6 hours |

**If both block-launch items aren't built:** Tests 3, 5, 6, 7 will fail. The rehearsal does not pass. The first paid client cannot be onboarded with the express-consent path that the copy promises.

**Done when:** Each row has an explicit decision logged. Block-launch items either complete or rehearsal scope is formally reduced (with stakeholder sign-off).

**Time:** 10 minutes to decide. 4-6 hours to build the two block-launch UI items. 1 hour for the conditional backfill.

---

### Action 4E — Cross-Reference Block-Launch Items NOT in Wave A

Items I flagged earlier in this conversation that are still open and not covered by Wave A. Decide before first paid client.

| Item | Status | Owner | Estimated effort |
|---|---|---|---|
| Calendar booking 12-step smoke test on fresh Gmail account | NOT IN WAVE A | You | 2-3 hours |
| Google app verification status (or accept warning + script the explanation) | NOT IN WAVE A | You | 30 min decision; 4-6 weeks if pursuing verification |
| Inbound-reply CASL exemption counsel sign-off (Section 6 unlock) | NOT IN WAVE A | Counsel + you | 3-7 days, $500-1,500 |
| Logging-coverage dashboard widget (operator + contractor visibility) | NOT IN WAVE A | Dev | 4-6 hours |
| Stripe auto-pause integration for Day 30 logging gate | NOT IN WAVE A — verify if implemented | Dev | 2-4 hours if not done |
| Live SMS test recovery script (ICP §5 qualifier failure handling) | NOT IN WAVE A | You | 30 min |

For each: confirm whether it is in flight, scheduled for a Wave B, or accepted as known launch risk.

**Done when:** Each row has an explicit status. None is "unknown."

**Time:** 15 minutes to triage. Build effort varies per item.

---

## Summary Table

| Checkpoint | Action | Time | Trigger |
|---|---|---|---|
| 1A | Push migration 0030 (CASL gate columns) | 2 min | Before any Phase 0 execution |
| 1A.1 | Verify migration 0030 columns post-push + measure legacy row count | 2 min | Immediately after 1A |
| 1B | Create R2 bucket + object-lock | 10 min | Before Phase 2 |
| 1C | Add 5 R2 env vars | 5 min | Before Phase 2 |
| 2A | Push migration 0031 (Decision F column) | 1 min | After commit `feat(compliance): add contractorAlertQuietHoursEnabled` |
| 2.5A | CASL code path audit (7 grep checks) | 5 min | Before rehearsal |
| 2.5B | typecheck + full test suite | 2 min | Before rehearsal |
| 2.5C | Confirm out-of-scope gap decisions resolved | 5 min decide; 4-8 hr build | Before rehearsal |
| 3A | Full E2E rehearsal with 19 new tests | 110-150 min | After all code lands |
| 4A | Verify changelog v2.1 + v2.2 entries in approved copy | 2 min | After rehearsal |
| 4B | Public offer page parity check vs v2.2 | 10 min | After rehearsal |
| 4C | Cross-doc sync per `.claude/references/doc-sync-map.md` | 30-45 min | After rehearsal |
| 4D | Out-of-scope gap decisions (5 items) | 10 min decide; 4-6 hr build | Before rehearsal |
| 4E | Triage block-launch items NOT in Wave A (calendar, counsel, logging widget, etc.) | 15 min triage; varies per item | Before first paid client |

**Total operator time: ~3-4 hours spread across the execution window, plus 4-8 hours of UI build for block-launch items in 4D, plus follow-up effort for 4E items decided as block-launch.**

Most of this can run in parallel with agent work — Wave A commit messages and the final summary will signal when each checkpoint is needed.

**Critical reminder:** Action 2.5C and 4D are gating. If block-launch UI items (lead-detail boundary badges, CSV intakeMode toggle) are not built, rehearsal Tests 3, 5, 6, 7 will fail and the v2.2 copy promise is not yet kept by the platform.
