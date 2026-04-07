# Alberta Contractor Research — Platform & GTM Implications

Source: `conversionurgery_research.docx` (March 2026)
Research base: ContractorTalk, Reddit, Houzz Pro, finmkt.io, Projul CRM, GreatBuildz, AGC Survey, Harvard JCHS LIRA
Date: 2026-03-28
Status: Actionable — informs immediate outreach and first-client delivery

---

## 1. Core Validation

The research confirms one thing unambiguously:

> Contractors are not losing leads because lead quality is poor. They are losing leads because they have no follow-up system.

This is said in their own words across multiple independent sources. The platform's core automation suite — speed-to-lead response, estimate follow-up, win-back, appointment recovery — directly solves this. No pivot required. The product is right; the framing needs adjustment.

---

## 2. Pitch Reframe (Immediate)

The current offer docs (OFFER-STRATEGY.md, OFFER-APPROVED-COPY.md) already lean toward "stop losing leads" but still carry "get more leads" framing in places. The research says this distinction matters for objection surface.

| Current framing | Research-backed reframe |
|----------------|----------------------|
| "Recover revenue you&apos;re losing to slow follow-up" | "Stop losing the leads you already have" |
| "SMS automation for contractors" | "A follow-up system that runs when you can&apos;t" |
| "Lead recovery service" | "Your quotes stop dying in your inbox" |
| "$1,497/month managed service" | "30 cold quotes reactivated in your first week" |

**Action:** Update outreach templates and verbal scripts. Do NOT update OFFER-APPROVED-COPY.md yet — test the reframe in live outreach first and measure response rate vs. current framing. If the reframe performs, update the approved copy in a batch.

**Note on pricing:** The research references $1,497/month (from the internal offer doc). Current launch pricing is $1,000/month managed service. The reframe applies regardless of price point. The "$1,497 objection handling" in the research still works at $1,000 — the ROI math is even stronger.

---

## 3. Four Offer Angles to Test

The research surfaces four distinct angles not currently in active outreach rotation. Each maps to a confirmed pain point.

### Angle A: Quote Reactivation (highest priority)

> "We text every quote you sent in the last 90 days that went cold. You&apos;d be surprised how many are still interested — they just forgot to call back."

**Why this is the #1 angle:** It&apos;s concrete, low-commitment, and delivers ROI proof in the first week. The contractor doesn&apos;t have to trust the AI or the system — they just hand over a list and see what comes back. This is the fastest path to "holy shit, this works."

**Platform capability check:**
- CSV lead import: exists (just shipped)
- Estimate follow-up automation: exists (4-touch, days 2-14)
- **Gap:** Import hardcodes status to `new` — need to support importing at `estimate_sent` status
- **Gap:** Win-back targets `contacted` only — need to also target `estimate_sent` leads with old last-contact dates

**Experiment:** For the first 3-5 clients, manually import their old quotes, set status to `estimate_sent`, and trigger the estimate follow-up sequence. Measure: how many respond, how many convert to appointments, dollar value of recovered pipeline. This validates the angle before building the automated "quote reactivation blitz" workflow.

### Angle B: Speed-to-Respond

> "A homeowner contacts 4 contractors. One responds in 8 minutes. You respond in 3 hours. You don&apos;t get the appointment."

**Platform capability check:** Fully supported. AI responds to inbound SMS/calls within seconds. Speed-to-lead metric tracked and displayed on dashboard with industry comparison (42-minute average benchmark). No platform gaps.

**Experiment:** Track first-response time for first 5 clients. If consistently under 90 seconds, use actual data in outreach: "Our average response time across clients is [X] seconds. Industry average is 42 minutes."

### Angle C: Spring Season Urgency (time-sensitive)

> "Renovation inquiries are spiking right now. You can&apos;t call all of them back same-day. We respond within 90 seconds — automatically."

**Platform capability check:** Fully supported. Quarterly campaign system already defaults to `dormant_reactivation` in Q1 (maps to spring timing). AI seasonal context includes spring framing.

**Experiment:** Use this as the opening line in cold outreach during March-April window. Track open/response rates against non-seasonal subject lines. Window closes mid-April when contractors go heads-down.

### Angle D: No-System

> "You don&apos;t need more leads. You need a system that follows up on the ones you already have."

**Platform capability check:** Fully supported. This is literally what the platform does.

**Experiment:** Test as cold email subject line and LinkedIn opener. Compare against current "revenue recovery" framing.

---

## 4. Objection Handling Updates

The research provides specific rebuttals with contractor-language evidence. These supplement the existing objection handling in OFFER-STRATEGY.md Part 7.

| Objection | Research-backed response |
|-----------|------------------------|
| "I already follow up on my leads" | "How many quotes did you send in the last 60 days with no response? Most contractors I talk to can&apos;t answer that. We can make it zero." |
| "I have enough work right now" | "Perfect. That&apos;s exactly when your leads go cold — when you&apos;re too busy to call them back. The system runs in the background so that when this project finishes, your pipeline isn&apos;t empty." |
| "$1,000/month is expensive" | "If we recover one job you would have otherwise lost, do the math. How much is your average project worth?" (At $15k average, one recovered job covers 15 months of fees.) |
| "I don&apos;t lose leads" | "Can I show you something? How many quotes in your phone right now have had no response for more than 2 weeks?" |

**Action:** Incorporate into outreach scripts immediately. These are conversational — not for written proposals (which must use OFFER-APPROVED-COPY.md language).

---

## 5. Seasonal Timing — Act Now

The research documents a clear seasonal pattern from ContractorTalk data:

| Period | Lead Volume | Contractor State | Outreach Viability |
|--------|------------|-----------------|-------------------|
| **Mar-Apr (NOW)** | High leads, slow decisions | Overwhelmed, can&apos;t respond to all | **Prime window — 3-4 weeks left** |
| Apr-Jun | Decent leads and work | Busy but receptive | Good |
| Jun-Aug | Low leads, slow production | Heads-down on jobs | Difficult |
| Sep-Nov | Moderate leads, heavy work | Procrastinator rush | Moderate |
| Nov-Feb | Near dead | Slow season | Low volume |

**Implication:** The outreach window is approximately 3-4 weeks from the date of this research (late March 2026). After mid-April, contractors enter peak season and become unreachable. This is not manufactured urgency — it&apos;s documented seasonal behavior.

**Action:** Prioritize outreach volume now. The spring surge argument is strongest when the contractor is actively experiencing it.

---

## 6. Day-One Delivery Adjustment

The current Day-One activation (OFFER-STRATEGY.md Part 3) is:
1. Phone number live (24h)
2. Missed call text-back active (24h)
3. Call-your-own-number proof (Day 1-2)
4. Revenue Leak Audit (48h)

The research suggests adding a **quote reactivation blitz** as a Day 1-3 deliverable:

> "Give us your last 30 sent quotes with no response. We&apos;ll SMS them this week. You&apos;ll know by Friday which ones are still live."

This doesn&apos;t replace the existing Day-One milestones — it layers on top. The sequence becomes:
1. Day 1: Phone live + missed call text-back + call-your-own-number proof
2. Day 1-2: Client provides their old quote list (CSV, spreadsheet, or just names/phones from their phone)
3. Day 2-3: Operator imports quotes, system sends reactivation messages
4. Day 3-5: Revenue Leak Audit delivered + first quote reactivation results visible
5. Week 2+: AI smart assist mode, full automation ramp

**Platform requirement for this to work:**
- CSV import must support setting lead status (currently hardcodes to `new`)
- Imported `estimate_sent` leads need an automation path (currently no automation targets old estimates)

**This is not a feature request — it&apos;s a capability gap.** Without it, the operator cannot execute the highest-ROI first-week deliverable identified by the research.

---

## 7. What the Platform Already Handles

The research confirms these capabilities are correctly positioned and need no changes:

- **Speed-to-lead response** — AI responds in seconds, metric tracked, industry comparison on dashboard
- **Estimate follow-up** — 4-touch sequence with fallback nudges to the contractor
- **Win-back automation** — continuous dormant lead re-engagement (25-35 day window)
- **Appointment recovery** — no-show detection + same-day follow-up + rebook
- **Payment collection** — automated invoice reminders with Stripe payment links
- **Review generation** — post-job automated requests with Google link
- **Quarterly campaigns** — seasonal defaults aligned to contractor calendar
- **Revenue attribution** — funnel tracking with AI decision attribution
- **Self-serve phone provisioning** — client can set up their own number from the portal

---

## 8. Platform Capability Gaps — RESOLVED

Both gaps have been fixed as of 2026-03-28:

### Gap 1: CSV import cannot set lead status — FIXED

`POST /api/leads/import` now accepts an optional `status` column (`new`, `contacted`, `estimate_sent`). Defaults to `new` when not provided. Operator can import old quotes at their actual pipeline stage.

Commit: `feat(leads): support status field in CSV import for quote reactivation`

### Gap 2: No automation targets old `estimate_sent` leads — FIXED

Win-back automation now targets both `contacted` and `estimate_sent` leads. Uses `leftJoin` on conversations with `coalesce` fallback to `lead.createdAt`, so imported leads with zero message history are still eligible based on their creation/import date.

Commit: `feat(winback): target estimate_sent leads and imported quotes with no messages`

**The quote reactivation workflow is now fully executable:**
1. Operator imports contractor&apos;s old quotes via CSV with `status=estimate_sent`
2. Win-back cron picks them up 25-35 days after their import date (or immediately if backdated)
3. AI sends personalized reactivation message
4. Responses flow into the CRM as normal conversations
5. Revenue attribution tracks recovered pipeline

---

## 9. Experiment Tracking

| # | Experiment | Metric | Target | Status |
|---|-----------|--------|--------|--------|
| E1 | "Stop losing leads" reframe in cold outreach | Reply rate | &gt;5% (vs current baseline) | Not started |
| E2 | Quote reactivation as first-week deliverable (manual) | Quotes that respond / total imported | &gt;10% response rate | Not started |
| E3 | Speed-to-respond angle in outreach | Reply rate | Compare vs E1 | Not started |
| E4 | Spring urgency subject lines | Open rate | &gt;30% | Not started |
| E5 | "No-system" angle on LinkedIn | Connection accept + reply rate | &gt;15% accept | Not started |
| E6 | First-client speed-to-lead data in outreach | Credibility signal | Use after first 5 clients | Blocked on clients |

Track results here. Update after each outreach batch.

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|---------|-----------|
| 2026-03-28 | Do NOT update OFFER-APPROVED-COPY.md with reframe yet | Test in live outreach first; approved copy changes require validation |
| 2026-03-28 | Quote reactivation angle is #1 priority for first-client delivery | Research identifies it as fastest ROI proof; validates platform and retains client |
| 2026-03-28 | Two platform gaps identified (import status + estimate_sent automation) | Must fix before first client delivery to execute quote reactivation |
| 2026-03-28 | Spring window is 3-4 weeks — outreach volume is urgent | Seasonal data confirms Mar-Apr is prime; Jun-Aug is dead for outreach |
