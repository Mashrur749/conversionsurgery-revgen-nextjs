# Self-Serve Tier Consensus Analysis

**Problem**: What does ConversionSurgery need to support a $497/month self-serve tier where contractors use the platform without operator involvement?
**Agents**: 10 (Sonnet, varied framings)
**Date**: 2026-04-01

---

## Confidence Scores

| Agent | Framing | Score |
|-------|---------|-------|
| 1 | Neutral | 4 |
| 2 | Risk-averse | 4 |
| 3 | Growth | 7 |
| 4 | Contrarian | 6 |
| 5 | First-principles | 6 |
| 6 | User-empathy | 6 |
| 7 | Resource-constrained | 8 |
| 8 | Long-term | 7 |
| 9 | Data-driven | 6 |
| 10 | Systems-thinker | 4 |

**Mean: 5.8 | Median: 6.0 | Range: 4-8**

The platform is technically 80-95% ready (automation is zero-touch). The score reflects business viability uncertainty — KB cold-start, cannibalization, and positioning — not technical readiness.

---

## Consensus (7+/10 agents agreed)

### 1. KB Intake Questionnaire in Client Portal (10/10 — unanimous)

The #1 blocker. Every agent flagged this. The KB Intake Questionnaire exists in admin but is not accessible to contractors. Without it, the AI starts blind, defers on everything, and the contractor churns at Day 14-20 thinking "the AI is useless." This single build determines whether self-serve works or fails.

**Build estimate**: 1-2 days (the admin questionnaire + KB creation API already exist)

### 2. Auto-Progression of AI Modes (8/10)

The Week 1→2→3 ramp (missed-call-only → Smart Assist → Autonomous) is currently operator-gated. Self-serve needs automatic advancement based on time + onboarding checklist completion + quality gates passing. The quality gate infrastructure already exists — only the auto-trigger is missing.

**Build estimate**: 0.5-1 day

### 3. Revenue Leak Audit is Managed-Only (10/10)

Do not attempt to automate it for self-serve. It's a 30-45 minute human-researched deliverable and the managed tier's strongest Day-1 differentiator. Self-serve replaces it with the bi-weekly report at Day 14.

### 4. Layer 2 Guarantee (90-day) Should Not Transfer to Self-Serve (7/10)

The 90-day "attributed project" guarantee depends on operator involvement (KB quality, escalation handling, quote reactivation). Without the operator, the guarantee failure rate will be structurally higher. Keep Layer 1 (30-day, 5 qualified engagements) for self-serve. Remove or narrow Layer 2.

### 5. Don't Offer Both Tiers in Same Sales Conversation (9/10)

Self-serve should be a separate acquisition channel (website, referrals), not a downsell in a managed-service pitch. Mentioning $497 during a $1,000 close anchors the prospect to the lower price.

### 6. Don't Allow Portal Downgrade from Managed → Self-Serve (8/10)

Managed clients who want to downgrade should require a retention conversation, not a button click. Gate the path.

### 7. $497/Month is the Right Price (10/10)

Below answering-service cost ($500-1,500), above SaaS tool pricing ($97-300), and the ROI math still holds (one recovered project covers years of service). The $503 gap from managed is wide enough to justify the value differential.

---

## Divergences (4-6/10 agents)

### Build Scope Before Launch

**Minimal camp (4/10 — Growth, Resource-constrained, Contrarian, User-empathy):**
Build 3-4 items: KB wizard, auto-progression, demo auto-trigger, Day 3 check-in SMS. Ship in 1-2 weeks. Test with 3-5 clients.

**Thorough camp (6/10 — Neutral, Risk-averse, First-principles, Long-term, Data-driven, Systems-thinker):**
Build 5-7 items: KB wizard, auto-progression, portal CSV import, review approval UI, escalation UX improvement, knowledge gap auto-routing, onboarding metrics dashboard. Ship in 2-3 weeks. Private beta before public.

**Recommendation**: Start with the minimal camp's 4 items, launch to 3-5 test clients, then build the thorough camp's items based on what actually breaks.

### When to Launch

**Now (3/10)**: The platform is 80%+ ready. Ship the KB wizard and go.
**After 5 managed clients (4/10)**: Prove managed-tier PMF first, then add self-serve.
**After 10+ managed clients (3/10)**: Self-serve needs case studies and an inbound channel that doesn't exist yet.

---

## Platform Gaps — Full Inventory

### Must Build (blocks self-serve launch)

| # | Gap | Agents | Build Estimate |
|---|-----|:------:|---------------|
| 1 | **KB Intake Questionnaire in portal** | 10/10 | 1-2 days |
| 2 | **Auto-progression AI modes** (time + gate-based) | 8/10 | 0.5-1 day |
| 3 | **Self-serve quote import in portal** | 7/10 | 1 day |
| 4 | **Review response approval in portal** | 7/10 | 1 day |

### Should Build (before 10 clients)

| # | Gap | Agents | Build Estimate |
|---|-----|:------:|---------------|
| 5 | **Simplified escalation UX for contractors** | 5/10 | 1-2 days |
| 6 | **Knowledge gap auto-routing to contractor** | 5/10 | 1 day |
| 7 | **Self-serve onboarding metrics dashboard** (operator view) | 4/10 | 1-2 days |
| 8 | **Automated Day 3 check-in SMS** | 4/10 | 2-4 hours |
| 9 | **KB empty nudge automation** (48h no KB entries) | 3/10 | 2-4 hours |

### Defer (not needed for launch)

| # | Gap | Agents | Notes |
|---|-----|:------:|-------|
| 10 | Self-serve quarterly blitz launcher | 3/10 | Remove from tier or offer as add-on |
| 11 | In-app help center / FAQ | 3/10 | Email support sufficient at 25 clients |
| 12 | Automated Revenue Leak Audit substitute | 2/10 | Don't build — managed-only differentiator |
| 13 | Churn risk scoring | 2/10 | Build after 50+ clients |
| 14 | Self-serve landing/pricing page | 2/10 | Marketing site, not platform |

---

## Tier Comparison (Consensus)

| Feature | Self-Serve ($497/mo) | Managed ($1,000/mo) |
|---------|:-------------------:|:-------------------:|
| All automations (estimate, win-back, etc.) | Yes | Yes |
| AI conversation agent | Yes | Yes |
| Google Calendar sync | Yes | Yes |
| Bi-weekly reports | Auto-delivered | Operator-reviewed |
| Compliance gateway | Yes | Yes |
| Phone provisioning | Self-serve | Operator sets up |
| Onboarding | Guided wizard (20 min) | 30-min call + operator |
| Revenue Leak Audit | No | Yes (48-hour deliverable) |
| Quarterly Growth Blitz | No (or add-on) | Operator-customized |
| AI quality monitoring | Contractor self-monitors | Operator monitors daily |
| KB maintenance | Contractor fills gaps | Operator fills gaps |
| Escalation handling | Contractor handles | Operator triages |
| Review response posting | Contractor approves | Operator approves |
| Guarantee | Layer 1 only (30-day) | Layer 1 + Layer 2 (90-day) |
| Support | Email/portal only | SMS + proactive check-ins |
| Time commitment | 1-2 hrs/week | Under 15 min/week |

---

## Cannibalization Risk

**Consensus assessment: moderate, manageable with discipline.**

Mitigations that 7+/10 agents agreed on:
1. Separate acquisition channels — don't mention self-serve in managed sales calls
2. No portal downgrade button — require a conversation
3. Revenue Leak Audit as managed-only exclusive
4. Stronger guarantee at managed tier (Layer 1 + 2 vs Layer 1 only)
5. Launch self-serve to new prospects only — don't announce to existing managed clients initially

---

## Recommended Path

1. **Now → Client #5**: Focus entirely on managed at $1,000/month. Build social proof.
2. **Client #5**: Start building the 4 "must build" gaps (KB wizard, auto-progression, portal import, review approval). ~4-5 days of work.
3. **Client #5-8**: Run a private self-serve beta with 3-5 contractors (lower-budget or referral-contractor profile). Measure: onboarding completion rate, time to first AI conversation, support contacts per client.
4. **Client #8-10**: If beta validates (<30 min support/client/month), launch self-serve publicly at $497/month with separate positioning and separate landing page.
5. **Client #15+**: Consider the quarterly blitz add-on ($97-197/quarter) and managed upgrade automation triggers.

---

## Key Insight

The platform is architecturally ready for self-serve — the automation layer is genuinely zero-touch. **The risk is not technical. It's in three areas:**

1. **KB cold-start**: Without the onboarding wizard, the AI performs poorly and contractors form a negative first impression that no amount of subsequent automation can overcome.
2. **Cannibalization**: The managed tier's value is invisible by design ("the operator is invisible and the system just works"). Introducing a cheaper tier forces you to make that invisible value visible — or lose the premium.
3. **Positioning**: The current offer copy is 100% managed-service language. Self-serve requires a forked positioning document that honestly communicates "you run it" without undermining the managed tier's "we run it" promise.

All three are solvable. None require architectural changes. The KB wizard is 1-2 days of build. The cannibalization guard is discipline, not code. The positioning is a writing task.
