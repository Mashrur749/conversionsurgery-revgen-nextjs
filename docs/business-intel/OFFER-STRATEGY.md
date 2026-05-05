# ConversionSurgery — Grand Slam Offer Architecture

Version 3.0
Date: April 4, 2026
Status: Launch-Ready (pending legal review &mdash; see Part 10)

> **NOTE:** The approved copy bank lives in `docs/business-intel/OFFER-APPROVED-COPY.md` (v1.8). The client-facing presentation is `docs/business-intel/offer-page.html`. If this strategy doc and the approved copy conflict, the **approved copy is the source of truth** for anything a contractor might see. This doc provides internal rationale and strategy context.
>
> **ICP:** The canonical ICP definition (who we sell to, sub-segment priority, 30-second qualifier, and avoidance criteria) lives in `docs/business-intel/ICP-DEFINITION.md`. Primary target: design-build renovation contractors ($1M-$10M), Calgary + Edmonton first.

This document is the single source of truth for what ConversionSurgery sells, how every component is structured, and the operational definitions behind every promise. All sales scripts, outreach templates, landing pages, and client-facing materials should be built FROM this document.

---

## PART 1: THE FRAMEWORK

### The Hormozi Value Equation

```
Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort & Sacrifice)
```

A "stupid to say no" offer doesn't just stack features. It systematically maximizes the numerator (what they get and their confidence they'll get it) while minimizing the denominator (how long it takes and what they have to do). Every component below is designed to push one of these four levers.

### The Dream Outcome

**⚠ INTERIM LANGUAGE POLICY (until quiet-hours legal review is complete):**
All client-facing materials must use "near-instant response during compliant hours" rather than "30-second response 24/7." The system runs 24/7, but CRTC quiet hours (9 PM – 10 AM) may restrict outbound responses during that window. Until legal counsel confirms whether inbound replies are exempt from quiet hours, do not promise response delivery during restricted windows. Internal documents and verbal sales conversations can reference the 24/7 system capability, but written claims about response time must include the compliant-hours qualifier. Once legal review is complete, this policy will be updated to reflect the confirmed scope.

**Old framing:** "Recover revenue you're losing to slow follow-up."

**Problem:** This is accurate but passive. It positions ConversionSurgery as loss prevention — plugging a leak. Contractors don't get excited about plugging leaks. They get excited about growth and dominance.

**New framing:** "Never lose another job to a competitor who just responded faster."

This is the same outcome stated as dominance rather than defense. The contractor isn't just recovering revenue — they're becoming the contractor who always responds first, always follows up, always stays top of mind. They become the obvious choice in their market.

**The real dream outcome, stated plainly:**

> "You do the work. We make sure you never run out of it."

### What the Contractor Is Actually Buying

**A full-time, 24/7 revenue recovery team — for less than the cost of a part-time hire, with implementation included.**

Not software. Not automations. Not an app. A team that captures every lead, follows up on every estimate, collects every payment, builds their reputation, and reactivates past clients — while they're on the job site doing what they're best at.

---

## PART 2: OFFER COMPONENT MAP

Every component serves one of four functions:

- **CORE** = The primary thing they're paying for
- **ACCELERATOR** = Makes the core work faster or better
- **RISK REVERSAL** = Removes a reason to say no
- **RETENTION ANCHOR** = Makes leaving feel like a real loss

---

### COMPONENT 1: The Revenue Recovery Engine (CORE)

**What it is:** The full managed system — AI response, follow-up sequences, appointment booking, payment reminders, review generation.

**What's included:**

| Capability                                  | What actually happens                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Near-Instant Lead Response                  | Every inquiry — call, text, form — gets a near-instant response during permitted hours. The system monitors around the clock and responds within seconds during compliant windows. (CRTC quiet hours: outbound messages queued 9 PM – 10 AM; see Interim Language Policy for pending inbound-reply review.) |
| AI Conversation Agent                       | Not canned auto-replies. An AI configured with YOUR business information that has real conversations, answers questions about your services, qualifies the project, and books estimate appointments into your Google Calendar. Syncs with Google Calendar to prevent double-bookings. |
| Estimate Follow-Up Machine                  | When you flag an estimate as sent, we trigger a 4-touch follow-up sequence over 14 days. Personalized, not pushy. Designed for the decision cycle renovation projects actually take. Multiple low-friction trigger options (see Estimate Trigger Methods below).  |
| Appointment Confirmation & No-Show Recovery | Reminders before every appointment. If they miss it, AI follows up same day and rebooks.                                                                                                                                                                                                                    |
| Payment Collection                          | Automated deposit and invoice reminders with one-click payment links. No more awkward "just following up on that invoice" conversations.                                                                                                                                                                    |
| Review Generation                           | After every completed job, an automated review request at the moment of peak satisfaction. Direct link to Google.                                                                                                                                                                                           |
| Dormant Client Reactivation                 | Past customers who haven't booked in 6+ months get re-engaged automatically. These people already trust you — they just forgot about you.                                                                                                                                                                   |

**Estimate Trigger Methods (Critical Delivery Detail):**

The estimate follow-up sequence is the highest-value automation in the system — it's the feature that drives close rate improvements. It only works when triggered. Requiring a dashboard login to trigger it creates a dangerous dependency on the busiest person in the company. Multiple trigger methods reduce the risk of this feature going unused:

| Method                   | How it works                                                                                                                                                                     | Friction level                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| SMS reply trigger        | Contractor texts a keyword to system number (e.g., "EST [lead name]")                                                                                                            | Lowest — matches how contractors already operate |
| Notification quick-reply | Reply "YES" to the lead notification SMS to confirm estimate was sent                                                                                                            | Low — piggybacks on existing notifications       |
| Dashboard click          | Log in → Lead → Mark "Estimate Sent"                                                                                                                                             | Medium — requires dashboard access               |
| Jobber/FSM integration   | Auto-detect when estimate is created in Jobber or similar tool                                                                                                                   | Zero friction — fully automated (roadmap item)   |
| Fallback nudge           | If lead is in "contacted" status for 5+ days with no estimate flag, system sends contractor a proactive SMS: "Did you send an estimate to [Name]? Reply YES to start follow-up." | Safety net — catches forgotten triggers          |

Implementation priority: SMS reply trigger and fallback nudge should be available at launch. Jobber integration is a roadmap item that eliminates the dependency entirely for clients who use FSM software.

**Unlimited conversations and messaging.** No message caps. No lead limits. No overage charges. The system handles as many leads and conversations as your business generates — without throttling, without surprise bills, without you ever thinking about limits.

**Hormozi lever:** Dream Outcome — this IS the core result they're paying for.

**What this kills:** "What do I actually get for this?" — Everything a full-time office manager would do for lead management, follow-up, appointment coordination, payment collection, and reputation building — except the system runs around the clock, never quits, never calls in sick, and costs a fraction of a hire.

---

### COMPONENT 2: Dedicated Business Number + Lead CRM (CORE)

**What it is:** A local Alberta phone number (separate from their personal cell) plus a dashboard where every lead, conversation, and status lives.

**Why it matters more than it sounds:** Most renovation contractors run their business off their personal cell phone. Their "CRM" is a mix of text threads, sticky notes, and memory. When a lead from 3 weeks ago texts back saying "we're ready to go," the contractor has to scroll through hundreds of texts to remember who they are.

This gives them separation between personal and business, a complete history of every conversation, and the ability to see their pipeline at a glance.

**Includes:**

- Up to 3 dedicated phone numbers
- Up to 5 team members with access
- Additional phone numbers: $15/month each
- Additional team members: $20/month each

**Voice AI &mdash; Included (v3.0 update):**
Voice AI is included in the base price for all clients &mdash; `voiceEnabled` defaults to `true` on signup. No per-minute charges. No extra fees. No opt-in step required. The contractor gets a fully answering business line from Day 1: when they miss a call, Voice AI picks up, qualifies the lead, and books the estimate. This is the core value proposition &mdash; not an upsell.

**Internal cost note:** Twilio voice minutes are a pass-through cost to the operator (~$0.01-0.02/min for standard calls). At typical contractor volumes (15-20 calls/month, ~5 handled by Voice AI, avg 3 min each), the monthly cost per client is $0.75-$3.00. This is absorbed into the monthly fee, not passed to the contractor.

**Hormozi lever:** Dream Outcome + Effort Minimizer — one place for everything, zero management required.

**What this kills:** "I don't need another tool to manage." — You don't manage it. We do. But it's there if you ever want to look. Think of it as the scoreboard — you can check it anytime, but we're the ones playing the game.

---

### COMPONENT 3: The Day-One Activation Package (ACCELERATOR)

**THIS IS THE SINGLE BIGGEST STRUCTURAL CHANGE TO THE OFFER.**

**The problem it solves:** A contractor pays the setup fee and then waits 3 weeks for full automation. That's 21 days of paying for something that isn't fully working. That gap creates doubt, buyer's remorse, and a feeling of "is this actually going to do anything?"

**The solution: Value within 24 hours.**

Here's what goes live on Day One — before the full AI is configured:

| Day-One Activation                                 | What happens                                                                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phone number provisioned**                       | Their dedicated business number is live and receiving calls within hours of signup.                                                                                                                                              |
| **Missed Call Text-Back — LIVE**                   | Every missed call gets an instant text: "Hey, sorry we missed your call! What can we help you with?" This requires zero AI training — it's a simple, immediate response that captures leads the moment they'd otherwise be lost. |
| **The "Call Your Own Number" Moment**              | During onboarding, we have them call their new number, let it ring, and watch the text come back in seconds. This is visceral. They SEE it working. On their phone. In real time. This is the wow moment.                        |
| **Revenue Leak Audit — Delivered within 48 hours** | We research their business and deliver a personalized breakdown of where money is falling through. This isn't generic. It's THEIR numbers.                                                                                       |

**Revenue Leak Audit — Defined Deliverable:**

- Data inputs: Google Business Profile (review count, rating, response patterns), website lead capture spot-check (form exists? speed? what happens?), competitive responsiveness spot-check (who else shows up, how many reviews, estimated response patterns)
- Output: One-page summary with 3-5 specific findings, priority-ranked, with estimated revenue impact ranges
- Production time: 30-45 minutes per account
- Delivery: Within 48 business hours of signup

**Revised Onboarding Timeline:**

| Day                      | What happens                                                                                         | Value delivered                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Day 1                    | Phone number live. Missed call text-back active.                                                     | Leads captured immediately.                            |
| Day 1-2                  | "Call your own number" demo. They see it work.                                                       | Visceral proof moment.                                 |
| Within 48 business hours | Revenue Leak Audit delivered.                                                                        | They see the size of the problem in their own numbers. |
| Days 3-5                 | AI configured with their business info. Form response goes live. Appointment reminders active.       | Website leads now get instant response too.            |
| Week 2                   | AI in smart assist mode — auto-sends after 5-minute approval window. Client can review and override. | Speed preserved. Client still sees what AI is saying.  |
| Week 3+                  | Full autonomous mode. All sequences active.                                                          | Complete system running.                               |

**Smart Assist Mode (Critical Design Detail):**

Standard assist mode — where the AI suggests and the contractor approves before anything sends — creates a response time problem during the exact period when demonstrating speed matters most. If the contractor is mid-demolition, an AI-suggested response could sit unapproved for hours.

Smart assist uses a configurable auto-send delay (default: 5 minutes). The AI generates the response and notifies the contractor. If the contractor reviews and approves/edits within 5 minutes, the edited version sends. If they don't respond within 5 minutes, the AI's response sends automatically. This preserves the review window while protecting the speed-to-lead promise.

For sensitive message categories (estimate follow-up, payment reminders), the auto-send delay can be extended or disabled during onboarding at the contractor's request.

**Knowledge Base Quality Assurance:**

The AI's conversation quality depends entirely on the knowledge base, and a single 30-minute call may not capture everything needed. The following process ensures KB quality reaches production standard before full autonomous mode:

1. **Pre-call questionnaire:** Sent to client before onboarding call. Covers services, pricing approach, FAQs, what they don't do, competitive advantages, and tone preferences. The call is for refining answers, not starting from scratch.
2. **Industry preset foundation:** Start with the renovation-specific KB template (covers 80% of common homeowner questions), then customize the remaining 20% per client. This means the AI is competent from Day 1, not built from zero.
3. **Assist-mode KB sprint:** During Week 2, every time the AI defers to human ("let me have [contractor] get back to you"), that question becomes a new KB entry. Frame this to the client: "The AI gets smarter every day during your first two weeks."
4. **Knowledge gap tracking:** The platform logs when the AI lacks information to answer a question. These gaps are reviewed and filled during the first bi-weekly check-in.

**Onboarding SLA:** All Day-One Activation timelines are business-day targets. If any activation milestone is delayed beyond 2 business days of target, client will be notified with a revised timeline.

**Hormozi lever:** Time Delay — crushes it from 3 weeks to 24 hours for first value.

**What this kills:**

- "What if nothing happens for weeks?" — Something happens Day One.
- "How do I know it works?" — You'll see it work on your own phone.
- "Is this vaporware?" — You'll have captured real leads before your first report.
- "I don't have time for onboarding." — It's one 30-minute call. We do the rest. Value starts day 1.

---

### COMPONENT 4: The 90-Day Operational Guarantee (RISK REVERSAL)

**THIS IS AN OPERATIONAL GUARANTEE — NOT A REVENUE GUARANTEE.**

We do not guarantee specific revenue outcomes. Renovation project close rates depend on factors outside our control (lead quality, pricing, contractor responsiveness, market conditions). What we guarantee is that the system will be set up, running, and actively working within defined operational parameters.

**Why the old revenue guarantee framing was problematic:**

1. "Recovered lead" was ambiguous. Who defines "recovered"? What counts?
2. 30 days isn't enough time for renovation results. Kitchen projects take 2-3 months to close.
3. Revenue attribution is contested territory — we can't guarantee what we don't control.

**The guarantee — two operational gates:**

#### Gate 1: 21-Day Go-Live Gate

> "Your system will be fully configured and live within 21 days of your onboarding call &mdash; or we extend your first month at no charge."

This is a delivery commitment, not a revenue promise. The system either goes live or it doesn&apos;t. If we miss this deadline, the client&apos;s billing pauses until the system is live. Setup fee is non-refundable (covers implementation work already done).

#### Gate 2: 30-Day Logging Gate

> "At least 80% of all inbound inquiries will be captured and logged in your CRM within the first 30 days of go-live. If we miss this threshold, we pause billing until logging meets the standard."

This is a system-performance gate. The platform logs prove it either way &mdash; no subjective interpretation needed. If logging falls below 80%, billing pauses until the issue is resolved.

**What this is NOT:**

- NOT a revenue guarantee &mdash; we do not guarantee specific revenue outcomes, pipeline values, or lead counts
- NOT a refund promise &mdash; billing pauses (not refunds) until operational standards are met
- NOT tied to deal outcomes &mdash; whether the contractor wins the job is outside system control

**Why this works:**

- **Binary and measurable:** The system is either live by Day 21 or it isn&apos;t. Logging is either at 80% or it isn&apos;t. No ambiguity.
- **Fair to both sides:** The contractor doesn&apos;t pay for months where the system isn&apos;t performing. The operator isn&apos;t liable for revenue outcomes they can&apos;t control.
- **Builds trust:** Billing pause is a stronger signal than a credit &mdash; it says &ldquo;we won&apos;t charge you until we deliver.&rdquo;
- **Defensible:** These are operational metrics with clear audit trails in the platform.

**Hormozi lever:** Perceived Likelihood — maximized through specificity, generosity, and measurability.

**What this kills:**

- "What if it doesn't work?" — If the system isn&apos;t live by Day 21, your billing extends. If it isn&apos;t logging properly by Day 30, billing pauses. You don&apos;t pay for a system that isn&apos;t working.
- "I need to think about it." — The guarantee means if we don&apos;t deliver on our operational commitments, you don&apos;t pay. The only risk is waiting another month and losing more leads.
- "Can I try it first?" &mdash; The Pilot tier (first 3 clients) is the lowest-risk entry point. Full service, case study commitment in exchange.

---

### COMPONENT 5: The Quarterly Growth Blitz (RETENTION ANCHOR + ACCELERATOR)

**THIS SOLVES THE SEASONALITY PROBLEM AND THE "MONTH 6 LOOKS LIKE MONTH 1" PROBLEM.**

**What it is:** Every 90 days, we run a proactive campaign on behalf of the client. Not part of the normal automation — an additional, targeted initiative.

**The Annual Rotation:**

| Quarter         | Campaign                                       | What it does                                                                                                     |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Q1 (Onboarding) | Dormant Client Reactivation Blitz              | Re-engage past customers who haven't booked in 6+ months. Revenue at zero acquisition cost.                      |
| Q2              | Review Acceleration Sprint                     | Targeted push to increase Google reviews from past completed jobs. Permanent, compounding value.                 |
| Q3              | Slow Season Pipeline Builder                   | "Planning season" campaign targeting past inquiries who never converted. Fills fall pipeline before busy season. |
| Q4              | Year-End Performance Review + Strategy Session | Comprehensive annual ROI analysis. 30-minute strategy call. Planning for next year.                              |

**Q1 Reactivation — Customer List Extraction (Critical Delivery Detail):**

This campaign requires a list of past customers with phone numbers. The ICP contractor typically does NOT have a clean customer list — their records are scattered across phone contacts, text threads, Jobber job history, and paper files. If this depends on "homework" (client sends us a list later), it won't happen.

List extraction process — built into onboarding, not assigned as homework:

1. **During onboarding call:** "Open your phone contacts. Let's spend 10 minutes scrolling through and flagging past customers. I'll capture them — you just tell me names." This gets 15-30 names live.
2. **Jobber/FSM export:** If client uses Jobber, Housecall Pro, or similar — pull the customer list from there. This is where the data actually lives for most ICP clients.
3. **Accept any format:** Screenshots of contact lists, a forwarded text with names, a shared Google Sheet, even a paper list they photograph. We clean it up. That's the managed service.
4. **Set realistic expectations:** "Even 20 names is enough to start. We'll get results proportional to the list. Most contractors are surprised how many past customers they have when we dig in."

Target: minimum 20 contacts for a viable Q1 reactivation. Ideal: 50-100+.

The rotation repeats annually, adapted to what the client needs most.

**Client Expectations:**

- Quarterly campaigns are scheduled and communicated to the client at least 14 days before launch
- Campaign selection is recommended by ConversionSurgery based on account performance data
- Client may request an alternative from the available campaign menu
- Fully custom campaign builds are outside scope at this price point

**Why this is powerful:**

1. **It solves seasonality.** Slow months aren't dead months — they're reactivation and pipeline-building months. The system is MOST valuable when leads are slow because that's when proactive outreach matters most.

2. **It creates compounding value.** Quarter over quarter, the client accumulates: more reviews (permanent), more reactivated relationships (recurring), more pipeline for busy season (revenue). Month 12 is objectively more valuable than Month 1.

3. **It makes leaving feel like a real loss.** If a contractor cancels in month 4, they lose the Q2 Review Sprint, the Q3 Pipeline Builder, and the Q4 Strategy Session. These are tangible things they'll miss — not just "automation stops."

4. **It differentiates from every competitor.** No answering service, no CRM, no DIY tool offers quarterly strategic campaigns. This is agency-level service at SaaS-level pricing.

**Hormozi lever:** Dream Outcome (proactive growth, not just reactive capture) + Perceived Likelihood (compounding value proves ongoing ROI) + Time Delay (new value injected every quarter).

**What this kills:**

- "What about slow months?" — Slow months are when we go on offense for you.
- "Why wouldn't I just cancel and re-sign when I'm busy?" — Because compounding value only works if it's continuous.
- "After a few months, what changes?" — Every quarter brings a new campaign. This isn't static.

---

### COMPONENT 6: The Bi-Weekly Scoreboard with "Leads at Risk" Line (RETENTION ANCHOR)

**What it is:** Every two weeks, a performance report showing exactly what the system did.

The report shouldn't just show metrics. It should answer one question: **"How many leads would have waited 40+ minutes for a response — and what was the estimated pipeline at stake?"**

**Report Structure:**

| Section                        | What it shows                                             | Why it matters                                                          |
| ------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Leads captured                 | Total inquiries handled, after-hours vs. business hours   | Shows volume they'd have missed                                         |
| Response time                  | Average response: X seconds vs. industry 42 minutes       | Makes speed tangible                                                    |
| Conversations had              | AI conversations, questions answered, appointments booked | Shows the AI doing real work                                            |
| Estimates followed up          | Which estimates are in sequence, which responded          | Shows the invisible follow-up happening                                 |
| Revenue impact                 | Won jobs attributed to the system, pipeline value         | The money number                                                        |
| **The "Leads at Risk" line**   | Leads that would have waited 40+ minutes — Based on your response times and lead volume | This is the retention line. It makes the cost of cancellation concrete. |
| **Weekly pipeline SMS**        | Monday morning SMS with dollar pipeline values ($XK probable, $XK confirmed) + needs-attention count | Keeps the contractor informed between bi-weekly reports |

**"Leads at Risk" Methodology — Based on your response times and lead volume (Standardized):**

This is a directional model, not guaranteed revenue. Each report lists inputs and assumptions explicitly.

Inputs:

- After-hours lead count in the reporting window
- Average observed first-response speed from platform logs
- Unfollowed estimate count or delayed follow-up count

Assumption framework:

- Scenario benchmark for delayed human response (industry baseline: 42-minute average, data from Invoca/HouseCall Pro studies)
- Scenario benchmark for follow-up impact on conversion (published first-responder win rate data)
- Conservative, Likely, and Optimistic estimate ranges

Reporting rules:

- Show Conservative/Likely/Optimistic estimated pipeline at stake ranges
- Label all benchmark-driven components as assumptions
- Include note on every report: "Actual outcomes vary by market, close process, and lead quality"

**Hormozi lever:** Perceived Likelihood — makes the ongoing value visible, concrete, and undeniable.

**What this kills:**

- "I'm not sure it's worth it." — Here's exactly what the service delivered this month, in concrete numbers.
- "I could probably do this myself." — Could you respond to 23 leads near-instantly while you're on a job site?

---

### COMPONENT 7: Complete Managed Service Model (EFFORT & SACRIFICE MINIMIZER)

**This is the existing positioning stated explicitly as an offer component.**

**What we handle:**

| We handle                     | So you never have to       |
| ----------------------------- | -------------------------- |
| AI setup and training         | Learn new software         |
| Sequence configuration        | Write follow-up messages   |
| Performance monitoring        | Check dashboards           |
| A/B testing and optimization  | Figure out what works      |
| Compliance (CASL/CRTC)        | Worry about legal exposure |
| Technical maintenance         | Deal with bugs or updates  |
| Bi-weekly reporting           | Build your own reports     |
| Quarterly strategic campaigns | Plan marketing initiatives |

**What they do (and ONLY what they do):**

| Their only responsibilities                                                               | Time required                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------- |
| One 30-minute onboarding call                                                             | Once                                |
| Review AI responses during smart assist (Week 2 — auto-sends after 5 min if not reviewed) | Optional 10-15 min/day for ~5 days  |
| Flag estimates as sent (reply to notification SMS, text keyword, or dashboard click)      | 10 seconds each                     |
| Mark jobs as won or lost                                                                  | 30 seconds each                     |
| Respond when AI escalates to them                                                         | As needed (complex situations only) |
| Read bi-weekly report                                                                     | 5 minutes                           |

**Total ongoing time commitment: Under 15 minutes per week.**

**Hormozi lever:** Effort & Sacrifice — minimized to near-zero. This is the strongest structural advantage in the entire offer. No competitor matches it.

**What this kills:**

- "I don't have time for this." — It takes 15 minutes a week. Less time than you spend on hold with your supplier.
- "I've tried CRM before and nobody used it." — CRM is software you operate. This is a service we operate for you.
- "What if my team won't adopt it?" — Your team doesn't need to adopt anything. We run it.

---

### COMPONENT 8: 90-Day Minimum, Then Month-to-Month (STRUCTURAL RISK REVERSAL)

This is structural risk reversal — not a "bonus," not a marketing line, but a fundamental feature of how the offer works.

**Terms:**

- One-time setup fee (tier-dependent: $3,500 / $5,500 / $9,500) — covers implementation, non-refundable
- 90-day minimum term — aligned to the renovation sales cycle; results compound over 60-90 days
- Month-to-month after the 90-day minimum
- No cancellation penalties after minimum term
- 30 calendar days written notice to cancel (after minimum)
- Full data export on request
- Export delivery: within 5 business days of request
- Export format: CSV (lead records, conversation history, pipeline status)

**Exact language for all client-facing documents:**

"One-time setup fee covers implementation. 90-day minimum term. Month-to-month thereafter. Cancel anytime after the minimum with 30 calendar days written notice. No cancellation penalties. Full data export available on request."

**Frame it this way:**

> "We don't lock you in beyond the 90-day minimum — because we don't need to. Renovation projects take 60-90 days to close. If we haven't produced results in that window, we haven't done our job. After Day 90, it's month-to-month. We earn your business every single month."

**Hormozi lever:** Perceived Likelihood (removes the "what if I'm stuck" fear) + Effort & Sacrifice (leaving is painless after minimum, so staying is a choice, not a trap).

**What this kills:**

- "What if I'm stuck in a contract?" — 90-day minimum only. After that, month-to-month, cancel anytime.
- "That's a big commitment." — The setup fee covers real implementation work. The 90-day term matches how long renovation results actually take to show up.

---

## PART 3: THE FULL OFFER — AS YOU'D PRESENT IT

Here's what you get when you start with ConversionSurgery:

**The Revenue Recovery Engine** — Every lead gets a near-instant response during compliant hours. AI that has real conversations, books appointments, and follows up on every estimate for weeks. Payment collection, review generation, dormant client reactivation. Unlimited conversations and messaging. All managed by us.

**Your Own Dedicated Business Number + Lead CRM** — Everything in one place. Every conversation, every lead, every status. Separate from your personal phone.

**Day-One Activation** — Your number is live and catching missed calls within 24 hours. Before the full AI is even configured, you're already capturing leads you'd have lost. Plus a personalized Revenue Leak Audit showing exactly where money is falling through YOUR business.

**Quarterly Growth Blitz** — Every 90 days, a new strategic campaign: dormant client reactivation, review acceleration, pipeline building for busy season, annual strategy review. This isn't static — it gets more valuable every quarter.

**Bi-Weekly Performance Scoreboard** — Every two weeks, a report showing exactly what the system did, how much revenue it impacted, and what would have happened without it. Full transparency.

**Complete Done-For-You Service** — We set it up, run it, optimize it. Your only job is to keep building great projects. Total time commitment: under 15 minutes a week.

**Operational Guarantee** &mdash; Go-live by Day 21 or your first month extends at no charge. 80% logging coverage by Day 30 or billing pauses until we hit the standard. No revenue guarantees, no pipeline promises &mdash; just a commitment that the system will be live and working as designed.

**Weekly Pipeline Update** &mdash; Every Monday, a text on your phone showing your pipeline in dollars. No login required.

**90-day minimum term, then month-to-month. No cancellation penalties after the minimum. No message limits. No overage charges.** We earn your business every single month.

**One-time setup fee + monthly service fee (tier-dependent).** One recovered project covers the setup and months of service. Most clients see measurable pipeline activity within the first 30 days.

Pilot tier ($3,500 setup + $1,500/mo) is available to the first 3 clients only, in exchange for participating in a 90-day outcome review.

---

## PART 4: HORMOZI EQUATION SCORECARD

### Dream Outcome: MAXIMIZED ✓

- Not just "recover some lost leads" — become the contractor who always responds first, always follows up, always stays top of mind
- Grow revenue without hiring
- Quarterly campaigns add proactive growth on top of reactive capture
- "You do the work. We make sure you never run out of it."

### Perceived Likelihood: MAXIMIZED ✓

- 21-Day Go-Live Gate &mdash; system live or billing extends
- 30-Day Logging Gate &mdash; 80% capture or billing pauses
- Day-One Activation so they see it working in hours, not weeks
- Revenue Leak Audit with THEIR numbers, not generic industry claims
- Bi-Weekly Scoreboard with "Leads at Risk" line making value concrete and visible
- Month-to-month removes the "what if I'm stuck" fear entirely
- Unlimited messaging removes the "what if I run out" anxiety
- Full data export at cancellation removes vendor lock-in fear

### Time Delay: MINIMIZED ✓

- Value within 24 hours (missed call text-back live, phone number active)
- Visceral proof moment on Day 1 (call your own number and watch the text come back)
- Revenue Leak Audit within 48 business hours
- Form response and appointment reminders by Day 3-5
- Full AI in assist mode by Week 2
- Full autonomous by Week 3
- System is catching leads from Day 1, not Week 3

### Effort & Sacrifice: MINIMIZED ✓

- One 30-minute onboarding call (once)
- 15 minutes per week ongoing — total
- No software to learn, no dashboards to manage, no follow-up to remember
- We handle everything: setup, training, optimization, compliance, reporting
- No message limits to monitor or manage
- No overage bills to worry about
- Client's job is to keep doing great work. Our job is everything else.

---

## PART 5: PRICING PSYCHOLOGY

### Three-Tier Model (Business Reference v1.0)

| Tier         | Setup Fee  | Monthly Fee | Availability                        |
| ------------ | ---------- | ----------- | ----------------------------------- |
| **Pilot**    | $3,500     | $1,500/mo   | First 3 clients only (case studies) |
| **Standard** | $5,500     | $2,000/mo   | General availability                |
| **Premium**  | $9,500     | $3,500/mo   | General availability                |

**Setup fee rationale:** Covers implementation, onboarding, AI configuration, and knowledge base build. One-time. Non-refundable. Signals commitment from both sides and ensures the operator is compensated for the Day-One Activation work regardless of outcome.

**90-day minimum term:** All tiers carry a 90-day minimum. This aligns with the renovation sales cycle — results take 60-90 days to compound. Month-to-month after the minimum.

**Pilot tier:** Capped at 3 clients. Purpose is to generate documented case studies and refine the managed service delivery model before scaling to Standard/Premium pricing. Pilot clients receive full service in exchange for agreeing to participate in a post-90-day outcome review.

**Hard rule &mdash; Pilot-to-Standard transition at client 4:** Clients 1-3 are Pilot, no exceptions. Client 4 and beyond are Standard ($5,500 setup + $2,000/mo), no exceptions, regardless of objection or sales pressure. This is a hard rule, not a negotiating position &mdash; do not re-litigate it on a sales call. If client 4 cannot afford Standard, they are not the right fit and should be passed on.

### Why Round Numbers Work

1. **Round numbers signal confidence and transparency.** Research (Troll et al. 2024 meta-analysis, Wadhwa & Zhang 2015) shows charm pricing ($997, $999) underperforms round pricing in B2B and professional services contexts. Contractors quote kitchens at $50,000, not $49,997. We price the same way.

2. **Setup fee plus monthly is honest pricing.** It communicates that implementation has real cost — and that the monthly fee is for ongoing delivery, not amortized setup.

3. **One project pays for the entire engagement.** At $45K-$65K average project value, even the Premium tier ($9,500 setup + $3,500/mo × 3 months = $20,000) is paid back by a single recovered basement or kitchen project.

4. **90-day minimum neutralizes early cancellation.** The real objection isn't "it costs too much" — it's "what if I'm stuck paying for something that doesn't work." The operational guarantee addresses this directly.

5. **Unlimited messaging justifies premium.** No caps, no overages, no surprises. Flat-rate simplicity that competitors don't offer.

6. **Quarterly Growth Blitz justifies premium.** Agency-level service at SaaS-level pricing. No competitor offers proactive quarterly campaigns.

### Price Anchors

| Anchor                    | Cost                                 | Your line                                                                                           |
| ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Full-time office employee | $4,000-5,000/month                   | "And they can't work at 11 PM on a Saturday."                                                       |
| Part-time hire            | $1,500-2,500/month                   | "Still more than us, and you have to manage them."                                                  |
| Answering service         | $500-1,500/month                     | "They take messages. We book appointments. And they charge per minute. We're flat rate, unlimited." |
| One basement project      | $9,000-16,000 profit (at 20% margin) | "One recovered basement covers the setup fee and months of service. Always talk profit, not revenue &mdash; they know their margins."  |
| One kitchen project       | $7,000-13,000 profit (at 20% margin) | "One recovered kitchen covers the setup and 2-3 months."                                            |
| Doing nothing             | $10,000-40,000/year in lost profit   | "The most expensive option is the one you're choosing now."                                         |

---

## PART 6: OBJECTION MAP

Every component is tagged to the specific objection it preemptively kills:

| Objection                               | Primary killer                                                                         | Supporting                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| "It's too expensive"                    | ROI math (one recovered project covers setup + months of service)                      | Bi-Weekly Scoreboard, unlimited messaging (no surprise costs)                       |
| "Why a setup fee?"                      | Setup fee covers real implementation work (AI config, KB, onboarding) — not a markup  | Day-One Activation (phone number + missed-call text-back live Day 1)                |
| "I need to think about it"              | Day-One Activation (value starts immediately, waiting costs leads)                     | 90-day minimum aligns with renovation cycle — short relative to project payback     |
| "What if it doesn't work?"              | Operational Guarantee (21-day go-live gate + 30-day logging gate, billing pause)        | Day-One Activation (you'll see it working in hours)                                 |
| "I've tried CRM/software before"        | Managed Service (we run it, not you)                                                   | 15 min/week (nothing to learn or operate)                                           |
| "I can hire someone instead"            | Revenue Engine (24/7, comparable monthly cost, no management overhead)                 | Day-One Activation (employee takes weeks to hire and train)                         |
| "What about slow months?"               | Quarterly Growth Blitz (slow months = reactivation/pipeline months)                   | Dormant Client Reactivation (revenue at zero acquisition cost)                      |
| "Can I try it free?"                    | Pilot tier available (first 3 clients — case study program)                            | Operational guarantee means if we don&apos;t deliver, billing pauses                 |
| "What if AI says something wrong?"      | Managed Service (assist mode first week, guardrails, escalation)                       | Bi-Weekly Scoreboard (you see what it's saying and doing)                           |
| "I don't have time for onboarding"      | Day-One Activation (30-min call + we do rest, value day 1)                             | 15 min/week ongoing                                                                 |
| "What if I want to cancel?"             | 90-day minimum only, then month-to-month + full data export (CSV, 5 business days)     | No penalty after minimum, no lock-in                                                |
| "My leads are fine / I don't need this" | Revenue Leak Audit (personalized, shows THEIR specific gaps)                           | Industry data (42-min avg response, 80% don't leave voicemail)                      |
| "What makes you different?"             | Managed service + renovation-specific AI + quarterly campaigns                         | Unlimited messaging — no one else offers flat rate with no caps                     |
| "Let me talk to my wife/partner"        | Revenue Leak Audit (tangible doc to share) + Leave-behind email                        | Guarantee removes financial risk from the spousal conversation                      |
| "What if I run out of messages?"        | Eliminated. Unlimited. No caps. No overages.                                           | N/A — the objection no longer exists                                                |

---

## PART 7: OPERATIONAL DEFINITIONS

### Service Level Expectations

| Priority                                                             | Response commitment           |
| -------------------------------------------------------------------- | ----------------------------- |
| High-priority support (system down, lead not receiving responses)    | 1 business day first response |
| Standard support (question, change request, optimization)            | 2 business days               |
| Critical incident (data breach, compliance violation, billing error) | Same-day triage               |

### Operational Capacity Rules

- New client onboarding cap: 2 per week
- Custom requests beyond scope: queued to monthly batch
- Weekly delivery hours per client (post-onboarding): 45-60 minutes target
- If delivery hours are breached 2 consecutive weeks: pause outbound for 5 business days OR shift new starts to waitlist

### Internal Usage Guardrails (Not Client-Facing)

These exist to protect service quality and margins. They are invisible to the client.

**Per-conversation guardrail:** Soft escalation trigger at 25-30 messages in a single conversation thread without resolution. This is a quality signal — if a conversation needs 30+ messages, it needs a human. Existing escalation triggers remain: 3+ exchanges without progress, AI confidence below 60%, complaint detection.

**Per-client usage monitoring:** Internal alert threshold at 8,000 messages/month per client for review. Purpose: determine if volume is healthy growth (good) or misconfiguration (fix it). No automated throttling — alerts are for human review only.

**Expected usage ranges (internal benchmarks):**

| Client profile                      | Monthly leads | Monthly messages | Monthly API cost |
| ----------------------------------- | ------------- | ---------------- | ---------------- |
| Typical ICP (15-30 leads/month)     | 15-30         | 1,000-3,000      | $25-45           |
| Active ICP (30-50 leads/month)      | 30-50         | 2,500-5,000      | $40-65           |
| High-volume ICP (50-80 leads/month) | 50-80         | 4,000-7,000      | $55-85           |
| Outlier (investigate)               | 80+           | 8,000+           | $85+             |

At $1,500-$3,500/month revenue (depending on tier), even outlier usage maintains strong gross margin on API costs.

**Enterprise trigger:** If a client consistently exceeds 100 leads/month for 2+ consecutive months, they are outgrowing the Standard/Premium tier. This is a revenue opportunity — introduce a custom enterprise conversation naturally. Do NOT throttle them.

### Scope Boundaries

**Quiet Hours Response Classification (Pending Legal Review):**

The system enforces CRTC quiet hours (9 PM – 10 AM) by queuing all outbound messages. This creates a 13-hour window every day where a lead texting in gets silence — creating a gap in response coverage that limits the "near-instant response" promise to compliant hours.

The compliance nuance: CRTC quiet hours restrict unsolicited commercial messages. A direct reply to an inbound inquiry is arguably not unsolicited — it's a response to the lead's own action.

**Proposed message classification:**

| Category                                      | Examples                                                                                                    | Quiet hours behavior                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Inbound reply** (response to lead's action) | First response to missed call, form submission reply, reply to inbound SMS                                  | Send immediately — this is conversational, not commercial |
| **Proactive outreach** (system-initiated)     | Estimate follow-up sequences, win-back messages, reactivation campaigns, review requests, payment reminders | Queue for next available window — these are commercial    |

**This classification requires legal confirmation before implementation.** If legal counsel confirms inbound replies are exempt from quiet hours, update the compliance gateway to distinguish message categories. If not, update all marketing to say "30-second response during permitted hours" and adjust the "Leads at Risk" methodology to reflect the actual response window.

**This is flagged as a high-priority legal review item because it directly affects the core value proposition.**

**What's included:** Everything described in Components 1-8 above.

**What's NOT included:**

- Website redesign or development
- Paid advertising management (Google Ads, Meta Ads, YouTube Ads)
- Social media management
- Newsletter or email marketing campaigns (beyond automated follow-up sequences)
- SEO services and technical implementation
- Full-funnel paid ads management
- Project management or accounting implementation
- Unlimited custom workflow builds
- Same-day custom copywriting outside templates
- 24/7 live human support (AI is 24/7; human escalation during business hours)

### Claims and Messaging Guardrails

**Aspirational vs. qualified language boundary:**

Dream Outcome language ("Never lose another job…", "You do the work. We make sure you never run out of it.") is approved for verbal sales conversations, landing page headlines, and demo video hooks. This is strategic positioning — no contractor interprets it as a contractual guarantee of zero lost leads. It conveys confidence and ambition.

All supporting copy, email outreach, written proposals, leave-behind documents, and client-facing agreements must use qualified language per the rules below. The test: if it could be screenshot and forwarded, it must use qualifiers.

**Use in written materials:** "Typically," "most clients," "can," "often," "results vary by lead volume, response behavior, and market conditions"

**Never use in any context:** "Guaranteed revenue increase," "zero work required"

**Never use in written materials:** "Never lose a lead again," "every lead will be captured" (these are acceptable verbally in sales conversations where context makes the aspirational intent clear)

**Approved written framing:** "Most qualified clients see faster response times immediately and measurable pipeline lift within 30-90 days."

### Contract and Cancellation Language

Exact language for all client-facing documents:

- Month-to-month service
- Cancel anytime
- Effective 30 calendar days after written notice
- No cancellation penalties
- Full data export available on request
- Export delivery: within 5 business days
- Export format: CSV (lead records, conversation history, pipeline status)

**Unlimited Messaging — Contract Clause:**

The following line must appear in the service agreement:

_"Unlimited lead conversations and automated messaging for in-scope renovation business use. Excludes mass broadcasting, personal messaging, and use for businesses or services not covered under the service agreement. ConversionSurgery reserves the right to review accounts with usage patterns substantially outside normal business operation."_

This protects against edge-case misuse while preserving sales simplicity. The exclusions are narrow and obviously reasonable — no contractor reads this and thinks "they're going to cap me." It should appear in the agreement only, not in the sales pitch. Sales language remains: "Unlimited. No caps. No overages."

---

## PART 8: IMPLEMENTATION PRIORITY

If building this offer in phases, here's the sequence:

| Priority | Component                                                                                                    | Impact                                                  | Effort                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1        | **Day-One Activation** (missed call text-back on Day 1 + call-your-number demo)                              | Biggest impact on the wow moment gap                    | Minimal — just sequencing what already exists                                      |
| 2        | **Operational Guarantee** (21-day go-live gate + 30-day logging gate with billing pause)                      | Biggest impact on sales close rate                      | Zero technical change — policy decision + updated scripts                          |
| 3        | **Low-friction estimate triggers** (SMS keyword trigger + notification quick-reply + fallback nudge)         | Prevents the highest-value automation from going unused | Moderate — new trigger endpoints, but logic is straightforward                     |
| 4        | **Smart assist mode** (auto-send after 5-minute approval window)                                             | Preserves speed-to-lead during onboarding               | Small — configurable delay on existing assist mode logic                           |
| 5        | **Revenue Leak Audit** (personalized pre-onboarding research)                                                | High impact on both sales and onboarding trust          | Create template + define 30-45 min research process                                |
| 6        | **Unlimited messaging** (remove caps from plan configuration and all materials)                              | Removes hidden objection + strengthens pricing          | Remove limits from active plan config; keep overage capability dormant in codebase |
| 7        | **Quarterly Growth Blitz** (starting with Q1 Dormant Client Reactivation + customer list extraction process) | Biggest impact on retention and seasonality             | Plan campaign cadence + build reactivation sequence + onboarding list extraction   |
| 8        | **Bi-Weekly Scoreboard upgrade** (add "Leads at Risk" line with standardized methodology)                    | Moderate impact on retention                            | Update report template + define calculation methodology                            |
| 9        | **Quiet hours response classification** (legal review → compliance gateway update)                           | Directly affects core "24/7" promise                    | Legal review first, then gateway logic change if approved                          |
| 10       | **KB quality assurance process** (pre-call questionnaire, industry presets, assist-mode KB sprint)           | Prevents thin AI conversations that erode trust         | Template creation + process documentation                                          |

---

## PART 9: DOCUMENTS THAT SHOULD BE REBUILT FROM THIS ARCHITECTURE

Once this document is finalized and legal-reviewed, the following should be updated to align:

| Document                                   | Key changes needed                                                                                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00-AI-AGENT-KNOWLEDGE-BASE.md              | Remove lead/message limits. Update guarantee language to operational gates (21-day go-live, 30-day logging). Add smart assist mode description. Update quiet hours if legal review changes classification.                                                |
| 01-SALES-SCRIPTS.md                        | Rebuild close section with unlimited messaging, operational guarantee (21-day + 30-day gates), Day-One Activation. Update assist mode description to smart assist. Add aspirational/qualified language boundary.                                         |
| 02-OUTREACH-TEMPLATES.md                   | Update value prop lines. Reference unlimited messaging and operational guarantee. Ensure all written copy uses qualified language per guardrails.                                                                                                         |
| 03-ONBOARDING-PLAYBOOK.md                  | Add customer list extraction to onboarding call script. Update assist mode to smart assist with auto-send. Add KB quality sprint process. Add low-friction estimate trigger setup. Update "Client Ongoing Responsibilities" doc with SMS trigger option. |
| 05-BATTLE-CARDS.md                         | Add "unlimited, no caps" as differentiator. Update guarantee references to operational gates. Add voice AI included by default.                                                                                                                          |
| 06-ROI-CALCULATOR.md                       | Update value stack for unlimited messaging. Remove overage math.                                                                                                                                                                                         |
| BUSINESS-CASE.md                           | Keep overage billing dormant in codebase. Add smart assist auto-send feature. Add SMS estimate trigger endpoint. Add fallback nudge cron job. Update compliance gateway if quiet hours classification changes.                                           |
| ConversionSurgery Business Reference Guide | Update core offer, plan limits, guarantee (operational gates), pricing, onboarding timeline, client responsibilities, and compliance sections throughout.                                                                                                |
| Sales Process & Offer Presentation         | Update pricing section with unlimited messaging. Present voice AI as separate add-on. Use aspirational language verbally, qualified language in leave-behinds.                                                                                           |

---

## PART 10: LEGAL REVIEW ITEMS

Before using this offer architecture with real clients, the following should be reviewed by a Canadian contract lawyer:

1. **Quiet hours response classification (HIGH PRIORITY)** — Are direct replies to inbound inquiries (missed call text-back, form submission response) exempt from CRTC quiet hours as conversational responses rather than unsolicited commercial messages? This directly affects the core "24/7 response" value proposition. If replies are NOT exempt, marketing must be adjusted.
2. **Guarantee language** — Are the 21-day go-live gate and 30-day logging gate (with billing pause) enforceable as written? Is the 80% logging threshold specific enough for a contractual context?
3. **Billing pause mechanics** — Is the billing pause mechanism (not refund, not credit) appropriate from a liability and accounting standpoint?
4. **Dispute resolution clause** — Should there be a formal process for determining whether the go-live or logging gate was met? What evidence standard is appropriate?
5. **Cancellation terms** — Are 30 calendar days notice and 5-business-day data export compliant with Canadian consumer protection standards?
6. **"Unlimited" messaging claims** — Any risk in advertising "unlimited" with the contract qualifier excluding broadcast/personal/out-of-scope use? Is the qualifier sufficient protection?
7. **CASL/CRTC compliance** — Does the service model as described satisfy consent and opt-out requirements for automated messaging in Canada?

**Pre-Launch Legal Review (REQUIRED before first client signs):**

Items 1-3 must be reviewed by legal counsel BEFORE using this offer architecture with paying clients. These three items directly affect client-facing promises and financial commitments:

| Priority      | Item                                                  | Why it can't wait                                                            |
| ------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Must-have** | Quiet hours response classification (#1)              | Determines whether the core response time claim is legally accurate          |
| **Must-have** | Guarantee enforceability + billing pause (#2, #3)     | Financial commitments that could create liability if poorly drafted          |
| **Must-have** | "Unlimited" clause language (#6)                      | Contract language that needs legal validation before any agreement is signed |

Items 4, 5, and 7 should be reviewed before scaling but can be addressed in the first 60 days of operation if counsel availability is limited.

**Action:** Engage a Canadian contract lawyer for a focused review of items 1, 2, 3, and 6. This is a bounded scope — not a full legal audit. Target: 1-2 hour consultation with written guidance. Do not sign any client to a service agreement until this review is complete.

---

---

## PART 11: WAVE 6 UPDATES (April 2026)

The following capability and policy updates were shipped as part of Wave 6 (April 2026) and are reflected in this document:

### Pre-Sale ROI Calculator

A public API endpoint (`POST /api/public/roi-calculator`) accepts contractor inputs (monthly lead volume, average project value, estimated follow-up gap, quote-to-win rate) and returns a personalized revenue-at-risk estimate. Use this during the sales call instead of doing the math on paper.

Sales flow: pull up the calculator during the pricing objection or Objection 3 (referral-heavy contractor). Enter their numbers. Show the output on screen. The conversation shifts from "is this expensive?" to "I'm leaving $X on the table every month."

Inputs accepted: monthly lead volume, average project value, current follow-up rate (%), estimated conversion lift.
Output: annual revenue at risk, monthly recovery potential, months-to-break-even.

Template for manual calculation if API is unavailable: `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md`.

### Pre-Sale Revenue Leak Audit

Before any sales call, run a 15-20 minute lightweight audit using publicly available data. This changes the call opener from a pitch to a discovery conversation: "I already did some research on your business — can I share what I found?"

Audit process and template: `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`
Spec reference: `docs/specs/PRESALE-REVENUE-LEAK-AUDIT.md`

### Jobber Integration

Basic webhook integration is live:
- **Outbound (CS → Jobber):** CS fires an `appointment_booked` event to a configured Jobber webhook URL when an appointment is created
- **Inbound (Jobber → CS):** Jobber sends `job_completed` events to `POST /api/webhooks/jobber/job-completed`, which triggers review generation for the associated lead

This integration is optional (off by default, enabled per client). It resolves the "I use Jobber — won't this overlap?" objection by making CS the front-end of the Jobber pipeline. See Objection 7 in the Sales Objection Playbook for updated script.

The integration architecture uses a generic `integration_webhooks` table, so future providers (HubSpot, ServiceTitan, Housecall Pro) follow the same pattern.

### Voice AI Included by Default

Voice AI is no longer an opt-in add-on for new clients. `voiceEnabled` defaults to `true` on client creation. Per-minute usage ($0.15/min pass-through) is invoiced as a transparent line item, but no setup step is required. See Component 2 update above.

---

## PENDING: CLIENT-FACING DOC REVIEW REQUIRED

The following changes affect client-facing promises and have NOT yet been updated in `docs/business-intel/OFFER-APPROVED-COPY.md` (which is approved sales copy and must not be edited without review):

| Change | What needs updating in OFFER-APPROVED-COPY.md |
|--------|-----------------------------------------------|
| Voice AI included by default | Section describing Voice AI as "optional add-on" should be updated |
| Operational guarantee (21-day go-live + 30-day logging gate) | Section 3 guarantee language needs updating to operational gates |
| ROI Calculator available for pre-sale | Can be added as a pre-sale tool reference |

**Action required:** Review these three items with the founder and update OFFER-APPROVED-COPY.md with approved copy before using the updated scripts in live sales calls.

---

_ConversionSurgery Grand Slam Offer Architecture v3.0_
_Consolidated from v1.0 (strategic architecture), v1.1 (operational refinements), Unlimited Messaging Update, Gap Resolution (estimate triggers, quiet hours, smart assist, KB quality, voice AI, customer list extraction, claims boundary, unlimited qualifier, guarantee formula), Wave 6 updates (ROI calculator, pre-sale audit, Jobber integration, voice default-on, weekly pipeline SMS, guarantee pipeline floor), and Business Reference v1.0 alignment (three-tier pricing, setup fee, 90-day minimum term, operational guarantee, Pilot cap)_
_Last updated: May 2026_
