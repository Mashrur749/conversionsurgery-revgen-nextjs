# SPEC-07: Pre-Sale Revenue Leak Audit

**Status:** Approved
**Last Updated:** 2026-04-03
**Audience:** Operator (pre-sales), Sales Conversation

---

## Purpose

Define the pre-sale revenue leak audit — a lightweight diagnostic conducted by the operator using publicly available data *before* the sales conversation. The audit reveals the contractor's specific revenue vulnerability using real-world measurements (response time, review gap) and market-based estimates, providing concrete evidence of value without requiring any contractor participation, system access, or commitment.

---

## Problem Context

Contractors receiving cold outreach are skeptical. Generic claims ("we'll improve your response time" or "you're missing leads") are noise. But showing them *their specific measured response time* and *their actual review gap relative to competitors* — backed by numbers tied to dollar estimates — shifts the conversation from "should I listen?" to "how much am I actually losing?"

The pre-sale audit answers: "Based on public data and industry benchmarks, here's specifically how much revenue you're at risk of losing, and here's what recovery could look like."

---

## Scope

**In Scope:**
- Pre-sale only (before sales conversation)
- Public data sources only (Google Business Profile, website, phone test, competitor research)
- No contractor system access required
- No sign-up, trial, or login required
- Operator-conducted, ~30–45 minutes per prospect
- Output: one-page markdown/PDF summary

**Out of Scope:**
- Post-sale diagnostics (those use contractor data)
- Detailed lead pipeline analysis (requires dashboard access)
- Comparison to current close rates without measurement
- Multi-month trend analysis (only current state)

---

## Operator Process

The operator follows these steps in sequence. Total time: 30–45 minutes per prospect.

### Step 1: Speed-to-Lead Test (10 minutes)

Test how fast the contractor actually responds to an inbound inquiry. Measure both phone and web channels.

**Phone test:**
1. Call the contractor's published business phone number at 6–7 PM on a weekday (avoid Sundays, holidays, and lunch hours).
2. Record:
   - **Answered?** Did a human pick up? Did voicemail answer? No answer?
   - **Voicemail quality?** Professional greeting? Generic voicemail? Helpful instructions?
   - **Callback time:** If not answered, how long until they called/texted back? (If no callback by next business day, record "no callback")
3. Document time of call and result.

**Web form test (if they have a contact form):**
1. Submit their website contact form (name, phone, inquiry about project estimate).
2. Record:
   - **Submission time:** Note the exact time
   - **First response time:** How long until they called, emailed, or texted?
   - **Channel:** Was the response via phone call, text message, or email?
3. If no response within 24 hours, record "no response."

**Record both in template:** "We called at [TIME]. Response: [RESULT] after [X hours]. We submitted your form at [TIME]. Response: [RESULT] after [X hours]."

### Step 2: Google Review Gap (10 minutes)

Compare their review presence to their local competitors. This reveals whether they're losing visibility and trust signals.

**Their profile:**
1. Search Google Business Profile (GBP) for their business name + location (or navigate via Google Maps).
2. Record:
   - Review count (e.g., "47 reviews")
   - Average rating (e.g., "4.7 stars")
   - Date of most recent review
   - Sentiment of recent reviews (positive, mixed, any complaints about response time?)

**Competitor profiles:**
1. Identify 3–4 local competitors offering the same service (same trade, overlapping service area).
2. Search their GBP profiles and record the same metrics.
3. If they're a larger regional business, include a regional competitor for comparison.

**Calculate the gap:**
- "Your business has [X] reviews. Market leaders in your area average [Y]. Gap: [Z] fewer reviews."
- If their reviews are stale (no recent reviews in 6+ months), note: "Latest review is [X] months old — competitors are receiving new reviews weekly."

### Step 3: Competitor Response Comparison (5 minutes)

Optional but recommended: test 1–2 competitors' response times to benchmark.

1. Call or message 1–2 competitors using the same method as Step 1.
2. Record response time and channel.
3. Document any differences (e.g., "Competitor A answered within 3 minutes. Competitor B called back within 2 hours.").
4. Note if they have obvious systems in place: auto-responder text, dedicated receptionist, scheduling link in voicemail.

**Use this to personalize the finding:** "Your [X-hour] response time contrasts with Competitor A's [X-minute] response. On average, prospects contact 2–3 contractors — whoever responds first wins the project."

### Step 4: Revenue Impact Estimate (10 minutes)

Use the ROI Calculator API to translate observed response time and market signals into estimated annual revenue at risk.

**Before the call:**

1. **Estimate monthly lead volume** (from GBP activity signals):
   - If they have 100+ reviews and recent activity (reviews in past week): estimate **15–25 leads/month**
   - If they have 30–100 reviews and moderate activity: estimate **10–15 leads/month**
   - If they have <30 reviews and sparse activity: estimate **5–10 leads/month**
   - If no GBP or very inactive: estimate **5–8 leads/month** (industry floor for local contractors)

2. **Determine trade and default project values:**
   - Kitchen remodel: ~$50K average
   - Full bathroom: ~$25K average
   - Basement renovation: ~$40K average
   - Roofing: ~$15K average
   - Deck/patio: ~$12K average
   - Exterior (siding, windows): ~$35K average
   - Ask yourself: "What's the typical project scope for this trade in this market?"

3. **Use industry-standard close rate:** 25–30% (typical for contractors responding to inbound inquiries).

4. **Use measured response time** from Step 1 (e.g., "14 hours," "45 minutes," "no callback").

5. **Call POST /api/public/roi-calculator** with:
   ```json
   {
     "estimatedLeadsPerMonth": 15,
     "projectValue": 50000,
     "closeRate": 0.28,
     "responseTime": "14 hours"
   }
   ```

6. **Record the output:**
   - `lostRevenueAnnual`: Estimated annual revenue lost due to poor response time
   - `potentialRecoveryAnnual`: Estimated annual revenue recoverable by improving response + follow-up
   - `recoveryTimeframe`: How many recovered projects to break even on service cost

**Example calculation:**
- 15 leads/month × 12 = 180 leads/year
- 28% close rate × 180 = ~50 projects/year at $50K each = $2.5M annual revenue (current trajectory)
- With 14-hour response time, lose 20–30% of leads to faster competitors = 10–15 projects = $500K–$750K/year at risk
- With 2-hour response time + follow-up, recover 50% of lost leads = 5–7 projects = $250K–$350K/year recoverable

---

## Step 5: Compile One-Page Summary

Use the template in `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`. Fill in:
- Business name, date, operator name
- Actual measured response times (phone and web)
- Actual review count and competitive gap
- Estimated monthly leads and revenue at risk
- One personalized insight (2–3 sentences)

Output format: Markdown file (can be printed or saved as PDF).

---

## How It's Used in the Sales Conversation

**Before the call:**
- Operator completes the audit (30–45 minutes)
- Operator prepares the one-page summary

**During the sales conversation (in-person or video):**
1. Operator opens: "I did some research on your business before we talked. Here's what I found."
2. Hands the contractor the one-page summary (printed or on screen)
3. Walk through each section:
   - Speed-to-Lead: "This is what we measured when we tested your line."
   - Review Gap: "This is how you're positioned against your neighbors."
   - Revenue at Risk: "Based on your volume and typical project value, this is what's in play."
4. Close: "Here's what we can do..." (tie back to the numbers)

**Outcome:**
- Contractor sees concrete evidence, not generic claims
- Conversation shifts from skepticism to "how much am I actually losing?" and "can you really help?"
- One-pager becomes a sales artifact (shared with office manager, business partner)

---

## Data Sources & Limitations

**Public sources (all free):**
- Google Business Profile (Maps, reviews, recent activity)
- Business website (contact form, phone number)
- Phone test (direct call)
- Form submission (direct test)
- Competitor GBP profiles (public search)

**Limitations (important for template disclaimer):**
- Estimates are based on public market signals, not actual lead data
- Monthly lead volume is inferred from review activity and trade patterns, not measured
- Close rate uses industry average (25–30%), not their actual close rate
- Response time is measured once, not averaged over time
- Revenue estimates assume typical project values for the trade (actual value varies)
- Does not account for service area, seasonality, or marketing spend

**Accuracy:** Estimates are ±20–30% for illustrative purposes. Actual results depend on close process, lead quality, sales skill, and seasonal demand.

---

## Template & Variables

See `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md` for the fill-in-the-blanks template.

**Key variables to populate:**
- `[Business Name]`, `[Date]`, `[Operator Name]`
- `[TIME]`, `[RESULT]`, `[X hours/minutes]`
- Review counts, ratings, competitor names
- Estimated leads/month, project value, revenue at risk
- Personalized 2–3 sentence insight

---

## Success Criteria

**Audit is complete when:**
- All 5 steps are documented (response time, review gap, competitor comparison, revenue estimate, summary)
- One-page summary is printed or ready to share
- Summary includes at least one specific number the contractor cares about (response time, review count, or annual revenue at risk)

**Conversation is successful when:**
- Contractor acknowledges the speed-to-lead gap or review gap as real
- Contractor engages with the revenue number (asks clarifying questions, relates it to their experience)
- Conversation moves from "why should I listen?" to "how would this work?"

---

## Operator Notes

- **Timing:** Run the audit 1–2 days before the sales conversation (data stays fresh, operator has time to refine messaging)
- **Personalization:** Use trade-specific language and defaults (kitchen remodelers vs. roofers expect different project values)
- **Tone:** Be precise, not sensational. "You're losing $X annually" is stronger than "you might be missing opportunities"
- **Competitor intel:** Don't name competitors in the summary (keep focus on the prospect). Internal notes are fine
- **Follow-up:** Keep the one-pager in the CRM. Post-close, compare estimated revenue to actual — builds credibility with future prospects

---

## Related

- **Post-Sale Diagnostics:** Deeper analysis (requires contractor system access, lead data) in separate spec
- **ROI Calculator API:** `POST /api/public/roi-calculator` — called during Step 4
- **Sales Conversation Flow:** Documented in `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (Section 5: Sales Conversation)
- **Billing & ROI:** Revenue projections tie to contract pricing and guarantee terms (documented in `docs/business-intel/OFFER-APPROVED-COPY.md`)
