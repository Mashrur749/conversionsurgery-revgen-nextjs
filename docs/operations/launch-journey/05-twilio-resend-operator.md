# 05 — Twilio + Resend + Operator Profile + R2 Audit Bucket

## What this is
Four dashboard tasks in one file because they share the same headspace: provisioning your first production Twilio number, verifying your Resend email domain, setting your operator contact info inside the deployed admin app, and creating the Cloudflare R2 bucket where weekly compliance audit logs are exported with object-lock retention.

## Before you start this
- [ ] App is deployed to a real HTTPS domain (file 04 done)
- [ ] You have admin access to Twilio, Resend, and Cloudflare
- [ ] You can log into the deployed `/admin` with your operator email

## Time required
~60 minutes (the extra 15 minutes is the R2 setup)

## Part 1 — Twilio production number

1. Twilio Console → **Phone Numbers** → **Buy a number**.
2. Country: **Canada**. Area code: **403** (Calgary) or **780** (Edmonton). Capabilities: **SMS + Voice + MMS**.
3. Buy the number. Note it in E.164 format (e.g. `+14035551234`).
4. Open the number's config page. Set:
   - **Messaging** → "A MESSAGE COMES IN" → Webhook → `https://your-domain.com/api/webhooks/twilio/sms` (HTTP POST)
   - **Voice** → "A CALL COMES IN" → Webhook → `https://your-domain.com/api/webhooks/twilio/voice` (HTTP POST)
   - **Voice** → "CALL STATUS CHANGES" → Webhook → `https://your-domain.com/api/webhooks/twilio/voice-status` (HTTP POST)
5. Save. If A2P is already approved (file 02), associate this number with the campaign now. If still pending, you will associate it as soon as approval lands.

This first number is your **demo / pilot pool** number. You will buy additional numbers per client during their onboarding.

## Part 2 — Resend domain verification

1. Resend Dashboard → **Domains** → **Add Domain**.
2. Enter your sending domain (e.g. `mail.conversionsurgery.io` or `conversionsurgery.io`).
3. Resend shows a list of DNS records: SPF (TXT), DKIM (3 CNAMEs), and an optional DMARC.
4. Add every record to your DNS provider exactly as shown. Save.
5. Click **Verify DNS Records** in Resend. Verification usually completes in 5–60 minutes. If still pending after 1 hour, the DNS records have a typo — re-check.
6. Once verified, set `RESEND_FROM_EMAIL` env var in production to a sender address on the verified domain (e.g. `noreply@mail.conversionsurgery.io`).

## Part 3 — Operator profile inside the app

1. Open `https://your-domain.com/admin/agency` (or **Settings → Agency Settings** in the admin nav).
2. Set:
   - `operator_name` — your full name as you want it to appear in operator-facing notifications
   - `operator_phone` — your real cell phone in E.164 format (e.g. `+14035550100`)
3. Save. The platform sends ops notifications (cron alerts, escalations, Friday Pulse) to this phone via SMS.

## Part 4 — Cloudflare R2 audit log bucket (Wave A Hardening)

The platform exports compliance audit logs (`compliance_audit_log` + `consent_records`) weekly to Cloudflare R2 with object-lock retention. This is your tamper-evident regulatory paper trail. CRTC investigations would accept R2 with COMPLIANCE-mode object-lock as immutable evidence.

### Steps

1. Sign in to Cloudflare Dashboard → **R2** → **Overview**.
2. Click **Create bucket**.
   - Bucket name: `conversionsurgery-audit-logs`
   - Region: **Automatic** (Cloudflare picks closest)
3. Click into the bucket → **Settings** tab → **Object Lock**.
4. Enable Object Lock with these settings:
   - **Default retention mode:** `Compliance` (NOT Governance — Compliance is non-overridable, which is the regulatory point)
   - **Default retention period:** `2557` days (= 7 years)
5. Click **Save**.

### Generate API credentials

6. Cloudflare Dashboard → **R2** → **Manage R2 API Tokens**.
7. Click **Create API Token**.
   - Token name: `conversionsurgery-audit-export`
   - Permissions: **Object Read and Write**
   - Specify bucket: `conversionsurgery-audit-logs`
   - TTL: leave unlimited
8. **Copy the Access Key ID and Secret Access Key now — you'll only see the secret once.**
9. Note the **Account ID** from the R2 dashboard sidebar.

### Add R2 environment variables

Add to your production deployment env (Cloudflare Workers env or Vercel env, depending on the platform you chose in file 04). Also add to local `.env.local` so the cron route works during dev testing.

```
R2_ACCOUNT_ID=<your account id>
R2_ACCESS_KEY_ID=<from step 8>
R2_SECRET_ACCESS_KEY=<from step 8>
R2_AUDIT_BUCKET=conversionsurgery-audit-logs
R2_AUDIT_RETENTION_DAYS=2557
```

### Verify the export cron is wired

After all env vars are set and a deploy has occurred, manually trigger the export cron:

```
curl -X GET "https://your-domain.com/api/cron/audit-log-export" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: HTTP 200 with response containing `{ exportedAt, recordCount, key, etag, retainUntil }`. Cloudflare Dashboard → R2 bucket → confirm a new object exists at `audit-export/YYYY-MM-DD-{hash}.json` with the retention date applied.

If the cron returns 500, the most common cause is missing env vars or the R2 token doesn't have write permission to that specific bucket.

## Test: trigger a cron, confirm SMS arrives

This single test verifies all three integrations are wired. It uses `CRON_SECRET` from your env.

```
curl -X POST https://your-domain.com/api/cron/morning-brief \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- HTTP 200 response
- An SMS arrives at your `operator_phone` within ~30 seconds
- The SMS comes from your Twilio production number
- An admin email digest may also fire — confirms Resend works

If any one of those fails, that integration is the suspect.

## What success looks like
- [ ] Twilio number bought, in E.164 format, configured with all three webhooks
- [ ] Resend domain verified (green checkmark in dashboard)
- [ ] `RESEND_FROM_EMAIL` set in production env
- [ ] `operator_name` + `operator_phone` saved at `/admin/agency`
- [ ] Cloudflare R2 bucket `conversionsurgery-audit-logs` created with Compliance object-lock + 2557-day retention
- [ ] All 5 R2 env vars set in production + local
- [ ] Manual `audit-log-export` cron returned 200, object visible in R2 bucket with retention applied
- [ ] Manual cron trigger returned 200
- [ ] SMS landed on your phone from the Twilio number

## If something goes wrong

- **Cron returns 401** — `CRON_SECRET` mismatch between curl call and production env. Re-set in deployment env.
- **Cron returns 200 but no SMS** — Twilio creds wrong, or A2P pending and carrier filtered. Check Twilio Console → Logs → Messaging for the outbound entry.
- **Resend domain stuck "pending"** — DNS typo or your provider strips quotes from TXT records. Look at the raw DNS response with `dig TXT mail.your-domain.com`.
- **`/admin/agency` shows blank inputs after save** — DB write failed; check deployment logs for Drizzle error. Most likely cause: migration not pushed yet (file 06 fixes this).

## Reference
- Launch checklist: `docs/operations/LAUNCH-CHECKLIST.md` Phase 4.1 (External Services)
- Operator settings location: admin nav → Settings → Agency Settings
- Phone normalization: `src/lib/utils/phone.ts`

## Next
[06 — Migrations + Seed](./06-migrations-and-seed.md)
