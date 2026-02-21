# Launch Readiness Audit — ConversionSurgery

**Last updated:** 2026-02-20
**Audited against:** Company-Wide Business Reference Guide v1.0

---

## Status Summary

| Category | Ready | Gaps | Critical |
|----------|-------|------|----------|
| Automated Sequences | 7/7 | 0 | 0 |
| AI Conversation Agent | Ready | 2 | 1 |
| Lead CRM & Dashboard | Ready | 0 | 0 |
| Client Portal | Ready | 0 | 0 |
| Phone Provisioning | Ready | 0 | 0 |
| Escalation & Hot Transfer | Ready | 0 | 0 |
| Compliance (CASL/CRTC) | Mostly | 2 | 1 |
| Billing & Subscriptions | Mostly | 3 | 1 |
| Analytics & ROI | Ready | 1 | 0 |
| Reporting | Partial | 1 | 0 |
| Onboarding | Partial | 1 | 0 |
| **Totals** | | **10** | **3** |

---

## Critical Gaps (Fix Before First Client)

### C1. Plan limits don't match the business doc

**What the business doc says:**
| Plan | Leads | Messages | Team | Numbers |
|------|-------|----------|------|---------|
| Starter | 100 | 1,000 | 2 | 2 |
| Professional | 500 | 5,000 | 5 | 3 |
| Enterprise | 2,000 | 20,000 | 20 | 10 |

**What the seed data creates:**
| Plan | Leads | Messages | Team | Numbers |
|------|-------|----------|------|---------|
| Starter | 50 | (none) | 1 | 1 |
| Professional | 200 | (none) | 5 | 3 |
| Enterprise | unlimited | (none) | unlimited | 10 |

**Issues:**
- Lead limits are wrong across all tiers
- **Monthly message limits are not tracked at all** — no SMS quota enforcement exists in the billing or compliance layer
- Team member and phone number limits are partially wrong

**Fix:**
1. Update `scripts/seed.ts` plan features to match business doc numbers exactly
2. Add `monthlyMessageLimit` to plan features schema
3. Add message count enforcement in `sendCompliantMessage()` (similar to how lead limits are checked)
4. Add message usage tracking to the usage dashboard

**Files:** `scripts/seed.ts`, `src/lib/compliance/compliance-gateway.ts`, `src/app/api/admin/usage/`

---

### C2. Queued messages during quiet hours never delivered

**What the business doc says:** No messages between 9 PM and 10 AM; messages during this window are queued for the next available window.

**What happens:** `sendCompliantMessage()` correctly detects quiet hours and returns `{ queued: true }`, logging a `message_queued` event in the compliance audit log. But **no background job exists to pick up queued messages and deliver them** after quiet hours end.

**Impact:** Messages queued during quiet hours are permanently lost. A homeowner texting at 11 PM gets no response until the next real-time trigger.

**Fix:** Add a cron job (e.g., `/api/cron/process-queued`) that runs at 10:01 AM daily, queries `complianceAuditLog` for `message_queued` events not yet delivered, and retries `sendCompliantMessage()` for each.

**Files:** New cron route, `src/lib/compliance/compliance-gateway.ts`

---

### C3. Voice AI has no guardrails

**What the business doc says:** AI operates under 10 absolute rules enforced in every interaction.

**What happens:** The SMS AI agent (both legacy and LangGraph) has all 10 guardrails injected via `buildGuardrailPrompt()`. The voice AI at `src/app/api/webhooks/twilio/voice/ai/gather/route.ts` has a basic system prompt ("You are a phone assistant for...") but **none of the 10 guardrails**.

**Risk:** Voice AI could make pricing promises, use pressure tactics, give professional advice, or deny being AI — all violations of the business doc rules and potential regulatory issues.

**Fix:** Inject the guardrail block from `src/lib/agent/guardrails.ts` into the voice AI system prompt, adapted for spoken-friendly language.

**Files:** `src/app/api/webhooks/twilio/voice/ai/gather/route.ts`, `src/lib/agent/guardrails.ts`

---

## High Priority Gaps (Fix Before First Invoice Cycle)

### H1. Overage charges not calculated

**What the business doc says:** $0.50/lead, $0.03/message, $20/team member, $15/phone number, $0.15/voice minute overages.

**What exists:** Schema supports overage pricing fields (`overagePerLeadCents`, `overagePerSmsCents`). Admin UI allows setting overage rates. Usage alerts schema exists.

**What's missing:** No code calculates overage charges or adds them to invoices. Clients exceeding plan limits are not billed for overages.

**Fix:** Add overage calculation to the billing cycle (monthly reset cron or Stripe webhook), create line items on invoices for overages.

**Files:** `src/app/api/cron/monthly-reset/route.ts`, `src/lib/services/subscription.ts`, `src/lib/billing/`

---

### H2. Bi-weekly performance reports not automated

**What the business doc says:** Bi-weekly performance reports showing leads captured, appointments booked, revenue recovered, and ROI. Clients review them every 2 weeks.

**What exists:** Weekly summary emails are automated via `/api/cron/weekly-summary`. Admin can manually generate detailed reports via `/api/admin/reports`. Report schema supports bi-weekly type.

**What's missing:** No automated bi-weekly cron job. No client-facing report delivery. No scheduled email with the detailed performance report (only the weekly SMS/email summary exists, which is lighter).

**Fix:** Add bi-weekly cron job that generates the full performance report and emails it to the client. Can reuse `weekly-summary.ts` logic with bi-weekly scheduling and enhanced metrics.

**Files:** New cron route or modify `src/app/api/cron/weekly-summary/route.ts`

---

### H3. 30-day performance guarantee — no tracking

**What the business doc says:** "If the client doesn't see at least one recovered lead in their first 30 days, we refund the first month. This guarantee is central to our sales pitch."

**What exists:** Nothing. No tracking of guarantee eligibility, no definition of "recovered lead," no automatic refund trigger, no admin visibility.

**Fix:**
1. Add `guaranteePeriodEndsAt` and `guaranteeFulfilled` fields to clients or subscriptions
2. Define "recovered lead" criteria (e.g., lead created by system with status progressing past `contacted`)
3. Add check in daily cron: if client is within 30 days and has a recovered lead, mark fulfilled
4. Add admin UI indicator showing guarantee status per client
5. If 30 days pass without fulfillment, flag for manual refund review

**Files:** `src/db/schema/clients.ts` or `src/db/schema/subscriptions.ts`, new cron logic

---

### H4. Onboarding mode auto-transition

**What the business doc says:** Week 1: setup. Week 2: AI in assist mode (suggests responses, contractor approves). Week 3+: full automation.

**What exists:** AI has `assist` and `autonomous` modes. Assist mode works — suggests responses via SMS for contractor approval. But transition from `assist` to `autonomous` **must be manually toggled by admin**. No time-based or approval-count-based auto-transition.

**Fix:** Add logic (cron or on-approval check) that auto-transitions to `autonomous` after either: (a) 7 days in assist mode, or (b) N consecutive approvals without edits. Notify the contractor and admin when the transition happens.

**Files:** `src/db/schema/clients.ts` (add `assistModeStartedAt`), cron or trigger logic

---

## Medium Priority Gaps (Fix Within First Month)

### M1. Business identification not enforced in AI responses

**What the business doc says:** Business identification included in every message.

**What exists:** Template messages (missed call, appointment, etc.) all include `{{businessName}}`. AI-generated responses include business name in the system prompt but **no post-generation validation** ensures the response actually contains it.

**Risk:** AI could generate a response that reads like a generic text with no business attribution, violating CASL business identification requirements.

**Fix:** Add post-generation check: if response doesn't contain `businessName` or `ownerName`, append a signature line. Alternatively, add explicit instruction to system prompt: "Always sign your response with your name."

**Files:** `src/lib/services/openai.ts`, `src/lib/agent/nodes/respond.ts`

---

### M2. Appointment reminders only sent to homeowner

**What the business doc says:** "Day-before and 2-hour-before reminders to both parties."

**What exists:** Both reminders are sent to the lead (homeowner). The contractor receives no reminder.

**Fix:** Add contractor notification (SMS or email) alongside the homeowner reminder. Use the team member assigned to the lead or the client owner.

**Files:** `src/lib/automations/appointment-reminder.ts`

---

### M3. Conversation context window too small for long threads

**What the business doc says:** AI should have full context when responding, even after multi-day gaps.

**What exists:** Conversation history is loaded from DB (last 20 messages) but only the last 8-10 are sent to the LLM. For a typical 2-day gap scenario with a short conversation, this works fine. For longer threads (30+ messages over weeks), early context is lost.

**Current behavior by path:**
| Path | Loaded from DB | Sent to LLM |
|------|---------------|-------------|
| Legacy AI | 20 messages | Last 10 |
| LangGraph Agent | 20 messages | Last 8 |
| Voice AI | Current call transcript only | No SMS history |

**Additional gap:** Voice AI loads **zero SMS conversation history**. If a homeowner texts for a week then calls, the voice AI treats them as a brand new caller.

**Fix:**
1. Increase respond node window from `slice(-8)` to `slice(-15)` (GPT-4o-mini handles this easily)
2. For very long conversations, implement conversation summarization — summarize messages 1-N into a paragraph, then append recent messages in full
3. Add SMS history loading to voice AI gather route (query `conversations` table by lead phone)

**Files:** `src/lib/agent/nodes/respond.ts` (line 68), `src/lib/services/openai.ts` (line 164), `src/app/api/webhooks/twilio/voice/ai/gather/route.ts`

---

### M4. Cohort retention data not populated

**What the business doc says:** Cohort retention at 1, 2, 3, 6, and 12-month milestones.

**What exists:** Schema at `src/db/schema/client-cohorts.ts` with all milestone fields. No cron job or logic populates the data.

**Fix:** Add monthly cron job that calculates retention for each cohort (clients grouped by signup month) and populates the table.

**Files:** New cron route, `src/db/schema/client-cohorts.ts`

---

## Low Priority Gaps (Polish)

### L1. Cost per client not calculated

**What the business doc says:** Track API costs (AI, SMS, voice, payments) divided by active clients.

**What exists:** Platform analytics schema has `avgCostPerClientCents` field. Not populated.

**Fix:** Aggregate Twilio + OpenAI + Stripe costs per client from usage tracking, calculate in monthly cron.

---

### L2. NPS not aggregated to platform metric

**What the business doc says:** NPS >50 as a platform target.

**What exists:** Individual NPS surveys sent and captured. No aggregation to a single platform NPS score.

**Fix:** Add NPS calculation to platform analytics cron.

---

### L3. Cancellation call scheduling

**What the business doc says:** Optional call scheduling in cancellation flow.

**What exists:** "Schedule a Call" button exists in the flow. No calendar integration — just a UI endpoint.

**Fix:** Integrate with admin calendar or send notification to retention team.

---

## Not Gaps (Confirmed Intentional)

| Item | Status | Rationale |
|------|--------|-----------|
| Yelp/Facebook review monitoring | By design | Google-only is correct — other platforms lack viable APIs for the full pipeline |
| Cloudflare WAF rate limiting | Deploy-time | Middleware rate limiter works; Cloudflare config is infrastructure, not code |
| PDF report export | Not promised | Reports are in-app; PDF is nice-to-have |
| Dedicated "Leads" tab in client portal | Not needed | Leads accessible via Conversations view — matches contractor UX |
| Weekly vs. bi-weekly summaries | See H2 | Weekly summaries exist and are automated; bi-weekly detailed reports are the gap |

---

## Features Fully Ready

All 7 automated sequences, AI conversation agent (SMS), lead CRM, client portal, phone provisioning, escalation system, hot transfer, Google review monitoring, subscription billing (create/pause/cancel/upgrade), cancellation flow with ROI display, analytics dashboards, NPS surveys, weekly summaries, compliance gateway (consent/opt-out/DNC/quiet hours/audit trail), CI/CD pipeline.

---

## Recommended Fix Order

```
Week 0 (before first client):
  C1 — Fix plan limits + add message quota enforcement
  C2 — Add queued message delivery cron
  C3 — Inject guardrails into voice AI

Week 1 (before first invoice):
  H1 — Overage charge calculation
  M3 — Increase conversation context window + add SMS history to voice AI

Week 2-3:
  H2 — Bi-weekly report automation
  H4 — Onboarding mode auto-transition
  M1 — Business identification enforcement
  M2 — Contractor appointment notifications

Month 1:
  H3 — 30-day guarantee tracking
  M4 — Cohort retention population
  L1-L3 — Polish items
```
