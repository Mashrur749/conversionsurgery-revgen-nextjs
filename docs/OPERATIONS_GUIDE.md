# Operations Guide

Day-to-day system operations, monitoring, troubleshooting, and incident response for the ConversionSurgery platform.

**Companion docs**: [Testing Guide](./TESTING_GUIDE.md) for E2E testing, [Use Cases](./USE_CASES.md) for workflow reference, [Deployment](../DEPLOYMENT.md) for setup.

---

## Table of Contents

- [System Architecture Overview](#system-architecture-overview)
- [Cron Jobs](#cron-jobs)
- [Monitoring Checklist](#monitoring-checklist)
- [Troubleshooting](#troubleshooting)
- [Incident Response](#incident-response)
- [Common Database Queries](#common-database-queries)
- [Client Lifecycle Operations](#client-lifecycle-operations)
- [Cost Monitoring](#cost-monitoring)

---

## System Architecture Overview

```
                    ┌──────────────────┐
                    │  Cloudflare CDN   │
                    │  (edge caching)   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Next.js App    │
                    │ (Cloudflare Worker│
                    │  via OpenNext)    │
                    └──┬──────┬──────┬─┘
                       │      │      │
              ┌────────▼┐  ┌──▼───┐  ┌▼────────┐
              │  Neon    │  │Twilio│  │ OpenAI  │
              │Postgres  │  │SMS/  │  │ GPT-4o  │
              │ (95+     │  │Voice │  │  mini   │
              │  tables) │  │      │  │         │
              └──────────┘  └──────┘  └─────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼───┐   ┌─────▼────┐  ┌────▼────┐
    │ Stripe │   │  Resend  │  │   R2    │
    │Billing │   │  Email   │  │ Storage │
    └────────┘   └──────────┘  └─────────┘
```

**Key data flows**:
1. Inbound SMS/Call &rarr; Twilio &rarr; Webhook &rarr; App &rarr; AI Response &rarr; Twilio &rarr; Lead
2. Cron (Cloudflare) &rarr; App &rarr; Process scheduled messages, aggregate stats
3. Agency login &rarr; NextAuth magic link &rarr; Resend &rarr; Email &rarr; Auth &rarr; `agency_memberships` &rarr; permissions
4. Portal login &rarr; OTP (SMS/email) &rarr; `people` &rarr; `client_memberships` &rarr; signed cookie with permissions

**Identity model**: All users are represented by a `people` record. Access is granted through memberships:
- `client_memberships`: links a person to a business with a role template and permission overrides
- `agency_memberships`: links a person to the agency with a role template and client scope
- `role_templates`: define permission bundles (7 built-in + custom)

---

## Cron Jobs

### Schedule Summary

All cron jobs are orchestrated by the master cron at `/api/cron` (POST), triggered by Cloudflare Cron Triggers defined in `wrangler.toml`.

| Frequency | Jobs |
|-----------|------|
| **Every 5 min** | Process scheduled messages, check missed calls |
| **Every 30 min** | Auto review response, calendar sync |
| **Hourly** | Usage tracking, SLA breach check, review sync, expire prompts, NPS surveys, agent health |
| **Daily midnight** | Lead scoring, analytics aggregation, trial reminders, no-show recovery, Stripe reconciliation |
| **Daily 7am** | Daily summary emails |
| **Daily 10am** | Win-back re-engagement |
| **Weekly Mon 7am** | Weekly summary, agency digest |
| **Monthly 1st** | Cohort retention analysis |

### Manually Triggering Cron Jobs

Set your cron secret for convenience:
```bash
export CRON_SECRET="your-cron-secret"
export BASE="http://localhost:3000"
```

**Master orchestrator** (runs all sub-jobs based on time-of-day logic):
```bash
curl -X POST $BASE/api/cron -H "cf-cron: true" -H "Authorization: Bearer $CRON_SECRET"
```

**Individual jobs** (useful for testing specific functionality):
```bash
# Scheduled messages (every 5 min)
curl $BASE/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"

# Missed call polling (every 5 min)
curl $BASE/api/cron/check-missed-calls -H "Authorization: Bearer $CRON_SECRET"

# Auto review responses (every 30 min)
curl -X POST $BASE/api/cron/auto-review-response -H "Authorization: Bearer $CRON_SECRET"

# NPS surveys (hourly)
curl -X POST $BASE/api/cron/send-nps -H "Authorization: Bearer $CRON_SECRET"

# Trial reminders (daily)
curl -X POST $BASE/api/cron/trial-reminders -H "Authorization: Bearer $CRON_SECRET"

# No-show recovery (daily)
curl $BASE/api/cron/no-show-recovery -H "Authorization: Bearer $CRON_SECRET"

# Win-back campaigns (daily 10am)
curl $BASE/api/cron/win-back -H "Authorization: Bearer $CRON_SECRET"

# Daily summary (daily 7am)
curl $BASE/api/cron/daily-summary -H "Authorization: Bearer $CRON_SECRET"

# Weekly summary (Monday 7am)
curl $BASE/api/cron/weekly-summary -H "Authorization: Bearer $CRON_SECRET"

# Agency digest (Monday 7am)
curl $BASE/api/cron/agency-digest -H "Authorization: Bearer $CRON_SECRET"

# Stripe reconciliation (daily midnight)
curl $BASE/api/cron/stripe-reconciliation -H "Authorization: Bearer $CRON_SECRET"
```

### Verifying Cron Health

Check the master cron response — it returns results for each sub-job:

```bash
curl -s -X POST $BASE/api/cron \
  -H "cf-cron: true" \
  -H "Authorization: Bearer $CRON_SECRET" | python3 -m json.tool
```

Expected shape:
```json
{
  "results": {
    "processScheduled": { "processed": 0 },
    "checkMissedCalls": { "processed": 0, "missedDetected": 0 },
    "usageTracking": { "updated": 5 },
    ...
  },
  "errors": [],
  "timestamp": "2026-02-16T00:00:00.000Z"
}
```

If `errors` array is non-empty, investigate the failing job.

---

## Monitoring Checklist

### Daily Checks

| What | Where | Normal | Action if abnormal |
|------|-------|--------|-------------------|
| SMS delivery rate | Twilio Console → Messaging Insights | > 95% delivered | Check carrier filtering, content blocklists |
| AI response time | `/admin/platform-analytics` | < 10 seconds | Check OpenAI API status, rate limits |
| Cron job execution | Cloudflare Dashboard → Workers → Cron Triggers | All green | Re-deploy worker, check logs |
| Failed webhooks | `/admin/webhook-logs` (filter: status >= 400) | 0 failures | Check webhook URLs, auth tokens |
| Unresolved escalations | `/admin` dashboard | SLA within target | Notify team leads, check escalation rules |
| Stripe reconciliation | Cron response `stripeReconciliation` | 0 mismatches | Investigate subscription drift, check webhook delivery |
| Database connections | Neon Console → Monitoring | < 90% pool used | Investigate connection leaks |

### Weekly Checks

| What | Where | Normal |
|------|-------|--------|
| MRR trend | `/admin/platform-analytics` | Stable or growing |
| Client churn | `/admin/platform-analytics` | < 5% monthly |
| AI quality scores | `/admin` → AI response review | > 80% positive |
| Twilio balance | Twilio Console → Billing | > $50 buffer |
| OpenAI usage | OpenAI Platform → Usage | Within budget |

---

## Troubleshooting

### SMS Not Sending

**Symptoms**: Lead doesn't receive SMS, no delivery status updates.

| Check | How | Fix |
|-------|-----|-----|
| Twilio credentials | Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` | Update credentials, restart |
| Phone number active | Twilio Console → Phone Numbers | Re-purchase or fix suspension |
| Compliance block | Check lead's `optedOut` flag in DB | If legitimate, reset opt-out |
| Client disabled | Check `missedCallSmsEnabled` / `aiResponseEnabled` flags | Enable in client settings |
| Twilio balance | Twilio Console → Billing | Add funds |
| Rate limiting | Check Twilio error codes in webhook logs | Slow down sending, increase limits |
| Webhook URL mismatch | Twilio Console → Phone Number → webhooks | Update to correct URL |

**SMS retry behavior**: `sendSMS()` automatically retries up to 3 times with exponential backoff (1s, 2s, 4s) for transient failures (HTTP 429, 5xx, network errors). Non-retryable errors (invalid number, auth failures) throw immediately without retry.

### AI Not Responding

**Symptoms**: Inbound SMS received but no AI response generated.

| Check | How | Fix |
|-------|-----|-----|
| OpenAI API key | Test: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"` | Rotate key |
| AI disabled | Check `aiResponseEnabled` flag for client | Enable via admin |
| Empty KB | Check client's knowledge base entries | Add relevant KB entries |
| Rate limited | Check OpenAI error in server logs | Wait, or upgrade plan |
| Human takeover | Check if conversation is in "human" mode | Resume AI if appropriate |

### Email Not Arriving

**Symptoms**: Magic links, daily summaries, or trial reminders not received.

| Check | How | Fix |
|-------|-----|-----|
| Resend API key | Resend Dashboard → API Keys | Regenerate key |
| Sender domain | Resend → Domains → verify status | Re-verify DNS records |
| Spam folder | Check recipient's spam/junk | Improve SPF/DKIM records |
| Email from address | `EMAIL_FROM` must match verified domain | Update env var |
| Daily summary disabled | Check `notification_preferences.emailDailySummary` | Enable per client |

### Webhooks Failing

**Symptoms**: Webhook logs show 4xx/5xx errors, events not processing.

| Check | How | Fix |
|-------|-----|-----|
| URL reachable | `curl` the webhook URL | Fix DNS, SSL, or routing |
| Secret mismatch | Compare `FORM_WEBHOOK_SECRET` with sender | Sync secrets |
| Stripe signature | Check `STRIPE_WEBHOOK_SECRET` | Re-copy from Stripe Dashboard |
| Twilio signature | Verify `TWILIO_AUTH_TOKEN` matches | Update token |
| Payload format | Check webhook log payload in `/admin/webhook-logs` | Fix sender payload format |

### Voice AI Issues

**Symptoms**: Calls not answered by AI, or AI unresponsive during call.

| Check | How | Fix |
|-------|-----|-----|
| Voice enabled | Check `voiceEnabled` for client | Enable in admin |
| Voice webhook | Twilio Console → Phone Number → Voice URL | Set to `/api/webhooks/twilio/voice` |
| ElevenLabs key | Check `ELEVENLABS_API_KEY` (optional) | Falls back to Twilio TTS |
| Business hours | If `voiceMode=after_hours`, only works outside hours | Change to `always` for testing |

### Build / Deploy Failures

```bash
# Check TypeScript errors
npm run build

# Check lint
npm run lint

# If migration issues
npm run db:generate   # regenerate migrations
npm run db:push       # push schema (dev only!)
```

---

## Incident Response

### Twilio Outage

**Impact**: All SMS/voice stops. Leads get no responses.

1. Check [status.twilio.com](https://status.twilio.com)
2. If Twilio is down: nothing to do but wait. Messages will queue
3. After recovery: trigger `process-scheduled` cron to flush queued messages
4. Monitor webhook logs for catch-up processing

### OpenAI Outage

**Impact**: AI responses stop. Leads get no auto-reply.

1. Check [status.openai.com](https://status.openai.com)
2. Conversations fall back to "awaiting human" mode
3. Alert clients: escalations will need manual handling
4. After recovery: no catch-up needed (missed messages stay unanswered)

### Database Issues

**Impact**: Everything stops.

1. Check [Neon status page](https://neonstatus.com)
2. Neon auto-recovers from most issues
3. If prolonged: check Neon Console → Project → Monitoring for connection issues
4. After recovery: trigger master cron to catch up on missed jobs

### Stripe Outage

**Impact**: Billing actions fail. Subscriptions unaffected (Stripe handles retry).

1. Check [status.stripe.com](https://status.stripe.com)
2. Payment links and checkout will fail — inform clients
3. Existing subscriptions continue (Stripe retries failed invoices)
4. After recovery: retry any failed manual actions
5. Run manual reconciliation to catch any drift: `curl $BASE/api/cron/stripe-reconciliation -H "Authorization: Bearer $CRON_SECRET"`

**Subscription safeguards**:
- All Stripe mutation calls include idempotency keys (safe to retry on timeout)
- Subscription creation uses saga pattern: if DB write fails after Stripe charge, compensating cancel is issued
- All multi-step billing operations (create, cancel, change plan) are wrapped in DB transactions
- Daily reconciliation cron compares local subscription state with Stripe (source of truth) and auto-fixes mismatches with audit trail in `billing_events`

### High SMS Costs / Unexpected Charges

1. Check Twilio Console → Usage → SMS
2. Look for: abnormal volume, premium number destinations, carrier surcharges
3. Identify the source: which client, which flow, which cron job
4. Emergency stop: disable `flowsEnabled` and `aiResponseEnabled` for the offending client
5. Investigate and fix the root cause before re-enabling

---

## Access Management Operations

### Identity Migration

Before using the new access management system, existing data must be migrated:

```bash
# Seed role templates (idempotent)
npx tsx src/scripts/seed-role-templates.ts

# Preview migration (no changes)
npx tsx src/scripts/migrate-identities.ts --dry-run

# Execute migration
npx tsx src/scripts/migrate-identities.ts

# Verify all data migrated correctly
npx tsx src/scripts/verify-migration.ts
```

### Session Invalidation

When you change a user&apos;s role or permissions, their `sessionVersion` is bumped automatically. The next request with a stale session cookie will be rejected, forcing re-authentication.

To manually invalidate a session:

```sql
-- Invalidate a client portal session
UPDATE client_memberships SET session_version = session_version + 1
WHERE person_id = 'PERSON_UUID' AND client_id = 'CLIENT_UUID';

-- Invalidate an agency session
UPDATE agency_memberships SET session_version = session_version + 1
WHERE person_id = 'PERSON_UUID';
```

### Permission Debugging

To check what permissions a user has:

```sql
-- Client portal user permissions
SELECT p.name, p.email, rt.name as role, rt.permissions,
       cm.permission_overrides, cm.is_owner, cm.is_active
FROM client_memberships cm
JOIN people p ON cm.person_id = p.id
JOIN role_templates rt ON cm.role_template_id = rt.id
WHERE cm.client_id = 'CLIENT_UUID';

-- Agency user permissions
SELECT p.name, p.email, rt.name as role, rt.permissions,
       am.client_scope, am.is_active
FROM agency_memberships am
JOIN people p ON am.person_id = p.id
JOIN role_templates rt ON am.role_template_id = rt.id;
```

### Audit Log Queries

```sql
-- Recent auth events
SELECT al.action, al.created_at, p.name, p.email,
       al.resource_type, al.ip_address
FROM audit_log al
LEFT JOIN people p ON al.person_id = p.id
WHERE al.action LIKE 'auth.%'
ORDER BY al.created_at DESC
LIMIT 50;

-- Permission changes
SELECT al.action, al.created_at, p.name, al.metadata
FROM audit_log al
LEFT JOIN people p ON al.person_id = p.id
WHERE al.action IN ('role.changed', 'member.invited', 'member.removed', 'member.updated')
ORDER BY al.created_at DESC
LIMIT 50;

-- Client portal team actions
SELECT al.action, al.created_at, p.name, al.metadata
FROM audit_log al
LEFT JOIN people p ON al.person_id = p.id
WHERE al.action IN (
  'auth.business_switched',    -- user switched between businesses
  'team.member_added',         -- client portal user added team member
  'team.member_reactivated',   -- inactive member reactivated
  'team.member_updated',       -- client portal user updated team member
  'team.member_deactivated',   -- member deactivated from portal
  'team.member_removed'        -- member removed from portal
)
ORDER BY al.created_at DESC
LIMIT 50;
```

---

## Common Database Queries

Use Drizzle Studio (`npm run db:studio`) for visual queries, or connect directly via Neon Console SQL Editor.

### Find All Leads for a Client

```sql
SELECT l.id, l.name, l.phone, l.status, l.temperature, l.created_at
FROM leads l
WHERE l.client_id = 'CLIENT_UUID'
ORDER BY l.created_at DESC;
```

### Check Scheduled Messages

```sql
SELECT sm.id, sm.lead_id, sm.message, sm.send_at, sm.status
FROM scheduled_messages sm
WHERE sm.client_id = 'CLIENT_UUID'
  AND sm.status = 'pending'
ORDER BY sm.send_at ASC;
```

### View Recent Conversations

```sql
SELECT c.id, c.lead_id, c.message, c.direction, c.delivery_status, c.created_at
FROM conversations c
JOIN leads l ON c.lead_id = l.id
WHERE l.client_id = 'CLIENT_UUID'
ORDER BY c.created_at DESC
LIMIT 50;
```

### Check Client Feature Flags

```sql
SELECT
  business_name,
  missed_call_sms_enabled,
  ai_response_enabled,
  ai_agent_enabled,
  flows_enabled,
  voice_enabled,
  hot_transfer_enabled
FROM clients
WHERE id = 'CLIENT_UUID';
```

### Find Opted-Out Leads

```sql
SELECT l.id, l.name, l.phone, l.opted_out_at
FROM leads l
WHERE l.client_id = 'CLIENT_UUID'
  AND l.opted_out = true;
```

### Check Subscription Status

```sql
SELECT s.id, c.business_name, p.name as plan_name, s.status, s.current_period_end
FROM subscriptions s
JOIN clients c ON s.client_id = c.id
JOIN plans p ON s.plan_id = p.id
ORDER BY s.created_at DESC;
```

### Daily Stats for a Client (Last 7 Days)

```sql
SELECT date, new_leads, messages_sent, messages_received, appointments_booked
FROM daily_stats
WHERE client_id = 'CLIENT_UUID'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### Webhook Log Errors (Last 24h)

```sql
SELECT wl.id, wl.event_type, wl.response_status, wl.created_at
FROM webhook_log wl
WHERE wl.response_status >= 400
  AND wl.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY wl.created_at DESC;
```

### Active A/B Tests

```sql
SELECT at.id, at.name, at.status, at.start_date, at.end_date,
       COUNT(DISTINCT atl.lead_id) as total_leads
FROM ab_tests at
LEFT JOIN ab_test_leads atl ON at.id = atl.test_id
WHERE at.status = 'running'
GROUP BY at.id;
```

---

## Client Lifecycle Operations

### Onboarding a New Client

1. Admin creates client via wizard (A1)
2. Provision phone number (A2)
3. Build knowledge base (A3)
4. Define services (A37)
5. Create or assign flow templates (A4, A5)
6. Configure feature flags
7. A `people` record and `client_membership` (business_owner role, isOwner=true) are created automatically for the client&apos;s owner
8. The owner can log in via `/client-login` using their phone or email OTP
9. Owner can invite team members via `/client/team` (creates `people` + `client_membership` records)
10. Schedule a training call

### Suspending a Client

If a client needs temporary suspension (non-payment, etc.):

1. Disable all automations:
   ```sql
   UPDATE clients SET
     missed_call_sms_enabled = false,
     ai_response_enabled = false,
     flows_enabled = false,
     voice_enabled = false
   WHERE id = 'CLIENT_UUID';
   ```
2. Cancel scheduled messages:
   ```sql
   UPDATE scheduled_messages SET status = 'cancelled'
   WHERE client_id = 'CLIENT_UUID' AND status = 'pending';
   ```
3. Keep the phone number assigned (can be reclaimed later)

### Reactivating a Client

1. Re-enable feature flags (reverse the suspension query)
2. Verify KB is still populated
3. Verify flows are assigned and active
4. Send a test SMS to verify the phone number works
5. Notify the client

### Offboarding a Client

> This is destructive. Confirm with the client first.

1. Cancel Stripe subscription
2. Release phone number back to Twilio pool
3. Export client data (leads, conversations) as CSV for their records
4. Disable all automations (suspension step above)
5. Deactivate all `client_memberships` for this client (bumps sessionVersion to force logout):
   ```sql
   UPDATE client_memberships
   SET is_active = false, session_version = session_version + 1
   WHERE client_id = 'CLIENT_UUID';
   ```
6. Optionally: delete client data after retention period
   ```sql
   -- WARNING: Cascading deletes. Back up first.
   -- client_memberships cascade on client delete.
   -- Delete in order: conversations → leads → scheduled_messages →
   --   business_hours → kb_entries → client
   ```

---

## Cost Monitoring

### Monthly Cost Breakdown (Typical per Client)

| Service | Cost Driver | Typical Range |
|---------|------------|---------------|
| **Twilio SMS** | $0.0079/msg sent + $0.0079/msg received | $15-50/mo per active client |
| **Twilio Voice** | $0.014/min inbound + $0.014/min outbound | $5-20/mo if voice enabled |
| **Twilio Phone** | $1.15/mo per number | $1.15/mo base |
| **OpenAI** | ~$0.15/1M input tokens, ~$0.60/1M output tokens (gpt-4o-mini) | $5-20/mo per active client |
| **Resend** | Free tier: 3,000 emails/mo, then $20/mo for 50K | $0-20/mo |
| **Neon** | Free tier: 0.5 GB RAM, then $19+/mo | $0-19/mo |
| **ElevenLabs** | ~$0.30/1K chars synthesized | $5-15/mo if voice AI used |
| **Stripe** | 2.9% + $0.30 per transaction | Per-transaction only |
| **Cloudflare** | Workers free tier: 100K req/day | $0 for most usage |

### Cost Alerts

- Set Twilio budget alerts: Console → Billing → Alerts
- Set OpenAI usage limits: Platform → Settings → Limits
- Monitor via `/admin/usage` in the platform
- Configure per-client usage alerts at `/admin/clients/[id]` → Usage Alerts

### Optimizing Costs

1. **SMS**: Use scheduled messages (batch sends) instead of real-time for non-urgent flows
2. **OpenAI**: gpt-4o-mini is already the cheapest capable model. Reduce KB size for faster/cheaper responses
3. **Voice**: Set `voiceMode=after_hours` to only use voice AI outside business hours
4. **Email**: Batch daily summaries instead of per-event emails
