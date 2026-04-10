# Stochastic Multi-Agent Consensus Report — Full Platform Gap Audit

**Problem**: From the ICP (home service contractor) perspective, find real-world workflow gaps across ALL 18 service delivery domains.
**Agents**: 10 (neutral, risk-averse, growth, contrarian, first-principles, user-empathy, resource-constrained, long-term, data-driven, systems-thinker)
**Date**: 2026-04-09
**Scope**: 18 domains × 10 agents = ~150 unique gap findings, aggregated below

---

## TIER 1 — LAUNCH BLOCKERS (8+ agents agree, HIGH impact)

These are gaps that will cause visible failures for the first real client. Fix before any contractor goes live.

### LB-01: No Appointment List in Client Portal (10/10 — previous round)
Appointments table is populated but no portal page exists. Contractor cannot see their schedule.
**Fix:** Add `/client/appointments` page (read from existing `appointments` table).

### LB-02: Crew Not Assigned/Notified at Booking (10/10 — previous round)
`calendar_events.assignedTeamMemberId` exists but is never populated. Owner gets the calendar event; estimator who visits sites gets nothing.
**Fix:** SMS dispatch to assigned crew member with address + lead info at booking time.

### LB-03: Timezone Hardcoded Wrong (9/10 — previous round)
`calendar_events` defaults `America/Denver`, `clients` defaults `America/Edmonton`. Slot generation, reminder scheduling, no-show detection, campaign scheduling, hot-transfer routing ALL use timezone and get it wrong for non-Mountain clients.
**Fix:** Make `clients.timezone` the single source of truth, require during onboarding, thread through all time-sensitive code.

### LB-04: Estimate Follow-Up Sequences Survive Won/Lost Status (9/10)
When contractor marks lead `won` or `lost`, active estimate follow-up scheduled messages are NOT cancelled. Homeowner who already hired the contractor gets "still thinking about your estimate?" on day 10.
**Fix:** Cancel all pending `scheduledMessages` for a lead whenever status changes to `won`, `lost`, or `completed`.

### LB-05: Win-Back Fires on Leads with Active Sequences (8/10)
Win-back (25-35 day) query doesn't check for existing unsent scheduled messages. Lead can receive both an estimate follow-up AND a win-back in the same day.
**Fix:** Exclude leads with any unsent, uncancelled scheduled messages from win-back eligibility.

### LB-06: Voice AI Callback Requests Never Actioned (8/10)
`voice_calls.callbackRequested = true` is stored but no cron or notification reads it. Homeowner expects a morning callback that never comes.
**Fix:** Daily cron that alerts contractor when callbacks are due.

### LB-07: Business Hours Not Gated Before AI Activation (8/10)
Onboarding quality gate doesn't check if `businessHours` table has any entries. When AI activates with no business hours, `getAvailableSlots()` returns empty — every booking attempt fails silently.
**Fix:** Add `business_hours_configured` as a critical onboarding quality gate.

### LB-08: Quiet Hours Falls Back to UTC on Timezone Failure (8/10)
If client timezone resolution fails, compliance gateway falls back to UTC. A client in Pacific time (UTC-8) gets quiet hours inverted — messages sent at 2am, blocked at noon. TCPA/CRTC violation.
**Fix:** Default to most restrictive window on failure, never to UTC.

### LB-09: Reply-on-Lead Cancels ALL Sequences Indiscriminately (8/10)
`incoming-sms.ts` line 295: any inbound reply cancels every unsent scheduled message for that lead — including payment reminders and estimate follow-ups. A homeowner texting "thanks, still thinking" kills their entire nurture sequence.
**Fix:** Scope cancellation by sequence type. Only cancel the active sequence, not all sequences. Payment reminders should only cancel on Stripe payment confirmation.

### LB-10: Voice AI Hot-Transfer Timezone Hardcoded (8/10)
`routeHighIntentLead()` hardcodes `timezone: 'America/Edmonton'`. An Atlanta contractor's 4:30pm call (within business hours) is evaluated as 6:30pm Mountain (outside hours), routing to SMS escalation instead of ring group.
**Fix:** Read `client.timezone` from DB.

---

## TIER 2 — PRE-LAUNCH (6-7 agents agree, HIGH/MEDIUM impact)

Fix these in the first sprint after launch blockers are resolved.

### PL-01: No Job Completion Lifecycle Loop (8/10 — previous round)
After `won`, there's no way to mark "job complete" that triggers review request at the right moment and captures final revenue.
**Fix:** "Mark Job Complete" action in portal → sets `completed`, triggers review request.

### PL-02: No-Show Recovery Fires Without Contractor Verification (6/10 — previous round)
`processNoShows()` sends recovery SMS to homeowner without checking if contractor's crew was the one who missed.
**Fix:** SMS confirmation to contractor before firing homeowner recovery.

### PL-03: Address Not Captured at Booking Time (7/10)
`appointments.address` is nullable and the AI booking flow never prompts for it. Crew shows up with no address.
**Fix:** AI booking flow prompts "What's the address for the estimate?" before confirming.

### PL-04: Review Request Fires on Frustrated/Escalated Homeowners (7/10)
No sentiment gate before scheduling review request. A homeowner who texted "very unhappy with the work" still gets a Google review request.
**Fix:** Check lead sentiment signals and escalation history before firing review request.

### PL-05: No "Mark Paid (Cash/Check)" in Client Portal (7/10)
`markInvoicePaid` only reachable via Stripe webhook or admin API. Contractors who collect cash/check can't stop payment reminders.
**Fix:** Add portal-accessible "Mark Paid" action on invoice cards.

### PL-06: "Without Us" ROI Model Uses Wrong Per-Client Baselines (7/10)
`averageProjectValue` and `previousResponseTimeMinutes` use agency-wide defaults. A plumber ($800 avg job) gets the same model as a roofer ($15K avg).
**Fix:** Require `averageJobValueCents` and `previousResponseTimeMinutes` during onboarding.

### PL-07: `won` Status Never Fires `job_won` Funnel Event (7/10)
Portal status update to `won` doesn't call `trackFunnelEvent('job_won')`. AI attribution, effectiveness dashboard, and guarantee monitor are all systematically understated.
**Fix:** Add `trackFunnelEvent('job_won')` to both portal and admin status update routes.

### PL-08: No Platform-Level DNC (Cross-Client Opt-Out) (7/10)
Opt-outs are per-client. A homeowner who STOPs one contractor can be texted by another contractor on the same platform.
**Fix:** Platform-level DNC table checked before per-client logic.

### PL-09: Onboarding Quality Gate Doesn't Block AI on Empty KB (7/10)
Client with 0 KB entries activates AI. Every AI response hits knowledge boundary guardrail, escalates. Cascade: high escalation rate → contractor ignores escalations → leads go cold → bad reports.
**Fix:** Make KB completeness a hard block for AI activation.

### PL-10: Voice AI Overflow Mode Not Implemented (7/10)
`overflow` is selectable in UI but the voice webhook never reads the field. Setting it does nothing — same behavior as no AI.
**Fix:** Implement the overflow dial-then-fallback-to-AI path in the voice webhook.

### PL-11: Soft Rejection Detection Missing (7/10)
"I went with someone else" / "not interested" doesn't trigger opt-out or status change. AI fires win-back 25 days later.
**Fix:** Detect soft rejection signals and auto-transition to `lost`, cancelling sequences.

### PL-12: Escalation Re-Notification Insufficient (7/10)
Only one re-notify after 15 minutes. Field crews on job sites can't respond for 90+ minutes. Hot lead goes cold with no further alerts.
**Fix:** Allow 3 re-notifications (15, 30, 60 min) before marking exhausted.

### PL-13: Referral Request Fires After Negative Review (6/10)
Review request (day 1) and referral request (day 4) are separate scheduled messages. If homeowner leaves a 1-2 star review, referral still fires.
**Fix:** Check most recent review rating before sending referral; cancel if <= 3 stars.

### PL-14: Campaign Scheduling Uses UTC 10am, Not Client Local (6/10)
`getDefaultScheduledAtForQuarter()` uses `setUTCHours(10)`. A Vancouver contractor's campaign launches at 3am local.
**Fix:** Use client timezone for campaign scheduling.

---

## TIER 3 — POST-LAUNCH / BACKLOG (4-5 agents agree, or MEDIUM impact)

### BL-01: No Deposit/Milestone Payment Split
The payment system only creates one invoice per sequence. $12K jobs need 30% deposit + 70% final. `payments.type` already has `deposit|progress|final` but it's never used.

### BL-02: Estimate Follow-Up Uses Static Templates (No AI Personalization)
Win-back and no-show use AI-generated messages; estimate follow-up (the highest-volume automation) uses static `renderTemplate()` with no project type or amount reference.

### BL-03: No Post-Appointment Quote Capture via SMS
After appointment time passes, no prompt to contractor to log the outcome. Jobs don't get marked, review requests don't fire, reports show $0.

### BL-04: Booking Window Fixed at 7 Days
Contractors booked 3 weeks out can't offer further slots. No configurable `bookingLeadTimeDays` or extended window.

### BL-05: No MMS/Photo-Aware AI Responses
Homeowners send photos of damage. AI receives the media but can't reason about it. Responds with generic "tell me more."

### BL-06: Appointments and Calendar Events Are Parallel Tables
No FK between `appointments` and `calendar_events`. Reschedule in Google Calendar doesn't update `appointments`. Divergent state accumulates.

### BL-07: No Returning Customer Recognition
A homeowner who used the contractor 8 months ago is treated as a brand-new lead. No "welcome back" context.

### BL-08: No Morning-Of Appointment Confirmation
No proactive "are you still on for 2pm today?" SMS. Would prevent 60-70% of no-shows (prevention vs. recovery).

### BL-09: Slot Capacity Not Modeled (Multi-Crew)
System assumes 1 appointment per time slot. Multi-crew contractors get artificially blocked.

### BL-10: Decision Node Always Uses Haiku
`analyzeAndDecide` hardcodes `model: 'fast'` regardless of lead value. $40K lead gets escalation decision from cheapest model.

### BL-11: No Lead Source Revenue Breakdown in Reports
`leads.source` exists but reports don't break down revenue by source. Contractors can't evaluate which acquisition channel is worth investing in.

### BL-12: Stripe Payment Link Expiry Not Handled
Checkout links may expire. No re-issue mechanism. Homeowner clicks expired link, gets error, gives up.

### BL-13: No Callback Scheduling from Escalation Queue
Missed hot transfer has no "schedule callback" action. Contractor can't commit to calling back at a specific time.

### BL-14: Win-Back Message Ignores Open Objections
AI win-back uses generic re-engagement prompt even when conversation history shows an unresolved price objection.

### BL-15: No Contractor Portal Walkthrough on First Login
No tooltip sequence, no "start here" prompt. First-impression confusion is the #1 SaaS churn driver.

### BL-16: Voice AI Has No SMS Conversation Memory
Voice AI answers a call with no context from prior SMS conversation. Homeowner repeats everything.

### BL-17: Invoice Dual Amount Model (Dollars vs Cents)
`amount` (numeric, dollars) coexists with `totalAmount/paidAmount/remainingAmount` (integer, cents). No constraint forcing one. Financial data integrity risk.

### BL-18: No Voice AI Emergency Escalation Path
After-hours emergency calls (burst pipe, no heat) get standard AI handling. No immediate transfer to owner's cell.

### BL-19: Compliance Cache Not Invalidated on Opt-Out
`compliance_check_cache` can serve stale `isOptedOut = false` after STOP. Window for TCPA violation.

### BL-20: `completed` Without `won` Loses Revenue Data
Contractor skips `won` → goes directly to `completed`. `confirmedRevenue` never captured. Reports show $0.

---

## OUTLIER IDEAS (1-3 agents, high-creativity)

### OUT-01: Day-Of Homeowner Prep Sequence (Contrarian)
Instead of crew dispatch, send the homeowner a "day-of" SMS: who's coming, arrival window, what to prepare. Reduces owner's phone burden more than dispatch tools. **Zero schema changes — template content update only.**

### OUT-02: Review Count Milestone Celebrations (Growth)
At 10/25/50/100 reviews, send contractor a celebratory SMS: "You just hit 25 Google reviews — most competitors have fewer than 10." Creates shareable moments and word-of-mouth.

### OUT-03: Competitor Review Benchmarking (Growth)
Track competitor Google review counts via Places API. Report says "You now have more reviews than 2 of your 3 top competitors." Creates retention urgency.

### OUT-04: "Biggest Opportunity This Week" in Digest (Growth)
Add one line to weekly digest: "Your highest-value estimate: $18K bathroom reno for Sarah M — quoted 11 days ago, no response. Worth a personal call."

### OUT-05: Voice AI Consent Disclosure (Compliance-forward)
Mandatory AI + recording disclosure in voice greeting. Not optional post-2026 from a regulatory standpoint.

### OUT-06: KB Answer Quality Scoring (Growth)
Track which KB entries consistently lead to follow-up questions or escalations. Surface low-quality entries for operator improvement.

### OUT-07: CASL Consent Expiry Dashboard (Risk-averse)
Surface which leads are approaching 6-month consent expiry. Operator can prompt re-consent before messages start getting silently blocked.

### OUT-08: Facebook Lead Ad Integration (Growth)
Webhook from Facebook Lead Ads → platform. Captures the largest untapped advertising channel for home service contractors.

---

## CROSS-DOMAIN CASCADE CHAINS (Systems Thinker findings)

The following gaps have 3+ domain cascade effects:

| Root Gap | Cascade | Depth |
|----------|---------|-------|
| Empty KB activates AI | KB → AI quality → Escalation rate → Lead conversion → Reports → Engagement health | 6 |
| `won` never fires funnel event | Portal → Attribution → AI Effectiveness → Reports → Guarantee | 5 |
| Reply cancels all sequences | Lead Capture → Estimate Follow-Up → Payment → Win-Back | 4 |
| Timezone hardcoded | Booking → Reminders → No-Show → Voice → Campaigns → Compliance | 6 |
| No job completion loop | Portal → Reviews → Reports → Digest → Engagement health | 5 |

---

## PRIORITY MATRIX

### Fix This Week (launch blockers — cannot ship without these)
| ID | Gap | Effort | Impact |
|----|-----|--------|--------|
| LB-04 | Sequences survive won/lost | 30 min | Revenue trust |
| LB-05 | Win-back fires on active sequences | 1 hr | Double-messaging |
| LB-09 | Reply cancels ALL sequences | 2 hrs | Estimate follow-up coverage |
| LB-03 | Timezone hardcoded | 1 day | Every non-Mountain client |
| LB-10 | Voice hot-transfer timezone | 1 hr | Voice routing broken |
| LB-08 | Quiet hours UTC fallback | 2 hrs | TCPA/CRTC compliance |
| LB-07 | Business hours not gated | 2 hrs | Booking always fails |
| LB-01 | No appointment list | 1-2 days | Core portal UX |
| LB-02 | Crew not notified | 1 day | Booking value prop |
| LB-06 | Voice callbacks not actioned | 4 hrs | Voice AI trust |

### Fix Next Sprint (pre-launch quality)
| ID | Gap | Effort |
|----|-----|--------|
| PL-01 | Job completion loop | 1 day |
| PL-03 | Address at booking | 4 hrs |
| PL-04 | Review sentiment gate | 4 hrs |
| PL-05 | Mark Paid (cash) | 4 hrs |
| PL-06 | Per-client ROI baselines | 1 day |
| PL-07 | `won` funnel event | 2 hrs |
| PL-08 | Platform DNC | 1 day |
| PL-09 | KB activation gate | 4 hrs |
| PL-10 | Voice overflow mode | 1 day |
| PL-11 | Soft rejection detection | 4 hrs |
| PL-12 | Escalation re-notify | 4 hrs |
| PL-13 | Referral after neg review | 2 hrs |
| PL-14 | Campaign timezone | 2 hrs |

---

## AGENT FRAMING CONTRIBUTIONS

| Agent | Framing | Unique High-Value Finding |
|-------|---------|--------------------------|
| 1 — Neutral | Balanced full-domain | Booking address capture; AI response while estimate sequence active |
| 2 — Risk-averse | Churn/trust focus | Quiet-hours missed-call promise broken; Smart Assist draft silently discarded |
| 3 — Growth | 10x value | MMS photo AI; competitor review benchmarking; milestone celebrations |
| 4 — Contrarian | Challenge assumptions | Day-of homeowner prep > crew dispatch; static templates are the biggest quality gap |
| 5 — First principles | Lead-to-money pipeline | Post-appointment SMS quote capture; deposit collection timing |
| 6 — User empathy | Both perspectives | Booking confirmation lacks crew details; conversation message type badges |
| 7 — Resource constrained | Solo founder lens | Voice overflow mode is a no-op; Mark Paid (cash) is critical |
| 8 — Long-term | Architecture debt | Invoice dual-amount model; compliance cache invalidation; appointments/calendar_events FK |
| 9 — Data-driven | Industry metrics | Lead source revenue breakdown; 78% first-responder rule applied to MMS |
| 10 — Systems thinker | Cascade chains | `won` funnel event cascade; empty KB cascade (6 domains deep) |
