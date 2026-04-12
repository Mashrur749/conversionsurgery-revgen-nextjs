# Service Delivery Simulation: 30-Profile Portfolio Model

**Date**: 2026-04-10
**Method**: Full lifecycle simulation (T0-T32) with cascade modeling, operator capacity analysis, and 15-client portfolio stress test.
**Context**: Post-hardened onboarding script. Quick fixes applied (KB pre-pop, call forwarding verification, EST walkthrough, calendar qualification, responsiveness screening, Day 45 retention call).

---

## Section 1: Profile Distribution (30 Profiles)

### Archetype A: Solo Kitchen Specialist (6 profiles)

| # | Name | Revenue | Leads/mo | Avg Job | Calendar | Phone | CRM | Tech | Reply Time | Seasonality |
|---|------|---------|----------|---------|----------|-------|-----|------|------------|-------------|
| A1 | Marcus | $780K | 18 | $38K | GCal (daily) | Cell (Rogers) | None | Med | 15 min | Moderate (Nov-Feb -35%) |
| A2 | Tanya | $650K | 16 | $42K | iPhone Cal | Cell (Bell) | Spreadsheet | Med | 30 min | Moderate (Dec-Feb -40%) |
| A3 | Greg | $720K | 17 | $36K | GCal (sporadic) | Cell (Telus) | None | Med | 45 min | Mild (Jan -20%) |
| A4 | Nadia | $690K | 15 | $48K | Paper notebook | Cell (Fido) | Spreadsheet | Med-Low | 20 min | Moderate (Nov-Feb -30%) |
| A5 | Kevin | $810K | 18 | $40K | GCal (daily) | Cell (Rogers) | None | Med | 10 min | Strong (Dec-Feb -50%) |
| A6 | Simone | $660K | 16 | $35K | Phone reminders | Cell (Koodo) | Nothing | Med | 25 min | Mild (Jan -15%) |

### Archetype B: Small Crew Renovator (8 profiles)

| # | Name | Revenue | Team | Leads/mo | Avg Job | Calendar | Phone | CRM | Tech | Reply Time | Seasonality |
|---|------|---------|------|----------|---------|----------|-------|-----|------|------------|-------------|
| B1 | Derek | $1.2M | +2 crew | 26 | $42K | GCal (shared) | Biz VoIP (Ring) | Jobber | Med-Hi | 20 min | Mild |
| B2 | Jason | $850K | +1 crew | 22 | $35K | GCal (personal) | Cell (Rogers) | Jobber | Med | 30 min | Moderate |
| B3 | Priya | $780K | +spouse | 17 | $32K | GCal (both) | Cell (Telus) | None | Med | 15 min | Moderate |
| B4 | Luis | $920K | +1 crew | 24 | $38K | Phone calendar | Cell (Bell) | Nothing | Med-Low | 40 min | Mild |
| B5 | Amy | $870K | +2 crew | 25 | $30K | GCal (sporadic) | Cell (Fido) | Jobber | Med | 25 min | Moderate |
| B6 | Frank | $750K | +1 crew | 20 | $33K | Paper wall cal | Cell (Koodo) | Nothing | Low-Med | 35 min | Moderate |
| B7 | Sandra | $800K | +1 crew | 21 | $36K | GCal (daily) | Cell (Rogers) | Jobber | Med | 20 min | Mild |
| B8 | Raj | $680K | +1 crew | 20 | $28K | Phone reminders | Cell (Bell) | Nothing | Med-Low | 45 min | Strong |

### Archetype C: Basement/Bath Guy (5 profiles)

| # | Name | Revenue | Team | Leads/mo | Avg Job | Calendar | Phone | CRM | Tech | Reply Time | Seasonality |
|---|------|---------|------|----------|---------|----------|-------|-----|------|------------|-------------|
| C1 | Ray | $900K | +1 crew | 20 | $40K | No digital | Cell + landline | None | Very Low | 60 min | Spring rush |
| C2 | Pete | $680K | Solo | 16 | $30K | Paper notepad | Cell (Fido) | Spreadsheet | Low | 45 min | Spring rush |
| C3 | Donna | $620K | +1 sub | 15 | $28K | Paper wall cal | Cell (Android) | Nothing | Low | 50 min | Spring/summer |
| C4 | Vince | $750K | +1 crew | 18 | $35K | GCal (rarely) | Cell (Rogers) | None | Med-Low | 30 min | Moderate |
| C5 | Marie | $640K | Solo | 15 | $25K | iPhone Cal | Cell (Bell) | Nothing | Med-Low | 40 min | Strong seasonal |

### Archetype D: Growing Interior Crew (4 profiles)

| # | Name | Revenue | Team | Leads/mo | Avg Job | Calendar | Phone | CRM | Tech | Reply Time | Seasonality |
|---|------|---------|------|----------|---------|----------|-------|-----|------|------------|-------------|
| D1 | Tony | $1.1M | +lead carp | 28 | $45K | GCal (inconsistent) | Cell (Rogers) | Prev Jobber | Med-Hi | 15 min | Strong spring |
| D2 | Andrea | $1.3M | +2 crew + office | 30 | $50K | GCal (shared) | Biz line (Ooma) | Jobber | Med-Hi | 10 min | Mild |
| D3 | Mike | $950K | +2 crew | 25 | $38K | GCal (personal) | Cell (Telus) | Jobber | Med | 20 min | Moderate |
| D4 | Yusuf | $1.0M | +3 crew | 27 | $55K | GCal (shared) | Cell (Bell) | Jobber | Med | 25 min | Mild |

### Archetype E: Responsive Tech-Forward (3 profiles)

| # | Name | Revenue | Team | Leads/mo | Avg Job | Calendar | Phone | CRM | Tech | Reply Time | Seasonality |
|---|------|---------|------|----------|---------|----------|-------|-----|------|------------|-------------|
| E1 | Chris | $820K | Solo | 22 | $38K | GCal (daily) | Cell (Rogers) | Jobber + GCal | High | 5 min | Mild |
| E2 | Jen | $750K | +1 crew | 20 | $45K | GCal (daily) | Cell (Bell) | Jobber | High | 8 min | Moderate |
| E3 | Omar | $680K | Solo | 20 | $30K | GCal (daily) | Cell (Telus) | Jobber + sheets | High | 5 min | Mild |

### Archetype F: Moderate Seasonal (4 profiles)

| # | Name | Revenue | Team | Leads/mo | Avg Job | Calendar | Phone | CRM | Tech | Reply Time | Seasonality |
|---|------|---------|------|----------|---------|----------|-------|-----|------|------------|-------------|
| F1 | Lisa | $680K | Solo | 16 | $30K | iPhone Cal | Cell (Bell) | None | Med-Low | 30 min | Strong (80% Apr-Sep) |
| F2 | Helen | $610K | +1 part-time | 15 | $25K | Paper desk cal | Cell (Fido) | None | Low | 60 min | Mild winter dip |
| F3 | Dan | $720K | +1 crew | 18 | $32K | GCal (sporadic) | Cell (Rogers) | None | Med | 35 min | Moderate (Nov-Feb -40%) |
| F4 | Barb | $650K | Solo | 15 | $28K | Phone reminders | Cell (Koodo) | Nothing | Med-Low | 40 min | Strong (70% May-Oct) |

**Summary distribution:**
- GCal daily/shared users: 13 of 30 (43%)
- GCal sporadic/rarely: 4 of 30 (13%)
- iPhone/phone calendar: 4 of 30 (13%)
- Paper/no digital calendar: 9 of 30 (30%)
- VoIP/business phone: 2 of 30 (7%)
- Jobber users: 10 of 30 (33%)
- No CRM/nothing: 14 of 30 (47%)
- Spreadsheet: 4 of 30 (13%)
- Strong seasonality: 7 of 30 (23%)
- Team > 1 person: 14 of 30 (47%)

---

## Section 2: Touchpoint Definitions (T0-T32)

| # | Touchpoint | Phase | Position Weight |
|---|-----------|-------|-----------------|
| T0 | Pre-sale audit + responsiveness screening | Pre-sale | 2.0 |
| T1 | Sales call + objection handling | Pre-sale | 2.0 |
| T2 | Payment capture (Stripe link) | Day 1 | 2.0 |
| T3 | Phone provisioning + call forwarding | Day 1 | 2.0 |
| T4 | "Call your own number" wow moment | Day 1 | 2.0 |
| T5 | Exclusion list + old quote collection | Day 1 | 2.0 |
| T6 | KB setup (onboarding call) — with pre-pop | Day 1 | 2.0 |
| T7 | Calendar qualification + sync setup | Day 1 | 2.0 |
| T8 | Team member identification + setup | Day 1 | 2.0 |
| T9 | EST walkthrough (live on call) | Day 1 | 2.0 |
| T10 | Day 3-4 check-in SMS | Week 1 | 2.0 |
| T11 | KB gap auto-notify (ongoing) | Week 1-2 | 1.5 |
| T12 | Week 2 Smart Assist period | Week 2 | 1.5 |
| T13 | Guarantee milestone SMS (30-day) | Week 4 | 1.5 |
| T14 | Autonomous mode activation | Week 3+ | 1.5 |
| T15 | Estimate follow-up sequence (EST trigger) | Ongoing | 1.5 |
| T16 | EST fallback nudge (48h) | Ongoing | 1.5 |
| T17 | Calendar sync + AI booking | Ongoing | 1.5 |
| T18 | Payment collection (Stripe links) | Ongoing | 1.0 |
| T19 | Weekly pipeline SMS (Monday) | Ongoing | 1.0 |
| T20 | Bi-weekly reports | Ongoing | 1.0 |
| T21 | Win-back / dormant re-engagement | Ongoing | 1.0 |
| T22 | Escalation handling | Ongoing | 1.0 |
| T23 | Review request automation | Ongoing | 1.0 |
| T24 | Quarterly campaigns | Quarterly | 0.8 |
| T25 | 30-day guarantee evaluation | Month 1 | 1.5 |
| T26 | 90-day guarantee evaluation | Month 3 | 1.5 |
| T27 | Day 45 proactive retention call | Month 1.5 | 1.5 |
| T28 | Cancellation alert (operator SMS) | Event | 1.0 |
| T29 | Notification volume management | Ongoing | 1.0 |
| T30 | Revenue data accuracy (WON/LOST tracking) | Ongoing | 1.0 |
| T31 | Operator daily checklist sustainability | Ongoing | 1.0 |
| T32 | Multi-person coordination | Ongoing | 1.0 |

---

## Section 3: Touchpoint Heatmap (30 profiles)

### Quick-Fix Impact Key
- **[QF]** = Quick fix applied, rating improved from pre-fix baseline
- Cascade penalties shown as **[C:source]**

| Touchpoint | GREEN | YELLOW | RED | % Affected (Y+R) | Pre-Fix % Affected | Delta |
|-----------|-------|--------|-----|-------------------|-------------------|-------|
| **T0: Pre-sale audit + screening** | 24 | 6 | 0 | 20% | 33% | -13% [QF] |
| **T1: Sales call** | 16 | 14 | 0 | 47% | 50% | -3% |
| **T2: Payment capture** | 18 | 10 | 2 | 40% | 43% | -3% |
| **T3: Phone provisioning** | 22 | 6 | 2 | 27% | 40% | -13% [QF] |
| **T4: Wow moment** | 22 | 6 | 2 | 27% | 37% | -10% [QF] |
| **T5: Old quote collection** | 8 | 18 | 4 | 73% | 75% | -2% |
| **T6: KB setup (pre-populated)** | 20 | 8 | 2 | 33% | 53% | -20% [QF] |
| **T7: Calendar qualification** | 17 | 4 | 9 | 43% | 50% | -7% [QF] |
| **T8: Team member setup** | 20 | 8 | 2 | 33% | N/A (new) | N/A |
| **T9: EST walkthrough (live)** | 22 | 8 | 0 | 27% | 53% | -26% [QF] |
| **T10: Day 3-4 check-in** | 22 | 8 | 0 | 27% | 30% | -3% |
| **T11: KB gap auto-notify** | 18 | 10 | 2 | 40% | 50% | -10% [QF:KB pre-pop] |
| **T12: Week 2 Smart Assist** | 14 | 12 | 4 | 53% | 57% | -4% |
| **T13: Guarantee milestone SMS** | 26 | 4 | 0 | 13% | N/A (new) | N/A |
| **T14: Autonomous mode** | 17 | 9 | 4 | 43% | 47% | -4% |
| **T15: EST trigger (ongoing)** | 14 | 10 | 6 | 53% | 67% | -14% [QF:walkthrough] |
| **T16: EST fallback nudge** | 12 | 14 | 4 | 60% | 67% | -7% |
| **T17: Calendar + booking** | 17 | 4 | 9 | 43% | 50% | -7% [QF:qualification] |
| **T18: Payment collection** | 18 | 8 | 4 | 40% | 43% | -3% |
| **T19: Weekly pipeline SMS** | 22 | 6 | 2 | 27% | 30% | -3% |
| **T20: Bi-weekly reports** | 14 | 12 | 4 | 53% | 57% | -4% |
| **T21: Win-back / dormant** | 16 | 10 | 4 | 47% | 50% | -3% |
| **T22: Escalation handling** | 18 | 8 | 4 | 40% | 43% | -3% |
| **T23: Review automation** | 16 | 10 | 4 | 47% | 50% | -3% |
| **T24: Quarterly campaigns** | 14 | 14 | 2 | 53% | 57% | -4% |
| **T25: 30-day guarantee** | 22 | 4 | 4 | 27% | 33% | -6% |
| **T26: 90-day guarantee** | 18 | 6 | 6 | 40% | 47% | -7% |
| **T27: Day 45 retention call** | 26 | 4 | 0 | 13% | N/A (new) | N/A |
| **T28: Cancellation alert** | 28 | 2 | 0 | 7% | N/A (new) | N/A |
| **T29: Notification volume** | 16 | 10 | 4 | 47% | 50% | -3% |
| **T30: Revenue data accuracy** | 10 | 12 | 8 | 67% | 73% | -6% |
| **T31: Operator checklist** | 0 | 30 | 0 | 100% | 100% | 0% |
| **T32: Multi-person coordination** | 16 | 8 | 6 | 47% | 53% | -6% |

**Summary**: Quick fixes reduced average % affected from 49% to 40% across all touchpoints. Largest improvements at T6 (KB pre-pop, -20%), T9 (EST walkthrough, -26%), T0 (responsiveness screening, -13%), T3 (call forwarding verification, -13%).

---

## Section 4: Structural Bottlenecks (>20% affected)

### SB-1: Revenue Data Accuracy — No WON/LOST SMS Commands (67% affected, 20 profiles)

**Profiles**: All non-Jobber profiles + inconsistent Jobber users (C1-C5 RED, B4/B6/B8 RED, A4/A6/F2/F4 RED, rest YELLOW)

**Cascade chain**: T30 red/yellow → degrades T20 (report understates ROI), T26 (90-day guarantee data weak), T27 (Day 45 call has wrong numbers), T28 (cancellation page shows bad ROI)

**Impact Score**: (67/100) x 9 x 1.0 x 1.3 = **7.8** (CRITICAL)

**Root cause**: Confirmed revenue requires explicit contractor action (portal click or SMS command). WON/LOST SMS commands with reference codes are NOT YET SHIPPED. Auto-detect probable wins (appointment → 7-day silence → prompt) is NOT YET SHIPPED. The only mitigation is the probable wins nudge (14-day cooldown, requires reply).

**Operator hours impact**: +0.5 hr/week per affected client manually entering wins = **+10 hr/week at 20 affected clients**

**What ships fix this**: WON/LOST SMS commands + auto-detect probable wins. Together they reduce this from 67% to ~25% (Jobber users auto-synced, SMS command catches most of the rest, auto-detect catches the remainder).

---

### SB-2: Old Quote Collection Fails at Onboarding (73% affected, 22 profiles)

**Profiles**: Paper/no-CRM profiles RED (C1-C3, F2, A4, A6, B4, B6 = 8 RED), rest YELLOW except Jobber exporters and organized GCal users

**Impact Score**: (73/100) x 7 x 2.0 x 1.2 = **12.3** (CRITICAL)

**Root cause**: Onboarding call asks for old quotes but 73% cannot provide a clean list in real-time. Paper notebooks, phone contacts, memory-only. The win-back pool starts thin, delaying the "proof of life" moment.

**Operator hours impact**: +0.3 hr per client for follow-up quote import call = one-time +6.6 hr across 22 clients

**Mitigation (process, not code)**: Formalize Day 2-3 "Quote Import Call" (15 min). Pre-send an SMS template: "Before our next call, think of 5 people you gave a quote to in the last 6 months. Just first name + what the project was." This shifts the list quality from improvised to prepared.

---

### SB-3: Non-GCal Booking Has No Confirmation Mode (43% affected, 13 profiles)

**Profiles**: C1-C3 RED, A4 RED, B4/B6 RED, F2 RED, C5/A6/B8/F4 YELLOW (phone cal/sporadic), D1/B5/Dan YELLOW (sporadic GCal)

**Cascade chain**: T7 red → degrades T17 (double-booking risk), T22 (escalation from angry homeowner), T25/T26 (guarantee impact from failed appointments)

**Impact Score**: (43/100) x 9 x 1.5 x 1.3 = **7.5** (CRITICAL)

**Root cause**: Booking confirmation mode for non-GCal clients is NOT YET SHIPPED. The platform either uses GCal availability (43% of profiles) or falls back to business hours only. Paper-calendar contractors have no protection against double-booking. Calendar qualification (shipped) identifies these clients but the alternative path does not exist yet.

**Operator hours impact**: +0.25 hr/week per non-GCal client manually checking bookings = +2.25 hr/week at 9 RED profiles

**What ships fix this**: Booking confirmation mode (SMS to contractor: "Booking request: [Name], [time]. Reply YES/NO"). Single most impactful unshipped feature for churn prevention.

---

### SB-4: EST Trigger Adoption Decay Post-Walkthrough (53% affected, 16 profiles)

**Profiles**: Despite the live EST walkthrough (QF shipped), ongoing usage decays. C1-C3 RED (will forget within 2 weeks), B4/B6/B8 RED (low-tech crew won't sustain), A4/A6/F2/F4 YELLOW (inconsistent), D1 YELLOW (forgets during surge)

**Cascade chain**: T15 red/yellow → degrades T21 (win-back fires on leads already closed), T30 (revenue data wrong), T20 (report inaccurate)

**Impact Score**: (53/100) x 8 x 1.5 x 1.2 = **7.6** (CRITICAL)

**Root cause**: The EST walkthrough teaches the command on Day 1, but there is no reinforcement mechanism. Proactive "Did you send a quote?" SMS at 3 days is NOT YET SHIPPED. The fallback nudge fires at 48h (not shortened to 24h as planned). The gap between "taught once" and "habitual use" is the failure zone.

**Operator hours impact**: +0.2 hr/week per affected client monitoring for missed estimates = +3.2 hr/week

---

### SB-5: Bi-Weekly Report Not Consumed by Non-Email Contractors (53% affected, 16 profiles)

**Profiles**: C1-C5 YELLOW/RED, B4/B6/B8 YELLOW, A4/A6 YELLOW, F2/F4 YELLOW, D1 RED (ignores email), F1 YELLOW

**Cascade chain**: T20 red/yellow → degrades T27 (retention call less effective without shared context), T26 (90-day guarantee narrative weak)

**Impact Score**: (53/100) x 7 x 1.0 x 1.2 = **4.5** (HIGH)

**Root cause**: Report delivered via email. Report inline SMS summary is NOT YET SHIPPED. The auto-follow-up SMS says "check your email" but does not include the key numbers.

**Operator hours impact**: +0.15 hr/week per client requiring personal report delivery call = +2.4 hr/week

---

### SB-6: Week 2 Smart Assist Operator Load (53% affected, 16 profiles)

**Profiles**: B1/D2 YELLOW (high volume = 50+ drafts), B3/Priya RED (tone scrutiny), C1-C3 RED (tone mismatch), F1 YELLOW (wants to see all messages), A4 YELLOW, F2 YELLOW

**Impact Score**: (53/100) x 6 x 1.5 x 1.0 = **4.8** (HIGH)

**Root cause**: Smart Assist requires operator review of AI drafts. At 15+ clients, Week 2 overlaps create 100+ drafts/day across the portfolio. Tone-sensitive profiles (Priya, formal contractors) escalate every mismatch. The KB pre-pop fix helps (fewer deflections) but tone matching remains imperfect.

**Operator hours impact**: +1.5 hr/week per Smart Assist client. At 3 simultaneous Smart Assist clients: +4.5 hr/week surge.

---

### SB-7: Notification Volume for High-Lead Clients (47% affected, 14 profiles)

**Profiles**: B1/D1/D2/D3/D4 YELLOW (25+ leads = 50+ notifications/week), B2/B5/B7 YELLOW (20+ leads), E1-E3 GREEN (tech-forward, manage well), rest mixed

**Impact Score**: (47/100) x 5 x 1.0 x 1.0 = **2.4** (MEDIUM)

**Root cause**: Notification digest mode is NOT YET SHIPPED. Every AI reply fires a contractor notification SMS. At 25+ leads/month, contractor stops reading notifications, misses real escalations buried in the noise.

---

### SB-8: Autonomous Mode Activation Invisible (43% affected, 13 profiles)

**Profiles**: C1-C5 YELLOW (don't know it happened), B4/B6/B8 YELLOW, A4/A6 YELLOW, F2/F4 YELLOW, D1 RED (doesn't know if system is doing anything)

**Impact Score**: (43/100) x 5 x 1.5 x 1.0 = **3.2** (MEDIUM-HIGH)

**Root cause**: Autonomous mode activation notification + PAUSE command is NOT YET SHIPPED. Low-engagement contractors transition to autonomous without awareness. Combined with the "can't tell if it's doing anything" failure mode, this creates an evidence vacuum.

---

### SB-9: Multi-Person Coordination Friction (47% affected, 14 profiles)

**Profiles**: B1 RED (VoIP + estimator), D2 RED (office person + crew), B3 YELLOW (spouse), D3/D4 YELLOW (crew need context), B4-B8 YELLOW (crew), F2 YELLOW

**Cascade chain**: T8 yellow/red → degrades T32 (ongoing coordination), T22 (escalations to wrong person), T15 (EST from non-owner)

**Impact Score**: (47/100) x 6 x 1.0 x 1.1 = **3.1** (MEDIUM-HIGH)

**Root cause**: Team member setup is now part of onboarding (QF shipped: "Does anyone else need booking notifications?"). But ongoing coordination still routes most notifications to owner only. Team members cannot trigger EST/NOSHOW from their own phones in all cases. Pre-appointment context brief is NOT YET SHIPPED.

---

### SB-10: Seasonal Clients Hit Guarantee Risk (27% affected, 8 profiles)

**Profiles**: A5/K5 RED (signed in Nov, Dec-Feb = dead), F1/F4 RED (strong seasonal), C5 YELLOW, A2 YELLOW, B8 YELLOW, D1 YELLOW (spring surge then crash)

**Impact Score**: (27/100) x 8 x 1.5 x 1.0 = **3.2** (MEDIUM-HIGH)

**Root cause**: Guarantee window starts at signup regardless of season. Low-volume months produce insufficient lead activity to meet guarantee thresholds. The platform correctly identifies at-risk clients but the operator must manually intervene.

---

## Section 5: Additional Friction Points (5-20% affected)

| Friction Point | % Affected | Profiles | Impact |
|---------------|-----------|----------|--------|
| VoIP/PBX phone setup delay | 7% (2) | B1 (RingCentral), D2 (Ooma) | Wow moment deferred, Day 1 incomplete |
| Stripe payment for non-smartphone users | 7% (2) | F2, C3 | Payment link unusable, no phone alternative |
| AI tone mismatch (formal contractors) | 13% (4) | B3, C3, A4, F2 | Smart Assist prolonged, operator overhead |
| Double-contact risk (contractor + AI) | 10% (3) | B3, F1, F2 | Trust breach, embarrassment |
| Low-volume guarantee floor (<15 leads) | 10% (3) | F2, C5, F4 | 30-day guarantee at risk from volume alone |
| Jobber expectation gap (want CRM integration) | 10% (3) | D3, D4, B5 | Perceive platform as downgrade from existing tools |

---

## Section 6: Cascade Chains Observed

### Chain 1: KB Thinning (T6/T11 → T14, T15, T20, T21, T26)

**Trigger**: KB pre-populated but thin (3-5 facts only) + contractor does not respond to gap auto-notify
**Profiles activated**: C1, C2, C3, B4, B6, A4, F2 (7 profiles, 23%)
**Cascade effect**: AI deflection rate remains >15% → autonomous mode produces visible failures → contractor loses trust → report shows "AI couldn't answer X questions" → 90-day guarantee narrative weakened
**Post-fix delta**: Previously 40%+ of profiles. KB pre-pop reduces this to 23% — the remaining are contractors who genuinely cannot articulate their business details and do not respond to gap notifications.

### Chain 2: Phone Setup Failure (T3 → T4, T14, T22)

**Trigger**: VoIP/PBX provisioning deferred or failed
**Profiles activated**: B1, D2 (2 profiles, 7%)
**Cascade effect**: No wow moment → Day 1 incomplete → autonomous mode delayed → escalations cannot reach contractor via forwarded line
**Post-fix delta**: Call forwarding verification (QF) reduces this from 15% to 7%. VoIP clients are identified but still require post-call setup.

### Chain 3: Low Volume Starvation (< 15 leads/month in any month)

**Trigger**: Seasonal dip or naturally low volume drops below 15 leads/month
**Profiles activated**: F1 (winter), F4 (winter), C5 (winter), A5 (winter), B8 (winter), F2 (year-round), A2 (winter) = 7 profiles, 23%
**Cascade effect**: T19 (pipeline SMS shows nothing) → T20 (report thin) → T25/T26 (guarantee at risk) → T27 (retention call has weak data) → T21 (win-back pool exhausted faster)
**Post-fix delta**: Responsiveness screening (QF) removes the worst cases (0-5 leads). But seasonal dips cannot be screened out — they are intrinsic to the ICP.

### Chain 4: Team Communication Mismatch (team > 1, notifications to owner only)

**Trigger**: Multi-person operation where the non-owner handles estimates or appointments
**Profiles activated**: B1, D2, D4, B3, D3 (5 profiles with meaningful team friction, 17%)
**Cascade effect**: T8 (setup) → T22 (escalations to wrong person) → T15 (EST from non-owner fails) → T32 (ongoing coordination overhead)
**Post-fix delta**: Team question in onboarding (QF) identifies these clients. Team infrastructure exists. But ongoing notification routing still defaults to owner for many notification types.

### Chain 5: Tool Expectation Gap (non-Jobber FSM users)

**Trigger**: Contractor previously used or expected a CRM/FSM integration
**Profiles activated**: D3, D4, B5 (current Jobber users expecting integration), D1 (ex-Jobber) = 4 profiles, 13%
**Cascade effect**: T23 (review automation requires portal interaction they want in Jobber) → T30 (revenue tracking they want in Jobber) → T24 (campaign approval friction) → T32 (team visibility they expect from FSM)
**Post-fix delta**: No change — this is an architectural gap (no Jobber integration), not an onboarding fix.

### Chain 6: Seasonal Cliff (strong seasonality + winter)

**Trigger**: Revenue drops 40%+ in winter months, leads drop to <10/month
**Profiles activated**: F1, F4, A5, C5, B8 (5 profiles, 17%)
**Cascade effect**: T19 (empty pipeline SMS) → T20 (report shows declining numbers) → T25/T26 (guarantee math tight) → T21 (win-back pool small) → perception of "system not working" when it is working on fewer inputs

---

## Section 7: Leverage Analysis — Highest-ROI Fixes

### Fix 1: WON/LOST SMS Commands + Auto-Detect Probable Wins

| Metric | Value |
|--------|-------|
| Friction points eliminated | 4 (T30, T20 cascade, T26 cascade, T27 cascade) |
| Profiles improved | 20 of 30 (67%) |
| Operator hours saved/month | 40 hr (10 hr/week manual win entry eliminated) |
| Implementation difficulty | Platform (code) — 3-5 days |
| Leverage score | **(4 x 20) / 4 = 20.0** |
| Status | NOT YET SHIPPED |

**What to do**: Ship WON [ref code] / LOST [ref code] SMS commands. Add auto-detect: appointment → 7-day silence → auto-prompt "Did [Name] sign? Reply WON or LOST." This is the single highest-leverage unshipped feature.

---

### Fix 2: Booking Confirmation Mode for Non-GCal Clients

| Metric | Value |
|--------|-------|
| Friction points eliminated | 3 (T7, T17, T25/T26 cascade) |
| Profiles improved | 13 of 30 (43%) |
| Operator hours saved/month | 9 hr (2.25 hr/week manual booking checks eliminated) |
| Implementation difficulty | Platform (code) — 3-5 days |
| Leverage score | **(3 x 13) / 4 = 9.8** |
| Status | NOT YET SHIPPED |

**What to do**: Per-client toggle. Before confirming booking with homeowner, SMS contractor: "Appointment request: [Name], [date/time]. Reply YES to confirm or suggest a new time." One-tap confirmation. Prevents double-booking for paper-calendar contractors.

---

### Fix 3: Report Inline SMS Summary

| Metric | Value |
|--------|-------|
| Friction points eliminated | 2 (T20, T27 cascade) |
| Profiles improved | 16 of 30 (53%) |
| Operator hours saved/month | 10 hr (2.4 hr/week personal report calls eliminated) |
| Implementation difficulty | Platform (template change) — 1 day |
| Leverage score | **(2 x 16) / 1 = 32.0** |
| Status | NOT YET SHIPPED |

**What to do**: Extend auto-follow-up SMS to include one-line summary: "[Biz] 2-week results: X calls caught, Y estimates followed, Z replies from old quotes. Full report in email." The data already exists in report generation. This is a template change.

---

### Fix 4: Proactive "Did You Send a Quote?" SMS at 3 Days

| Metric | Value |
|--------|-------|
| Friction points eliminated | 2 (T15, T16) |
| Profiles improved | 16 of 30 (53%) |
| Operator hours saved/month | 13 hr (3.2 hr/week monitoring for missed estimates) |
| Implementation difficulty | Platform (code) — 2 days |
| Leverage score | **(2 x 16) / 2 = 16.0** |
| Status | NOT YET SHIPPED |

**What to do**: When a lead is in `new` or `contacted` for 3+ days with no EST trigger, SMS contractor: "[Name] has been waiting 3 days. Did you send a quote? Reply EST [Name] or PASS." Shortens fallback from 48h to 72h post-lead-creation (different from the 48h fallback nudge, which fires 48h after last activity).

---

### Fix 5: Activity-Enriched Monday SMS

| Metric | Value |
|--------|-------|
| Friction points eliminated | 1 (T19) |
| Profiles improved | 8 of 30 (27%) |
| Operator hours saved/month | 2 hr |
| Implementation difficulty | Platform (template) — 1 day |
| Leverage score | **(1 x 8) / 1 = 8.0** |
| Status | NOT YET SHIPPED |

**What to do**: Add to Monday SMS: "This week: [N] new inquiries, [N] estimates being followed up, [N] old leads re-engaged." Currently shows dollar pipeline only.

---

### Fix 6: Autonomous Mode Activation Notification + PAUSE Command

| Metric | Value |
|--------|-------|
| Friction points eliminated | 2 (T14, T29 partial) |
| Profiles improved | 13 of 30 (43%) |
| Operator hours saved/month | 3 hr |
| Implementation difficulty | Platform (code) — 2 days |
| Leverage score | **(2 x 13) / 2 = 13.0** |
| Status | NOT YET SHIPPED |

---

### Fix 7: Notification Digest Mode

| Metric | Value |
|--------|-------|
| Friction points eliminated | 1 (T29) |
| Profiles improved | 14 of 30 (47%) |
| Operator hours saved/month | 2 hr |
| Implementation difficulty | Platform (code) — 3 days |
| Leverage score | **(1 x 14) / 3 = 4.7** |
| Status | NOT YET SHIPPED |

---

### Fix 8: EST Fallback Nudge Shortened to 24h

| Metric | Value |
|--------|-------|
| Friction points eliminated | 1 (T16) |
| Profiles improved | 16 of 30 (53%) |
| Operator hours saved/month | 4 hr |
| Implementation difficulty | Config change — 0.5 days |
| Leverage score | **(1 x 16) / 0.5 = 32.0** |
| Status | NOT YET SHIPPED |

---

### Fix 9: "Moment Trigger" Notification (Dead Lead Re-Engages)

| Metric | Value |
|--------|-------|
| Friction points eliminated | 1 (T21 partial) |
| Profiles improved | 10 of 30 (33%) |
| Operator hours saved/month | 1 hr |
| Implementation difficulty | Platform (code) — 2 days |
| Leverage score | **(1 x 10) / 2 = 5.0** |
| Status | NOT YET SHIPPED |

---

### Fix 10: Day 2-3 Quote Import Call (Process Fix)

| Metric | Value |
|--------|-------|
| Friction points eliminated | 1 (T5) |
| Profiles improved | 22 of 30 (73%) |
| Operator hours saved/month | Net neutral (adds 15 min/client but prevents ongoing follow-up) |
| Implementation difficulty | Process/documentation — 0.5 days |
| Leverage score | **(1 x 22) / 0.5 = 44.0** |
| Status | Process change, no code needed |

---

### Leverage Ranking (sorted by score)

| Rank | Fix | Leverage Score | Type | Days |
|------|-----|---------------|------|------|
| 1 | Day 2-3 Quote Import Call | 44.0 | Process | 0.5 |
| 2 | Report Inline SMS Summary | 32.0 | Template | 1 |
| 3 | EST Fallback Nudge → 24h | 32.0 | Config | 0.5 |
| 4 | WON/LOST SMS Commands + Auto-Detect | 20.0 | Code | 3-5 |
| 5 | Proactive Quote SMS at 3 Days | 16.0 | Code | 2 |
| 6 | Autonomous Mode Notification + PAUSE | 13.0 | Code | 2 |
| 7 | Booking Confirmation Mode | 9.8 | Code | 3-5 |
| 8 | Activity-Enriched Monday SMS | 8.0 | Template | 1 |
| 9 | Moment Trigger Notification | 5.0 | Code | 2 |
| 10 | Notification Digest Mode | 4.7 | Code | 3 |

---

## Section 8: Segment Viability

### Archetype A: Solo Kitchen Specialist (6 profiles)

| Metric | Value |
|--------|-------|
| Total REDs across all touchpoints | 8 (A4: 4 REDs from paper cal + no CRM; A6: 3 REDs; rest 0-1) |
| Cascade chains activated | Chain 1 (KB thin) for A4; Chain 3 (seasonal) for A2, A5; Chain 6 for A5 |
| Operator hours/week (base) | 0.75 hr/client |
| Operator hours/week (friction) | +0.3 hr for A4, A6 (paper cal, manual booking checks) |
| Avg operator hours/week | 0.85 hr/client |
| Churn probability | 12% (A4: 25%, A5 seasonal: 20%, rest: 5-8%) |
| Estimated LTV | $1,000/mo x 24 months avg = **$24,000** |
| Verdict | **GREEN** — Take. Core ICP. GCal users are lowest-friction. Paper-cal outliers (A4) need booking confirmation mode. |

### Archetype B: Small Crew Renovator (8 profiles)

| Metric | Value |
|--------|-------|
| Total REDs across all touchpoints | 22 (B1: 5 REDs from VoIP + team; B4/B6: 4 REDs each from paper cal + no CRM; B8: 4 REDs from seasonal + low tech; B3: 3 REDs from tone; rest 1-2) |
| Cascade chains activated | Chain 2 (phone) for B1; Chain 4 (team) for B1, B3; Chain 1 (KB) for B4, B6; Chain 5 (tool gap) for B5; Chain 6 (seasonal) for B8 |
| Operator hours/week (base) | 1.0 hr/client |
| Operator hours/week (friction) | +0.5 hr for B1, B4, B6 (VoIP coordination, manual booking, team dispatch) |
| Avg operator hours/week | 1.15 hr/client |
| Churn probability | 18% (B1: 22% VoIP frustration, B4/B6: 25% paper cal double-booking, B8: 20% seasonal, rest: 10-15%) |
| Estimated LTV | $1,000/mo x 20 months avg = **$20,000** |
| Verdict | **YELLOW** — Take with adaptation. Multi-person team needs team setup enforced on Day 1. Paper-cal members (B4, B6) need booking confirmation mode before onboarding. VoIP clients (B1) need dedicated tech setup call. |

### Archetype C: Basement/Bath Guy (5 profiles)

| Metric | Value |
|--------|-------|
| Total REDs across all touchpoints | 20 (C1: 6 REDs, C2: 5, C3: 5, C4: 2, C5: 2) |
| Cascade chains activated | Chain 1 (KB thin) for C1-C3; Chain 3 (low volume) for C5; Chain 6 (seasonal) for C5 |
| Operator hours/week (base) | 0.75 hr/client |
| Operator hours/week (friction) | +0.6 hr for C1-C3 (manual booking, EST monitoring, report delivery) |
| Avg operator hours/week | 1.1 hr/client |
| Churn probability | 22% (C1: 28%, C2: 25%, C3: 25%, C4: 12%, C5: 20%) |
| Estimated LTV | $1,000/mo x 18 months avg = **$18,000** |
| Verdict | **YELLOW** — Take with adaptation. Booking confirmation mode is prerequisite for C1-C3. Without it, first double-booking is a churn event. C4 (has GCal, even rarely) is safest. C5 seasonal + low volume is highest risk. |

### Archetype D: Growing Interior Crew (4 profiles)

| Metric | Value |
|--------|-------|
| Total REDs across all touchpoints | 10 (D1: 4 REDs from disengagement + seasonal; D2: 3 REDs from VoIP + team; D3: 2; D4: 1) |
| Cascade chains activated | Chain 4 (team) for D2, D3, D4; Chain 5 (tool gap) for D3, D4; Chain 2 (phone) for D2 |
| Operator hours/week (base) | 1.25 hr/client (high volume) |
| Operator hours/week (friction) | +0.4 hr for D1 (evidence vacuum intervention), +0.5 hr for D2 (VoIP + team) |
| Avg operator hours/week | 1.45 hr/client |
| Churn probability | 15% (D1: 25% "can't tell if working", D2: 18% setup friction, D3: 10%, D4: 8%) |
| Estimated LTV | $1,000/mo x 22 months avg = **$22,000** |
| Verdict | **GREEN** — Take. Highest revenue per client. D1 needs proactive ROI communication (Day 45 call + activity SMS). D2 needs VoIP setup call. D3/D4 are strong fits. Team infrastructure already exists — enforce during onboarding. |

### Archetype E: Responsive Tech-Forward (3 profiles)

| Metric | Value |
|--------|-------|
| Total REDs across all touchpoints | 0 |
| Cascade chains activated | None |
| Operator hours/week (base) | 0.5 hr/client |
| Operator hours/week (friction) | +0 hr |
| Avg operator hours/week | 0.5 hr/client |
| Churn probability | 5% (lowest — high engagement, GCal, Jobber, fast responders) |
| Estimated LTV | $1,000/mo x 30 months avg = **$30,000** |
| Verdict | **GREEN** — Priority acquisition target. Zero structural friction. These clients generate the best testimonials and referrals. Every portfolio should have 2-3 of these. |

### Archetype F: Moderate Seasonal (4 profiles)

| Metric | Value |
|--------|-------|
| Total REDs across all touchpoints | 14 (F1: 3 seasonal + guarantee; F2: 5 paper cal + low tech + low volume; F4: 3 seasonal; F3: 3) |
| Cascade chains activated | Chain 3 (low volume) for F1, F2, F4; Chain 6 (seasonal) for F1, F4; Chain 1 (KB) for F2 |
| Operator hours/week (base) | 0.75 hr/client |
| Operator hours/week (friction) | +0.5 hr for F2 (everything manual), +0.3 hr for F1/F4 (seasonal management) |
| Avg operator hours/week | 1.0 hr/client |
| Churn probability | 25% (F1: 25%, F2: 35%, F3: 15%, F4: 28%) |
| Estimated LTV | $1,000/mo x 16 months avg = **$16,000** |
| Verdict | **YELLOW** — Take selectively. F3 (GCal, moderate seasonal) is fine. F1/F4 need seasonal expectation setting at sales. F2 is the highest-risk profile in the entire portfolio: low tech + paper calendar + low volume + mild seasonal dip. Consider F2-type as a soft exclusion from the ICP unless booking confirmation mode ships first. |

### Viability Summary

| Archetype | Verdict | Avg LTV | Avg Op Hr/Wk | Churn % | Priority |
|-----------|---------|---------|---------------|---------|----------|
| E: Tech-Forward | GREEN | $30,000 | 0.50 | 5% | 1 (acquire aggressively) |
| A: Solo Kitchen | GREEN | $24,000 | 0.85 | 12% | 2 |
| D: Growing Crew | GREEN | $22,000 | 1.45 | 15% | 3 |
| B: Small Crew | YELLOW | $20,000 | 1.15 | 18% | 4 |
| C: Basement/Bath | YELLOW | $18,000 | 1.10 | 22% | 5 |
| F: Moderate Seasonal | YELLOW | $16,000 | 1.00 | 25% | 6 |

---

## Section 9: Portfolio Simulation — 15-Client Operator Model

### Portfolio Composition (proportional to archetype frequency)

| Archetype | Count | Profiles Used |
|-----------|-------|---------------|
| Solo Kitchen (A) | 3 | A1 (Marcus), A2 (Tanya), A5 (Kevin) |
| Small Crew (B) | 4 | B1 (Derek), B2 (Jason), B3 (Priya), B7 (Sandra) |
| Basement/Bath (C) | 3 | C1 (Ray), C4 (Vince), C5 (Marie) |
| Growing Crew (D) | 2 | D1 (Tony), D3 (Mike) |
| Tech-Forward (E) | 1 | E1 (Chris) |
| Seasonal (F) | 2 | F1 (Lisa), F3 (Dan) |

### Operator Hours Model — Steady State (Month 3+)

| Activity | Hours/Week | Notes |
|----------|-----------|-------|
| **Escalation triage** | 4.0 | ~2-3 escalations/client/month, 15 min each, across 15 clients |
| **Smart Assist review (new clients)** | 3.0 | Average 2 clients in Week 2 at any time (staggered onboarding) |
| **Revenue data entry (manual wins)** | 5.0 | 10 of 15 clients don't mark wins reliably; 0.5 hr each |
| **Report delivery follow-up** | 2.5 | 8 of 15 need personal touch; bi-weekly = 1.25 hr/week avg |
| **KB gap resolution** | 2.0 | 5-8 gap notifications/week across portfolio, 15 min each |
| **Booking verification (non-GCal)** | 2.0 | 4 non-GCal clients, ~3 bookings/week each, 5 min per check |
| **Guarantee monitoring** | 1.0 | 3-4 clients in active guarantee windows at any time |
| **EST monitoring / fallback** | 2.0 | Checking for missed estimates across 10 non-reliable-EST clients |
| **Quarterly campaign prep** | 1.0 | Amortized: 4 campaigns/year x 15 clients x 30 min each / 52 weeks |
| **Team coordination (multi-person)** | 1.5 | 6 multi-person clients, 15 min/week each for dispatch/context |
| **Onboarding (new clients)** | 3.0 | ~1 new client/month, 12 hrs spread across 4 weeks |
| **Day 45 retention calls** | 0.5 | ~1 call/month, 30 min prep + call |
| **Triage dashboard + daily checklist** | 2.5 | 30 min/day minimum |
| **Ad hoc (cancellation saves, billing issues, compliance)** | 1.5 | Unpredictable but steady |
| **TOTAL** | **31.5 hr/week** | |

### Capacity Analysis

| Metric | Value |
|--------|-------|
| Steady-state hours at 15 clients | 31.5 hr/week |
| Headroom to 40-hr cap | 8.5 hr/week |
| **Breaking point (clients)** | **19 clients** (at current friction levels) |
| Breaking point if top 5 fixes ship | **23 clients** (saves ~12 hr/week) |

### Collision Weeks (Surge Scenarios)

| Scenario | Extra Hours | Frequency |
|----------|------------|-----------|
| 3 clients in Smart Assist simultaneously (staggered onboarding fails) | +6 hr | ~2x/year |
| Seasonal surge (March-April): 5 clients at 30+ leads/month | +4 hr | 1x/year |
| 2 guarantee windows closing in same week | +3 hr | ~3x/year |
| Client cancellation save + new onboarding overlap | +5 hr | ~2x/year |
| **Worst case collision** (2+ of the above) | **+10-12 hr** | ~1x/year |

During a worst-case collision week, the operator is at **41-44 hours** — above sustainable capacity. Tasks that get dropped: KB gap resolution, EST monitoring, quarterly campaign prep. These are exactly the tasks whose absence accelerates churn in Months 3-5.

### Bottleneck Activities (what breaks first at scale)

| Rank | Activity | Why It Breaks | Impact of Breaking |
|------|----------|---------------|-------------------|
| 1 | Revenue data entry | Most time-consuming; no automation | Reports show $0, churn accelerates |
| 2 | Smart Assist overlap | Cannot be deferred; real-time queue | Messages delayed, contractor trust drops |
| 3 | Booking verification (non-GCal) | Must happen before appointment | Double-booking = immediate churn event |
| 4 | Report delivery follow-up | Easy to skip | Evidence vacuum → "can't tell if working" churn |
| 5 | EST monitoring | Easy to skip | Estimate follow-up sequences never start |

---

## Section 10: Top 5 Recommendations

### Recommendation 1: Ship WON/LOST SMS Commands + Auto-Detect Probable Wins

**What to do**: Implement WON [ref] / LOST [ref] SMS commands. Add auto-detect logic: appointment → 7-day silence → auto-prompt contractor. Include reference codes in estimate follow-up and booking confirmation messages so contractors can reply contextually.

**Why**: Revenue data accuracy is the #1 operator time sink (5 hr/week at 15 clients) and the primary Month 2-4 churn driver. Every report, every retention call, every guarantee evaluation depends on this data. Without it, the platform generates invisible value.

**What it unblocks**: T30 (revenue accuracy) → T20 (accurate reports) → T26 (strong guarantee narrative) → T27 (retention call with real numbers) → T28 (cancellation page shows true ROI). Eliminates the single largest cascade chain.

**Effort**: 3-5 days of engineering.

**Decision**: Ship before the 5th client onboards. This is the #1 priority unshipped feature by operator hour savings.

---

### Recommendation 2: Ship Booking Confirmation Mode for Non-GCal Clients

**What to do**: Per-client toggle (set during calendar qualification). When AI wants to book an appointment, SMS contractor first: "Booking request: [Name] for [project], [date/time]. Reply YES to confirm or suggest a new time." Only confirm with homeowner after contractor approves.

**Why**: 9 of 30 profiles (30%) have no digital calendar. The first double-booking is a churn event, not a recoverable friction. Calendar qualification (shipped) correctly identifies these clients but the alternative path does not exist. The operator is manually checking bookings (2 hr/week) as a stopgap.

**What it unblocks**: T7 (calendar setup complete for all profiles) → T17 (booking safe for all profiles) → T25/T26 (no guarantee damage from failed appointments). Converts the paper-calendar population from "high-risk" to "slightly slower booking."

**Effort**: 3-5 days of engineering.

**Decision**: Ship before any paper-calendar client is onboarded. If the next client uses paper, this must ship first or AI booking must be disabled for them (losing a core value prop).

---

### Recommendation 3: Ship Report Inline SMS Summary + Activity-Enriched Monday SMS

**What to do**: Two template changes. (1) Bi-weekly report auto-follow-up SMS becomes: "[Biz] 2-week results: X calls caught, Y estimates followed, Z old quote replies. Full report: [link]." (2) Monday SMS becomes: "This week: X new inquiries, Y estimates being followed up, Z old leads re-engaged. Pipeline: $[amount]."

**Why**: 53% of profiles do not consume the bi-weekly report via email. The weekly SMS is universally read but currently shows only dollar pipeline. These two template changes — requiring no new infrastructure — make the retention-critical ROI story SMS-native.

**What it unblocks**: T19 (pipeline SMS becomes the primary evidence channel) → T20 (report consumption doubles) → T27 (retention call has shared context) → addresses the "can't tell if it's doing anything" failure mode for Tony-archetype profiles.

**Effort**: 1 day for both template changes.

**Decision**: Ship immediately. Highest leverage-per-hour of any fix. No architectural risk.

---

### Recommendation 4: Formalize Day 2-3 Quote Import Call as Standard Process

**What to do**: Add to managed-service playbook: After onboarding call, schedule a 15-minute "Quote Import Call" for Day 2-3. Pre-send SMS template: "Before our next call, think of 5 people you gave a quote to in the last 6 months. Just first name and what the project was." On the call, operator enters the list while contractor reads from their records.

**Why**: 73% of profiles cannot provide a usable old-quote list during the onboarding call. The win-back pool is the primary "proof of life" in Week 1-2. If it starts empty, the first report shows nothing and the contractor's confidence drops before any inbound leads arrive.

**What it unblocks**: T5 (old quote collection) → T21 (win-back pool seeded) → T20 (first report has reactivation data) → T25 (30-day guarantee supported by early wins).

**Effort**: 0.5 days to document and add to playbook. No code change.

**Decision**: Implement immediately. Update managed-service playbook and onboarding checklist.

---

### Recommendation 5: Ship Proactive "Did You Send a Quote?" SMS at 3 Days + Shorten EST Fallback to 24h

**What to do**: (1) When a lead is in `new` or `contacted` for 3+ days with no EST trigger, fire SMS: "[Name] has been waiting 3 days. Did you send a quote? Reply EST [Name] to start follow-up or PASS." (2) Shorten fallback nudge from 48h to 24h.

**Why**: The EST walkthrough (shipped) teaches the command but adoption decays within 2 weeks for 53% of profiles. The estimate follow-up sequence is the highest-value automation — if it never fires, the platform's core loop is broken. The 3-day proactive prompt + 24h fallback creates two safety nets that catch most missed estimates within the conversion-critical window.

**What it unblocks**: T15 (EST trigger ongoing) → T30 (revenue data more complete) → T20/T26 (reports and guarantee narrative stronger).

**Effort**: 2.5 days (2 days for 3-day prompt, 0.5 day config change for 24h fallback).

**Decision**: Ship in the same sprint as Recommendation 1. These two features together close the "invisible value" gap that drives Month 2-4 churn.

---

## Section 11: Quick-Fix Impact Summary

| Quick Fix Shipped | Touchpoints Improved | Avg Delta | Profiles Moved from RED/YELLOW to GREEN |
|-------------------|---------------------|-----------|----------------------------------------|
| KB pre-populated (3-5 facts from sales call) | T6, T11, T14 | -20% at T6 | 6 profiles |
| Tone capture question | T6, T12, T14 | -10% at T12 | 4 profiles |
| Calendar qualification | T7, T17 | -7% at T7 | 3 profiles (identified, not fixed) |
| Team question | T8, T32 | -6% at T32 | 4 profiles |
| Call forwarding verified with test call | T3, T4 | -13% at T3 | 4 profiles |
| EST walkthrough live on call | T9, T15 | -26% at T9 | 8 profiles |
| Responsiveness screening | T0 | -13% at T0 | 4 profiles (filtered out) |
| Day 45 proactive retention call | T27 (new) | N/A | Prevents 2-3 churns/year |
| Guarantee milestone SMS | T13 (new) | N/A | Reduces guarantee anxiety for all |
| Cancellation alert to operator | T28 (new) | N/A | Enables save attempt for every cancellation |

**Net impact of all quick fixes**: Average % affected across all touchpoints dropped from **49% to 40%** (-9 percentage points). The largest single improvement was EST walkthrough (-26% at T9), followed by KB pre-pop (-20% at T6).

**What quick fixes did NOT fix**: Revenue data accuracy (T30: still 67%), booking confirmation for non-GCal (T17: still 43% with 30% RED), report consumption (T20: still 53%), operator checklist sustainability (T31: still 100%).

---

## Section 12: Final Scorecard

### Portfolio Health at 15 Clients

| Metric | Current (with QFs) | After Top 5 Fixes | Target |
|--------|-------------------|-------------------|--------|
| Operator hours/week | 31.5 | 22.0 | <30 |
| Monthly churn rate | 5.5% (0.8 clients/month) | 3.5% (0.5 clients/month) | <3% |
| Breaking point (clients) | 19 | 23 | 25+ |
| Profiles with 0 REDs | 7 of 30 (23%) | 15 of 30 (50%) | 60%+ |
| Avg cascade chains per profile | 1.2 | 0.6 | <0.5 |
| Revenue accuracy (% clients with reliable data) | 33% | 70% | 90%+ |

### Investment Required for Top 5

| Fix | Days | Type |
|-----|------|------|
| WON/LOST SMS + auto-detect | 3-5 | Code |
| Booking confirmation mode | 3-5 | Code |
| Report SMS summary + Monday SMS | 1 | Template |
| Quote import call process | 0.5 | Process |
| Proactive quote SMS + 24h fallback | 2.5 | Code |
| **Total** | **10-14 days** | |

### Decision Framework

The 15-client portfolio is **viable today** at 31.5 hr/week — below the 40-hour cap with 8.5 hours of headroom. But this headroom is consumed by collision weeks (2-3x/year) and does not account for the operator also doing sales, onboarding calls, and business development.

**The real constraint is not hours — it is cognitive load.** The operator is simultaneously tracking guarantee windows, monitoring EST adoption, verifying bookings, personalizing reports, and managing tone-sensitive contractors across 15 clients. The top 5 fixes reduce hours by ~9.5 hr/week but more importantly eliminate the three highest-cognitive-load tasks: manual revenue entry, manual booking verification, and EST monitoring.

**Ship the top 5 fixes before scaling past 10 clients.** The portfolio is sustainable at 10 clients without them. At 15, collision weeks create quality degradation. At 19 (current breaking point), it fails.
