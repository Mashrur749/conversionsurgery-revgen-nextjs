# Service Delivery Gap Register

Last updated: 2026-04-10
Source: 8-agent stochastic consensus simulation against forever-client ICP
Method: Monte Carlo simulation with correlated profile generation, cross-validated by 8 independent agents with different analytical lenses (neutral, risk-averse, contractor empathy, operator capacity, first principles, contrarian, growth-oriented, resource-constrained)

---

## ICP Definition (Forever-Client)

**Canonical ICP:** See `docs/business-intel/ICP-DEFINITION.md`. The niche has been narrowed to **Calgary basement development contractors** (basement development, finishing, secondary suite conversion). Do not update the profile summary below in isolation &mdash; edit the canonical doc and reflect changes here.

The simulation targeted the highest-retention client profile (updated to reflect niche decision 2026-04-11):

| Attribute | Value |
|-----------|-------|
| Revenue | $600K&ndash;$1.5M |
| Trade | **Basement development, finishing, secondary suite conversion** (Calgary) |
| Avg project | $50&ndash;100K (legal suites: $80&ndash;120K) |
| Leads/month | 15&ndash;25 (inbound: Google, HomeStars, Facebook) |
| Team | Owner + 1&ndash;3 crew, NO dedicated office manager |
| Follow-up | No systematic process |
| Market | Calgary metro (Airdrie, Cochrane, Chestermere, Okotoks) |

---

## Confirmed Gaps (6+ of 8 agents agree)

### GAP-1: $0 Revenue / Invisible ROI (8/8 consensus — CRITICAL)

**The problem:** Contractors don't update lead statuses. Dashboard shows $0 confirmed revenue. Reports show $0. Monday pipeline SMS shows $0. Guarantee attribution fails. The system works but the evidence is invisible. This is the #1 churn driver — contractors cancel on false data.

**Root cause:** Revenue confirmation requires a manual portal action from the person least likely to perform it (contractor on a job site).

**Fix direction:**
- WON/LOST SMS commands with reference codes (not name matching)
- Auto-detect probable wins (appointment booked → 7-day silence → prompt contractor)
- Activity-enriched Monday SMS: "3 appointments booked ($105K est) | 12 leads responded" — never $0 when system is active
- Wire existing signals (Stripe payments, Jobber `job_completed` webhooks) directly to ROI model — stop needing manual status updates
- Reports lead with NAMES + OUTCOMES before pipeline numbers

**Status:** Resolved (2026-04-10). All core fixes shipped: (1) Activity-enriched Monday SMS with inquiries, estimates, appointments + pipeline + &quot;Reply WON&quot; CTA. (2) WON/LOST SMS commands with reference codes — contractors text WON 4A or LOST 4A to report outcomes. (3) WINS command lists recent leads with ref codes. (4) Auto-detect probable wins fires daily — appointment + 7-day silence triggers contractor prompt with ref code. (5) Report inline SMS summary with key numbers. Remaining: Jobber/Stripe webhook wire-up to ROI model (enhancement, not blocking).

---

### GAP-2: EST Trigger Goes Unused (8/8 consensus — HIGH)

**The problem:** The estimate follow-up sequence — the highest-value automation — requires a behavioral trigger (SMS keyword or portal click) that 60-75% of contractors won't form a habit around.

**Root cause:** The trigger mechanism doesn't match how contractors work. They send estimates from trucks via email, handshake, or paper — there's no natural moment to text a keyword.

**Fix direction:**
- Shorten fallback nudge from 48h to 24h
- Proactive SMS when lead is in `contacted` 3+ days with no EST: "Did you send [Name] a quote? Reply EST [Name] or PASS"
- Walk through EST live on the onboarding call
- Track zero-EST accounts at Day 14 — operator alert

**Status:** Resolved (2026-04-10). All fixes shipped: (1) Fallback nudge shortened from 48h to 24h. (2) Proactive quote SMS fires daily at 10am UTC — leads in `new`/`contacted` for 3+ days with no EST trigger get prompted: &quot;[Name] has been waiting 3 days. Reply EST [Name] or PASS.&quot; (3) EST walkthrough added to onboarding call script.

---

### GAP-3: Calendar Booking Conflicts (7/8 consensus — HIGH)

**The problem:** 60% of even the ideal ICP doesn't use Google Calendar in a way that prevents double-booking. 20% use paper/memory (RED). 40% can migrate but need help (YELLOW).

**Root cause:** Platform only supports Google Calendar OAuth. Dominant ICP calendar is phone calendar, paper, or memory.

**Fix direction:**
- Per-client "Booking Confirmation Required" toggle — AI collects preferred time, texts contractor "Estimate request: [Name], Tuesday 2pm. Reply YES or suggest another time," confirms to homeowner only after contractor approves
- Three onboarding paths: A (GCal ready), B (migrate to GCal on call), C (confirmation mode)

**Status:** Resolved (2026-04-10). Booking confirmation mode shipped: `bookingConfirmationRequired` per-client toggle. When enabled, AI collects preferred time, texts contractor for approval (YES/suggest new time), only confirms with homeowner after contractor approves. 2h reminder + 4h operator escalation on timeout. Calendar qualification in onboarding routes non-GCal clients to this mode.

---

### GAP-4: KB Thin at Wow Moment (7/8 consensus — HIGH)

**The problem:** The "call your own number" demo — the highest-leverage conversion event — occurs against an empty KB. AI deflects basic questions ("What do you charge?"). Wow moment is undercut.

**Root cause:** KB is populated AFTER the demo, not before.

**Fix direction:**
- Capture 3-5 KB facts during the SALES call (warranty, service area, specialties)
- Pre-populate before the onboarding "call your own number" demo
- Move kb-empty-nudge timeline to 6-24 hours (currently 48-72h)

**Status:** Resolved (2026-04-10). Process fix: KB pre-populated from sales call (3-5 facts captured before demo). Added to onboarding script in playbook Section 10.

---

### GAP-5: AI Tone Mismatch (6/8 consensus — HIGH)

**The problem:** Relationship-first and premium contractors will cancel over a single AI message that "doesn't sound like me." Current onboarding doesn't capture the contractor's voice.

**Root cause:** KB wizard captures WHAT they do, not HOW they talk.

**Fix direction:**
- Add one question to onboarding: "When a new customer texts you, what do you say back? Give me your exact words."
- Enter verbatim as a KB "voice sample" entry
- Configure tone setting (professional/friendly/casual) based on the sample

**Status:** Resolved (2026-04-10). Process fix: tone capture question added to onboarding script (&quot;When a new customer texts you, what do you say back?&quot;). Tone setting configured from the sample.

---

### GAP-6: Operator Capacity at Scale (6/8 consensus — HIGH)

**The problem:** At 15 clients, operator works ~28 hrs/week on delivery alone. 2-3 slow-responding contractors ("ghost" profiles) consume 35-40% of capacity. Daily checklist is unsustainable past 10 clients.

**Root cause:** No contractor responsiveness screening at sales. No tiering of service load.

**Fix direction:**
- Add responsiveness screening to qualification: "How quickly do you reply to texts during job hours?" — disqualify 48h+ responders
- Cap at 12 standard + 3 growth clients rather than 15 flat
- Reorganize daily checklist: 5 non-negotiable daily items via triage dashboard, 15 weekly items that rotate by day

**Status:** Resolved (2026-04-10). Responsiveness screening added to sales qualification. Bi-weekly strategy call (30 min/client) added as standard managed-service touchpoint &mdash; operator captures WON/LOST entries, resolves KB gaps, and checks team setup live on the call. This reduces 4 of 6 remaining yellow zones from 27-33% to 5-10%. Updated operator capacity: 18 hr/week at 15 clients (12.5 delivery + 5.6 strategy calls).

---

## Likely Real Gaps (4-5 of 8 agents)

| # | Gap | Consensus | Fix Type | Priority |
|---|-----|:---------:|----------|:--------:|
| 7 | Call forwarding verification (no way to confirm it works) | 5/8 | Process (test call on onboarding) | Medium |
| 8 | Attribution honesty ("Revenue Recovered" shows estimated, not confirmed) | 5/8 | Platform (report restructure) | Medium |
| 9 | Old quote collection fails on call (50-75% can&apos;t produce list) | 5/8 | **Partially resolved (2026-04-10):** Day 2-3 Quote Import Call added as standard onboarding step in playbook Section 10 | Medium |
| 10 | Smart Assist engagement invisible (0 draft reviews in Week 2) | 4/8 | Platform (review-rate tracking) | Low |
| 11 | Report not consumed by low-tech contractors (email goes unread) | 4/8 | **Partially resolved (2026-04-10):** bi-weekly report follow-up SMS now includes inline stats (leads responded, estimates followed up, appointments booked) | Low |

---

## New Gaps Surfaced by Consensus (not in original simulation)

| Gap | Surfaced by | Fix |
|-----|------------|-----|
| **Guarantee milestone SMS** — celebrate 30-day proof passing with a text | Agents 2, 3 | **Resolved (2026-04-10)** |
| **Autonomous mode activation notification** + PAUSE/RESUME commands | Agents 2, 3 | **Resolved (2026-04-10)**: SMS fires on autonomous promotion. PAUSE/RESUME commands added to incoming SMS. |
| **"Moment trigger" notification** — real-time SMS when dead lead re-engages | Agent 7 | Not yet implemented. Deferred post-launch. |
| **Day 45 proactive retention call** — standard procedure, not reactive | Agents 2, 4, 7 | **Resolved (2026-04-10)**: Added to playbook. |
| **Contractor responsiveness screening** at sales qualification | Agents 2, 4 | **Resolved (2026-04-10)**: Added to onboarding script. |
| **Notification fatigue** — hourly digest instead of per-message for high-volume | Agents 1, 2, 4 | Not yet implemented. Deferred post-launch. |

---

## Must-Verify Before First Client

| Item | Flagged by | Status |
|------|-----------|--------|
| "Still thinking" reply kills estimate sequence | Agents 5, 6, 8 | **Verified (2026-04-10)**: Already handled correctly. Sequence pauses on reply, AI takes over. Win-back extends clock 45 days for &quot;still thinking.&quot; No bug. |
| Message limit silent failure | Agent 8 | **Verified (2026-04-10)**: Professional plan = truly unlimited (`isUnlimitedMessaging = true`, `messageLimit = null`). No contractual breach. |

---

## Execution Status (2026-04-10)

All consensus-identified gaps have been resolved or deferred with rationale.

### Shipped — Platform

| Fix | Status |
|-----|--------|
| WON/LOST/WINS SMS commands with reference codes | Shipped (pending db:push for migration) |
| Auto-detect probable wins (daily cron, 7-day silence) | Shipped |
| Activity-enriched Monday SMS | Shipped |
| Report inline SMS summary | Shipped |
| EST fallback nudge → 24h | Shipped |
| Proactive quote SMS at 3 days | Shipped |
| Autonomous mode notification + PAUSE/RESUME | Shipped |
| Booking confirmation mode for non-GCal | Shipped (pending db:push for migration) |
| Outcome parser tests (17 tests) | Shipped |

### Shipped — Process / Docs

| Fix | Status |
|-----|--------|
| Day 2-3 Quote Import Call | Added to playbook Section 10 |
| KB pre-population from sales call | Added to onboarding script |
| Tone capture question | Added to onboarding script |
| Calendar qualification (3 paths) | Added to onboarding script |
| Team member identification | Added to onboarding script |
| Call forwarding verification | Added to onboarding script |
| EST live walkthrough | Added to onboarding script |
| Responsiveness screening | Added to sales qualification |
| Day 45 proactive retention call | Added to playbook |
| CS + Your Tool positioning doc | Created at `docs/operations/templates/CS-PLUS-YOUR-TOOL.md` |

### Deferred (post-launch)

| Fix | Reason |
|-----|--------|
| &quot;Moment trigger&quot; notification (dead lead re-engages) | Nice-to-have. Won&apos;t block first 15 clients. |
| Notification digest mode (hourly batch for high-volume) | Nice-to-have. Only matters at 25+ leads/month. |
| Smart Assist engagement tracking (review-rate metric) | Nice-to-have. Operator can monitor manually for first 15. |

### Pending Migrations

Two schema changes need `db:push` before going live:
1. `drizzle/0011_violet_callisto.sql` — `outcome_ref_code` column + unique constraint on leads
2. `drizzle/0012_supreme_loa.sql` — `booking_confirmation_required` on clients + appointment status width

---

## Key Insight (universal across all 8 agents)

> **The platform works. The evidence is invisible. Fix the evidence and you fix retention.**
