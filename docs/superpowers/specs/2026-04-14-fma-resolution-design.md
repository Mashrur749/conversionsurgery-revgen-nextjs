# FMA Resolution Master Spec

**Date**: 2026-04-14
**Source**: Failure Mode Analysis (59 FMs, 10K Monte Carlo scenarios) — `active/fma/managed-service-fma.md`
**Scope**: All platform builds, process codifications, and architectural decisions to resolve identified failure modes across the managed service lifecycle
**Implementation**: 4 waves, each spec'd and built in a dedicated session referencing this document

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Architectural Decisions](#2-architectural-decisions)
3. [Wave 1: Foundation + Quick Wins](#3-wave-1-foundation--quick-wins)
4. [Wave 2: Gates & Enforcement](#4-wave-2-gates--enforcement)
5. [Wave 3: Operator Cockpit](#5-wave-3-operator-cockpit)
6. [Wave 4: System Health](#6-wave-4-system-health)
7. [Process Codifications](#7-process-codifications)
8. [Deferred Items](#8-deferred-items)
9. [FM Resolution Matrix](#9-fm-resolution-matrix)

---

## 1. Design Principles

### 1.1 The Operator Copilot Model

The platform turns the playbook from a document the operator reads into a system the operator follows. Three layers of support:

| Layer | Platform Role | Operator Role | Example |
|-------|-------------|--------------|---------|
| **Automate** | Does it without involvement | Reviews in monthly digest | Day 25 billing reminder, pre-onboarding SMS |
| **Gate** | Blocks progression until condition met | Confirms condition, unblocks | Exclusion list verified, readiness checklist passed |
| **Surface** | Shows what to do next with pre-loaded context | Makes the decision, takes action | Action queue, call prep, engagement signals |

**Target**: Reduce per-client weekly operator time from 2.0h to 1.2-1.5h, pushing capacity wall from ~10 to 13-17 clients.

### 1.2 Three AI Rules

1. **Transparent by default** — show inputs, not just outputs. "18 days since last EST, 3 nudges unanswered" not "score: 62." The operator can always answer "why is the system telling me this?"
2. **Human decides, system surfaces** — no automated interventions on contractor-facing or homeowner-facing touchpoints without explicit operator action.
3. **Earn trust through accuracy, not assertion** — shadow &rarr; supervised &rarr; autonomous, graduated by demonstrated accuracy, not elapsed time.

### 1.3 Safety Model

| Layer | Purpose | Mechanism |
|-------|---------|-----------|
| **Guardrails** | Prevent bad actions | Compliance gateway (all outbound), shadow mode (new automations), rate caps, notification budget |
| **Observability** | Detect failures fast | Structured audit logs, heartbeat monitoring, error aggregation |
| **Review cadence** | Catch drift | Daily briefing (2 min), bi-weekly call prep (auto-generated), monthly digest (10 min) |
| **Circuit breakers** | Stop cascading damage | Per-client (3 errors/24h &rarr; pause), system-wide (3 simultaneous alerts &rarr; investigate), rate anomaly (2x daily avg &rarr; pause) |

### 1.4 Trust Gradient Per Automation

| Level | Behavior | Operator Experience | Graduation Criteria |
|-------|----------|-------------------|-------------------|
| **Shadow** | Logs what it would do, doesn't act | Sees proposed action, confirms first instance | Operator approves 3 in a row |
| **Supervised** | Acts, notifies operator after | Appears in daily briefing as completed action | No corrections after 5 clients AND operator has edited at least 1 |
| **Autonomous** | Acts, logs silently | Appears in monthly health stats only | Steady state, operator explicitly graduates |

Each automation starts at shadow. Operator graduates it per-client. If the operator never edits a suggestion in 10 instances, prompt: "You've approved 10 without changes. Are you reviewing carefully?"

---

## 2. Architectural Decisions

### 2.1 Contractor Communication: Daily Digest

**Problem**: Current system sends 40-60 individual operational texts/month to each contractor. 17 texts/week in a busy week. Violates the "you don't manage anything" promise.

**Decision**: Batch all P2 operational messages into a single daily digest at 10am local time.

**Notification Priority Tiers**:

| Tier | Category | Behavior | Examples |
|------|----------|----------|---------|
| **P0** | Critical | Always sends immediately, no cap | Opt-out confirmations, compliance, PAUSE/RESUME |
| **P1** | Time-sensitive | Sends immediately, counts toward daily cap (max 2/day) | Booking confirmations, escalation needing contractor, hot transfer missed |
| **P2** | Operational | Batched into daily digest (10am local) | KB gaps, probable wins, stuck estimates, quote prompts |
| **P3** | Informational | Batched into weekly digest (Monday) | Pipeline SMS, report notification |

**P1 hot-lead bypass**: If an escalation involves a high-intent lead (intent score &ge;80 or appointment within 24h), it sends immediately as P1 even if it would normally be P2. Hot leads can't wait for tomorrow's digest.

**Daily digest format**:
```
Morning update for [Business]:

2 leads need input:
  1. Sarah T — sent quote? Reply 1=YES
  2. Mike R — won or lost? Reply W2 or L2

1 question from a homeowner:
  3. "Do you offer financing?" Reply with answer

Reply 0 to skip all.
```

Uses existing compact reply syntax from `numbered-reply-parser.ts`. One text. One interruption. Contractor replies in 15 seconds.

**Monthly message reduction**: 52-78/month &rarr; 32-36/month. Daily interruptions: 2-3 &rarr; 1 digest + occasional P1.

### 2.2 Engagement Signals (Not Score)

**Decision**: 5 deterministic indicators, each independently visible as green/yellow/red. No composite number.

| Signal | Green | Yellow | Red |
|--------|-------|--------|-----|
| EST trigger recency | &lt;7 days | 7-14 days | &gt;14 days |
| WON/LOST recency | &lt;14 days | 14-21 days | &gt;21 days |
| KB gap response rate | &gt;70% answered | 30-70% | &lt;30% |
| Nudge response rate | &gt;50% replied | 20-50% | &lt;20% |
| Last contractor-initiated contact | &lt;7 days | 7-14 days | &gt;14 days |

**Context shown alongside signals** (prevents misinterpretation):
- Lead volume this period vs average ("2 leads vs 14 avg" explains low EST activity)
- How many clients have similar activity levels ("3 of 12 clients look like this" = probably seasonal)

**Threshold for surfacing**: 4 of 5 signals yellow/red for 14+ consecutive days. Conservative — better to miss some at-risk contractors than generate false alarms.

**No automated interventions**. System surfaces signals to operator cockpit. Operator decides if action is warranted. Never auto-send an intervention text to the contractor.

### 2.3 Auto-Resolve Escalations

**Decision**: For KB-gap escalations (AI deferred because it lacked information), the platform suggests an answer sourced from the contractor's website or existing KB entries. Operator always approves.

**Gates**:
- Always show source verbatim: "From alpineconcrete.ca/services: '[exact text]'"
- External-data flag: "This answer is from the contractor's website, not their knowledge base. It may be outdated."
- Confirmation button reads "I verified this is accurate" (not "Send")
- First 5 auto-resolves per client require: "I confirmed this with the contractor"
- **Never graduates past supervised** for homeowner-facing messages from external data
- If source is an existing KB entry (not scraped): confidence flag not needed, simpler confirmation

### 2.4 Second Operator Readiness

**Decision**: Design data model for multiplayer. Don't build multiplayer UI.

**Data model additions**:
- `operatorId` on: action items, intervention records, call notes, audit log entries
- `assignedOperatorId` on: scheduled calls, pending actions in cockpit
- `clientPrimaryOperatorId` on: clients table

**Client ownership model**: Assign clients to operators, not actions to operators. Operator A owns clients 1-6, Operator B owns clients 7-12. Each operator's cockpit shows their clients only. Prevents collision and diffusion of responsibility.

**Atomic action claiming**: When operator clicks an action, it's atomically claimed (same `status-conditional UPDATE` pattern as existing escalation assignment). Second operator sees it as claimed.

### 2.5 Rollback Safety

**Decision**: Every automation independently disableable at two levels.

**Feature flag pattern** (follows existing `voiceEnabled`, `calendarSyncEnabled`):

```
System-level (agency_settings):
  [feature]Enabled: boolean (default: true)

Per-client override (clients):
  [feature]Enabled: boolean | null (null = inherit system)
```

**Three states**: System on + client inherits (default), system on + client off, system off (all clients).

**Drain behavior**: On disable, in-progress work completes, no new work starts.

**Emergency global pause**: One button in system settings. Stops all automations except compliance-required messages. Extends existing PAUSE concept.

**Audit trail**: Every enable/disable logged with timestamp and operatorId.

### 2.6 Call Prep Auto-Generation

**Decision**: Before each bi-weekly call, auto-generate an agenda with pre-loaded context. Replaces 10 min of manual prep with 2 min of review.

**Content** (all facts from DB, inferences clearly marked):

| Section | Data Source | Type |
|---------|-----------|:----:|
| Engagement signals (5 indicators) | Aggregated from audit_log, leads, KB gaps | Fact |
| Guarantee progress (phase, %, days remaining) | Client guarantee status | Fact |
| Stale leads to ask about (contacted/estimate_sent, 3+ days no update) | Leads table | Fact |
| KB gaps to fill on call | Knowledge gaps table | Fact |
| Automation activity (last 2 weeks) | Audit log aggregation | Fact |
| *"At risk: needs $1,800 more pipeline in 23 days"* | *Calculated from guarantee threshold - current pipeline* | *Inference (italicized)* |

### 2.7 Operator Cockpit UX Architecture

**Two-layer view**:

**Layer 1 — Birds-eye** (morning triage, 2 min):
- Top row: 3-4 KPI cards (actions due, clients needing attention, automation health badge, capacity)
- Below: Action list sorted by urgency (red &rarr; yellow &rarr; green)
- Each row is an ACTION, not a client. Client with 3 things due = 3 rows.
- Green clients collapsed at bottom — expandable but not prominent
- Follows existing triage UX patterns: `border-l-4` urgency colors, trigger lists, trend duration

**Layer 2 — Issue surfacing** (when operator clicks an action):
- Full context for THAT action, pre-loaded
- Call prep, escalation detail, engagement signals, guarantee progress
- One-click happy path + full editing capability
- Facts in normal text, inferences italicized

**Replaces**: Current workflow of checking escalation queue + each client dashboard + mental tracking of what's due.

---

## 3. Wave 1: Foundation + Quick Wins

**Prerequisites**: None. All items are independent.
**Estimated effort**: 1-2 sessions
**Key dependency**: Items 1-3 are foundational — other waves build on notification tiers, digest service, and feature flags.

### 3.1 Notification Priority Tier System

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | All contractor-facing FMs (notification fatigue prevention) |
| **What it does** | Classifies every outbound contractor notification into P0-P3 tiers. Enforces daily cap (2 immediate messages/day for P1). Routes P2 to digest, P3 to weekly digest. |
| **Key files** | New: `src/lib/services/notification-priority.ts`. Modify: every automation that sends contractor notifications |
| **Pattern** | Each outbound call to contractor gets a `priority` parameter. The notification service checks: P0 = send immediately. P1 = send if under daily cap, else defer to next slot. P2 = queue for daily digest. P3 = queue for weekly digest. |
| **Trust level** | Autonomous from day 1 (internal routing, not content generation) |
| **Feature flag** | Not independently flaggable — this is infrastructure |

### 3.2 Daily Contractor Digest Service

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-31, FM-40, FM-56, FM-44 + notification fatigue |
| **What it does** | Daily cron at 10am local time per client. Aggregates all pending P2 items. Formats into single SMS with compact reply syntax. Sends. Suppresses individual notifications for included items. |
| **Key files** | New: `src/lib/services/contractor-digest.ts`, `src/lib/automations/daily-digest.ts`. Modify: `src/app/api/cron/route.ts` |
| **Pattern** | Cron collects: pending KB gaps (unsent), probable-wins-eligible leads, stuck estimates, proactive quote prompts. Numbers them. Formats using `numbered-reply-parser.ts` syntax. Sends one SMS. Marks items as "included in digest" to prevent duplicate individual sends. |
| **Digest items can include** | KB gap questions (reply with answer), EST prompts (reply 1=YES), WON/LOST prompts (reply W/L + number), quote prompts |
| **Empty digest** | If no P2 items pending, no digest sent. Silence = green. |
| **Trust level** | Shadow for first client (operator sees proposed digest, approves). Supervised after that. |
| **Feature flag** | `dailyDigestEnabled` (system + per-client) |

### 3.3 Feature Flag Infrastructure

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | Rollback safety for all automations |
| **What it does** | Standardized feature flag pattern for all new automations. System-level defaults in agency settings. Per-client overrides. Audit trail on changes. |
| **Key files** | Modify: `src/db/schema/agency-settings.ts` (add flag columns), `src/db/schema/clients.ts` (add nullable override columns). New: `src/lib/services/feature-flags.ts` (resolution logic: client override > system default) |
| **Pattern** | `isFeatureEnabled(clientId, 'dailyDigest')` &rarr; checks client override, falls back to system default |
| **Flags to create** | `dailyDigestEnabled`, `engagementSignalsEnabled`, `autoResolveEnabled`, `forwardingVerificationEnabled`, `billingReminderEnabled`, `opsHealthMonitorEnabled`, `callPrepEnabled`, `capacityTrackingEnabled` |
| **Emergency pause** | `globalAutomationPause` boolean on agency settings. When true, all automations skip (except P0 compliance). One-click toggle in admin settings UI. |

### 3.4 Day 25 Billing Reminder Cron

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-05 (trial surprise), FM-62 (card decline), FM-63 (charge dispute) |
| **What it does** | Daily cron. For clients 24-26 days post-signup with active trial, sends SMS: "Your free month ends in 5 days. Billing starts [date] at $1,000/month. Questions? Reply to this message." |
| **Key files** | New: `src/lib/automations/billing-reminder.ts`. Modify: `src/app/api/cron/route.ts` |
| **Pattern** | Same as Day 3 check-in: daily cron, date range check, audit_log dedup (one per client), compliance gateway send |
| **Priority tier** | P1 (time-sensitive, sends immediately) |
| **Trust level** | Supervised (operator sees in briefing that it sent) |
| **Feature flag** | `billingReminderEnabled` |

### 3.5 Pre-Guarantee Operator Alert (Day 80)

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-58 (L1 fails on legit client), FM-61 (false refund) |
| **What it does** | Daily cron. For clients 78-82 days post-signup where guarantee pipeline &lt;$5K AND no attributed result: alerts operator via cockpit action item (NOT SMS to contractor). "Client [name] has 10 days until 90-day guarantee. Pipeline at $[X]. Schedule revenue capture call immediately." |
| **Key files** | New: `src/lib/automations/guarantee-alert.ts`. Modify: `src/app/api/cron/route.ts` |
| **Pattern** | Creates an action item in the operator cockpit (Wave 3) with pre-loaded context. Falls back to operator SMS if cockpit not yet built. |
| **Priority tier** | Operator-only notification (not contractor-facing) |
| **Trust level** | Autonomous (internal alert, no external action) |
| **Feature flag** | Part of `opsHealthMonitorEnabled` |

### 3.6 Onboarding Call Reminder (2h Before)

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-07 (onboarding no-show) |
| **What it does** | Sends contractor SMS 2 hours before scheduled onboarding call: "Quick reminder — setup call at [time] today. Takes 30 min. If now doesn't work, reply with a better time." |
| **Key files** | New: `src/lib/automations/onboarding-reminder.ts`. Modify: `src/app/api/cron/route.ts` |
| **Pattern** | Requires onboarding call datetime to be recorded on client record. Cron checks every 30 min for calls due in 1.5-2.5h window. Dedup via audit_log. |
| **Prerequisite** | Need a `scheduledOnboardingCall` field on clients or a calendar event linked to onboarding. |
| **Priority tier** | P1 (time-sensitive) |
| **Trust level** | Autonomous (simple reminder, low risk) |
| **Feature flag** | Not independently flagged — part of onboarding flow |

### 3.7 Pre-Onboarding Priming SMS

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-15 (no old quotes), FM-65 (empty dormant list) |
| **What it does** | Auto-sends to contractor after signup, before onboarding call: "Before our call — think of 5 people you quoted in the last 6 months that never got back to you. Just first names and what the project was. That's all I need." |
| **Key files** | New: `src/lib/automations/onboarding-priming.ts`. Modify: `src/app/api/cron/route.ts` |
| **Pattern** | Triggers on client creation (or on scheduled call booking). Sends once, dedup via audit_log. Timing: immediately after call is scheduled, or 24h before call if scheduled same-day. |
| **Priority tier** | P1 (time-sensitive, pre-call) |
| **Trust level** | Supervised (operator sees in briefing) |
| **Feature flag** | Not independently flagged — part of onboarding flow |

### 3.8 Extend Probable-Wins Nudge to Estimate-Sent Leads

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-56, FM-53 (WON/LOST gap for non-appointment leads) |
| **What it does** | Extends existing probable-wins-nudge to include leads in `estimate_sent` status for 14+ days with no WON/LOST update. Currently only fires for post-appointment leads. |
| **Key files** | Modify: `src/lib/automations/probable-wins-nudge.ts` |
| **Pattern** | Add query for `estimate_sent` leads with `updatedAt` &gt; 14 days. Include in same batched numbered list. Same compact reply syntax. Same 7-day cooldown. |
| **Priority tier** | P2 (included in daily digest) |
| **Trust level** | Autonomous (extends existing trusted automation) |
| **Feature flag** | Part of existing probable-wins-nudge |

---

## 4. Wave 2: Gates & Enforcement

**Prerequisites**: Wave 1 feature flag infrastructure (3.3)
**Estimated effort**: 1-2 sessions

### 4.1 Exclusion List Onboarding Gate

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-14 (S=10, nuclear trust event) |
| **What it does** | Blocks autonomous mode activation until operator confirms "exclusion list reviewed" — even if the list is empty. The gate confirms the conversation happened. |
| **Key files** | Modify: `src/lib/services/onboarding.ts` (add gate), `src/db/schema/clients.ts` (add `exclusionListReviewed` boolean) |
| **Gate behavior** | When operator tries to switch AI mode to autonomous: check `exclusionListReviewed`. If false, show: "Exclusion list not reviewed. Confirm you asked the contractor about family, friends, and personal numbers before enabling autonomous mode." Operator clicks "I have reviewed the exclusion list" &rarr; sets flag &rarr; allows mode switch. |

### 4.2 Autonomous Readiness Checklist

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-33 (premature autonomous), FM-13 (KB too thin), FM-12 (wrong KB) |
| **What it does** | Auto-calculates readiness before mode transition. Shows checklist with pass/fail per item. Blocks transition if any critical item fails. |
| **Checklist items** | 1. KB entry count &ge;10 (critical, blocks). 2. Pricing range exists for &ge;1 service (critical, blocks — already gated). 3. Reviewed interactions &ge;30 in Smart Assist (critical, blocks). 4. Escalation rate last 7 days &lt;20% (warning, doesn't block). 5. Exclusion list reviewed (critical, blocks — from 4.1). 6. AI safety tests pass (critical, blocks — `npm run test:ai`). |
| **Key files** | New: `src/lib/services/readiness-check.ts`. Modify: AI mode toggle UI, `src/lib/services/onboarding.ts` |
| **UX** | Checklist shown inline when operator clicks mode toggle. Green checkmarks for passing, red X for failing with explanation. "3 of 6 passed. Resolve the following before enabling autonomous mode:" |

### 4.3 ICP Qualification Fields on Client Creation

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-01 (wrong ICP), FM-02 (volume disclosure skipped) |
| **What it does** | Adds required fields to client creation wizard: monthly lead volume estimate, average project value, number of dead quotes available. If volume &lt;15: auto-displays guarantee extension window and requires operator acknowledgment. |
| **Key files** | Modify: client creation wizard component, `src/db/schema/clients.ts` (add `estimatedLeadVolume`, `averageProjectValue`, `deadQuoteCount` fields) |
| **Gate behavior** | Fields are required (wizard won't proceed without them). Sub-15 volume shows: "Guarantee windows will extend: 30-day &rarr; [X] days, 90-day &rarr; [X] days. Confirm you disclosed this to the contractor." Checkbox required. |
| **Not a hard block** | Low-volume contractors CAN be signed — the gate ensures disclosure happened, not that the contractor was rejected. |

### 4.4 Onboarding Checklist with Blocking Gates

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-06, FM-09, FM-11, FM-29 |
| **What it does** | Platform-enforced onboarding checklist that tracks completion of mandatory steps. Some items block progression, others are advisory. |
| **Checklist items** | 1. Phone number assigned (auto-checked). 2. `operator_phone` configured (blocks Smart Assist — FM-29). 3. Call forwarding tested (blocks after forwarding verification — 4.5). 4. Voicemail disabled verified (blocks after forwarding verification). 5. KB minimum entries &ge;5 (blocks Smart Assist activation). 6. Pricing range set (blocks autonomous — already exists). 7. Exclusion list reviewed (blocks autonomous — from 4.1). 8. Payment captured (advisory, not blocking). 9. Quote import completed (advisory). 10. Revenue Leak Audit sent (advisory, surfaces in cockpit if overdue). |
| **Key files** | New: `src/lib/services/onboarding-checklist.ts`. Modify: client detail page, onboarding UI |
| **UX** | Visible on client detail page as a progress card. Green checkmarks accumulate. Blocking items show lock icon on the capability they gate. |

### 4.5 Post-Setup Forwarding Verification

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-08 (forwarding fails), FM-09 (voicemail intercepts), FM-18 (text-back doesn't fire) |
| **What it does** | After phone setup, system auto-calls the contractor's business number. Checks if Twilio receives the forwarded call. If not, alerts operator. Runs daily for first 7 days. |
| **Key files** | New: `src/lib/services/forwarding-verification.ts`, new API route for verification trigger. Modify: `src/app/api/cron/route.ts` |
| **Mechanism** | 1. Place outbound call to contractor's business number via Twilio. 2. Wait for webhook — did the call forward to the Twilio number? 3. If yes: mark verification passed, update onboarding checklist. 4. If no (voicemail picked up, no forward, timeout): alert operator with specific failure reason. |
| **Cost** | ~$0.02 per test call. 7 days &times; 1 call = $0.14 per client onboarding. |
| **Trust level** | Autonomous (internal verification, no contractor-facing action) |
| **Feature flag** | `forwardingVerificationEnabled` |

---

## 5. Wave 3: Operator Cockpit

**Prerequisites**: Wave 1 (digest, feature flags), Wave 2 (gates provide data)
**Estimated effort**: 2-3 sessions (largest wave)
**This is the highest-leverage wave** — transforms operator workflow from reactive checking to proactive action queue.

### 5.1 Operator Action Queue

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-21, FM-25, FM-27, FM-54, FM-64, FM-44, FM-70 |
| **What it does** | Replaces/extends current triage dashboard as operator's primary view. Shows all pending actions across all clients, sorted by urgency. Each action has pre-loaded context. |
| **Action types** | Bi-weekly call due/overdue, Day 45 call due, onboarding gate pending, escalation pending, Revenue Leak Audit overdue, engagement signals flagged, guarantee approaching, forwarding verification failed |
| **Key files** | New or major extension of: `/admin/triage` page, new API: `GET /api/admin/operator-actions`. New: `src/lib/services/operator-actions.ts` (aggregates action items from all sources) |
| **UX** | Follows existing triage patterns. Top KPI row (actions due, clients needing attention, automation health, capacity). Action list below with `border-l-4` urgency. Each row: client name, action description, context snippet, time since due, action button. Red = overdue. Yellow = due today/tomorrow. Green clients collapsed at bottom. |
| **Atomic claiming** | `assignedOperatorId` set via status-conditional UPDATE when operator clicks action. Prevents two operators working same action. |
| **Mobile** | Card layout below 640px (same pattern as existing triage cards) |

### 5.2 Engagement Signals

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-40, FM-56, FM-70, FM-20, FM-24 |
| **What it does** | Calculates 5 deterministic engagement indicators per client. Surfaces in cockpit when 4/5 are yellow/red for 14+ days. Shows context alongside signals. |
| **Signals** | See Section 2.2 for thresholds. |
| **Key files** | New: `src/lib/services/engagement-signals.ts`. Enhancement to existing `src/lib/services/engagement-health.ts` or replacement. New cron entry for weekly signal calculation. |
| **Data sources** | `audit_log` (EST triggers, WON/LOST marks, nudge responses), `knowledge_gaps` (gap response rate), `messages` (last contractor-initiated contact), `leads` (volume this period vs average) |
| **Surfacing** | When threshold crossed: creates action item in operator cockpit with trigger list and context. Never auto-messages the contractor. |
| **Feature flag** | `engagementSignalsEnabled` |

### 5.3 Call Prep Auto-Generation

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-53, FM-61, FM-56 |
| **What it does** | Before each bi-weekly call, auto-generates agenda. Accessible from cockpit action item. Replaces 10 min manual prep with 2 min review. |
| **Content** | See Section 2.6 for full breakdown. Facts in normal text, inferences italicized. |
| **Key files** | New: `src/lib/services/call-prep.ts`, new component for call prep view. New API: `GET /api/admin/clients/[id]/call-prep` |
| **Trigger** | Generated on-demand when operator clicks "Prep Call" from cockpit. Data is live (not pre-computed). |
| **Feature flag** | `callPrepEnabled` |

### 5.4 Auto-Resolve Escalations

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-68, FM-35, FM-31 |
| **What it does** | For KB-gap escalations, suggests an answer sourced from contractor's existing KB entries or website. Operator always approves before sending. |
| **Gates** | See Section 2.3. Source shown verbatim. External data flagged. "I verified this is accurate" button. First 5 per client require "I confirmed with contractor." Never graduates past supervised. |
| **Key files** | New: `src/lib/services/auto-resolve.ts`. Modify: escalation detail view. |
| **Resolution flow** | 1. Detect escalation is KB-gap type (AI deferred, not frustrated customer). 2. Search existing KB for semantic match. 3. If no KB match, search contractor website (if URL stored). 4. Present suggestion with source to operator. 5. Operator: Send &amp; Add to KB / Edit Before Sending / Skip. 6. If sent: create KB entry automatically, re-engage lead with answer, mark escalation resolved. |
| **Feature flag** | `autoResolveEnabled` |

### 5.5 SMS-Reply KB Entry

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-31 (KB gaps accumulate) |
| **What it does** | KB gap questions in the daily digest accept direct SMS replies as KB entries. Contractor replies with the answer, system parses and creates the entry. |
| **Mechanism** | Daily digest includes numbered KB gaps: `3. "Do you offer financing?" Reply with answer`. When contractor replies with text after the number, system creates a draft KB entry with the question as title and reply as content. Operator reviews in next daily check (or auto-approves if contractor reply is &gt;10 words). **Reply disambiguation**: KB items use numbers only (`3. [question]`). EST items use `1=YES`. WON/LOST items use `W2`/`L2`. Free-text replies to a number (not matching W/L/YES patterns) are treated as KB answers. Ambiguous replies surface to operator for manual routing. |
| **Key files** | Modify: `src/lib/services/contractor-digest.ts` (include KB gaps), `src/lib/services/sms-command-handler.ts` (parse KB replies). New: KB draft entry creation from SMS. |
| **Trust level** | Supervised — operator sees draft KB entry in cockpit, approves or edits before it goes live. Contractor's exact words may need cleanup (spelling, formatting). |
| **Feature flag** | Part of `dailyDigestEnabled` |

---

## 6. Wave 4: System Health

**Prerequisites**: Wave 3 (cockpit provides display surface)
**Estimated effort**: 1-2 sessions

### 6.1 Ops Health Monitor

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | All automations (meta-monitoring) |
| **What it does** | Heartbeat monitoring for all crons. Error aggregation. Circuit breaker enforcement. Automation health badge in cockpit. |
| **Components** | 1. **Heartbeat**: Each cron writes a heartbeat entry on every run (even if no work found). Daily meta-cron checks: did every expected cron fire in last 24h? If not, alert. 2. **Error aggregation**: Count errors per client per automation per 24h. If &ge;3, trigger circuit breaker. 3. **Circuit breaker**: Per-client pause (auto-pause that client's automations, alert operator). System-wide flag (3+ clients simultaneously &rarr; "possible system issue, not contractor behavior"). Rate anomaly (total outbound &gt;2x daily avg &rarr; pause all, alert). 4. **Health badge**: Green (all systems normal), Yellow (1+ skipped/errored, details available), Red (circuit breaker tripped). |
| **Key files** | New: `src/lib/services/ops-health-monitor.ts`, `src/lib/automations/heartbeat-check.ts`. Modify: `src/app/api/cron/route.ts` |
| **Feature flag** | `opsHealthMonitorEnabled` |

### 6.2 Monthly Health Digest

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-73 (capacity), system-wide drift detection |
| **What it does** | Auto-generated monthly report for operator. Replaces manual monthly health check (playbook Section 11). |
| **Content** | Client count + status distribution. Capacity utilization (hours estimate). Automation performance (fired/succeeded/skipped/errored with reasons). Engagement signal distribution across clients. Guarantee tracker (approaching deadlines). Intervention outcomes (alerts fired &rarr; what happened 30 days later). |
| **Key files** | New: `src/lib/services/monthly-health-digest.ts`, new admin page or section in system settings |
| **Delivery** | Generated on 1st of each month. Accessible at `/admin/system-health`. Optionally emailed to operator. |
| **Feature flag** | Part of `opsHealthMonitorEnabled` |

### 6.3 Capacity Tracking

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-73 (operator overload), FM-28 (SA overwhelmed) |
| **What it does** | Estimates operator hours per client based on lifecycle phase and activity. Shows total utilization. Alerts when approaching capacity wall. |
| **Estimation model** | Per-client weekly hours = base (lifecycle phase) + activity multiplier. Onboarding week: 5-8h. Smart Assist active: +1.25h. Post-onboarding steady state: 1.5-2h. Adjusted by: escalation count, KB gap count, call schedule. |
| **Key files** | New: `src/lib/services/capacity-tracking.ts`. Surfaces in cockpit KPI card and monthly digest. |
| **Alerts** | At 80% capacity: yellow warning in cockpit. At 100%: red with "Consider pausing new onboardings." SA queue depth: if 3+ clients simultaneously in Smart Assist, warning. |
| **Feature flag** | `capacityTrackingEnabled` |

### 6.4 Quiet Hours Inbound-Reply Classification

| Attribute | Detail |
|-----------|--------|
| **FMs addressed** | FM-38 (RPN 100, highest single RPN) |
| **Blocker** | Legal review must confirm inbound-reply exemption. Already flagged in OFFER-STRATEGY Part 10, Item #1. |
| **What it does** | Updates compliance gateway to classify messages as inbound-reply (send immediately, any hour) vs proactive-outreach (queue for next compliant window). |
| **Classification logic** | Inbound-reply: first response to a missed call, first response to a form submission, direct reply to an inbound SMS (within same conversation, within 4h of inbound). Proactive-outreach: estimate follow-up sequences, win-back, review requests, payment reminders, dormant reactivation, quarterly campaigns. |
| **Key files** | Modify: `src/lib/compliance/compliance-gateway.ts` — add `messageCategory` parameter, conditional quiet-hours bypass for inbound-reply category |
| **If legal says no** | Update all marketing to "during permitted hours." Adjust Leads at Risk methodology. No platform change needed. |
| **Feature flag** | Independent toggle: `inboundReplyExemptionEnabled` (so it can be killed instantly if legal interpretation changes) |

---

## 7. Process Codifications

Platform builds are half the solution. These process changes need to be documented in the playbook and templates. Each references the playbook section to update.

### 7.1 Playbook Updates (Existing Sections)

| # | Process Change | Playbook Section | What to Change |
|---|---------------|:----------------:|---------------|
| P1 | Sales qualification with ICP fields | Section 12 | Add: "Complete ICP qualification fields in wizard before proceeding. If volume &lt;15, disclose guarantee extension on the call." |
| P2 | Volume disclosure script | Section 12 | Add exact language: "At your lead volume, the guarantee window extends to [X] days instead of 30." |
| P3 | Demo failure recovery | Section 12 | New subsection: carrier troubleshooting steps (Rogers/Telus/Bell codes), VoIP fallback, video demo option |
| P4 | Closed-question KB technique | Section 10 | Replace open questions with specific alternatives. "Do you offer 1-year or 2-year warranty?" not "What's your warranty?" |
| P5 | Pre-sale audit reuse | Section 10 | Add: "If pre-sale audit was completed, reformat as post-sale Revenue Leak Audit. Effort: 15 min instead of 45 min." |
| P6 | Onboarding no-show follow-up | Section 10 | New subsection: same-day reschedule protocol, "your number is already catching calls" framing |
| P7 | Web form test during setup | Section 10 | Add to post-call checklist: "Submit test form on contractor's website. Verify webhook fires and lead appears." |
| P8 | Reframe EST/WON as "your report numbers" | Section 10 (Minute 25-30) | Update expectations script: "When you close a job, text WON — that's how your pipeline numbers go up in your Monday report." |
| P9 | Max 2 clients in Smart Assist simultaneously | Section 3 | Add capacity constraint: "If 2 clients are already in Smart Assist, defer new client's SA activation by 3-5 days." |
| P10 | Operator fills KB proactively from website | Section 3 | Add: "Don't wait for contractor responses. Research their website, Google reviews, HomeStars listing. Fill gaps yourself." |
| P11 | Budget 5-8 escalations/week per new client | Section 1 | Add capacity note: "Month 1 escalation rate is 2-3x steady state. Plan accordingly." |
| P12 | Lead with auto-tracked metrics on call | Section 4 (Minute 5-15) | Add: "Even if WON data is $0, lead with auto-tracked numbers: leads responded, missed calls caught, appointments booked." |
| P13 | Monthly health review uses platform digest | Section 11 | Replace manual checklist with: "Review the auto-generated monthly health digest at /admin/system-health." |
| P14 | Reactivation messages include opt-out | Section 2 + Blitz | Add: "All reactivation messages to contacts 6+ months old must include opt-out language." |
| P15 | Auto-resolve review training | Section 1 | New subsection: "When reviewing auto-resolve suggestions: check the source. If from website, verify with contractor for first 5. Read the 'I verified' button as an attestation, not a formality." |

### 7.2 New Playbook Sections

| # | New Section | Content |
|---|------------|---------|
| P16 | Capacity Management | Hard hiring trigger at 8 active clients. Role scope for part-time ops: Smart Assist review, escalation handling, Revenue Leak Audit research. Training checklist (which playbook sections to master). When to pause new sales. |
| P17 | Backup Operator Protocol | Cross-training requirements. Minimum capability: escalation handling, Smart Assist review, bi-weekly call format. Handoff protocol for planned absence. Emergency coverage for unplanned absence. What the system handles autonomously during operator absence (automations continue, calls get skipped). |
| P18 | Provider Outage Communication | Template texts for contractor notification during Twilio/Stripe/Anthropic outage. "Brief system maintenance — back shortly. Your leads are being queued." Email fallback when SMS is the provider that's down. |
| P19 | Notification Philosophy | Why we batch (contractor experience). The daily digest model. When P1 overrides apply. How to adjust notification priority for specific clients. |
| P20 | Automation Trust Management | How shadow/supervised/autonomous works. When to graduate automations. How to check automation health. When to disable a feature. Emergency pause procedure. |

---

## 8. Deferred Items

| Item | Reason | Revisit Trigger |
|------|--------|----------------|
| **Booking auto-confirm with override** | Double-booking risk outweighs time saved. Push GCal adoption instead. | After 20+ clients with GCal data showing low conflict rate |
| **Multi-operator UI** | Data model ready (operatorId fields). UI premature at &lt;8 clients. | At client #6-7 when hiring process begins |
| **ML engagement prediction** | Insufficient training data (&lt;50 clients, &lt;6 months churn history). Deterministic signals are more transparent and debuggable at current scale. | After 50+ clients with 6+ months of engagement + churn outcome data |
| **Automated contractor intervention** | System should surface signals, not send intervention texts. Operator judgment required for at-risk conversations. | Potentially never — human judgment may always be better for this |
| **Jobber/FSM webhook for EST auto-trigger** | High value (eliminates EST dependency for 40% of ICP) but requires third-party integration work. | When first Jobber-using client signs up — build for real use case, not hypothetical |

---

## 9. FM Resolution Matrix

Complete mapping: every FM &rarr; its resolution (platform, process, or both).

### Resolved by Platform Build

| FM | Resolution | Wave |
|:--:|-----------|:----:|
| FM-05 | Day 25 billing reminder | 1 |
| FM-08 | Forwarding verification | 2 |
| FM-09 | Forwarding verification + onboarding gate | 2 |
| FM-11 | Already gated (pricing range) | — |
| FM-14 | Exclusion list gate | 2 |
| FM-18 | Forwarding verification | 2 |
| FM-29 | Onboarding gate (operator_phone) | 2 |
| FM-33 | Readiness checklist | 2 |
| FM-38 | Quiet hours classification | 4 |
| FM-62 | Day 25 billing reminder | 1 |
| FM-63 | Day 25 billing reminder | 1 |

### Resolved by Platform + Process

| FM | Platform | Process | Wave |
|:--:|---------|---------|:----:|
| FM-01 | ICP qualification fields | Sales discipline | 2 |
| FM-02 | Volume disclosure gate | Disclosure script | 2 |
| FM-06 | Onboarding gates (KB minimum) | Closed-question technique | 2 |
| FM-07 | Onboarding call reminder | No-show follow-up script | 1 |
| FM-12 | Readiness checklist (AI self-test) | Operator QA during Smart Assist | 2 |
| FM-13 | Readiness checklist | Industry preset + KB sprint | 2 |
| FM-15 | Pre-onboarding priming SMS | Accept any format, lower bar | 1 |
| FM-20 | Engagement signals (volume context) | Set expectations on call | 3 |
| FM-21 | Cockpit surfaces overdue | Pre-sale audit reuse | 3 |
| FM-25 | Cockpit with preloaded data | Script in playbook | 3 |
| FM-28 | Capacity tracking | Max 2 SA simultaneously | 4 |
| FM-31 | SMS-reply KB + daily digest | Operator fills from website | 1+3 |
| FM-40 | Daily digest EST prompt + engagement signals | Reframe value during onboarding | 1+3 |
| FM-53 | Call prep with auto-tracked metrics | Lead with auto-tracked on call | 3 |
| FM-54 | Cockpit surfaces overdue calls | Block calendar for calls | 3 |
| FM-56 | Daily digest WON/LOST + engagement signals | Reframe as "your report numbers" | 1+3 |
| FM-58 | Pre-guarantee alert (Day 80) | Investigate root cause | 1 |
| FM-61 | Pre-guarantee alert + engagement signals + call prep | Revenue capture on every call | 1+3 |
| FM-64 | Cockpit surfaces Day 45 action | — | 3 |
| FM-65 | Pre-onboarding priming SMS | Import ANY contacts | 1 |
| FM-68 | Auto-resolve + capacity tracking | Budget escalations per client | 3+4 |
| FM-70 | Engagement signals + cockpit | At-risk intervention script | 3 |
| FM-73 | Capacity tracking | Hire at 8 clients | 4 |
| FM-74 | operatorId data model | Cross-train backup | 3 |

### Resolved by Process Only

| FM | Process Resolution |
|:--:|-------------------|
| FM-03 | Demo failure recovery script |
| FM-04 | Payment capture script (already in playbook) |
| FM-16 | Verify on import preview |
| FM-23 | Test web form during setup |
| FM-24 | Engagement signals show volume context (covered by FM-20) |
| FM-27 | Cockpit auto-defers Day 7 if zero data (covered by cockpit) |
| FM-35 | Quality monitoring 2-3x/week + existing guardrails |
| FM-37 | Existing escalation triggers + pattern monitoring |
| FM-39 | Existing vendor screening |
| FM-43 | Push GCal adoption at Day 14 |
| FM-44 | Push GCal + cockpit surfaces timeouts |
| FM-51 | Reactivation includes opt-out language |
| FM-59 | Bi-weekly calls build attribution record |
| FM-66 | Acknowledge risk, include opt-out |
| FM-67 | Bi-weekly call contextualizes numbers |

### Resolved by Existing Platform

| FM | Already Handled By |
|:--:|-------------------|
| FM-42 | Soft rejection detection |
| FM-45 | Timezone-aware slot generation |
| FM-46 | Probable wins nudge catches status lag |
| FM-47 | Stripe webhook cancels reminders |
| FM-49 | Sentiment gate + rate cap |
| FM-76 | Monitoring (auto-resolves) |
| FM-79 | Falls back to booking confirmation mode |

### Resolved by External Action

| FM | External Action Required |
|:--:|------------------------|
| FM-75 | Twilio SLA — monitor, email fallback template |
| FM-77 | Anthropic SLA — monitor, template fallback (future) |

---

## Implementation Sequence

```
Wave 1 (Foundation)     → Session N+1
  Notification tiers, daily digest, feature flags,
  billing reminder, guarantee alert, onboarding reminder,
  priming SMS, probable-wins extension

Wave 2 (Gates)          → Session N+2
  Exclusion gate, readiness checklist, ICP fields,
  onboarding checklist, forwarding verification

Wave 3 (Cockpit)        → Session N+3, N+4
  Action queue, engagement signals, call prep,
  auto-resolve, SMS-reply KB

Wave 4 (Health)         → Session N+5
  Ops health monitor, monthly digest,
  capacity tracking, quiet hours (if legal cleared)

Process Codification    → Parallel with any wave
  Playbook updates (P1-P15)
  New playbook sections (P16-P20)
```

Each wave session: read this master spec &rarr; deep-dive that wave's items &rarr; spec exact files/schemas/APIs &rarr; build &rarr; test &rarr; ship.

---

*Source: Failure Mode Analysis (2026-04-14) — 59 FMs, 10K Monte Carlo scenarios, 6 correlation groups*
*Simulation: `.scratch/fma-simulation.py` | Results: `.scratch/fma-simulation-results.json`*
*FMA Report: `active/fma/managed-service-fma.md`*
