# Work Tracker

Central coordination file for parallel agent execution. The orchestrator (main conversation) owns this file — agents read it but only the orchestrator writes to it.

Last updated: 2026-04-01

## How This Works

1. **Orchestrator reads** this file to decide what to assign next
2. **Orchestrator updates** item status before dispatching agents (todo → in_progress)
3. **Agents read** their assigned items + the file manifest to avoid conflicts
4. **Orchestrator updates** status after agent completes (in_progress → done/failed)
5. **Orchestrator triggers doc sync** after each wave completes

## File Manifest (conflict prevention)

Agents MUST NOT modify files owned by another in-progress item. The orchestrator checks this before dispatching.

| File/Directory | Owner (item ID) | Status |
|----------------|----------------|--------|
| *(no active assignments)* | | |

---

## All Open Items

### UX — Remaining (6 items)

| ID | Issue | Priority | Status | Files Touched | Depends On | Model Tier |
|----|-------|----------|--------|---------------|------------|------------|
| UX-3.3 | Self-serve onboarding checklist lacks direction — tutorials not clickable, no "do this next" CTA, quality gates use technical language | P3 | done | `src/app/signup/next-steps/onboarding-checklist.tsx` | None | sonnet |
| UX-4.1 | No keyboard shortcuts or command palette (Cmd+K) | P4 | done | New: `src/components/command-palette.tsx` + both layout files | None | sonnet |
| UX-4.2 | Billing skeleton doesn't match actual content (3 skeletons shown, 5+ sections load) | P4 | done | `src/app/(client)/client/billing/page.tsx` | None | haiku |
| UX-4.3 | Dashboard has no sticky header — scrolling loses page title | P4 | done | `src/app/(client)/client/page.tsx` | None | haiku |
| UX-4.4 | Wizard step titles hidden on mobile — only numbered circles, no labels | P4 | done | `src/app/(dashboard)/admin/clients/new/wizard/setup-wizard.tsx` | None | haiku |
| UX-4.6 | Discussion page has no "Contact Support" CTA from error states | P4 | done | `src/app/(client)/client/discussions/` + portal error boundary | None | haiku |
| UX-4.7 | Escalation queue has no auto-refresh — must reload page for new items | P4 | done | `src/components/escalations/escalation-queue.tsx` | None | haiku |

### Edge Cases — Remaining (7 items)

| ID | Issue | Priority | Status | Files Touched | Depends On | Model Tier |
|----|-------|----------|--------|---------------|------------|------------|
| EC-08 | Lead deleted between escalation and re-notification — SMS sent with empty name | High | done | `src/lib/services/team-escalation.ts` | None | — |
| EC-09 | All team SMS fail but claim marked re-notified — no one actually notified | High | done | `src/lib/services/team-escalation.ts` | EC-08 | — |
| EC-12 | Stripe payment link creation fails but invoice created without link — customer gets reminder with no link | Medium | done | `src/lib/automations/payment-reminder.ts` | None | — |
| EC-13 | Unbounded message polling with no pagination — performance degrades with 1000+ messages | Medium | done | `src/app/(client)/client/conversations/conversations-shell.tsx` | None | sonnet |
| EC-14 | Unmounted component state update on notification bell — React memory leak warning | Low | done | `src/components/notification-bell.tsx` | None | haiku |
| EC-16 | Compliance blocks all booking recipients — contractor never notified of new booking | Medium | done | `src/lib/services/appointment-booking.ts` | None | haiku |
| EC-17 | No retry on SMS failure during initial escalation notification | Medium | done | `src/lib/services/team-escalation.ts` | EC-08 | — |
| EC-18 | Resend 503 transient errors treated as permanent — email lost on temp failure | Medium | done | `src/lib/services/resend.ts` | None | — |

### Consensus Findings — Churn Prevention (11 items)

| ID | Issue | Priority | Status | Files Touched | Depends On | Model Tier |
|----|-------|----------|--------|---------------|------------|------------|
| CON-01 | Google Calendar two-way sync (9/10 agents, #1 dealbreaker) | Critical | todo | New: `src/lib/services/calendar-sync.ts`, booking service, schema | None | opus |
| CON-02 | Shorten estimate fallback nudge from 5 days to 48 hours | High | in_progress | `src/lib/automations/estimate-nudge.ts` or cron config | None | haiku |
| CON-03 | Confirmed revenue field when marking lead "won" + headline in reports | High | in_progress | `src/app/api/leads/[id]/route.ts`, `src/lib/services/report-generation.ts` | None | sonnet |
| CON-04 | Win notification SMS when lead marked won | High | done | `src/app/api/leads/[id]/route.ts` | None | — |
| CON-05 | Make Layer 2 guarantee attribution objective (log-based, remove "you confirm") | High | in_progress | `docs/business-intel/OFFER-CLIENT-FACING.md` (language), guarantee service | None | haiku |
| CON-06 | "Your Account Manager" card in client portal | High | done | `src/app/(client)/client/page.tsx` | None | — |
| CON-07 | Auto-trigger estimate follow-up on CSV import (72h not 25-day) | High | done | `src/app/api/leads/import/route.ts`, `src/lib/services/estimate-triggers.ts` | None | — |
| CON-08 | Backup operator protocol + published escalation SLA | Medium | todo | Docs only: ops guide, playbook, offer doc | None | — |
| CON-09 | Offer doc language fixes (7 items: 15min, trained, calendar, dormant, A/B, guarantee) | High | done | `docs/business-intel/OFFER-CLIENT-FACING.md` v1.1 | None | — |
| CON-10 | Bi-weekly report auto-follow-up SMS (automate the retention touchpoint) | Medium | in_progress | `src/lib/services/report-generation.ts` or delivery service | None | sonnet |
| CON-11 | KB gap "ask contractor" button (auto-SMS question, pre-populate KB draft) | Medium | in_progress | `src/components/escalations/` or knowledge gap UI | None | sonnet |

### Operational Readiness — New (4 items)

| ID | Issue | Priority | Status | Files Touched | Depends On | Model Tier |
|----|-------|----------|--------|---------------|------------|------------|
| OPS-01 | Agency number (#5) has no voice webhook — callers hear dead air or Twilio error | High | done | `src/app/api/webhooks/twilio/agency-voice/route.ts` | None | — |
| OPS-02 | No operator alerting — critical cron failures, SLA breaches, error spikes don't SMS the operator | High | done | `src/lib/services/operator-alerts.ts` + cron orchestrator | None | — |
| OPS-03 | No demo seed command — can't show the product on a sales call without using production | Medium | done | `scripts/seed.ts` — `--demo` and `--demo-cleanup` flags | None | — |
| OPS-04 | No staging Neon branch — all changes tested against production | Medium | done | Config/docs only — added to Launch Checklist Phase 2 | None | — |

---

## Recommended Dispatch Waves

### Wave 1: Critical operational gaps + high-priority edge cases (4 agents)

| Agent | Items | Files | Model |
|-------|-------|-------|-------|
| Agent A | EC-08 + EC-09 + EC-17 | `team-escalation.ts` | haiku |
| Agent B | OPS-01 | New: `api/webhooks/twilio/agency-voice/route.ts` | haiku |
| Agent C | OPS-02 | New: `operator-alerts.ts` + cron orchestrator | sonnet |
| Agent D | EC-12 + EC-18 | `payment-reminder.ts` + `resend.ts` | haiku |

### Wave 2: UX polish + remaining edge cases (4 agents)

| Agent | Items | Files | Model |
|-------|-------|-------|-------|
| Agent E | UX-3.3 | `onboarding-checklist.tsx` | sonnet |
| Agent F | UX-4.1 | New: `command-palette.tsx` + layouts | sonnet |
| Agent G | UX-4.2 + UX-4.3 + UX-4.4 + UX-4.6 + UX-4.7 | billing/page, client/page, wizard, discussions, escalation-queue | haiku |
| Agent H | EC-13 + EC-14 + EC-16 | `conversations-shell.tsx` + `notification-bell.tsx` + `appointment-booking.ts` | sonnet |

### Wave 4: Consensus quick fixes (3 agents, all small)

| Agent | Items | Files | Model |
|-------|-------|-------|-------|
| Agent J | CON-02 (48hr nudge) + CON-05 (objective guarantee language) | estimate nudge config + offer doc + guarantee service | haiku |
| Agent K | CON-03 (confirmed revenue in reports) | leads API + report generation | sonnet |
| Agent L | CON-10 (report auto-follow-up SMS) + CON-11 (KB gap ask contractor) | report delivery + knowledge gap UI | sonnet |

### Wave 5: Calendar integration (dedicated, 1 agent)

| Agent | Items | Files | Model |
|-------|-------|-------|-------|
| Agent M | CON-01 (Google Calendar two-way sync) | New service + booking service + schema + API routes | opus |

### Wave 6: Ops protocol + doc sync

| Agent | Items | Files | Model |
|-------|-------|-------|-------|
| Direct edits | CON-08 (backup protocol + SLA) | Ops guide, playbook, offer doc | — |
| Direct edits | Doc sync for all consensus items | All docs per Change-to-Doc table | — |

### Wave 3 (completed): Demo seed + doc sync

| Agent | Items | Files | Model |
|-------|-------|-------|-------|
| Agent I | OPS-03 | Seed script | sonnet |
| Direct edits | OPS-04 | Docs only (Neon branch setup instructions) | — |
| Direct edits | Doc sync for all waves | Testing guide, capabilities, ops guide, audit docs | — |

---

## Completed Items Log

### UX Audit (33 items — 32 done, 1 remaining)
See `docs/specs/UX-AUDIT-FULL.md` for full history (F1-F33).

### Edge Cases (25 items — 7 done, 8 remaining)
See `docs/specs/EDGE-CASES-AUDIT.md` for full history (EC-01 through EC-07 fixed).

| ID | Issue | Completed |
|----|-------|-----------|
| EC-01 | localStorage crash on notification bell | 2026-04-01 |
| EC-02 | Double-booking race condition — unique constraint added | 2026-04-01 |
| EC-03 | Public leads rate limiting + dedup + XSS sanitization | 2026-04-01 |
| EC-04 | Race condition on conversation switching — AbortController | 2026-04-01 |
| EC-05 | Frozen loading state on deleted lead — 5s timeout | 2026-04-01 |
| EC-06 | Polling errors silently swallowed — 3-failure banner | 2026-04-01 |
| EC-07 | Promise.all crashes — replaced with Promise.allSettled | 2026-04-01 |
| EC-10 | Duplicate lead submissions — dedup added in EC-03 | 2026-04-01 |
| EC-11 | XSS in public leads — HTML strip added in EC-03 | 2026-04-01 |
| EC-15 | Notification settings save failure — already fixed in F10 | 2026-04-01 |
| UX-4.5 | Recently viewed clients shortcut — built in P2 | 2026-04-01 |
| EC-08 | Lead deleted check before re-notification SMS | 2026-04-01 |
| EC-09 | Only mark re-notified if SMS actually sent | 2026-04-01 |
| EC-12 | Payment link failure fallback text | 2026-04-01 |
| EC-17 | SMS retry on escalation notification | 2026-04-01 |
| EC-18 | Resend 503 transient retry logic | 2026-04-01 |
| OPS-01 | Agency voice webhook — text-only message | 2026-04-01 |
| OPS-02 | Operator alerting on cron failures | 2026-04-01 |
| UX-3.3 | Onboarding checklist — actionable links, start-here banner | 2026-04-01 |
| UX-4.1 | Cmd+K command palette | 2026-04-01 |
| UX-4.2 | Billing skeleton matches content | 2026-04-01 |
| UX-4.3 | Dashboard sticky header | 2026-04-01 |
| UX-4.4 | Wizard step labels on mobile | 2026-04-01 |
| UX-4.6 | Discussions empty state CTA | 2026-04-01 |
| UX-4.7 | Escalation queue auto-refresh | 2026-04-01 |
| EC-13 | Message polling pagination | 2026-04-01 |
| EC-14 | Notification bell AbortController | 2026-04-01 |
| EC-16 | Booking email fallback | 2026-04-01 |
| OPS-03 | Demo seed command (--demo / --demo-cleanup) | 2026-04-01 |
| OPS-04 | Staging Neon branch instructions in Launch Checklist | 2026-04-01 |
| CON-04 | Win notification SMS when lead marked won | 2026-04-01 |
| CON-06 | "Your Account Manager" card in client portal | 2026-04-01 |
| CON-07 | Auto-trigger estimate follow-up on CSV import | 2026-04-01 |
| CON-09 | Offer doc language fixes v1.1 (7 items) | 2026-04-01 |
| UX-3.3 | Onboarding checklist — actionable links, start-here banner, simplified gates | 2026-04-01 |
| UX-4.1 | Cmd+K command palette — both portals | 2026-04-01 |
| UX-4.2 | Billing skeleton matches content | 2026-04-01 |
| UX-4.3 | Dashboard sticky header | 2026-04-01 |
| UX-4.4 | Wizard step labels on mobile | 2026-04-01 |
| UX-4.6 | Discussions empty state CTA | 2026-04-01 |
| UX-4.7 | Escalation queue auto-refresh (30s) | 2026-04-01 |
| EC-13 | Message polling pagination (limit=50, load earlier) | 2026-04-01 |
| EC-14 | Notification bell AbortController on unmount | 2026-04-01 |
| EC-16 | Booking email fallback when compliance blocks SMS | 2026-04-01 |

---

## Dispatch Rules

### Conflict prevention
1. **Never assign two items that touch the same file** — check the Files Touched column
2. **Respect dependencies** — don't start an item until its Depends On item is done
3. **Group related items** for the same agent when they share files
4. **Max 4 agents in parallel**

### Token efficiency
5. **Keep agent prompts lean** — say "Read `.claude/skills/ux-standards/SKILL.md` for patterns" instead of repeating rules
6. **Tier agent models by complexity:**
   - `model: "haiku"` — single-file fixes, try-catch wrapping, class changes (< 20 lines changed)
   - `model: "sonnet"` — multi-file features, new components, API endpoints (20-200 lines)
   - Default (Opus) — architectural changes, rewrites, complex state management (200+ lines)
7. **Do small doc edits directly** — only spawn doc-update agents when 3+ large docs need simultaneous changes
8. **Batch items per wave** — fewer large waves are cheaper than many small waves

### Post-wave
9. **After each wave:** run `npm run quality:no-regressions`, update this tracker, update docs
10. **Doc sync is mandatory** — check CLAUDE.md Change-to-Doc table before marking any wave done

### Pending schema migrations (need `npm run db:generate` interactively)
- `re_notified_at` on `escalation_claims`
- `flag_resolved_at` + `flag_resolved_by` on `conversations`
- Unique index on `appointments` `(clientId, appointmentDate, appointmentTime)`
