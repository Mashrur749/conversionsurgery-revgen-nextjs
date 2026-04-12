# Touchpoint Map — Service Delivery Timeline

Every step in the contractor's journey from signup to Month 6+. Each touchpoint lists what happens, who acts, what the touchpoint assumes about the client, and what can go wrong.

**Important:** Always re-read the source docs before using this map. The offer and playbook evolve — this map is a starting point, not a substitute.

---

## Dependency Graph

Which touchpoints degrade when upstream ones fail. Use with `cascade-chains.md` for the full chain logic.

| Touchpoint | Depends On | Degrades (if this fails) |
|-----------|-----------|--------------------------|
| T4: Call Forwarding | T3 (phone provisioned) | T5, T6, T22 |
| T5: Wow Moment | T4 (forwarding works) | — (terminal impression) |
| T6: Voice AI Demo | T4 (forwarding), T10 (KB) | — (terminal impression) |
| T10: KB Setup | — | T6, T19, T20, T27, T32 |
| T11: FSM Integration | — | T21, T23, T24, T32 |
| T14: Quote Reactivation | T9 (old quotes collected) | T16, T17 (no data to show) |
| T16: Day 3-4 Check-in | T14 (some activity happened) | T17 (nothing to discuss) |
| T17: Day 7 Call | T14, T16 (data exists) | — |
| T18: Smart Assist | T10 (KB quality) | T19, T20 |
| T19: KB Gap Sprint | T18 (enough conversations) | T20 (KB stays thin) |
| T20: Autonomous Mode | T10, T19 (KB coverage) | T27 (escalation frequency) |
| T21: Estimate Follow-up | T11 (FSM integration) | T29, T31 (pipeline data) |
| T22: Calendar Sync | T4 (phone setup), profile calendar type | — |
| T25: Bi-Weekly Report | Lead volume, T21 usage | T29, T31 (perceived value) |
| T26: Pipeline SMS | T21 usage (pipeline has data) | T29, T31 (perceived value) |
| T29: 30-Day Guarantee | Lead volume, T14, T21 usage | — (terminal evaluation) |
| T31: 90-Day Guarantee | T29, T21, T25 (sustained value) | — (terminal evaluation) |
| T32: Health Check | All upstream data quality | — (operator meta-assessment) |

**Reading this table:** If T10 (KB Setup) scores yellow or red, check the "Degrades" column — T6, T19, T20, T27, T32 all shift toward yellow/red. See `cascade-chains.md` for the specific penalty rules.

---

## Operator Time Budget Per Touchpoint

Used by Portfolio Simulation to compute total operator load.

| Touchpoint | Base Time | Friction Overhead (yellow) | Friction Overhead (red) |
|-----------|:---------:|:--------------------------:|:----------------------:|
| T0: Pre-Sale Audit | 20 min (one-time) | +10 min (thin online presence) | +20 min (no GBP, manual research) |
| T1: Sales Call | 30 min (one-time) | +10 min (objection handling) | +15 min (major pivot needed) |
| T3-T12: Onboarding | 45 min (one-time) | +15 min (workarounds) | +30 min (major setup issues) |
| T13: Post-Call Setup | 30 min (one-time) | +15 min (thin KB, extra config) | +30 min (rebuild from scratch) |
| T15: Revenue Leak Audit | 30 min (one-time) | +15 min (thin data) | N/A |
| T17: Day 7 Call | 15 min (one-time) | +10 min (no data, reassurance) | +20 min (crisis management) |
| T18: Smart Assist Review | 30 min/week (Wk 2-3) | +15 min/week (frequent edits) | N/A (no conversations) |
| T19: KB Gap Sprint | 20 min/week (Wk 2-3) | +10 min/week (many gaps) | N/A |
| T27: Escalation Handling | 15 min/week (ongoing) | +15 min/week (frequent escalations) | +30 min/week (thin KB, high volume) |
| T25: Report Review | 10 min/2 weeks (ongoing) | +5 min (manual annotation) | N/A |
| T32: Monthly Health Check | 15 min/month (ongoing) | +10 min (multiple flags) | +20 min (intervention needed) |

**Steady-state per client (autonomous, green):** ~45-60 min/week
**Steady-state per client (yellow-heavy):** ~75-90 min/week
**Steady-state per client (red-heavy):** ~120+ min/week

---

## Pre-Sale

### T0: Pre-Sale Revenue Leak Audit
- **When:** Before the sales call
- **Who acts:** Operator
- **What happens:** 15-20 min research using public data (GBP, website, competitors)
- **Assumes:** Contractor has a Google Business Profile and a website
- **Watch for:** No GBP, no website, no online presence at all

### T1: Sales Call
- **When:** First contact
- **Who acts:** Operator + contractor
- **What happens:** Pain discovery, demo (call-your-number), ROI calculator, objection handling
- **Assumes:** Contractor has a smartphone, can receive texts, has lead volume to discuss
- **Watch for:** Referral-only contractor (speed-to-lead pitch falls flat), contractor who doesn't text, contractor with a receptionist (missed-call pitch irrelevant)

### T2: Payment Capture
- **When:** During or after sales call
- **Who acts:** Contractor (enters card via Stripe link)
- **What happens:** Stripe Checkout with 30-day trial, card on file
- **Assumes:** Contractor has a credit/debit card, is comfortable entering it on a phone link
- **Watch for:** Low-tech contractor uncomfortable with online payment, contractor who wants to "think about it"

---

## Day 1: Onboarding

### T3: Phone Number Provisioning
- **When:** Day 0-1
- **Who acts:** Operator (system)
- **What happens:** Local Alberta number assigned
- **Assumes:** Contractor wants a separate business number
- **Watch for:** Contractor who insists on using only their personal number, Google Voice users (can't forward)

### T4: Call Forwarding Setup
- **When:** During onboarding call (minute 3-8)
- **Who acts:** Operator walks contractor through it
- **What happens:** Conditional call forwarding from contractor's phone to Twilio
- **Assumes:** Contractor has a cell phone that supports *61 codes, carrier voicemail can be disabled
- **Watch for:** VoIP/PBX users (need admin portal access), Google Voice (can't forward), landline (different codes), carrier that doesn't support conditional forwarding, voicemail competing with forwarding

### T5: "Call Your Own Number" Wow Moment
- **When:** Minute 3-8 of onboarding call
- **Who acts:** Contractor calls their own number
- **What happens:** Phone rings, no answer, Voice AI picks up + text-back fires
- **Assumes:** Contractor has a second phone to call from (or spouse's phone), call forwarding works
- **Watch for:** Solo operator with one phone and nobody nearby, forwarding setup failed silently

### T6: Voice AI Demo
- **When:** Minute 5-8, second call
- **Who acts:** Contractor stays on the line
- **What happens:** Hears Voice AI qualify a lead, book an estimate
- **Assumes:** KB has enough info to answer basic questions, Voice AI is configured
- **Watch for:** AI can't answer industry-specific questions yet (KB is empty at this point)

### T7: Payment Capture (if not done on sales call)
- **When:** Minute 8-12
- **Who acts:** Operator sends Stripe link, contractor enters card
- **Assumes:** Same as T2
- **Watch for:** Same as T2

### T8: Exclusion List Collection
- **When:** Minute 12-13
- **Who acts:** Operator asks, contractor lists names
- **What happens:** Family/friends added to skip list
- **Assumes:** Contractor can think of people to exclude on the spot
- **Watch for:** Contractor who doesn't mention exclusions but later gets angry when AI texts their spouse

### T9: Old Quote Collection
- **When:** Minute 13-15
- **Who acts:** Operator extracts list from contractor
- **What happens:** Contractor scrolls phone contacts or Jobber, reads off names
- **Assumes:** Contractor has dead quotes to reactivate, can access them during the call
- **Watch for:** Contractor with zero dead quotes (new business), contractor whose quotes are in paper files they can't access on the call, contractor who says "I'll send them later" (they won't)

### T10: Knowledge Base Setup
- **When:** Minute 15-25
- **Who acts:** Operator interviews contractor
- **What happens:** Services, pricing approach, warranty, differentiators, what they don't do
- **Assumes:** Contractor can articulate their business, has clear pricing approach
- **Watch for:** Contractor who can't explain their own pricing, contractor who says "it depends" to everything, trades with highly variable scope (custom builders)

### T11: Jobber/FSM Integration (Optional)
- **When:** Minute 25, if applicable
- **Who acts:** Operator configures webhook
- **What happens:** CS ↔ Jobber webhook setup
- **Assumes:** Contractor uses Jobber specifically (only current integration)
- **Watch for:** Housecall Pro, ServiceTitan, Buildertrend users — no integration available, creates expectation gap

### T12: Expectations Setting + Day 7 Booking
- **When:** Minute 25-30
- **Who acts:** Operator explains timeline
- **What happens:** Week-by-week explanation, Day 7 check-in booked
- **Assumes:** Contractor understands the 3-week ramp
- **Watch for:** Contractor who expects "full AI" on Day 1, contractor who won't commit to Day 7 call

### T13: Post-Call Setup (Operator, same day)
- **When:** Within hours after call
- **Who acts:** Operator
- **What happens:** KB completion, tone config, business hours, Voice AI QA, outbound quote reactivation fired, test call verification, Stripe verification, recap SMS sent
- **Assumes:** Operator has 30 min post-call to complete, enough KB from the call
- **Watch for:** Thin KB from a contractor who answered with "it depends" to everything

---

## Week 1

### T14: Quote Reactivation Outbound
- **When:** Day 0-1, fired same day as onboarding
- **Who acts:** System (automated)
- **What happens:** Old quotes get reactivation messages
- **Assumes:** Old quotes were collected (T9), phone numbers are valid
- **Watch for:** Zero old quotes collected, stale numbers, contractor who promised to send list later

### T15: Revenue Leak Audit Delivery
- **When:** Within 48 business hours
- **Who acts:** Operator
- **What happens:** Personalized audit delivered via email
- **Assumes:** Contractor has a GBP, website, competitors in their area
- **Watch for:** Contractor with no online presence = thin audit, contractor who doesn't read email

### T16: Day 3-4 Check-in SMS
- **When:** Day 3-4
- **Who acts:** Operator
- **What happens:** Status update text with lead count
- **Assumes:** Some leads have come in, system has activity to report
- **Watch for:** Zero inbound activity (contractor has no lead flow), creates "is anything happening?" if no activity

### T17: Day 7 Check-in Call
- **When:** Day 7
- **Who acts:** Operator + contractor
- **What happens:** 10-min review of Week 1 activity, tune AI, discuss progressive phone strategy
- **Assumes:** Contractor shows up for the call, there's data to review
- **Watch for:** Contractor no-shows (common — they're busy), zero activity to review

---

## Week 2: Smart Assist

### T18: Smart Assist Mode Active
- **When:** Day 7-14
- **Who acts:** System + Operator reviews drafts
- **What happens:** AI drafts responses, operator reviews via SMS or dashboard, auto-sends after 5 min if not edited
- **Assumes:** Operator is monitoring SMS notifications 3x/day, operator can review drafts within 5 min
- **Watch for:** Operator overwhelmed with multiple clients in Smart Assist simultaneously, time zone issues

### T19: KB Gap Sprint
- **When:** During Week 2
- **Who acts:** Operator
- **What happens:** Every AI deferral becomes a new KB entry, gaps tracked automatically
- **Assumes:** There are enough conversations to surface gaps
- **Watch for:** Low-volume client = few conversations = few gaps surfaced = thin KB entering autonomous mode

---

## Week 3+: Autonomous

### T20: Autonomous Mode Activation
- **When:** After ~30 reviewed interactions, 90%+ KB coverage
- **Who acts:** Operator toggles
- **What happens:** AI responds without review, operator monitors quality post-hoc
- **Assumes:** KB is production-quality, safety tests pass
- **Watch for:** Premature switch (KB too thin), client who was never told this would happen

### T21: Estimate Follow-up Triggers
- **When:** Ongoing, whenever contractor sends an estimate
- **Who acts:** Contractor triggers via SMS keyword, notification reply, or dashboard
- **What happens:** 4-touch follow-up sequence over 14 days
- **Assumes:** Contractor remembers to trigger it, understands the SMS command
- **Watch for:** Contractor who never triggers (highest-value automation goes unused), low-tech contractor who doesn't understand SMS keywords, office manager triggers vs. owner triggers (who gets the notification?)

### T22: Appointment Booking + Calendar Sync
- **When:** Ongoing
- **Who acts:** AI books, syncs to Google Calendar
- **What happens:** AI books estimate appointments into contractor's calendar, checks availability
- **Assumes:** Google Calendar is connected, contractor uses it, calendar reflects real availability
- **Watch for:** Team members' calendars not synced (double booking), contractor uses Outlook/paper (no sync), contractor who blocks personal time on a different calendar, FSM calendar is the real source of truth (not Google)

### T23: Payment Collection
- **When:** After job completion
- **Who acts:** System sends reminders
- **What happens:** Deposit and invoice reminders with payment links
- **Assumes:** Contractor marks jobs as invoiced, uses the payment flow
- **Watch for:** Contractor who invoices through Jobber/QuickBooks (duplicate reminders), contractor who doesn't use the system for payments at all

### T24: Review Generation
- **When:** After job completion
- **Who acts:** System sends review request
- **What happens:** Automated request with direct Google link
- **Assumes:** Contractor marks jobs as complete, lead has a valid phone number
- **Watch for:** Contractor who completes jobs but never marks them done in the system, Jobber integration triggers this (good) but non-Jobber clients rely on manual status change

---

## Ongoing Operations

### T25: Bi-Weekly Report
- **When:** Every 2 weeks
- **Who acts:** System generates, operator reviews, auto-delivery
- **What happens:** Performance report with leads, response times, pipeline, Leads at Risk
- **Assumes:** There's enough activity to report, contractor reads it
- **Watch for:** Thin reports (low volume client), contractor who never reads reports (retention touchpoint lost), email goes to spam

### T26: Weekly Pipeline SMS
- **When:** Every Monday
- **Who acts:** System
- **What happens:** Text with pipeline dollar values
- **Assumes:** Pipeline has data, contractor receives and reads SMS
- **Watch for:** $0 pipeline (no estimates tracked), contractor who sees $0 and loses faith

### T27: Escalation Handling
- **When:** As needed
- **Who acts:** Operator handles or routes to contractor
- **What happens:** AI escalates complex/sensitive conversations, operator resolves
- **Assumes:** Operator checks escalation queue daily, contractor responds to operator texts
- **Watch for:** Contractor who takes days to respond to operator questions, escalation that requires contractor-specific knowledge the operator doesn't have

### T28: Dormant Lead Reactivation
- **When:** 180+ day dormant leads, Wednesday cron
- **Who acts:** System (automated)
- **What happens:** Single re-engagement message to long-dormant leads
- **Assumes:** There are leads old enough to qualify
- **Watch for:** New client with no history = no dormant leads to reactivate

---

## Quarterly + Guarantee

### T29: 30-Day Guarantee Evaluation
- **When:** Day 30
- **Who acts:** System flags, operator reviews
- **What happens:** Check for 5+ qualified lead engagements
- **Assumes:** Minimum 15 leads/month; if below, guarantee window extends
- **Watch for:** Low-volume client hitting extended window, contractor who had zero inbound (marketing problem, not system problem)

### T30: Quarterly Growth Blitz
- **When:** Every 90 days
- **Who acts:** Operator launches, system executes
- **What happens:** Targeted campaign (reactivation, review sprint, pipeline builder, strategy review)
- **Assumes:** There's data/contacts to campaign against, contractor approves campaign
- **Watch for:** Q1 reactivation with no customer list (never collected), Q2 review sprint with few completed jobs to request reviews from, seasonal contractor paused during their Q3

### T31: 90-Day Guarantee Evaluation
- **When:** Day 90
- **Who acts:** System flags, operator reviews
- **What happens:** Check for 1 attributed result OR $5K probable pipeline
- **Assumes:** System had enough volume and time to demonstrate value
- **Watch for:** Low-volume extension scenarios, contractor who marks nothing as "won" (pipeline shows $0 despite real results)

### T32: Monthly Health Check
- **When:** First of every month
- **Who acts:** Operator
- **What happens:** Review 7 metrics per client (response time, engagement rate, escalation frequency, KB gaps, win rate, guarantee status, churn signals)
- **Assumes:** Operator has capacity to review every client monthly
- **Watch for:** Operator capacity at 8+ clients (120+ min/month just on health checks)
