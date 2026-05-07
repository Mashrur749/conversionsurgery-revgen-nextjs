# ConversionSurgery Revenue Recovery System

## What This Is

A B2B SaaS platform that recovers lost revenue for renovation contractors (basement, bath, kitchen) by automating lead follow-up, estimate chasing, appointment reminders, review requests, and win-back campaigns. Sold as a managed service with AI-powered SMS/voice conversations, compliance-first messaging, and operator-managed delivery. Built on Next.js 16 + Neon Postgres + Stripe + Twilio + Anthropic Claude.

## Core Value

Every inbound lead gets an instant, compliant, AI-driven response and persistent follow-up — no contractor effort required. Revenue recovery happens automatically.

## Requirements

### Validated

Shipped and confirmed working in existing codebase:

- ✓ AI conversation agent — 6-layer deterministic-first pipeline (strategy + LLM) — existing
- ✓ Missed-call capture + compliant text-back — existing
- ✓ 4-6 touch estimate follow-up over 14-30 days — existing
- ✓ Appointment reminders + no-show recovery — existing
- ✓ Review request automation — existing
- ✓ Win-back campaigns for stale leads — existing
- ✓ Compliance gateway — TCPA quiet hours, CASL consent, STOP handling, DNC, kill switches — existing
- ✓ Dedicated business numbers (Twilio provisioning) — existing
- ✓ AI voice receptionist + ring groups — existing
- ✓ Admin dashboard — client management, lead triage, AI quality monitoring — existing
- ✓ Client portal — conversations, leads, appointments, reports — existing
- ✓ Bi-weekly performance scoreboard + weekly Pipeline Pulse SMS — existing
- ✓ Admin auth (magic links) + client portal auth (OTP) — existing
- ✓ Stripe billing integration (subscriptions, webhooks) — existing
- ✓ Webhook handlers (Twilio SMS/voice, Stripe, Jobber, forms) — existing
- ✓ 15+ cron jobs for scheduled automations — existing
- ✓ Public signup + onboarding flow — existing
- ✓ Feature flags + ops kill switches — existing
- ✓ 312 deterministic tests (agent scenarios, guardrails, routing, permissions) — existing

### Active

Current gaps and work in progress:

- [ ] Billing enforcement — `hasFeatureAccess()` exists but zero callers; all plans get all features (PG critical)
- [ ] Checkout session creation — `createCheckoutSession` missing from subscription service (Wave A)
- [ ] Checkout link API endpoint — admin endpoint for generating client checkout links (Wave A)
- [ ] 21-day activation gate + day-30 logging enforcement (PG-001)
- [ ] Channel-level lead source attribution — only `missed_call`, `form`, `manual` captured; no Google/Houzz/LSA/referral/organic (PG-002)
- [ ] Estimator-level reporting and pipeline filtering (PG-003)
- [ ] Timezone inference from phone area code — currently falls back to contractor timezone (TCPA risk)
- [ ] Notification batching — messages beyond 5/hour silently dropped instead of queued
- [ ] API route test coverage — billing, webhooks, cron handlers have zero unit tests
- [ ] Large file decomposition — 5 files over 800 lines (orchestrator, stripe webhook, relations, conversations shell)

### Out of Scope

- Mobile native app — web-first, mobile later
- Premium/Booked Estimate OS tier — 6 of 11 attribution deliverables incomplete; do not sell yet
- Add-on microsites — out of scope per Section 8 of offer copy
- Multi-tenant white-label — single agency operation
- Real-time chat (WebSocket) — SMS-first communication model

## Context

**Business model:** Managed service for Calgary basement/renovation contractors. Three tiers: Pilot ($3,500 setup + $1,500/mo, first 3 clients only), Standard ($5,500 setup + $2,000/mo, client 4+), Premium ($9,500 setup + $3,500/mo, hidden from public proposals via `publiclyVisible: false`). Setup split 50/50 (signing/go-live), Day-7 non-refundable. Operational guarantee: 21-day go-live + 30-day logging gate (auto-pause billing). Day-14 cancel right + 30-day pause right. Voice AI included free with 1,000 min/mo fair-use clause.

**ICP:** Referral-driven renovation contractors doing $500K-$3M annual revenue, 2-15 employees, who lose revenue from missed calls and unworked estimates.

**Delivery:** Operator-managed — ConversionSurgery team handles setup, number porting, AI tuning, compliance. Contractor interacts via client portal and SMS notifications.

**Current state:** Pilot and Standard tiers are sell-ready pending P0 gap resolution (billing enforcement, activation gate). Core operational platform is built and functional. 15 managed-service specs shipped (MS-01 through MS-15).

**Technical environment:** Cloudflare Workers edge runtime (single-threaded, no fs). Neon serverless Postgres (HTTP client per request). All outbound SMS through compliance gateway.

**n8n automation:** Six workflows (CS 0-5) automate lead sourcing, AI enrichment, audit generation, and outreach for contractor acquisition pipeline.

## Constraints

- **Runtime:** Cloudflare Workers — no long-running processes, no global state, no fs access
- **Compliance:** All outbound SMS must go through `sendCompliantMessage()` — never call Twilio directly
- **AI tracking:** Agent nodes use `getAIProvider()` raw; all other callers use `getTrackedAI()`
- **DB pattern:** `getDb()` per request — never cache the Neon HTTP client
- **TypeScript:** Zero tolerance for `any` — use `as unknown as T` for jsonb narrowing
- **Existing CLAUDE.md:** Project has extensive coding standards, auto-checklists, and doc-sync rules that must be preserved

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Deterministic-first AI (6-layer) | Strategy is rule-based; LLM only generates language — predictable, auditable | ✓ Good |
| Compliance gateway as single chokepoint | Legal risk too high for per-service compliance — centralize | ✓ Good |
| Managed service (not self-serve SaaS) | ICP contractors won't self-configure AI — needs operator delivery | ✓ Good |
| Wave-based billing implementation | Ship checkout + enforcement before channel attribution | — Pending |
| Coarse GSD phases | Platform is mature; work is gap-filling, not greenfield feature dev | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-04 after initialization*
