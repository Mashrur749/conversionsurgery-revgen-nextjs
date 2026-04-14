# Business Moat Assessment — Structural Gaps

**Date:** 2026-04-14
**Context:** Assessment of three business moats against what's actually built in the platform.

---

## Moat 1: Data — Proprietary Intelligence

**Status: Collection infrastructure complete. Learning pipeline missing.**

### What Exists
- `agentDecisions` table with rich context: signals, outcomes, confidence, model tier, analysisSnapshot, promptVersion
- AI attribution: decisions linked to funnel events (bookings, wins, losses) within 7-day window
- Cross-client effectiveness dashboard: aggregates across all clients (human-readable)
- Smart Assist correction tracking: per-client correction rate computed
- Opt-out reason classification: 6 categories stored per lead

### What's Missing (Plan 4 Phase B/C — deferred until 200+ leads)
- **Conversation analytics service:** Extract patterns from agentDecisions — what action sequences lead to bookings vs lost leads
- **Score calibration:** Compare AI-assigned urgency/budget/intent scores against actual outcomes — adjust thresholds empirically
- **Playbook auto-update:** Feed winning conversation patterns into playbook objection handling and qualifying sequences
- **Cross-client correction analysis:** Aggregate Smart Assist edits across clients to find universal AI tone/content gaps
- **Agent feedback loop:** Weekly cron that pulls positive/negative outcome conversations, extracts patterns, generates KB entries

### When to Build
After 5+ clients / 200+ leads. The data needs volume for statistical significance. One client generating 20 leads/month is noise. Five clients generating 100 leads/month for 3 months is signal.

---

## Moat 2: Switching Cost — Embedded in Operations

**Status: Strongest moat. Naturally deep from correct product design.**

### What Creates Lock-In
| Element | Depth | Exportable? |
|---------|-------|------------|
| Dedicated Twilio phone number | Deep — homeowners have it saved | Number stays with platform |
| Active flow executions | Deep — mid-flight sequences for every lead | Not exportable |
| Google Calendar OAuth sync | Deep — bidirectional, managed events | Tokens revocable but events managed by system |
| Google Review management | Deep — AI drafts, auto-posting | OAuth-linked |
| Ring group + escalation routing | Medium — team routing, SLA rules | Not exportable |
| Biweekly reports with ROI model | Medium — primary performance visibility | Not exportable as reports |
| Knowledge base | Medium — business-specific AI training | Not exportable |
| Conversation history | Weak — exportable as CSV | Full export via data-export-bundle.ts |
| Lead contact data | Weak — exportable as CSV | Full export |

### Assessment
Switching costs are operational, not data-based. A contractor can take their leads and conversations (CASL compliance, correct design). But rebuilding the phone routing, active follow-up sequences, calendar sync, review management, and team coordination elsewhere is weeks of work. This moat deepens with every month of usage.

---

## Moat 3: Reputation — Small Market Network Effects

**Status: Half built. Review automation works. Social proof capture missing.**

### What Exists
- Review request automation: fires on job completion, sentiment-gated, rate-capped
- Homeowner NPS surveys: automated 4-24 hours after appointments
- Referral request automation: scheduled after review request
- Referral counting: `leads.source = 'referral'` tracked, `dailyStats.referralsRequested` counted

### What's Missing

#### MOAT-REP-01: Shareable Report Link
**Impact:** High — arms word-of-mouth
**Effort:** Small (1-2 hours)

Contractors can't share their results with peers. Reports live in the dashboard only. Need: a public, expiring URL for the biweekly report so a contractor can text it to a friend. "Look what this thing did for me this month."

**Implementation:**
- API route that generates a signed, time-limited URL (7-day expiry)
- Public page that renders the report (read-only, no auth)
- "Share Report" button on the client portal reports page
- Signed URL contains reportId + HMAC signature — no auth required for viewing

#### MOAT-REP-02: Contractor NPS / Testimonial Capture
**Impact:** High — feeds sales collateral
**Effort:** Small (1-2 hours)

Homeowner NPS exists. Contractor NPS doesn't. No mechanism to capture "this tool is great" from contractors for use in sales.

**Implementation:**
- Monthly SMS to contractor: "On a scale of 1-10, how likely are you to recommend ConversionSurgery to another contractor?"
- Score 9-10: follow-up "Would you mind if we shared that with other contractors? Reply with a short sentence about your experience."
- Store in `contractorNps` table (clientId, score, comment, consentToShare)
- Testimonials with consent feed into sales collateral

#### MOAT-REP-03: Referral Attribution
**Impact:** Medium — tracks which contractors drive referrals
**Effort:** Small

Currently: referrals are counted but not traced to who sent them. 

**Implementation:**
- Per-client referral code (e.g., `REF-MIKE`)
- When a new lead mentions a referral code (or the referring contractor's name), link the referral
- Track: which contractors generate referrals, conversion rate of referred leads vs organic

### When to Build
MOAT-REP-01 and MOAT-REP-02 before Client #5 signs — they arm the word-of-mouth engine that makes outbound unnecessary. MOAT-REP-03 after 5+ clients when referral volume is meaningful.

---

## Priority Summary

```
NOW (0 clients):
  Nothing to build — moats require clients generating data

Before Client #5:
  MOAT-REP-01: Shareable report link (arms word-of-mouth)
  MOAT-REP-02: Contractor NPS + testimonial capture (feeds sales)

After 200+ leads:
  Plan 4 Phase B: A/B testing, conversation analytics
  Plan 4 Phase C: Score calibration, playbook auto-update
  MOAT-REP-03: Referral attribution

The data moat activates automatically with volume.
The switching cost moat deepens with every month of usage.
The reputation moat needs two small features to arm it.
```
