# Scoring Rubric — Green / Yellow / Red + Business Impact

How to score each profile x touchpoint combination. The goal is consistency: two runs of the simulation should produce similar scores for the same profile.

## General Framework

### GREEN — Works as designed
- The touchpoint proceeds exactly as described in the playbook
- No adaptation needed by the operator
- The contractor's characteristics don't create friction at this step
- The assumption the touchpoint makes about the client is true for this profile
- No upstream cascade penalties apply (or upstream was green)

### YELLOW — Works but needs adaptation
- The touchpoint can still deliver value, but requires:
  - A modified approach by the operator (different script, extra explanation)
  - An extra step not in the standard playbook
  - Managing contractor expectations differently
  - A workaround for a missing feature/integration
- The contractor will still get a positive experience, but it takes more effort or time
- The risk of failure is elevated but manageable
- **Cascade-adjusted yellow:** a green touchpoint shifted to yellow because an upstream dependency scored yellow or red

### RED — Breaks, doesn't apply, or creates negative experience
- The touchpoint cannot deliver its intended value for this profile
- The assumption is fundamentally wrong (e.g., "syncs with Google Calendar" but contractor uses paper)
- Attempting this step would create confusion, frustration, or a broken promise
- There's no reasonable workaround within the current system
- The contractor would perceive a gap between what was promised and what was delivered
- **Cascade-adjusted red:** a yellow touchpoint shifted to red because an upstream dependency scored red

---

## Cascade Penalty Rules

Before scoring a touchpoint, check whether any upstream dependency scored yellow or red. See `cascade-chains.md` for the full chain definitions.

| Upstream Score | This Touchpoint's Baseline | Adjusted Score |
|:--------------:|:--------------------------:|:--------------:|
| Green | Green | Green (no change) |
| Yellow | Green | Green or Yellow (yellow if this touchpoint has *any* additional friction for this profile) |
| Yellow | Yellow | Yellow (no change, but note cumulative operator burden) |
| Red | Green | Yellow (degraded baseline) |
| Red | Yellow | Red (compounded failure) |
| 2+ Yellow upstreams | Green | Yellow (treat as equivalent to 1 red upstream) |
| 2+ Yellow upstreams | Yellow | Red |

---

## Business Impact Framework

For every yellow or red score, estimate these three dimensions:

### 1. Operator Hours Impact
How much extra time does this friction add?

| Level | Description | Estimate |
|-------|-------------|----------|
| None | Green — no extra time | 0 min |
| Low | Quick workaround — different script, one extra text | 5-10 min one-time |
| Medium | Requires follow-up, repeated hand-holding, or process deviation | 15-30 min/week ongoing |
| High | Requires sustained extra effort — frequent escalations, manual monitoring | 30-60 min/week ongoing |
| Extreme | This one client consumes as much time as 2-3 normal clients | 60+ min/week ongoing |

### 2. Revenue Risk
Does this friction reduce the client's perceived value or likelihood of staying?

| Level | Description | Monthly revenue at risk |
|-------|-------------|:----------------------:|
| None | Green — no revenue risk | $0 |
| Low | Minor inconvenience, client barely notices | $0 |
| Medium | Client notices friction, mentions it on check-in calls | 10-25% of monthly fee |
| High | Client questions value, considers pausing or canceling | 25-50% of monthly fee |
| Critical | Client will cancel if this isn't resolved within 30 days | 50-100% of monthly fee |

### 3. Churn Signal Strength
How strongly does this friction predict churn? (Used for segment viability scoring)

| Signal | Description | Weight |
|--------|-------------|:------:|
| None | No impact on retention | 0 |
| Weak | Annoyance, not a deal-breaker | 1 |
| Moderate | Erodes trust over time, may tip the scales if combined with other friction | 2 |
| Strong | Creates a "this doesn't work" perception — active churn driver | 3 |
| Critical | Day 1 / Week 1 failure that poisons the entire relationship | 5 |

### Computing segment churn probability

Sum the churn signal weights across all touchpoints for a profile. Map to probability:

| Total Churn Signal Score | Churn Probability | Segment Classification |
|:------------------------:|:-----------------:|:----------------------:|
| 0-5 | Low (<15%) | Green segment |
| 6-12 | Moderate (15-35%) | Yellow segment |
| 13-20 | High (35-60%) | Red segment — needs service variant |
| 21+ | Very High (>60%) | Red segment — avoid or redesign |

**Trust-critical touchpoints** (T5, T6, T12, T17, T25) get 1.5x weight in the churn signal sum because they're the moments where the contractor forms or updates their opinion of the service.

---

## Per-Category Rubrics

### Phone & Voice Setup (T3-T6)

| Color | Criteria |
|-------|----------|
| GREEN | Cell phone, standard carrier, *61 forwarding works, voicemail can be disabled |
| YELLOW | VoIP/PBX (needs admin portal access), Google Voice (can't forward — must use Twilio number as primary), or carrier voicemail hard to disable |
| RED | No smartphone, landline only with no forwarding capability, or contractor refuses to change phone setup |

**Impact:** Operator hours: Low (yellow) to None (green). Churn signal: Strong if red (Day 1 broken). Check cascade chain #2.

### Payment Capture (T2, T7)

| Color | Criteria |
|-------|----------|
| GREEN | Contractor comfortable with online payment, has credit/debit card, enters card on call |
| YELLOW | Hesitant but persuadable — needs reassurance script, may need to follow up after call |
| RED | Cash-only business, no credit card, or actively refuses online payment (extremely rare in ICP) |

**Impact:** Operator hours: Low (yellow, follow-up needed). Churn signal: Weak (this is a one-time hurdle).

### Data Collection (T8, T9, T10)

| Color | Criteria |
|-------|----------|
| GREEN | Contractor can provide info on the call — has quotes accessible, can articulate services/pricing |
| YELLOW | Contractor says "I'll send it later" (they usually won't), info is scattered (paper files), can't articulate pricing clearly ("it depends") |
| RED | Zero dead quotes AND zero describable services (brand new business with no history), or contractor refuses to share business info |

**Impact:** Operator hours: Medium-High (yellow at T10 cascades into ongoing KB maintenance). Churn signal: Moderate (feeds KB Thinning chain). Check cascade chain #1.

### Calendar & Booking (T22)

| Color | Criteria |
|-------|----------|
| GREEN | Uses Google Calendar, is the only person who handles estimates, calendar reflects real availability |
| YELLOW | Uses Google Calendar but team members also handle site visits (their calendars not synced), or availability isn't fully reflected in GCal |
| RED | Uses Outlook/Exchange (no integration), uses paper calendar, uses FSM calendar as source of truth (Jobber scheduler, not GCal), or has no calendar at all |

**Impact:** Operator hours: Low (workaround: manual booking). Churn signal: Moderate (double-booking erodes trust). Check cascade chains #2 and #4.

### FSM/Tool Integration (T11)

| Color | Criteria |
|-------|----------|
| GREEN | Uses Jobber (supported integration) |
| YELLOW | Uses no FSM (no integration needed, but also no automation triggers from their side) |
| RED | Uses Housecall Pro, ServiceTitan, Buildertrend, or other FSM — expects integration but none exists, creating a "two systems" problem |

**Impact:** Operator hours: None (green/yellow) to Medium (red — ongoing manual coordination). Churn signal: Moderate-Strong if red (organized contractors expect integration). Check cascade chain #5.

### Smart Assist & AI Quality (T18, T19)

| Color | Criteria |
|-------|----------|
| GREEN | Sufficient lead volume (15+/month) for KB gap sprint, operator can review drafts within 5-min windows |
| YELLOW | Low volume (8-14/month) — few conversations to review, KB stays thin entering autonomous mode |
| RED | Near-zero inbound during Week 2 (system has nothing to do), or contractor is referral-only with leads who don't text |

**Impact:** Operator hours: Varies (low volume = less review time but also less value delivered). Churn signal: Strong if red (system appears useless). Check cascade chains #1 and #3.

### Estimate Follow-up Triggers (T21)

| Color | Criteria |
|-------|----------|
| GREEN | Contractor understands SMS trigger, will use it regularly, handles own estimates |
| YELLOW | Office manager handles estimates (notification goes to wrong person), or contractor is low-tech and won't remember the SMS keyword |
| RED | Contractor sends all estimates through FSM (expects auto-detection — Jobber integration exists but estimate trigger is still manual), or contractor doesn't send written estimates (verbal quotes only) |

**Impact:** Operator hours: Low. Revenue risk: High — this is the highest-value automation. If unused, the core value prop (revenue recovery from stale estimates) doesn't activate. Churn signal: Moderate (contractor doesn't see results, but doesn't know why). Check cascade chain #4.

### Reporting & Retention (T25, T26)

| Color | Criteria |
|-------|----------|
| GREEN | Contractor reads reports, pipeline has data, system has activity to report |
| YELLOW | Low volume = thin reports, contractor doesn't read email (SMS pipeline update is the only touchpoint) |
| RED | Zero activity to report (system never engaged any leads), pipeline stuck at $0 because contractor doesn't update lead statuses |

**Impact:** Operator hours: None (automated). Churn signal: Moderate (thin reports erode perceived value). Trust-critical touchpoint — 1.5x churn weight. Check cascade chain #3.

### Guarantee Evaluation (T29, T31)

| Color | Criteria |
|-------|----------|
| GREEN | 15+ leads/month, system engaged them, contractor marks outcomes — guarantee passes naturally |
| YELLOW | 8-14 leads/month (extended window), or contractor doesn't mark wins (pipeline shows $0 despite real results) |
| RED | <8 leads/month (case-by-case territory), or contractor had zero inbound (marketing failure, not system failure — but guarantee still fails) |

**Impact:** Operator hours: Medium (yellow — manual review and outreach). Revenue risk: Critical if red (refund + lost client). Churn signal: Strong (guarantee failure = relationship-ending event).

### Quarterly Campaigns (T30)

| Color | Criteria |
|-------|----------|
| GREEN | Customer list available for Q1 reactivation, completed jobs available for Q2 review sprint, lead history for Q3 pipeline builder |
| YELLOW | Thin customer list (<20 contacts), few completed jobs to request reviews from, seasonal pause overlaps with campaign timing |
| RED | Zero customer history (brand new business), contractor paused during campaign quarter, zero completed jobs for review sprint |

**Impact:** Operator hours: Low. Revenue risk: Medium (missed growth opportunity, not active value destruction). Churn signal: Weak. Check cascade chain #6.

### Operator Capacity (T13, T18, T25, T27, T32)

This is a meta-assessment: does this profile's operational burden fit within operator capacity?

| Color | Criteria |
|-------|----------|
| GREEN | Standard operational load — 45-60 min/week target per client |
| YELLOW | High-maintenance profile: high volume + frequent escalations, or low-tech contractor who needs extra hand-holding, or contractor who doesn't respond to operator texts |
| RED | Profile would consume 2x+ normal operator time — e.g., high-volume multi-crew operation with a thin KB and a contractor who is unresponsive to operator questions |

**Impact:** Operator hours: by definition, the highest-impact dimension. Churn signal: Indirect — operator burnout leads to dropped balls across ALL clients, not just this one. In **Portfolio Simulation** mode, this is the primary bottleneck to model.

---

## Impact Score Formula

For the aggregated report, compute a composite impact score per touchpoint:

```
Impact Score = (% affected / 100) × severity × position_weight × revenue_mult
```

| Factor | Values |
|--------|--------|
| severity | red = 3, yellow = 1 |
| position_weight | Pre-sale/Day 1 (T0-T13) = 2.0, Week 1-3 (T14-T20) = 1.5, Ongoing (T21-T28) = 1.0, Quarterly (T29-T32) = 0.8 |
| revenue_mult | Average monthly fee of affected profiles / $497 (base plan) — normalizes to 1.0 for standard clients |

This ensures early-journey reds on high-value clients rank above late-journey yellows on low-value clients.
