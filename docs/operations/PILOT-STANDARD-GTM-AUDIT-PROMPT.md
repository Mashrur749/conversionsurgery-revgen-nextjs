# Pilot/Standard GTM + Offer Strength Audit Prompt

**Purpose:** Single thorough prompt for `/stochastic-multi-agent-consensus`. Audits the Pilot/Standard offer across GTM, offer strength, market fit, sales motion, delivery readiness, and outreach engine. Run before any major sales push or strategic pivot.

**How to use:** Copy everything between `BEGIN PROMPT` and `END PROMPT` and paste as the args to `/stochastic-multi-agent-consensus` in a new session.

---

## BEGIN PROMPT

Run a 12-agent stochastic consensus audit of the ConversionSurgery Pilot/Standard offer for GTM viability, offer strength, market fit, and execution readiness. The operator is going to launch sales THIS WEEK with this offer exclusively (Premium is hidden, deferred until first Standard case study). The goal of this audit is to surface the highest-leverage gaps and risks before money goes out the door, not to redesign the offer.

### What each agent must read before scoring

Each agent must read these source-of-truth files in full and reason from their actual content (not generalizations). If any file is missing, agent should report it and continue with what's available.

**Offer + ICP (canonical):**
- `docs/business-intel/Revenue_Recovery_System_Business_Reference.md` — full offer, pricing, ICP, fulfillment, economics, compliance, 90-day validation plan
- `docs/business-intel/conversionsurgery_business_reference.md` — companion reference
- `docs/business-intel/OFFER-APPROVED-COPY.md` — approved client-facing language including new §12 post-signature comms
- `docs/business-intel/ICP-DEFINITION.md` — Calgary/Edmonton design-build renovators ($1M-$10M, 15-40 leads/mo)
- `docs/business-intel/OFFER-STRATEGY.md` — pricing psychology, hard rules

**Sales motion:**
- `docs/operations/COLD-START-PLAYBOOK.md` — outreach scripts (A-G), cadence, 50/wk floor
- `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` — 16 objections across 3 tiers
- `docs/business-intel/COMPETITIVE-COMPARISON.md` — positioning vs alternatives
- `docs/business-intel/VOICE.md` — tone and delivery rules
- `docs/business-intel/offer-page.html` — public-facing offer page

**Delivery + ops:**
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` — full lifecycle runbook (10 phases) including §2.4.5 Four Irresistibility Levers
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` — daily ops, including §1.7 Dead Lead Resurrection Demo, §1.8 Spouse Line, §1.9 First Missed Lead Replay SMS, §6a/b Pause flows, §7a/b/c Cancel flows, §10 onboarding, §10a Day-7 listing migration, §10b Day-45 retention call
- `docs/operations/01-OPERATIONS-GUIDE.md` — operator daily checklist
- `docs/operations/00-OPERATOR-GUIDE.md` — operator mental model
- `docs/operations/EXECUTION-PLAN.md` — outreach floor, leave trigger, cadence
- `docs/operations/LAUNCH-CHECKLIST.md` — pre-launch infra
- `docs/operations/OPERATOR-LAUNCH-ACTION-LIST.md` — operator-only external steps before first sale
- `docs/operations/PILOT-STANDARD-OPERATOR-INDEX.md` — daily entry-point index

**Legal contract:**
- `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` — Day-14 cancel right, 30-day pause right, 50/50 setup split, operational guarantee, Voice AI fair-use clause

**Templates:**
- `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`
- `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md`
- `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md`
- `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md`
- `docs/operations/templates/BASEMENT-KB-PRESET.md`
- `docs/operations/templates/calgary-basement-prospects.csv`

### Locked context the agents must accept (do not propose changing these)

- **Pricing:** Pilot $3,500 setup + $1,500/mo (first 3 clients only, 90-day min). Standard $5,500 setup + $2,000/mo (client 4+, 90-day min then m2m). Setup split 50/50 (signing/go-live). Setup non-refundable after Day 7.
- **Guarantees:** Operational only — 21-day go-live + 30-day logging gate (auto-pause billing). NO revenue guarantee, NO pipeline guarantee, NO closed-jobs guarantee.
- **Day-14 cancel right:** one phone call, no questions, max client exposure $1,750 Pilot / $2,750 Standard.
- **30-day pause right:** post-Minimum-Term, once per 12 months, 7-day notice.
- **Voice AI:** included free, 1,000 min/mo fair-use, $0.15/min above.
- **ICP:** Calgary/Edmonton design-build renovation contractors, $1M-$10M revenue, 15-40 leads/mo, $50K-$120K avg project, owner + 1-10 crew, no dedicated office manager.
- **Operator state:** solo founder, pre-revenue, zero case studies, zero testimonials, ~6-10 hours/week of operator capacity.
- **Goals:** $20k sales ASAP, $5k MRR ASAP. Leave-trigger = 7 stable clients (60+ days paid + 2 testimonials + $30k+ savings).
- **Hard rules:** client 4+ MUST be Standard (no exceptions). Pilot capped at 3 active. Counsel review deferred until cashflow starts. No multi-week dev delays.

### Agent count and framings

Spawn 12 agents in parallel. Use these 12 framings (one per agent):

1. **Neutral baseline** — objective analyst, no priors
2. **Risk-averse** — weight downside, regulatory exposure, churn risk
3. **Growth-aggressive** — weight upside, close rate, referral velocity
4. **Contrarian** — what does conventional GTM advice get wrong here?
5. **First principles** — strip the offer to its load-bearing assumptions
6. **Buyer empathy (Mike — warm ICP)** — Calgary basement contractor, $2.2M, dusty on jobsite, has been pitched 3 agencies and ghosted by one
7. **Buyer empathy (Sarah — referral-driven)** — whole-home renovator, $4.8M, 90% referrals, 10 leads/mo, doesn't think she has a problem
8. **Buyer empathy (Linda — office manager gatekeeper)** — evaluating for the owner, fears job displacement, knows the leak is real
9. **Resource-constrained** — solo founder, 6-10 hrs/week, no dev capacity for new features
10. **Long-term** — 5-year outcome lens, what compounds, what's a moat
11. **Data-driven** — measurable claims only, fight every assertion not backed by file evidence
12. **Systems thinker** — second and third-order effects, cascade dynamics

### What each agent must score

Each agent must read the files, then score the offer on these 8 dimensions (1-10 scale, with one-sentence justification per score):

| Dimension | Question being scored |
|---|---|
| **D1 — Market fit** | Is this offer aimed at a real, reachable, monetizable buyer in this geography right now? |
| **D2 — Offer strength** | Is this "stupid to say no" for the warm ICP, or merely "sensible if I'm in the market"? |
| **D3 — Pricing power** | Does the price/value ratio support the asked dollar without margin erosion? |
| **D4 — Risk reversal** | Does the buyer feel SAFE saying yes? (Day-14 cancel + operational guarantee + 30-day pause + Day-7 refund window) |
| **D5 — Trust signals** | For a zero-case-study solo founder, is there enough non-testimonial trust scaffolding (Loom audit, Dead Lead Resurrection demo, local presence, transparent contract)? |
| **D6 — Sales motion viability** | Can a solo operator reliably close 3-5 Pilots in 8-12 weeks with the documented scripts/cadence? |
| **D7 — Delivery readiness** | Are the runbooks, automations, and operational guardrails complete enough to deliver the operational guarantee without operator burnout? |
| **D8 — GTM / outreach engine** | Is the cold-outreach machine (50/wk floor, ICP list sourcing, Loom audit) capable of generating qualified-discovery-call volume to feed the sales motion? |

### What each agent must produce (exact schema)

```
AGENT FRAMING: [name from list above]

DIMENSION SCORES:
D1 Market fit: [1-10] — [one sentence]
D2 Offer strength: [1-10] — [one sentence]
D3 Pricing power: [1-10] — [one sentence]
D4 Risk reversal: [1-10] — [one sentence]
D5 Trust signals: [1-10] — [one sentence]
D6 Sales motion viability: [1-10] — [one sentence]
D7 Delivery readiness: [1-10] — [one sentence]
D8 GTM / outreach engine: [1-10] — [one sentence]

OVERALL OFFER STRENGTH: [1-10] (NOT a simple average — your judgment of compounded effect)

GO / HOLD / NO-GO: [GO | HOLD | NO-GO]

TOP 3 STRENGTHS (cite file/section evidence, not generalizations):
1.
2.
3.

TOP 3 GAPS that materially reduce close rate or scale cap (cite evidence):
1.
2.
3.

ONE THING THE OPERATOR CANNOT SEE FROM INSIDE THE BUSINESS:
[the blind spot you'd flag if you only had one chance]

SINGLE HIGHEST-LEVERAGE FIX before first cold email goes out:
[zero-dev, this-week, specific]

TIME-TO-FIRST-SALE ESTIMATE: [X weeks, P10-P50-P90 if you can]

KILL-SWITCH SIGNAL: [the one early indicator that would tell the operator to pivot the niche, the offer, or the motion]
```

### Aggregation requirements

After all 12 agents return, the orchestrator must produce `.scratch/consensus/consensus_report.md` with:

1. **Headline verdict** — GO / HOLD / NO-GO consensus and mean Overall Offer Strength
2. **Per-dimension table** — mean, median, std-dev, lowest-scoring framing per dimension (the std-dev flags genuine disagreement)
3. **Strength consensus** — items cited by ≥7/12 agents as a top-3 strength
4. **Gap consensus** — items cited by ≥7/12 agents as a top-3 gap
5. **Divergences (4-6/12)** — genuine judgment calls that the operator must decide, not defer
6. **Outliers (1-3/12)** — high-variance ideas worth considering, with the framing that produced each
7. **Time-to-first-sale aggregation** — distribution + outliers
8. **Top 5 highest-leverage actions** — ranked by impact × ease, all zero-dev and this-week
9. **Top 3 kill-switch signals** — what would tell the operator the strategy is wrong, not the execution
10. **Reconciliation with prior consensus** — note any agreement or contradiction with any prior report at `.scratch/consensus/consensus_report.md` (if it exists, will be overwritten — quote the relevant findings inline before overwriting)

### Rules for agents

- **Read the files**, do not pattern-match on what a typical SaaS pitch looks like. ConversionSurgery is a managed service, not a SaaS, and the ICP is renovation contractors, not B2B SaaS buyers. Generic advice that ignores those constraints is worth nothing.
- Cite specific file paths or section numbers in every claim that depends on file content. Unverifiable claims should be flagged as assumptions.
- Distinguish between "the offer document is missing X" (a doc gap) vs "the offer doesn't include X" (a real gap). Doc gaps are 5-min fixes; offer gaps require strategy changes.
- Do NOT propose changes to the locked context items above. If your scoring is contingent on changing them, say so explicitly and proceed with the locked version anyway.
- Do NOT recommend hiring counsel as a fix — operator has explicitly deferred that until cashflow.
- Do NOT recommend Premium-tier work — it is hidden until first Standard case study lands.
- **Use the model `sonnet`** for cost efficiency. The depth of reasoning needed is in the file-reading and scoring discipline, not in token-heavy generation.

### Output location

Final aggregated report at `.scratch/consensus/consensus_report.md`. Individual agent responses do not need to be persisted — the aggregator consumes them in memory.

## END PROMPT
