# Cascade Chains — Compounding Failure Paths

When an upstream touchpoint scores yellow or red, it degrades downstream touchpoints. These chains are the difference between "a few rough edges" and "structural delivery failure." Model them explicitly during simulation.

## How cascade penalties work

- **Yellow upstream → downstream shift:** green becomes yellow-leaning (score it yellow if the downstream touchpoint has any additional friction for this profile; otherwise keep green)
- **Red upstream → downstream shift:** green becomes yellow, yellow becomes red. The downstream touchpoint is starting from a degraded baseline.
- **Multiple upstream failures compound.** If two upstream touchpoints feeding the same downstream are both yellow, treat it as equivalent to one red upstream.

---

## Chain 1: Knowledge Base Thinning

**Trigger:** T10 (KB Setup) scores yellow or red
**Why it cascades:** A thin KB means the AI can't answer questions confidently. Every downstream touchpoint that depends on AI quality degrades.

| Step | Touchpoint | Effect of thin KB |
|:----:|-----------|-------------------|
| 1 | T10: KB Setup | Contractor says "it depends" to pricing, can't articulate differentiators |
| 2 | T6: Voice AI Demo | AI gives vague answers during onboarding demo → reduced wow factor |
| 3 | T19: KB Gap Sprint | Fewer conversations (if also low volume) = fewer gaps surfaced = KB stays thin |
| 4 | T20: Autonomous Mode | Premature switch OR delayed switch (both bad) — coverage threshold harder to reach |
| 5 | T27: Escalation Handling | AI defers more frequently → operator handles conversations that should be automated |
| 6 | T32: Monthly Health Check | KB gap metric stays high → ongoing operator investment required |

**Business impact:** This is the highest-frequency cascade chain. It affects 30-40% of profiles (anyone who's bad at articulating their business). The terminal effect is elevated operator hours for the lifetime of the client.

**Churn signal:** Moderate. Client sees AI as "dumb" if KB is thin → erodes trust → "I'm not getting what I paid for."

---

## Chain 2: Phone Setup Failure

**Trigger:** T4 (Call Forwarding Setup) scores red
**Why it cascades:** If calls can't forward to Twilio, the entire voice channel doesn't work. The onboarding "wow moment" fails, and ongoing missed-call recovery is broken.

| Step | Touchpoint | Effect of phone failure |
|:----:|-----------|------------------------|
| 1 | T4: Call Forwarding | VoIP/PBX can't forward, Google Voice can't forward, carrier blocks it |
| 2 | T5: "Call Your Number" Wow | No wow moment — the emotional anchor of onboarding is gone |
| 3 | T6: Voice AI Demo | Can't demonstrate voice AI on their actual number |
| 4 | T22: Appointment Booking | Inbound calls don't reach the system → bookings happen only via text |
| 5 | T29/T31: Guarantee | Reduced engagement (missed calls not captured) → guarantee at risk |

**Business impact:** Affects 15-25% of profiles (Google Voice, VoIP/PBX, some carriers). Creates an immediate "this doesn't work" perception on Day 1.

**Churn signal:** Strong. Day 1 failure → high early churn probability. The contractor's first experience is broken.

---

## Chain 3: Low Volume Starvation

**Trigger:** Profile has <10 leads/month AND/OR mostly referral leads who don't text
**Why it cascades:** The system needs inbound lead flow to demonstrate value. Without it, every engagement touchpoint starves.

| Step | Touchpoint | Effect of low volume |
|:----:|-----------|---------------------|
| 1 | T14: Quote Reactivation | May be the only visible activity — if zero old quotes, nothing happens at all |
| 2 | T16: Day 3-4 Check-in | "Here's your lead count: 0" — actively harmful message |
| 3 | T17: Day 7 Call | No data to review → awkward call, contractor questions value |
| 4 | T18: Smart Assist | Few drafts to review → operator idle, contractor doesn't see system working |
| 5 | T19: KB Gap Sprint | Few conversations = few gaps = KB doesn't improve |
| 6 | T25: Bi-Weekly Report | Thin report with minimal activity → reinforces "nothing is happening" |
| 7 | T26: Weekly Pipeline SMS | "$0 pipeline" message → contractor loses faith |
| 8 | T29: 30-Day Guarantee | Extended window needed, or fails entirely |

**Business impact:** Affects 20-30% of profiles (low-volume referral contractors). This is the most dangerous chain because every touchpoint designed to demonstrate value instead demonstrates the absence of value.

**Churn signal:** Very strong. The system appears to do nothing. Contractor churns at Day 30 or Day 90 guarantee evaluation.

---

## Chain 4: Team Communication Mismatch

**Trigger:** Profile has team members who handle customer contact (crew leads, office manager) but system only connects to the owner
**Why it cascades:** Messages and notifications go to the wrong person. The person who needs to act doesn't see the alert; the person who sees it can't act.

| Step | Touchpoint | Effect of team mismatch |
|:----:|-----------|------------------------|
| 1 | T3/T4: Phone Setup | Number is owner's, but office manager answers calls |
| 2 | T21: Estimate Follow-up | Owner sends estimates, but SMS trigger notification goes to... who? |
| 3 | T22: Calendar Sync | Only owner's calendar synced → crew leads double-booked |
| 4 | T27: Escalation Handling | Operator texts owner, but office manager should handle it |
| 5 | T25/T26: Reports | Reports go to owner who's on-site; office manager who manages the pipeline doesn't see them |

**Business impact:** Affects 30-45% of profiles (anyone with more than a solo operation). The friction is subtle — the system "works" but information goes to the wrong person, causing delays and missed actions.

**Churn signal:** Moderate. Not a "this is broken" perception, but a slow erosion: "this isn't really helping us." Shows up as low engagement rates despite adequate lead volume.

---

## Chain 5: Tool Expectation Gap

**Trigger:** T11 (FSM Integration) scores red — contractor uses a non-Jobber FSM and expects integration
**Why it cascades:** The contractor expected their existing tool to work with the system. Now they have to manage two systems — their FSM and ConversionSurgery — with no sync between them.

| Step | Touchpoint | Effect of integration gap |
|:----:|-----------|--------------------------|
| 1 | T11: Integration | "Sorry, we don't integrate with Housecall Pro/ServiceTitan yet" |
| 2 | T21: Estimate Follow-up | Manual trigger required because FSM can't notify CS when estimate is sent |
| 3 | T23: Payment Collection | May duplicate invoicing if contractor also invoices through FSM |
| 4 | T24: Review Generation | No automatic trigger from FSM job completion → relies on manual status change (which won't happen) |
| 5 | T32: Health Check | Data is split between two systems → metrics in CS are incomplete |

**Business impact:** Affects 25-30% of profiles (Housecall Pro, ServiceTitan, Buildertrend users). Creates ongoing friction — not a one-time fix but a permanent "two systems" tax on every interaction.

**Churn signal:** Moderate to strong. Contractors who already have an FSM are the most organized segment — they expect tools to integrate. The gap feels like going backwards.

---

## Chain 6: Seasonal Cliff

**Trigger:** Profile has strong seasonality AND onboards during their slow season
**Why it cascades:** All volume-dependent touchpoints fail simultaneously during the dead months.

| Step | Touchpoint | Effect of seasonal cliff |
|:----:|-----------|-------------------------|
| 1 | T14-T17: Week 1 | Zero inbound during dead season → quote reactivation is the only lifeline |
| 2 | T18-T19: Week 2 | Smart Assist has nothing to review → feels like paying for nothing |
| 3 | T29: 30-Day Guarantee | Almost certainly needs extension |
| 4 | T25/T26: Ongoing Reports | Months of "$0 pipeline" messages during off-season |
| 5 | T30: Quarterly Blitz | Q1 reactivation during Dec-Feb dead season → contacts aren't thinking about renos |

**Business impact:** Affects 25% of profiles (strong seasonal). This is a timing chain — the same contractor onboarded in April would be green everywhere. The fix is operational (onboarding timing) not technical.

**Churn signal:** Strong during dead season, drops once volume returns. But many contractors won't wait — they cancel during the dead months and never see the spring payoff.

---

## Quick Reference: Cascade Severity

| Chain | Trigger Frequency | Terminal Impact | Churn Signal | Fix Type |
|-------|:-----------------:|:---------------:|:------------:|----------|
| KB Thinning | 30-40% | Elevated operator hours forever | Moderate | Process (better KB interview) |
| Phone Setup | 15-25% | Day 1 broken experience | Strong | Platform (more phone types) |
| Low Volume | 20-30% | System appears to do nothing | Very Strong | Segment (minimum volume gate) |
| Team Mismatch | 30-45% | Info goes to wrong person | Moderate | Platform (multi-user support) |
| Tool Expectation | 25-30% | Permanent two-system tax | Moderate-Strong | Platform (more integrations) |
| Seasonal Cliff | 25% | Months of zero value | Strong | Process (onboarding timing) |
