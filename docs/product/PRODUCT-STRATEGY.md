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

## 3. Agency Onboarding Gaps

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

## 4. Terminology Clarifications

### Win-back vs Quarterly Campaigns

- **Win-back** (`/api/cron/win-back`): always-on automation targeting stale leads (25-35 days inactive). Runs continuously.
- **Quarterly Growth Blitz**: manual ops planning tool. Targeted push on top of always-on automations.
- Both can run simultaneously. Offer docs should clarify: "Always-on win-back runs continuously; the quarterly campaign is a targeted manual push on top of that."
