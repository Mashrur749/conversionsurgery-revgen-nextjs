# 08 — Platform Rehearsal (End-to-End in Test Mode)

## What this is

You walk through the entire client lifecycle as a fake contractor before any real Pilot client touches the system. Sign up, onboard, fire every automation, hit the gates, and exercise the Day-14 cancel — all in test mode against a phone number you own.

## Before you start this

- [ ] Stripe test mode products + prices seeded
- [ ] Resend domain verified, sender configured
- [ ] At least one Twilio test number you control
- [ ] App is running (local dev or deployed env you can access as admin)
- [ ] You have a personal phone number that is NOT the operator number — this plays the contractor

## Time required

~3-4 hours

## Why this matters

This is the single most important Day 2 task. Every infra bug — wrong webhook, wrong env var, wrong template variable, wrong cron — surfaces here, where the cost is your time. If you skip this, the first paying contractor finds it instead, and they will not pay you again.

## What you'll do

### 1. Pick the test contractor identity

Use this everywhere so the data tells a coherent story:

- Business name: **Peak Basements YYC**
- Owner: **Jordan Hayes**
- Email: a Gmail address you own (not your operator email)
- Phone: a personal mobile you own
- Trade: Calgary basement contractor
- Revenue: $1.5M
- Lead volume: 18/month
- Average project: $55K

### 2. Create the test client via the admin wizard

Go to `/admin/clients/new/wizard` and walk all wizard steps. Use the Peak Basements YYC profile. Confirm the review step shows the data correctly before you finish.

### 3. Generate the Pilot checkout link

On the new client's detail page, use the `GenerateCheckoutLink` component (see `src/app/(dashboard)/admin/clients/[id]/generate-checkout-link.tsx`). Pick the **Pilot tier**: $3,500 setup + $1,500/mo. Confirm the link copies to clipboard.

### 4. Pay with the Stripe test card

Open the checkout link in incognito (or another browser) so you're not signed in as admin. Pay with `4242 4242 4242 4242`, any future expiry, any CVC. Use the contractor email + phone from step 1.

Cross-reference: E2E Phase 3 (§3.1-3.5).

### 5. Verify the post-payment state

- [ ] Stripe shows the subscription created and the setup half-payment captured
- [ ] Client status = `active` in `/admin/clients`
- [ ] Welcome email arrived at the test Gmail
- [ ] Welcome SMS arrived on the test phone
- [ ] Day-7 non-refundable timer is set (verify via DB or admin UI per Phase 3.5)

### 6. Walk Phase 4 — onboarding

Cross-reference: E2E §4.1-4.7. Fire the welcome SMS, run the KB wizard end-to-end as if you were the contractor (use the basement preset in `docs/operations/templates/BASEMENT-KB-PRESET.md`), and provision the contractor's Twilio number.

- [ ] KB wizard completes and saves
- [ ] Contractor phone is provisioned and reachable
- [ ] Day-1 activation verification (§4.6) passes

### 7. Walk Phase 5 — Day 1-21 implementation

Cross-reference: E2E §5.1-5.8. You don't need to wait 21 real days — fire each milestone task in order. The point is to confirm every automation, template, and admin action works.

### 8. Run all 16 production tests

This is the heart of the rehearsal. Do not skip any.

Cross-reference: E2E §6.1 through §6.16. Send real SMS to the contractor number, place a missed call, submit the web form, place an inbound voice AI call, fire each estimate trigger, walk the 4-touch follow-up, trigger reactivation, book + remind + no-show + recover, fire review request, fire payment reminder, force a KB gap, exercise STOP/quiet hours/opt-out, hit Day-21 gate, hit Day-30 gate, confirm bi-weekly report, confirm Friday pulse SMS.

- [ ] All 16 tests pass with green checkmarks logged

### 9. Trigger the Day-21 go-live gate manually

Cross-reference: E2E §6.13 and 02-MANAGED-SERVICE-PLAYBOOK §5 Layer 1. Confirm the gate evaluates the criteria and writes a pass record. The second 50% setup invoice should fire on pass.

### 10. Trigger the Day-30 logging gate manually

Cross-reference: E2E §6.14 and 02-MANAGED-SERVICE-PLAYBOOK §5 Layer 2. Confirm the 80% logging threshold check runs and writes a pass record.

### 11. Verify the Day-14 cancel countdown banner

Open the admin client detail page for Peak Basements YYC. The countdown banner should show days remaining in the Day-14 window. Confirm it renders correctly.

### 12. Test the Day-14 cancel form end-to-end

Submit the cancel form on the test client. Pick a reason. Confirm:

- [ ] A row is written to the `client_cancellations` table
- [ ] Stripe subscription is cancelled per the Day-14 path
- [ ] The cancel confirmation email fires
- [ ] Max exposure on the cancel matches the offer math ($1,750 for Pilot)

Cross-reference: E2E §8.0a and 02-MANAGED-SERVICE-PLAYBOOK §7a.

### 13. Wave A Hardening tests (11 additional checks)

These verify the work that landed during the Wave A Hardening phase: the CASL 6-month gate at intake, the 24-month customer-consent path, the lead-detail consent badges, the compliance sentinel, the R2 audit export, and the per-client quiet-hours preference (Decision F).

Run each one and tick the boxes.

#### 13.1 Operator quick-add: standard mode (<180 days inquiry)

- Open `/admin/clients/[id]` → New Lead
- Select **"New inquiry (last 6 months)"**
- Pick a date 30 days ago. Submit.
- [ ] Lead created with `inquiry_date` set
- [ ] Consent record written: `type='implied'`, `source='manual_entry'`, `consentTimestamp = inquiry_date`

#### 13.2 Operator quick-add: express-consent mode (>=180 days)

- New Lead
- Select **"Older inquiry (express consent on file)"**
- Pick a date 240 days ago. Evidence text: "Test express consent attestation, signed estimate request 2024-09-01"
- Submit.
- [ ] Lead created
- [ ] Consent record: `type='express_written'`, evidence text stored in `consent_evidence`

#### 13.3 Operator quick-add: existing-customer mode (within 24 months)

- New Lead
- Select **"Past paid customer (within 24 months)"**
- Pick a date 14 months ago. Notes: "Test customer, kitchen reno completed Mar 2025"
- Submit.
- [ ] Lead created
- [ ] Consent record: `source='existing_customer'`, expiry computed at +24 months from transaction date

#### 13.4 CSV import: standard mode rejection (>180 days)

- Upload CSV with one row whose `inquiry_date` is 200 days ago.
- [ ] Rejected with clear error: "Standard CSV requires all inquiries within last 180 days"

#### 13.5 CSV import: express-consent mode acceptance

- Upload CSV with `intakeMode=express_consent` + `express_consent_evidence` column populated per row.
- [ ] Leads created with `'express_written'` consent + evidence text per lead

#### 13.6 CSV import: existing-customer mode acceptance

- Upload CSV with `intakeMode=existing_customer` + `transaction_date` column.
- [ ] Leads created with `consent_source = 'existing_customer'`

#### 13.7 Lead detail UI: consent badges

- Open lead with `inquiry_date` 155 days ago.
  - [ ] Sienna badge: "Approaching CASL window — 25 days until consent expires"
- Open lead with `inquiry_date` 200 days ago + no express consent.
  - [ ] Red badge: "Express consent required for further outbound"
- Open lead with `consent_source = 'existing_customer'` (transaction date 14 months ago).
  - [ ] Badge: "Customer consent (transaction date: ..., 18 months remaining)"

#### 13.8 Compliance sentinel block

- Add operator's own phone to platform DNC manually (admin → DNC list → add).
- Trigger any operator alert (e.g., escalation cron) that would normally fire to operator's phone.
- [ ] SMS NOT sent
- [ ] `compliance_audit_log` shows new entry with `category='internal_sms_sentinel_block'`
- [ ] `compliance_sentinel_blocked_total` counter incremented (visible at `/admin/system-health`)
- Remove operator's phone from DNC. Retry the alert. Verify SMS now sends.

#### 13.9 Twilio bypass guard (ESLint + CI gate)

- Create temporary file `src/lib/services/test-bypass.ts` with `import twilio from 'twilio'` and `twilio(...).messages.create({...})`.
- [ ] `pnpm run lint` blocks with the custom ESLint rule message
- [ ] `pnpm run quality:no-regressions` fails on the twilio bypass guard step
- Delete the temporary file and re-run — both pass.

#### 13.10 R2 audit log export

- Manually trigger the export cron:
  ```
  curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/audit-log-export
  ```
- [ ] HTTP 200 response with `{ exportedAt, recordCount, key, etag, retainUntil }`
- [ ] Cloudflare R2 dashboard → bucket → new object exists at `audit-export/YYYY-MM-DD-{hash}.json`
- [ ] Object shows COMPLIANCE-mode object-lock with retain-until date ~7 years out
- [ ] Last successful export timestamp updates in `/admin/system-health`

#### 13.11 Per-client quiet hours toggle (Decision F)

- Open `/client/settings/notifications` (signed in as the test contractor).
- Toggle **"Respect quiet hours (9pm–10am) for SMS alerts to me"** → ON.
- At 11pm contractor local time (or fake the timezone via test client setup), trigger an operator alert addressed to the contractor.
- [ ] SMS queued (not sent immediately) — visible in `scheduled_messages` table or compliance queue
- Toggle OFF. Retry at 11pm.
- [ ] SMS sent immediately
- Reset toggle to default (OFF) on the test client.

Cross-reference: `.planning/phases/wave-A-hardening/OPERATOR-ACTIONS.md` §3A for the canonical version of these 11 tests.

## What success looks like

- [ ] Test client signed up, onboarded, and walked all the way to Day-30 in test mode
- [ ] All 16 production tests green
- [ ] Both gates (Day-21, Day-30) verified
- [ ] Day-14 cancel form tested and writes to `client_cancellations`
- [ ] All 11 Wave A Hardening tests green (§13.1–§13.11)
- [ ] You have a clean test client record you can leave in the DB or wipe before launch

## If something goes wrong

Each failed step gets logged into `.scratch/rehearsal-bugs.md` with: which step, what you expected, what happened, hypothesis. Triage at the end — fix infra blockers before launch, defer cosmetic issues. Re-run the failed step (and downstream steps) after each fix.

## Reference

- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` Phases 1-8
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §5, §7a
- `src/app/(dashboard)/admin/clients/new/wizard/page.tsx`
- `src/app/(dashboard)/admin/clients/[id]/generate-checkout-link.tsx`

## Next

[09 — Offer Mastery](./09-offer-mastery.md)
