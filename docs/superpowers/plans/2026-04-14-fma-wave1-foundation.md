# FMA Wave 1: Foundation + Quick Wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build notification infrastructure (priority tiers, daily digest, feature flags) and 5 quick-win automations that reduce contractor notification fatigue and prevent guarantee-related failure modes.

**Architecture:** Extends existing automation patterns (`src/lib/automations/`) and agency communication (`src/lib/services/agency-communication.ts`). All contractor SMS uses `sendActionPrompt` or `sendAlert` from agency-communication (NOT compliance gateway). All crons register in `src/app/api/cron/route.ts` via the dispatch pattern. Feature flags extend the existing `src/lib/features/check-feature.ts` system with system-level defaults.

**Source Spec:** `docs/superpowers/specs/2026-04-14-fma-resolution-design.md` (Sections 3.1–3.8)

**Tech Stack:** Next.js 16, Drizzle ORM, Neon Postgres, Twilio SMS, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/services/notification-priority.ts` | Priority tier classification (P0-P3), daily cap enforcement, digest queue |
| Create | `src/lib/services/notification-priority.test.ts` | Unit tests for tier classification and cap logic |
| Create | `src/lib/services/contractor-digest.ts` | Aggregate pending P2 items per client, format digest SMS, track included items |
| Create | `src/lib/services/contractor-digest.test.ts` | Unit tests for digest aggregation and formatting |
| Create | `src/lib/automations/daily-digest.ts` | Cron runner: iterate clients, build + send digest via contractor-digest service |
| Create | `src/app/api/cron/daily-digest/route.ts` | Cron endpoint for daily digest |
| Create | `src/lib/services/feature-flags.ts` | System-level defaults + per-client override resolution |
| Create | `src/lib/services/feature-flags.test.ts` | Unit tests for flag resolution logic |
| Create | `src/lib/automations/billing-reminder.ts` | Day 25 trial billing reminder |
| Create | `src/app/api/cron/billing-reminder/route.ts` | Cron endpoint |
| Create | `src/lib/automations/guarantee-alert.ts` | Day 80 pre-guarantee operator alert |
| Create | `src/app/api/cron/guarantee-alert/route.ts` | Cron endpoint |
| Create | `src/lib/automations/onboarding-reminder.ts` | 2h-before onboarding call reminder |
| Create | `src/app/api/cron/onboarding-reminder/route.ts` | Cron endpoint |
| Create | `src/lib/automations/onboarding-priming.ts` | Pre-onboarding "think of 5 dead quotes" SMS |
| Create | `src/app/api/cron/onboarding-priming/route.ts` | Cron endpoint |
| Modify | `src/lib/automations/probable-wins-nudge.ts` | Add second query path for `estimate_sent` leads |
| Modify | `src/db/schema/clients.ts` | Add `dailyDigestEnabled` and `billingReminderEnabled` nullable boolean columns |
| Modify | `src/db/schema/system-settings.ts` | No schema change — use existing key-value pattern for system-level flag defaults |
| Modify | `src/lib/features/check-feature.ts` | Add new feature flags to `FeatureFlag` type and `featureToColumn` map |
| Modify | `src/app/api/cron/route.ts` | Register new cron dispatches |
| Modify | `src/db/schema/index.ts` | Re-export any new schema files (if created) |

---

## Task 1: Feature Flag Infrastructure

**What:** Extend the existing feature flag system to support system-level defaults with per-client overrides. Currently flags are per-client booleans only — add a resolution layer that checks system defaults when client value is null.

**Where:**
- Modify: `src/lib/features/check-feature.ts` — add new flags to `FeatureFlag` type union and `featureToColumn` map
- Create: `src/lib/services/feature-flags.ts` — resolution function: `resolveFeatureFlag(clientId, flag)` → checks client column first, falls back to system-settings key-value lookup
- Create: `src/lib/services/feature-flags.test.ts`
- Modify: `src/db/schema/clients.ts` — add nullable boolean columns: `dailyDigestEnabled`, `billingReminderEnabled`

**Pattern to follow:** The existing `check-feature.ts` pattern. System defaults use the existing `system_settings` table (key-value store at `src/db/schema/system-settings.ts`) — insert rows like `{ key: 'feature.dailyDigest.enabled', value: 'true' }`.

**Constraints:**
- New client columns must be nullable (null = inherit system default, true/false = explicit override)
- The resolution order: client column (if not null) → system_settings row → hardcoded default (false)
- Don't break existing `isFeatureEnabled()` — the new function is additive
- Existing flags (missedCallSms, aiResponse, etc.) keep working exactly as-is — they don't use system defaults
- Add ALL 8 flags from the spec to the `FeatureFlag` type now: `dailyDigest`, `billingReminder`, `engagementSignals`, `autoResolve`, `forwardingVerification`, `opsHealthMonitor`, `callPrep`, `capacityTracking`. Only add client columns for Wave 1 flags (`dailyDigestEnabled`, `billingReminderEnabled`) — future wave columns added in their respective waves.
- Add `globalAutomationPause` boolean to the `agencies` table (or `system_settings` key). When true, all automations skip except P0 compliance. The `resolveFeatureFlag()` function should check this first.

**Test criteria:**
- Client override true → returns true regardless of system default
- Client override false → returns false regardless of system default
- Client null + system default true → returns true
- Client null + system default missing → returns false (safe default)
- Global pause = true → all flags resolve false except P0 compliance
- Existing `isFeatureEnabled` still works unchanged

**Steps:**
- [ ] Add `dailyDigestEnabled` and `billingReminderEnabled` nullable boolean columns to clients schema
- [ ] Add all 8 new flags to `FeatureFlag` type and `featureToColumn` map in check-feature.ts (columns for Wave 2-4 flags will be added in those waves — for now they resolve via system_settings only)
- [ ] Create `feature-flags.ts` with `resolveFeatureFlag()` that does the 3-tier resolution + global pause check
- [ ] Write tests for all resolution paths including global pause
- [ ] Run `npm run db:generate`, review migration SQL — do NOT run db:push or db:migrate
- [ ] Run `npm run typecheck` to verify
- [ ] Commit: "feat: feature flag infrastructure with system-level defaults (FMA 3.3)"

---

## Task 2: Notification Priority Tier System

**What:** Create a service that classifies contractor notifications into P0-P3 tiers and enforces per-client daily caps on P1 messages.

**Where:**
- Create: `src/lib/services/notification-priority.ts`
- Create: `src/lib/services/notification-priority.test.ts`

**Behavior:**
- `classifyPriority(type: NotificationType): Priority` — pure function mapping notification types to P0/P1/P2/P3
- `canSendImmediate(clientId, priority): boolean` — P0 always true, P1 checks daily cap (max 2/day from `agencyMessages` count today), P2/P3 always false (queued)
- `recordSend(clientId, priority, type)` — tracks the send for cap counting

**Priority tier definitions (from spec Section 2.1):**
- P0 (critical, always immediate): opt-out confirmations, compliance, PAUSE/RESUME
- P1 (time-sensitive, max 2/day): booking confirmations, escalation needing contractor, hot transfer missed
- P2 (batched daily digest): KB gaps, probable wins, stuck estimates, quote prompts
- P3 (weekly digest): pipeline SMS, report notification

**Constraints:**
- Daily cap counting queries `agencyMessages` table for today's messages with a P1-related `promptType`
- This is infrastructure — no feature flag needed for this service itself
- Pure classification logic must be easy to test without DB

**Test criteria:**
- Each notification type maps to correct priority tier
- P0 always returns canSend=true
- P1 returns true when under cap, false when at cap (2)
- P2/P3 always return false for immediate send

**Steps:**
- [ ] Create notification-priority.ts with types, classification function, and cap check
- [ ] Write unit tests — mock DB for cap checks, test classification as pure function
- [ ] Run typecheck
- [ ] Commit: "feat: notification priority tier system P0-P3 (FMA 3.1)"

---

## Task 3: Daily Contractor Digest Service

**What:** Aggregate all pending P2 items per client into a single daily SMS using the existing numbered-reply-parser syntax. This is the core behavioral change — replaces 40-60 individual texts/month with one daily batch.

**Where:**
- Create: `src/lib/services/contractor-digest.ts` — aggregation + formatting logic
- Create: `src/lib/services/contractor-digest.test.ts`
- Create: `src/lib/automations/daily-digest.ts` — cron runner
- Create: `src/app/api/cron/daily-digest/route.ts` — cron endpoint

**Behavior:**
- `buildDigest(clientId)` → queries pending KB gaps (status='new'), probable-wins-eligible leads (estimate_sent 14+ days, no recent nudge), stuck estimates. Returns structured items list or null if empty.
- `formatDigestSms(items)` → formats into numbered SMS. KB gaps get plain numbers (`3. "question?" Reply with answer`). EST prompts use `1=YES`. WON/LOST prompts use `W2`/`L2`. This disambiguation is defined in spec Section 5.5.
- After sending, mark items as "included in digest" to prevent duplicate individual sends — use audit_log with action `'digest_included'` and the item IDs in metadata.
- Empty digest = no SMS sent. Silence is green.

**Pattern to follow:** `src/lib/automations/day3-checkin.ts` for the cron runner pattern (window check, audit_log dedup, sendActionPrompt). `src/lib/automations/probable-wins-nudge.ts` for the batched numbered-reply format and `sendActionPrompt` usage.

**Constraints:**
- Uses `sendActionPrompt` from agency-communication (contractor channel)
- Respects `dailyDigestEnabled` feature flag via `resolveFeatureFlag()` from Task 1
- Digest targets 10am LOCAL time per client. Cron runs hourly (register in the `minute < 10` hourly block). For each active client, convert current UTC time to client's `timezone` column — if it's 10:00-10:59 local, include them. This handles multiple timezones correctly. Dedup via audit_log action `'daily_digest'` with today's date prevents re-sending if cron fires again.
- Cap at 8 items per digest to keep SMS readable
- Must handle the reply disambiguation: when contractor replies to digest, existing `handleAgencyInboundSMS` in agency-communication.ts parses the numbered reply. The `actionPayload` on the digest message must include item types so replies route correctly.

**Data sources for digest items:**
- `knowledgeGaps` table: `status = 'new'`, ordered by `priorityScore` desc — include question text
- `leads` table: `status = 'estimate_sent'`, `updatedAt` > 14 days ago, no WON/LOST — for EST prompts
- `leads` table: post-appointment unresolved (existing probable-wins logic) — for WON/LOST prompts

**Test criteria:**
- Empty digest returns null (no SMS)
- Digest with mixed item types formats correctly with disambiguation syntax
- Items are marked as included after send
- Feature flag disabled → skips client
- Max 8 items enforced

**Steps:**
- [ ] Create contractor-digest.ts with buildDigest and formatDigestSms
- [ ] Create daily-digest.ts cron runner (iterate active clients, check feature flag, build + send)
- [ ] Create cron route at `src/app/api/cron/daily-digest/route.ts` — follow day3-checkin route pattern
- [ ] Register in cron orchestrator (`src/app/api/cron/route.ts`) in the `hour === 10` block
- [ ] Write tests for digest building, formatting, empty case, and cap
- [ ] Run typecheck
- [ ] Commit: "feat: daily contractor digest service (FMA 3.2)"

---

## Task 4: Day 25 Billing Reminder

**What:** Daily cron that sends contractors a heads-up SMS 5 days before their free trial ends.

**Where:**
- Create: `src/lib/automations/billing-reminder.ts`
- Create: `src/app/api/cron/billing-reminder/route.ts`

**Pattern to follow:** `src/lib/automations/day3-checkin.ts` exactly — same structure: time window check on a date field, audit_log dedup, sendAlert.

**Behavior:**
- Query `subscriptions` table for `status = 'trialing'` where `trialEnd` is 4-6 days from now (±1 day tolerance window)
- Dedup via `audit_log` action `'billing_reminder_day25'` — one per client ever
- Send via `sendAlert` (non-interactive, no reply needed): "Your free month ends in 5 days. Billing starts [date] at $[amount]/month. Questions? Reply to this message."
- This is P1 priority — sends immediately (not batched in digest)

**Constraints:**
- Respects `billingReminderEnabled` feature flag
- Uses `sendAlert` not `sendActionPrompt` (this is informational, not interactive)
- Must join `subscriptions` → `clients` to get client phone + business name
- Dollar amount comes from the subscription's plan — join to `plans` table or use a reasonable default

**Test criteria:**
- Only sends for trialing subscriptions in the 4-6 day window
- Skips clients that already received the reminder (audit_log dedup)
- Skips clients with feature flag disabled
- Does not send for non-trialing subscriptions

**Steps:**
- [ ] Create billing-reminder.ts following day3-checkin pattern
- [ ] Create cron route
- [ ] Register in cron orchestrator at `hour === 0` daily block (alongside other daily jobs)
- [ ] Run typecheck
- [ ] Commit: "feat: Day 25 billing reminder automation (FMA 3.4)"

---

## Task 5: Pre-Guarantee Operator Alert (Day 80)

**What:** Daily cron that alerts the OPERATOR (not contractor) when a client is 10 days from the 90-day guarantee deadline with insufficient pipeline.

**Where:**
- Create: `src/lib/automations/guarantee-alert.ts`
- Create: `src/app/api/cron/guarantee-alert/route.ts`

**Pattern to follow:** `src/lib/automations/day3-checkin.ts` for structure, but sends to OPERATOR via `alertOperator()` from `src/lib/services/operator-alerts.ts` (not to contractor).

**Behavior:**
- Query `subscriptions` table for clients where `guaranteeRecoveryEndsAt` is 8-12 days from now AND `guaranteeStatus` is still in a pre-fulfilled state (not `fulfilled`, not `refunded`)
- Check if client has sufficient pipeline: query `leads` for WON leads or attributed opportunities. If `guaranteeRecoveryAttributedOpportunities < 1` AND no WON leads with revenue — alert.
- Send operator alert: "Client [name] has [X] days until 90-day guarantee. Pipeline at $[X]. No attributed result yet. Schedule revenue capture call."
- Dedup via audit_log action `'guarantee_alert_day80'`

**Constraints:**
- This goes to the operator, NOT the contractor — use `alertOperator()` 
- Also create an audit_log entry so the operator cockpit (Wave 3) can surface it later as a fallback action item
- No feature flag needed — this is always-on internal alerting

**Test criteria:**
- Only fires for clients approaching guarantee deadline with insufficient pipeline
- Does not fire for fulfilled or refunded guarantees
- Does not fire for clients outside the 8-12 day window
- Dedup prevents repeat alerts

**Steps:**
- [ ] Create guarantee-alert.ts
- [ ] Create cron route
- [ ] Register in cron orchestrator at `hour === 0` daily block
- [ ] Run typecheck
- [ ] Commit: "feat: pre-guarantee Day 80 operator alert (FMA 3.5)"

---

## Task 6: Onboarding Call Reminder

**What:** Send contractor SMS 2 hours before their scheduled onboarding call.

**Where:**
- Create: `src/lib/automations/onboarding-reminder.ts`
- Create: `src/app/api/cron/onboarding-reminder/route.ts`

**Prerequisite decision:** The spec notes we need a `scheduledOnboardingCall` field or a calendar event link. Check if `calendar_events` table has onboarding-related events. If not, add a `scheduledOnboardingCallAt` timestamp column to the `clients` table — this is the simplest approach and avoids coupling to calendar sync (which not all clients will have).

**Pattern to follow:** `src/lib/automations/day3-checkin.ts` for structure.

**Behavior:**
- Runs every 30 minutes (register in the 30-min cron block)
- Query clients where `scheduledOnboardingCallAt` is 1.5-2.5 hours from now
- Dedup via audit_log action `'onboarding_call_reminder'`
- Send via `sendAlert`: "Quick reminder — setup call at [time] today. Takes 30 min. If now doesn't work, reply with a better time."
- P1 priority — sends immediately

**Constraints:**
- If adding a new column to clients, run `db:generate` and review migration
- 30-min cron block, not hourly — needs to catch the 2h window reliably

**Test criteria:**
- Sends for clients with calls in the 1.5-2.5h window
- Does not send for calls already past or too far out
- Dedup prevents duplicate reminders
- Does not send for clients without a scheduled call (null field)

**Steps:**
- [ ] Add `scheduledOnboardingCallAt` timestamp to clients schema (nullable)
- [ ] Create onboarding-reminder.ts
- [ ] Create cron route
- [ ] Register in cron orchestrator in the 30-min block (`minute < 5 || (minute >= 30 && minute < 35)`)
- [ ] Run `npm run db:generate`, review migration
- [ ] Run typecheck
- [ ] Commit: "feat: onboarding call reminder 2h before (FMA 3.6)"

---

## Task 7: Pre-Onboarding Priming SMS

**What:** Auto-send contractor a text after signup asking them to think of 5 dead quotes before the onboarding call.

**Where:**
- Create: `src/lib/automations/onboarding-priming.ts`
- Create: `src/app/api/cron/onboarding-priming/route.ts`

**Pattern to follow:** `src/lib/automations/day3-checkin.ts` — same time-window approach but for newly created clients.

**Behavior:**
- Daily cron at 7am UTC (same block as day3-checkin)
- Query clients created in last 24-48 hours that have `scheduledOnboardingCallAt` set (from Task 6) OR clients created 0-2 days ago without a call scheduled
- Dedup via audit_log action `'onboarding_priming'`
- Send via `sendAlert`: "Before our call — think of 5 people you quoted in the last 6 months that never got back to you. Just first names and what the project was. That is all I need."
- P1 priority — sends immediately

**Constraints:**
- Must NOT use literal quotes in the SMS text — use the message content from the spec
- One per client, ever (audit_log dedup)
- Fires once regardless of whether onboarding call is scheduled or not — the goal is to seed the thought early

**Test criteria:**
- Sends for new clients in the 24-48h window
- Dedup prevents repeats
- Does not send for older clients

**Steps:**
- [ ] Create onboarding-priming.ts
- [ ] Create cron route
- [ ] Register in cron orchestrator at `hour === 7` block
- [ ] Run typecheck
- [ ] Commit: "feat: pre-onboarding priming SMS (FMA 3.7)"

---

## Task 8: Extend Probable-Wins Nudge to Estimate-Sent Leads

**What:** The existing probable-wins-nudge only queries for post-appointment leads. Extend it to also include `estimate_sent` leads that are 14+ days stale with no WON/LOST.

**Where:**
- Modify: `src/lib/automations/probable-wins-nudge.ts`

**Behavior:**
- Add a second query path: find leads with `status = 'estimate_sent'` where `updatedAt` is 14+ days ago
- Merge these with the existing appointment-based leads into the same batched message
- Same dedup (agencyMessages cooldown), same `sendActionPrompt`, same 5-lead cap per batch
- These leads appear in the daily digest as P2 items (when digest is active), but the nudge also runs independently for clients without digest enabled

**Constraints:**
- Do NOT restructure the existing function — add the second query alongside the existing one
- Merged leads go into the same `buildBatchNudgeMessage` format
- Same 7-day cooldown per client applies across both lead types
- The APPOINTMENT_AGE_DAYS constant stays at 7 for appointment leads; use a separate 14-day constant for estimate_sent leads

**Test criteria:**
- Estimate-sent leads 14+ days old are included in the nudge
- Estimate-sent leads < 14 days old are not included
- Already-resolved leads (won/lost/closed) are excluded
- Both lead types appear in the same batched message
- Cooldown applies across both types

**Steps:**
- [ ] Add `ESTIMATE_STALE_DAYS = 14` constant
- [ ] Add second query for `estimate_sent` leads with `updatedAt` > 14 days ago, join with the same client/status filters
- [ ] Merge results into `leadsPerClient` map (same dedup, same 5-lead cap)
- [ ] Run existing tests to verify no regression
- [ ] Add test cases for estimate_sent leads if test file exists, otherwise verify manually
- [ ] Run typecheck
- [ ] Commit: "feat: extend probable-wins nudge to estimate_sent leads (FMA 3.8)"

---

## Task 9: Documentation Updates

**What:** Update all docs affected by Wave 1 changes per the Change-to-Doc mapping in CLAUDE.md.

**Where (check and update each):**
- `docs/product/PLATFORM-CAPABILITIES.md` — add: notification priority tiers, daily digest, billing reminder, guarantee alert, onboarding reminder, priming SMS, feature flag infrastructure. Update Section 2 (Follow-Up Automation) and Section 9 (Onboarding).
- `docs/engineering/01-TESTING-GUIDE.md` — add test steps for new crons (daily-digest, billing-reminder, guarantee-alert, onboarding-reminder, onboarding-priming). Update cron list in Section 3.
- `docs/operations/01-OPERATIONS-GUIDE.md` — document daily digest behavior, notification tiers, how to enable/disable feature flags
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` — reference the platform automations in relevant sections (onboarding, billing, guarantee monitoring)
- `docs/product/FEATURE-BACKLOG.md` — mark any implemented items as resolved

**Constraints:**
- PLATFORM-CAPABILITIES reflects what is BUILT, not planned — only add after implementation passes tests
- Don't edit OFFER-APPROVED-COPY.md without asking
- Testing guide steps must be executable as written

**Steps:**
- [ ] Update PLATFORM-CAPABILITIES.md with all new features
- [ ] Update TESTING-GUIDE.md with new cron entries and test steps
- [ ] Update OPERATIONS-GUIDE.md with operational documentation
- [ ] Update MANAGED-SERVICE-PLAYBOOK.md with references to new automations
- [ ] Check FEATURE-BACKLOG.md for items to mark resolved
- [ ] Commit: "docs: update platform docs for FMA Wave 1 features"

---

## Task 10: Quality Gate

**What:** Run the full quality gate to verify everything passes.

**Steps:**
- [ ] Run `npm run db:generate` — verify all migrations are clean
- [ ] Run `npm run quality:no-regressions` — must pass (ms:gate + build + tests + runtime smoke)
- [ ] Run `npm run quality:logging-guard` — verify no API error leaks
- [ ] Verify all new files are committed
- [ ] Final commit if any fixups needed

---

## Task Dependencies

```
Task 1 (Feature Flags) ─── must complete before ──→ Task 3 (Digest)
                                                  ──→ Task 4 (Billing Reminder)
Task 6 (Onboarding Reminder) adds column needed by → Task 7 (Priming SMS)

Tasks 2, 4, 5, 8 are independent — can run in parallel.
Task 9 (Docs) runs after all implementation tasks complete.
Task 10 (Quality Gate) is always last.
```

---

## Migration Summary

Schema changes requiring `npm run db:generate`:
1. `clients.dailyDigestEnabled` — nullable boolean (Task 1)
2. `clients.billingReminderEnabled` — nullable boolean (Task 1)
3. `clients.scheduledOnboardingCallAt` — nullable timestamp (Task 6)

All three can be in a single migration. Do NOT run `db:push` or `db:migrate` without user confirmation.
