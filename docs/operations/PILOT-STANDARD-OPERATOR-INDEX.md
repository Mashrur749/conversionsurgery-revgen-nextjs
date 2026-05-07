# Pilot / Standard Operator Index

**Version 1.0 — May 5, 2026**
**Audience:** Operator running Pilot + Standard tier sales and delivery exclusively. Premium is hidden from public proposals — ignore Premium-specific content.
**Purpose:** One entry point. Bookmark this file. For every action across the lifecycle, this index points you to the exact section of the exact existing doc.

---

## How to Use This

You will not find runbooks _in_ this file. This file _routes_ you to runbooks in other docs. The runbooks live where they live so they stay in sync with the rest of the project. Open this index, scan for your situation, jump to the linked section.

If a doc has multiple sections relevant to a stage, all are listed. If you can't find what you need here, the doc structure is wrong — file an issue or fix it.

---

## Stage 0 — Pre-Launch (One-Time Setup)

Get yourself sales-ready. Run these once.

| Action | Where |
|---|---|
| Full operator launch action list (everything you must do externally) | [`OPERATOR-LAUNCH-ACTION-LIST.md`](./OPERATOR-LAUNCH-ACTION-LIST.md) |
| A2P/10DLC, Stripe, deployment, Twilio, Resend, operator profile | [`OPERATOR-LAUNCH-ACTION-LIST.md`](./OPERATOR-LAUNCH-ACTION-LIST.md) Actions 1-8 |
| Pre-launch infrastructure checklist (Cloudflare, env vars, webhooks) | [`LAUNCH-CHECKLIST.md`](./LAUNCH-CHECKLIST.md) Phase 4 |
| End-to-end rehearsal with test contractor | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) Phases 1-7 |
| Origin story video (60-90 sec, phone recording) | [`OPERATOR-LAUNCH-ACTION-LIST.md`](./OPERATOR-LAUNCH-ACTION-LIST.md) Action 9.5 + [`templates/SALES-TOOLKIT-BASEMENT.md`](./templates/SALES-TOOLKIT-BASEMENT.md) §1 Notes |
| Loom Pro account + first audit recording | [`OPERATOR-LAUNCH-ACTION-LIST.md`](./OPERATOR-LAUNCH-ACTION-LIST.md) Action 10 |
| Prospect list refinement | [`OPERATOR-LAUNCH-ACTION-LIST.md`](./OPERATOR-LAUNCH-ACTION-LIST.md) Action 11 + [`templates/calgary-basement-prospects.csv`](./templates/calgary-basement-prospects.csv) |

---

## Stage 1 — Sales (Cold → Qualified Prospect)

Cold outreach to a prospect on your discovery call.

| Action | Where |
|---|---|
| ICP definition + 6-question qualifier | [`../business-intel/ICP-DEFINITION.md`](../business-intel/ICP-DEFINITION.md) |
| Cold email scripts (A-G) | [`COLD-START-PLAYBOOK.md`](./COLD-START-PLAYBOOK.md) Scripts A-E |
| Cold call openers | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §2.1 + [`COLD-START-PLAYBOOK.md`](./COLD-START-PLAYBOOK.md) Script C |
| LinkedIn DM scripts | [`COLD-START-PLAYBOOK.md`](./COLD-START-PLAYBOOK.md) Script D |
| Pre-sale audit deliverable (Loom + leak audit) | [`templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`](./templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md) + E2E §1.1-1.2 |
| Discovery call prep | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §1.3 |
| 10-question discovery scorecard | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §2.2 |
| Tier recommendation logic (Pilot vs Standard, hard rule) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §2.3 |
| Objection handling (16 objections + gatekeeper, all tiers) | [`../business-intel/SALES-OBJECTION-PLAYBOOK.md`](../business-intel/SALES-OBJECTION-PLAYBOOK.md) |
| No warm prospects — alternative demo path | [`ACQUISITION-PLAYBOOK-0-TO-5.md`](./ACQUISITION-PLAYBOOK-0-TO-5.md) Phase 2 "What If You Have No Warm Prospects?" |
| Outreach floor (50/wk minimum, 100/wk for accelerated timeline) | [`EXECUTION-PLAN.md`](./EXECUTION-PLAN.md) + [`COLD-START-PLAYBOOK.md`](./COLD-START-PLAYBOOK.md) |

---

## Stage 2 — Closing (Qualified → Signed Contract)

Move them across the line.

| Action | Where |
|---|---|
| The 4 Irresistibility Levers (Dead Lead Resurrection, Day-14 Cancel, 30-day Pause, Spouse Line) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §2.4.5 |
| Dead Lead Resurrection demo prep + on-call delivery | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §1.7 |
| Spouse Line invocation protocol + 10-fear partner Q&amp;A | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §1.8 |
| Demo close script | [`COLD-START-PLAYBOOK.md`](./COLD-START-PLAYBOOK.md) Script F + E2E §2.5 |
| Service Agreement template (fill brackets, send) | [`../legal/SERVICE-AGREEMENT-TEMPLATE.md`](../legal/SERVICE-AGREEMENT-TEMPLATE.md) + E2E §2.6 |
| Generate Stripe Checkout link in admin | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §3.1 |
| Send payment link to client | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §3.2 |
| Verify payment received in Stripe | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §3.3 |
| Verify subscription created in platform | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §3.4 |
| Day-7 non-refundable trigger handling | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §3.5 |

---

## Stage 3 — Onboarding (Signed → Day 21 Go-Live)

Get them live, get them logged.

| Action | Where |
|---|---|
| Welcome SMS + Welcome Email templates (auto-fire) | [`../business-intel/OFFER-APPROVED-COPY.md`](../business-intel/OFFER-APPROVED-COPY.md) §12.1, 12.2 |
| Pre-onboarding priming SMS (collect dead quotes) | [`../business-intel/OFFER-APPROVED-COPY.md`](../business-intel/OFFER-APPROVED-COPY.md) §12.3 |
| 30-min onboarding call script (7 beats) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §10 |
| KB wizard / questionnaire (4-step) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §4.4 |
| Phone number provisioning + forwarding | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §4.5 |
| Day-1 activation verification | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §4.6 |
| Old quote import procedure (CSV) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §2 + E2E §4.7 |
| Day-7 Listing Migration Call (15-20 min: GBP, HomeStars, Yelp) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §10a |
| 21-day implementation timeline (Day 1-2, 3-5, 6-8, ..., 19-20, 21) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §5.1-5.8 |
| Basement KB preset (21 entries, customize 5 required) | [`templates/BASEMENT-KB-PRESET.md`](./templates/BASEMENT-KB-PRESET.md) |

---

## Stage 4 — Delivery (Day 21 Go-Live → Day 90)

Run them through the operational guarantee window. Reinforce value.

| Action | Where |
|---|---|
| 16 production tests (every automation) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §6.1-6.16 |
| Per-feature test mechanics | [`../engineering/01-TESTING-GUIDE.md`](../engineering/01-TESTING-GUIDE.md) |
| Day-21 go-live gate handling | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §6.13 + [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §5 |
| Day-30 logging gate handling | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §6.14 + [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §5 |
| Smart Assist → Autonomous progression (Day 14 trigger) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §3 + [`01-OPERATIONS-GUIDE.md`](./01-OPERATIONS-GUIDE.md) §47 |
| First Missed Lead Replay SMS (auto, one-shot, Day 21-51) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §1.9 |
| Friday Pulse SMS (4pm Friday client local time, weekly) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §1.9 + E2E §7.0 |
| Weekly Pipeline Pulse SMS (Monday morning) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §6.16 |
| Bi-weekly performance report (email + SMS) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §6.15 |
| Bi-weekly strategy call agenda (30 min) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §4 |
| Day-45 Proactive Retention Call (15-20 min, structured) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §10b |
| Phase 10 final sign-off checklist (every box must be green) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §10 |

---

## Stage 5 — Ongoing Monthly Operations (Day 90+)

Daily cadence. Weekly cadence. The unsexy machine that keeps the lights on.

### Daily / Weekly / Monthly Routines

| Routine | Where |
|---|---|
| Operator daily routine (15-30 min: triage, escalations, AI quality, KB gaps) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §7.1 + [`01-OPERATIONS-GUIDE.md`](./01-OPERATIONS-GUIDE.md) Daily Checklist |
| Operator cockpit (unified daily workflow) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §1.6 |
| Operator weekly routine (Friday review, outreach floor count) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §7.2 |
| Operator bi-weekly strategy call (per client) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §7.3 + [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §4 |
| Operator monthly routine (template refinement, KB optimization, compliance audit) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §7.4 |
| Quarterly Growth Blitz (Q1-Q4 selection + execution) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §7.5 |

### Per-Function Reference

| Function | Where |
|---|---|
| Escalation handling | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §1 |
| At-Risk detection &amp; recovery (6 signals) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §1.5 |
| AI quality monitoring + Smart Assist ops | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §3 |
| KB gap closure (Ask Contractor button, auto-resolve) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §3 + [`01-OPERATIONS-GUIDE.md`](./01-OPERATIONS-GUIDE.md) |
| Compliance / quiet hours / opt-out | [`01-OPERATIONS-GUIDE.md`](./01-OPERATIONS-GUIDE.md) Compliance section |
| Lead opts out / compliance complaint | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §8 |
| Wrong number / misrouted lead | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §9 |
| Pilot tier handling (3-client cap, upgrade conversation) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §11b |
| Pilot-to-Standard upgrade (client #4 hard rule) | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §8.7 |

### Cancellation + Pause Flows

| Situation | Where |
|---|---|
| Day-14 cancel right (acknowledge, no questions, $1,750/$2,750 max exposure) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §7a + E2E §8.0a |
| Mid-term cancel (Day 15-90, retention conversation, guarantee triggers) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §7b + E2E §8.4 |
| Post-90-day cancel (30-day notice flow) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §7c + E2E §8.5 |
| 30-day pause right (post-Minimum-Term, contractual) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §6a + E2E §8.0b |
| Ad-hoc pause (operator courtesy, pre-Minimum-Term) | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) §6b |
| Setup second-half not paid at go-live | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §8.1 |
| Go-live slips past Day 21 | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §8.2 |
| Logging falls below 80% | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §8.3 |
| Voice AI exceeds 1,000 min/mo fair-use | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) §8.6 |

---

## Stage 6 — Growth (Defer Until 3+ Active Clients)

Don't write playbooks for these until you have real client experience to write from.

| Topic | Status |
|---|---|
| Referral mechanics (formal flywheel) | DEFERRED — write after Pilot #1 hits Day 90 |
| Supplier referral channel (Olympia Tile, Emco) | DEFERRED — activate after 2nd client live |
| Case study capture (Day-75 video, Day-90 win story) | DEFERRED — process emerges from Pilot #1 |
| Calgary contractor leaderboard | DEFERRED — needs 6+ clients for credibility |
| Capacity planning at scale | DEFERRED — irrelevant until 5+ clients |

---

## Quick Reference — Source-of-Truth Docs

When in doubt, the more recent doc wins. These are the authoritative sources for Pilot/Standard:

| What | Where |
|---|---|
| Offer terms, pricing, ICP, fulfillment, economics | [`../business-intel/Revenue_Recovery_System_Business_Reference.md`](../business-intel/Revenue_Recovery_System_Business_Reference.md) |
| Approved client-facing language | [`../business-intel/OFFER-APPROVED-COPY.md`](../business-intel/OFFER-APPROVED-COPY.md) |
| ICP definition (Calgary/Edmonton design-build, $1M-$10M) | [`../business-intel/ICP-DEFINITION.md`](../business-intel/ICP-DEFINITION.md) |
| Service agreement (legal contract template) | [`../legal/SERVICE-AGREEMENT-TEMPLATE.md`](../legal/SERVICE-AGREEMENT-TEMPLATE.md) |
| Daily ops + per-function runbooks | [`02-MANAGED-SERVICE-PLAYBOOK.md`](./02-MANAGED-SERVICE-PLAYBOOK.md) |
| End-to-end sales-to-delivery rehearsal + runbook | [`E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`](./E2E-PILOT-STANDARD-DELIVERY-GUIDE.md) |
| Pre-launch infrastructure checklist | [`LAUNCH-CHECKLIST.md`](./LAUNCH-CHECKLIST.md) |
| What only YOU can do (external accounts, rehearsal, outreach) | [`OPERATOR-LAUNCH-ACTION-LIST.md`](./OPERATOR-LAUNCH-ACTION-LIST.md) |

---

## What This Index Does NOT Cover

- Premium tier specifics (hidden from public proposals — `publiclyVisible: false`)
- Engineering / platform internals (see `docs/engineering/`)
- Self-serve signup flow (deferred until post-managed-service validation)
- Multi-agency / white-label expansion (post-validation, see `docs/product/FEATURE-BACKLOG.md` FB-02)

If you find yourself needing any of those, you're outside the Pilot/Standard hyper-focus phase — circle back when ready.
