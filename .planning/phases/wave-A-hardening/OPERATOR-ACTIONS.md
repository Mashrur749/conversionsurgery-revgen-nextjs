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

**Done when:** All 11 new tests pass. Existing 16 production tests in Phase 6 of E2E guide also still pass.

**Time:** 90-120 minutes for the full rehearsal pass.

**Required before:** First paid client signs.

---

## Summary Table

| Checkpoint | Action | Time | Trigger |
|---|---|---|---|
| 1A | Push migration 0030 (CASL gate columns) | 2 min | Before any Phase 0 execution |
| 1B | Create R2 bucket + object-lock | 10 min | Before Phase 2 |
| 1C | Add 5 R2 env vars | 5 min | Before Phase 2 |
| 2A | Push migration 0031 (Decision F column) | 1 min | After my commit `feat(compliance): add contractorAlertQuietHoursEnabled` |
| 3A | Full E2E rehearsal with 11 new tests | 90-120 min | After all code lands |

**Total operator time: ~110-140 minutes spread across the execution window.**

Most of this can run in parallel with my agent work — I'll signal when each checkpoint is needed via commit messages and the Wave A Hardening summary at the end.
