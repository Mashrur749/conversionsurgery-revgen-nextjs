# Stochastic Multi-Agent Consensus Report

**Problem:** Given the pre-launch Markov simulation results for ConversionSurgery, answer: (1) ICP minimum criteria, (2) safe client cap before hiring, (3) one process change before client #1.
**Agents:** 10 (Neutral, Risk-averse, Growth, Contrarian, First-principles, User-empathy, Resource-constrained, Long-term, Data-driven, Systems thinker)
**Date:** 2026-04-11
**Markov data:** Shared across all agents (not invented individually)

---

## Q1: ICP Minimum Criteria

### Consensus (9/10 agree)

**15+ inbound leads/month is the hard floor.** Every agent except the Contrarian used this as a primary gate. The Markov data makes this obvious: below 15 leads, the Low Volume Starvation chain fires and the system appears to do nothing.

### Consensus (8/10 agree)

**Screen for responsiveness, not just demographics.** Eight agents included some form of "contractor must respond to SMS/calls within X hours" as a qualifier. The specific thresholds varied (20 min to 2 hours), but the principle was unanimous: a contractor who ignores messages will churn regardless of lead volume.

### Consensus (7/10 agree)

**Year-round interior work only (no seasonal trades).** Seven agents explicitly gated on seasonality. The ICP already handles this (basement = year-round), but agents reinforced it as a non-negotiable.

### Divergence (6/4 split)

**Revenue floor: $600K vs $800K.** Six agents used $600K+ (matching the ICP's Solo Finisher floor). Four agents (Risk-averse, Growth, Long-term, First-principles) pushed for $800K+ to avoid the Solo Finisher segment entirely at launch. The Growth agent's reasoning: "Handyman/Referral King economics are fatal at $1K/mo."

### Outlier

**Contrarian: Screen for speed-to-first-response, not tech or tools.** Agent 4 argued the conventional wisdom (screen for GCal, tech comfort) is wrong. "A contractor who uses a paper notepad but returns calls in 20 min is a better fit than a Jobber user who ignores messages for 2 hours." Proposes a live test inquiry during qualification to verify actual response speed.

---

## Q2: Safe Client Cap Before Hiring

### Distribution

| Cap | Agents | Reasoning |
|:---:|:------:|-----------|
| **3** | 1 (Systems) | High churn creates false capacity; when retention improves, all clients stay and you hit the wall |
| **5** | 1 (First-principles) | Crisis-handling capacity is the binding constraint, not hours |
| **6** | 1 (User-empathy) | Surge weeks (collision + cancellation save + new onboard) push solo operator past 28h |
| **8** | 5 (Risk-averse, Growth, Resource, Long-term, Data-driven) | ~$8K MRR, 13-14h peak, leaves buffer for sales + platform work + first hire |
| **10** | 2 (Neutral, Neutral-adjacent) | P90 peak = 21.5h, steady = 1.9h/wk, leaves recovery playbook capacity |

### Consensus (5/10 — plurality)

**8 clients is the modal answer.** Five agents converged on 8, with the reasoning that it generates enough MRR ($8K) to fund a part-time hire while keeping peak operator load under 15h with buffer for sales and platform work.

### Divergence (3-6 vs 8-10)

Three agents pushed for lower caps (3, 5, 6) — their shared reasoning: the simulation's capacity model doesn't account for sales time, platform development, and crisis absorption. The constraint isn't steady-state hours, it's surge-week resilience.

Two agents went higher (10) — reasoning that the P90 data supports it and the recovery playbook keeps churn manageable.

### Outlier

**Systems thinker: 3 clients.** The most conservative answer, with novel reasoning: "High churn creates false capacity headroom. At 4-5 clients you feel fine because 2 are about to leave. When retention improves, all 5 stay — and you hit the load wall simultaneously." This is the only agent that modeled the second-order effect of fixing churn on capacity.

---

## Q3: ONE Process Change Before Client #1

### Consensus (7/10 agree)

**Build the At-Risk Recovery Playbook.** Seven agents named this explicitly as the #1 process change, citing the sensitivity data (+$80/client, 5x more than any other fix). Multiple agents noted it should be written, documented, and tested before onboarding — not developed reactively after the first churn.

| Agent | Named Recovery Playbook? |
|-------|:------------------------:|
| Neutral | Yes |
| Risk-averse | Yes |
| Resource-constrained | Yes |
| Long-term | Yes |
| Data-driven | Yes |
| First-principles | Yes (as "Week 3 value checkpoint") |
| Systems thinker | No — prioritized KB intake |
| Growth | No — prioritized dead-man's-switch monitoring |
| Contrarian | No — prioritized live test inquiry on sales call |
| User-empathy | No — prioritized Day 2-3 quote import call |

### Divergence (3 alternative answers)

Three agents proposed different #1 changes:

1. **Systems thinker: Week-1 KB build session, live with the contractor, 60 min.** Reasoning: KB Thinning at 38% is a supply-side problem you can eliminate before it starts. "Fix KB intake -> retention improves -> churn stops masking load -> cap becomes real -> hire from a position of signal, not crisis."

2. **Contrarian: Live test inquiry during the sales call.** Text the prospect's business number while they're still on the phone. Catches forwarding failures, carrier filtering, and wrong Twilio numbers before onboarding.

3. **User-empathy: Day 2-3 quote import call.** A dedicated 15-min call with pre-work SMS: "Write down 5 people you quoted in the last 6 months." Fills the win-back pool that makes the 30-day report show real value.

### Synthesis

These three are not mutually exclusive with the recovery playbook — they're complementary upstream fixes. The recovery playbook catches clients who reach At-Risk. The KB session, live test, and quote import prevent clients from reaching At-Risk in the first place. The consensus is: recovery playbook first (biggest single delta), then layer in the upstream fixes.

---

## Raw Scores

### Q1: ICP Criteria Frequency

| Criterion | Agents who included it |
|-----------|:----------------------:|
| 15+ leads/month | 9/10 |
| Responsiveness gate (SMS reply speed) | 8/10 |
| Year-round / no seasonal | 7/10 |
| Revenue floor ($600K+) | 6/10 |
| Revenue floor ($800K+) | 4/10 |
| Owner answers own phone (no gatekeeper) | 5/10 |
| Active Google Business Profile | 3/10 |
| Phone type qualifier (cell, not GV/VoIP) | 4/10 |
| Single decision-maker | 3/10 |

### Q2: Client Cap Distribution

| Cap | Votes |
|:---:|:-----:|
| 3 | 1 |
| 5 | 1 |
| 6 | 1 |
| 8 | 5 |
| 10 | 2 |

**Mean = 7.4 | Median = 8**

### Q3: Process Change Frequency

| Change | Agents |
|--------|:------:|
| Recovery playbook / At-Risk intervention | 7/10 |
| KB intake improvement | 2/10 |
| Live test on sales call | 1/10 |
| Quote import call | 1/10 |
| Dead-man's-switch monitoring | 1/10 |

---

## Recommendations (synthesized from consensus)

### 1. ICP Minimum Criteria — USE THIS

All five must pass:
1. Basement development or finishing (30-second qualifier Q1)
2. 15+ inbound leads per month (Q2)
3. Misses calls during builds — no receptionist (Q3)
4. Phone type check — flag Google Voice for modified onboarding (Q4)
5. **NEW from consensus:** Responds to SMS within 2 hours during business day (verify with a test text during qualification)

Revenue floor: $600K for inbound leads, but **actively cold-call only $800K+** (Small Crew Developer and Suite Specialist). Solo Finishers ($600-800K) are inbound-only until 5+ primary clients.

### 2. Client Cap — 8, then hire

8 clients before hiring a part-time ops person. Not 10, not 15. At 8 clients:
- MRR = $8,000 (enough to fund a part-time hire)
- P90 peak operator load = ~14h (buffer for sales + platform)
- Steady-state = ~1.4h/wk
- Hire trigger: when 6+ clients have survived past month 2 with no manual escalations

**Systems thinker's warning to keep in mind:** When retention improves (because you built the recovery playbook), the capacity math changes. Clients who would have churned now stay. Plan for the success case, not just the current churn rate.

### 3. Process Change — Recovery Playbook (already written)

The recovery playbook is now in `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 1.5. It was the consensus #1 by a wide margin (7/10).

**Layer in these three upstream fixes in the first month:**
- Live test inquiry during sales call (Contrarian's idea — catches Day 1 failures before contract) — **DONE:** added as ICP Q5, Playbook Section 10 pre-check, Launch Checklist 6.3
- Phone number onboarding strategy — **DONE:** 10-agent consensus (2026-04-12) recommended conditional forwarding Day 0 → listing migration Day 7. Full report: `active/consensus/phone-onboarding-consensus.md`
- 60-min structured KB build session during onboarding (Systems thinker — breaks cascade chain 1)
- Day 2-3 quote import call with pre-work SMS (User-empathy — fills the win-back pool)
