# 25 — When Things Break

## What this is
Maintenance protocols for the seven failure modes most likely to hit a pre-revenue solo operator. You have no SRE, no on-call rotation, no Tier-1 support. When something breaks, the only question is: is it client-impacting?

- **Client-impacting** (homeowner-facing automation broken, billing failed, A2P suspended, complaint received) → fix immediately, regardless of hour.
- **Not client-impacting** (a dashboard widget is wrong, a non-critical metric is stale) → fix in the next maintenance window (Tue/Wed AM).

This file is a runbook. Each failure mode has Symptom / Diagnosis / Fix. Read it once now so you recognize the patterns; come back when something fires.

## Before you start this
- [ ] You know how to access the admin dashboard at `/admin/system-health`
- [ ] You have access to: Stripe Dashboard, Twilio Console, Resend Dashboard, Cloudflare Dashboard, Neon Dashboard
- [ ] You have `CRON_SECRET` and other env vars accessible (encrypted password manager — never read `.env` directly)

## Time required
Varies — used reactively. Most fixes are 15–60 min. A2P suspension or compliance complaint can be a half-day.

## What you'll do

### Failure mode 1 — Cron stops firing

**Symptom.** Expected automation didn't run. The Friday Pulse SMS didn't go out. The dormant-lead recovery campaign skipped its window. Contractor asks "did you send anything this week?"

**Diagnosis.**
1. Open `/admin/system-health` → check "Last successful run" timestamp per cron job
2. Open Cloudflare Workers → Cron Triggers → check execution log for the failing job
3. Check whether the cron path returns 200 manually:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/<job-name>
   ```

**Fix.**
- If cron registration is broken (Cloudflare shows no recent invocations), redeploy. The cron triggers register on deploy.
- If the endpoint 500s when curled, investigate the route handler — fix and redeploy.
- If it just missed one window, manually trigger via curl (above). Do not let it sit until next cycle.
- Reference: `docs/engineering/03-RUNTIME-RELIABILITY-SYSTEM.md` (if exists in your repo).

### Failure mode 2 — Stripe webhook delivers but client doesn't transition to active

**Symptom.** Contractor paid (Stripe shows payment succeeded), but in admin the client status stays `pending` or `setup_pending`. Welcome flow doesn't fire.

**Diagnosis.**
1. Stripe Dashboard → Developers → Webhooks → click the relevant endpoint → check the recent event for that customer. 200 OK or error?
2. If 200 OK but no state change: open the client record in admin. Are `stripeCustomerId` and `stripeSubscriptionId` populated?
3. If they're missing, the webhook handler ran but didn't match the client. Check the metadata on the Stripe Checkout Session — does it have `clientId`?
4. If 4xx/5xx: webhook handler crashed. Check server logs.
5. If the signing secret was rotated in Stripe but not in the env, all webhooks will 401. Check `STRIPE_WEBHOOK_SECRET` env var.

**Fix.**
- If webhook handler fails on a fixable bug: deploy the fix, then in Stripe Dashboard re-send the failed event ("Resend" button on the event).
- If the client just needs a manual transition (e.g., setup paid but webhook never fired): update `client.status` directly via admin. Backfill `stripeCustomerId` from the Stripe customer.
- If signing secret rotated: update `STRIPE_WEBHOOK_SECRET`, redeploy, re-send failed events.

### Failure mode 3 — Twilio number stops sending SMS

**Symptom.** Outbound messages are queued in the system but homeowners report nothing arriving. Or the Twilio Console shows error codes on send.

**Diagnosis.**
1. Twilio Console → Monitor → Logs → Messaging. Filter by your number. What's the error code?
   - **30007** — carrier filtering (message looks promotional/spammy)
   - **30008** — unknown error (transient)
   - **30003** — handset unreachable (homeowner phone off / out of service)
   - **30034** — A2P 10DLC not registered or campaign not approved
   - **30406** — A2P campaign suspended
2. Twilio Console → Messaging → Regulatory Compliance → check A2P campaign status. Active? Suspended?

**Fix.**
- 30007 (filtering): rewrite the message — remove links, shorten, less salesy. The compliance gateway should be catching this; if it isn't, file a learned rule.
- 30003: nothing to do. Mark the lead's phone as bad after 3 attempts.
- 30034 / 30406: A2P issue. Open a Twilio support ticket immediately. Do not send more traffic until resolved — you risk the whole brand.
- If the campaign is suspended for content review, this is client-impacting. Pause outbound for affected clients and notify them within 24 hours.

### Failure mode 4 — Resend bounces emails

**Symptom.** Contractor reports the welcome email never arrived. Or homeowner replies "I didn't get your email."

**Diagnosis.**
1. Resend Dashboard → Emails → search for the recipient
2. Check status: delivered, bounced, complained?
3. If bounced, check the bounce reason: hard (invalid address, mailbox full long-term) or soft (transient)?
4. Common cause for new domain: SPF/DKIM not verified. Resend Dashboard → Domains → verify status.

**Fix.**
- Domain unverified: add the DNS records Resend gave you, wait 5–10 min, click "Verify" again.
- Soft bounce (mailbox full, server down): retry in 24h. Resend sometimes auto-retries; check.
- Hard bounce: mark the recipient as bad in your CRM (`emailValidStatus = 'invalid'`). Don't send again.
- Spam complaint: remove the recipient from all sends immediately. Investigate the content.

### Failure mode 5 — Migration needs rollback

**Symptom.** You ran `pnpm run db:push` or `db:migrate` and prod is now broken (column missing data, constraint violation, app errors).

**Diagnosis.**
1. Open the most recent migration SQL in `drizzle/`. Read it. Identify destructive operations: `DROP COLUMN`, `ALTER TYPE`, `DROP TABLE`.
2. Check Drizzle journal (`drizzle/meta/_journal.json`) — last applied migration tag.
3. Check Neon Dashboard → Branches → does the prod branch have a recent point-in-time you can restore from?

**Fix.**
- **Do NOT** use `db:push` to roll back. Push is not safe — it can drop data without warning.
- Write an explicit reverse migration: a new SQL migration that does the inverse (re-add column, restore type, etc.). Run that.
- If data was lost and you can't reconstruct: restore the prod branch from a Neon point-in-time backup taken before the bad migration. Then re-apply only the migrations you wanted.
- Reference: `.claude/skills/create-migration/SKILL.md` and `.claude/skills/neon-postgres/`

### Failure mode 6 — Voice AI starts hallucinating

**Symptom.** Homeowner reports the AI told them something wrong — wrong price, wrong availability, made-up service. Or `/admin/ai-quality` flags repeated low-confidence replies for one client.

**Diagnosis.**
1. `/admin/ai-quality` → filter to the client → review the flagged conversations
2. Cross-reference the AI's reply against the KB. Is the answer in the KB? If not, the AI is filling in.
3. Is the prompt allowing too much creativity? (Temperature too high, system prompt too vague.)

**Fix.**
- Tighten the KB. Add the missing entry. Explicit beats implicit.
- Switch the client to Smart Assist mode (operator approves before send) temporarily until KB is solid.
- Review the system prompt for that client's voice — pull it back toward "if you don't know, say you'll have a human follow up."
- If the pattern recurs across clients, escalate as a product fix (model swap, prompt rewrite, guardrail).

### Failure mode 7 — Homeowner files a CASL/CRTC complaint

**Symptom.** Contractor calls you alarmed. Or you receive a CASL complaint via email/regulator. Or a homeowner replies hostile: "I never asked for this, I'm reporting you."

**Diagnosis.**
1. Open the lead/conversation in admin. Pull the compliance audit log: when was consent captured? What was the source? What did the consent statement say?
2. Verify against `complianceConsent` table — record exists? source URL or capture event present?

**Fix.**
- Immediate: opt-out the recipient, add to DNC, send a brief apology ("Sorry — won't message you again. Removed."). Do not argue legality with the complainant.
- If consent record exists: keep it. That is your defense if escalated to CRTC.
- If consent record does NOT exist: this is a real incident. Document fully. Notify the client. Audit other recipients from the same source (broken consent capture path?). May require self-reporting depending on volume.
- Never delete the audit log. Never edit historical records. Add corrections forward.

### Maintenance windows

For non-client-impacting fixes (template tweaks, dashboard polish, KB cleanups), batch them into Tuesday or Wednesday morning. Avoid Friday afternoon — no fix-forward time before the weekend if you break something.

### When to escalate (immediate, not scheduled)

- A2P campaign suspended → Twilio support, same hour
- Stripe payments failing across multiple clients → Stripe support, same hour
- Security incident (suspected data leak, unauthorized access) → cease writes, audit, document. If user data is involved, get legal advice before notifying.
- Multiple clients reporting the same issue → it's a platform-wide bug. Pause whatever caused it, fix, redeploy.

## What success looks like
- [ ] You diagnosed the failure with the right tool (admin dashboard, vendor console, server logs)
- [ ] You fixed it without making it worse (no `db:push` rollbacks, no env var leaks, no untracked manual edits)
- [ ] You documented the incident — short note in your ops log: what happened, root cause, fix, prevention
- [ ] If client-impacting, you notified affected clients within 24 hours

## If something goes wrong
You're already in the "things break" file. Keep going. Most incidents are resolvable in <1 hour. The ones that aren't go to vendor support — Twilio, Stripe, Neon, Cloudflare. Open the ticket. Don't burn a day on what a vendor will tell you in 20 minutes.

## Reference
- `/admin/system-health` (live status)
- `docs/engineering/03-RUNTIME-RELIABILITY-SYSTEM.md` (if exists)
- `.claude/skills/create-migration/SKILL.md`
- `.claude/skills/neon-postgres/`
- Stripe / Twilio / Resend / Cloudflare / Neon dashboards (bookmark all)

## Next
[26 — Pilot 1 Reflection](./26-pilot-1-reflection.md)
