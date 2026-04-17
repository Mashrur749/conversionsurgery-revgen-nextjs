# Product Strategy

Living document for product direction, business model, and strategic decisions. Updated as decisions are made.

---

## 1. Business Model & Revenue Target

**Goal:** $1M/year ARR, solo, location-free, ~20 hrs/week

### Pricing (locked 2026-03-31)

- Managed service: $1,000/month, no contract, no setup fee
- First 3-5 clients: case study commitment requested, no fee concession
- Agency licensing: TBD, targeting $3,000-5,000/month per agency partner

### Phased Approach

| Phase | Timeline | Focus | Revenue |
|-------|----------|-------|---------|
| 1 | Months 1-4 | Managed clients for proof + runway (5-10 at $1,000) | $5-10K MRR |
| 2 | Months 4-8 | Agency licensing as primary growth engine | $20-40K MRR |
| 3 | Months 8-18 | Scale to 15-20 agencies + premium managed + self-serve | $85K MRR |

### End State Revenue Mix

- 15 agency partners x $3,500/mo = $52,500 MRR (10 hrs/week)
- 10 premium managed x $2,000/mo = $20,000 MRR (8 hrs/week)
- ~25 self-serve x $497/mo = $12,400 MRR (2 hrs/week)

### Hard Constraints (non-negotiable)

- Solo — no hiring, no employees, no VAs
- Location-free — no in-person meetings required
- Time-free — target 25 hrs/week at steady state

### Key Decisions Still Needed

- Agency licensing pricing structure (flat fee vs per-seat vs hybrid)
- Agency white-label UI scope (subdomain routing, branding per agency)
- Self-serve tier timing (month 8-12, not month 1 — needs inbound source first)
- Legal counsel signoff on 4 must-have items before first client

### Pressure Points

- First 5-8 agency deals will require live calls (async-only is the end state, not the start)
- 3-5 managed clients is thin proof — need ONE killer case study with hard dollar amounts
- Self-serve needs an inbound channel before building (agency overflow or content)
- Phase 1 is heavy on time (~30 hrs/week) — temporary to build exit velocity

---

## 2. CRM Trojan Horse Strategy

**Sell revenue recovery. Deliver a complete business tool.**

The contractor buys for the automation and AI, then discovers the platform covers everything their CRM does — and cancels the other tool.

**Never market as CRM.** The front of the company says "revenue recovery." The product experience says "why am I still paying for Jobber?"

### What's already built (CRM-equivalent)

- Leads with full pipeline stages, scoring, context
- Conversations (SMS, AI-managed)
- Appointments + calendar sync
- Jobs (quotes, amounts, status)
- Payments (links, reminders, tracking)
- Follow-up automations (estimate, payment, review, win-back, no-show)
- Review monitoring + response
- Client portal for contractor self-serve
- Reporting with ROI model

### CRM Gaps to Fill (not yet audited in detail)

- Job scheduling/dispatch (assign technician, time slots, route optimization)
- Invoicing (generate + send, not just payment links)
- Estimate/quote builder (templated, sendable)
- Customer record management (homeowner history, property details, past jobs)
- Simple job costing / profitability per job
- Inventory or materials tracking (low priority — many contractors skip this)

### Analytics / Theory of Constraints Layer (high-value, differentiated)

The data already flowing through the system enables bottleneck analysis most CRMs can't do:

- Response time impact on close rate
- Funnel stage where leads stall (contacted -> qualified? quoted -> won?)
- Revenue leakage quantified in dollars (missed follow-ups, slow responses, no-shows)
- Payment collection velocity (time-to-pay, reminder effectiveness)
- Seasonal patterns by service type
- AI vs human performance comparison

### Execution Approach

Don't build all CRM features at once. Fill gaps incrementally — each one makes the competing tool less necessary until the contractor hasn't opened it in weeks. Prioritize by: what keeps contractors logging into the other tool daily?

When evaluating feature requests, weight "does this reduce dependency on external CRM?" as a factor.

---

## 3. Lead Magnet Capture (Evaluation — not committed)

### Twilio Number SID is not self-serve

External agencies won't have access to the platform's Twilio console to look up their Number SID. Current form requires manual entry.

**Options:**
- Auto-provision a Twilio number from within the platform (buy + assign)
- Look up the SID automatically from the phone number via Twilio API
- Remove the SID field from the UI entirely and resolve it server-side

### Agency profile fields are incomplete

The `agencies` table and settings dialog should capture more than Twilio config and operator contact. Missing for external agencies:
- Agency email (for billing, notifications)
- Agency logo/branding (white-label potential)
- Business address (invoicing, compliance)
- Website URL

### Signup flow should collect agency details upfront

When a new agency signs up, they should fill in their name, contact details, and phone config as part of registration — not discover the settings dialog later. The signup-to-first-client path needs to be seamless.

### Review request triggers on job completed, not job won (resolved)

Previously, the review request automation fired when a lead was marked "won" (accepted the estimate). This is wrong — the homeowner hasn't had the work done yet. Now:
- Review requests trigger on lead status `completed` (job is finished)
- The portal status endpoint accepts `completed` and auto-triggers the review sequence
- Jobber webhook path was already correct (fires on `job_completed`)
- Non-Jobber contractors mark jobs complete via the portal

**Fast-follows (post-launch):**
- SMS command: contractor texts "DONE [lead name]" to mark complete
- Time-based prompt: for small jobs, auto-ask contractor X days after "won" if the job is done

### Google Business URL should be auto-resolved during client onboarding

Currently the onboarding wizard asks the contractor to paste their Google Review URL manually. Most contractors don't know where to find it.

**Current state (2026-04-07):** The wizard field now shows the expected `g.page/r/.../review` format as placeholder, and includes helper text with step-by-step instructions linking to business.google.com. The edit client form has the same guidance. This is adequate for managed-service onboarding where the operator fills in the form.

**Better approach (backlog — FB-03):** Typeahead search using Google Places Autocomplete API. Contractor types their business name, the UI shows matching businesses in a dropdown ("Did you mean XYZ Construction & Co.?"), they select theirs. On selection, the API returns the place ID, URL, rating, and review count — pre-populating everything needed for review sync in one click. No manual URL hunting. This becomes critical when self-serve signup launches (Phase 3) — contractors filling in their own setup shouldn't need to know how Google Business Profile works.

This powers the full review lifecycle (request → sync → alert → auto-respond → report), so getting it right during onboarding is critical.

---

## 4. Agency Onboarding Gaps

### Win-back vs Quarterly Campaigns

- **Win-back** (`/api/cron/win-back`): always-on automation targeting stale leads (25-35 days inactive). Runs continuously.
- **Quarterly Growth Blitz**: manual ops planning tool. Targeted push on top of always-on automations.
- Both can run simultaneously. Offer docs should clarify: "Always-on win-back runs continuously; the quarterly campaign is a targeted manual push on top of that."

---

## 5. Lead Magnet Capture (Evaluation — not committed)

**Status:** Idea stage. Documented 2026-04-17 for future evaluation. Not yet scoped or scheduled.

### The Problem

Contractor websites typically have one conversion path: "Call Now." Visitors who aren't ready to call leave with no way to stay connected. These are the "buy later" leads — interested but not urgent. They disappear and the contractor never hears from them again.

### The Concept

Embeddable widgets on contractor websites that offer something useful in exchange for contact info:

- **Pricing calculator**: "How much does a new AC unit cost?" → 4-5 questions → ballpark range → captures name, email, phone
- **Service quiz**: "Which pest control plan fits your home?" → short quiz → personalized recommendation → captures contact info
- **Seasonal checklist**: "Is your home ready for winter?" → interactive checklist → tips + offer → captures contact info

Submissions flow into the existing lead pipeline with quiz answers as structured context. SMS automations take over immediately — but now the AI agent has personalized context from their answers, making the nurture dramatically more relevant.

### Why This Fits the Platform

The platform already handles everything downstream of lead capture:

- Lead pipeline with scoring, context, and stage tracking
- AI-personalized SMS nurture sequences
- Multi-step flow engine with scheduling
- Compliance gateway for outbound messages
- Attribution and ROI reporting

Lead magnets solve the upstream problem — **more leads entering the pipeline.** The existing automation engine does the rest.

### Differentiator

Generic form builders (Typeform, Jotform) capture leads into a spreadsheet. This captures leads into an AI-powered nurture engine. The follow-up SMS isn't "Thanks for visiting" — it's "Hey Sarah, you mentioned your AC is 15+ years old and your energy bills jumped. Most homeowners in that situation save 30-40% after replacement. Want a free estimate this week?"

No other tool in the home services space connects lead magnet → AI-personalized SMS nurture. That's the moat.

### Revenue Impact

- **For contractors:** Captures the "buy later" audience they're currently losing. Increases total lead volume without increasing ad spend.
- **For ConversionSurgery:** Strengthens the ROI story ("we don't just recover your dead pipeline, we capture leads you're currently losing"). Could justify a higher tier or add-on pricing.

### ICP Fit Assessment

Mixed. Home services skews toward urgent/reactive ("my toilet is leaking NOW"), where lead nurture adds less value. But some trades have longer consideration cycles:

| High fit (longer consideration) | Lower fit (urgent/reactive) |
|---------------------------------|----------------------------|
| HVAC replacement | Emergency plumbing |
| Kitchen/bath remodel | Pest control (active infestation) |
| Roofing | Locksmith |
| Solar installation | Drain cleaning |
| Landscaping design | Appliance repair |

**Conclusion:** Not universally valuable for all contractor types. Best positioned as an add-on for trades with a "shopping" phase, not a core platform feature.

### Build vs. Wait Decision

**Arguments to wait:**
- No clients yet — build it after landing 3-5 managed clients and learning what they actually need
- Only matters once you control the contractor's website (or can embed on it)
- Adds scope to an already-complete platform that needs sales, not features

**Arguments to build:**
- Strengthens pitch: "we capture leads your website is losing" is a compelling differentiator
- Technical lift is moderate — embeddable iframe + new lead source type + template library
- Quiz answers feeding AI context is genuinely novel in this space

**Recommendation:** Wait until Phase 1 has 3+ active clients. Use client conversations to validate which trades have a "buy later" audience worth capturing. Build it as a Phase 2 add-on if validated.

### Implementation Sketch (for future reference)

1. **Lead magnet templates** — pre-built for common trades (HVAC cost calculator, pest control quiz, etc.)
2. **Embeddable widget** — iframe or script tag contractor adds to their site
3. **New lead source type** — `lead_source: 'lead_magnet'` with structured quiz/calculator answers in context
4. **AI context integration** — quiz answers injected into agent prompt for personalized first-touch
5. **Email channel** — optional addition to flow engine alongside SMS (lower priority, SMS is superior for this ICP)
6. **Analytics** — conversion rate on widget, lead-to-customer rate vs other sources

Estimated effort: 2-3 weeks. Not trivial, not massive.
