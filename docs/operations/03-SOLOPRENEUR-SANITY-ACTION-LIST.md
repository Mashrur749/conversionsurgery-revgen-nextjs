# Solopreneur Sanity Action List

Last updated: 2026-02-26
Audience: Founder/operator/developer (solo)
Goal: deliver managed-service results without burning out or destabilizing the platform.

## 1) Two-Lens Operating Model

### Operator Lens (Delivery)
- Primary goal: client outcomes (lead capture, follow-up, booked appointments, retention).
- Allowed work: operating playbooks, client communication, escalation triage, report review.
- Blocked work: feature building unless Sev1 incident requires emergency patch.

### Developer Lens (Maintenance + Product)
- Primary goal: reliability, maintainability, and safe feature evolution.
- Allowed work: hardening, refactors, tests, docs, feature delivery through quality gates.
- Blocked work: ad-hoc client support during scheduled build blocks (except Sev1).

## 2) Non-Negotiable Rules

1. No deploy without green `quality:no-regressions` and `quality:feature-sweep`.
2. No feature release without doc sync in active operational docs.
3. No direct client-specific code branches; use config/templates/policies.
4. No untriaged Sev1/Sev2 incident can remain open overnight.
5. No route may return raw `error.message`/`error.stack` to users.
6. All critical flows must have manual replay or safe fallback path.
7. Keep pilot capacity capped until stability thresholds are consistently met.

## 3) Execution Board (Single Source of Truth)

Status values:
- `TODO`: not started
- `IN_PROGRESS`: actively being worked
- `BLOCKED`: waiting on dependency/decision
- `DONE`: completed and verified

| ID | Lens | Priority | Status | Owner | This Sprint Target |
| --- | --- | --- | --- | --- | --- |
| `S-001` | Both | P0 | TODO | Founder | Lock daily operator/developer time blocks |
| `S-002` | Operator | P0 | TODO | Founder | Run daily cockpit ritual 10 business days |
| `S-003` | Operator | P0 | TODO | Founder | Enforce incident severity + postmortem standard |
| `S-004` | Operator | P0 | TODO | Founder | Set pilot client/onboarding capacity cap |
| `S-005` | Developer | P0 | DONE | Founder | Enforce hooks + CI gate coverage |
| `S-006` | Developer | P0 | DONE | Founder | Centralized safe error telemetry now covers all API routes; no raw `console.error` remains in `src/app/api` |
| `S-007` | Developer | P0 | DONE | Founder | Sensitive-log redaction sweep complete for API route error paths with centralized safe handlers |
| `S-008` | Developer | P1 | DONE | Founder | Global kill switches implemented and documented |
| `S-009` | Developer | P1 | DONE | Founder | Single deploy + rollback command path documented |
| `S-010` | Developer | P1 | IN_PROGRESS | Founder | Weekly maintenance budget protocol documented (calendar lock remains operator action) |
| `S-011` | Both | P1 | DONE | Founder | Export recovery drill command + validation script implemented |
| `S-012` | Both | P1 | DONE | Founder | No-custom-code policy codified in agent + operations docs |
| `S-013` | Developer | P2 | DONE | Founder | Solo reliability dashboard shipped in admin settings |
| `S-014` | Operator | P2 | DONE | Founder | Alert compression policy documented with hourly digest triage workflow |
| `S-015` | Developer | P2 | DONE | Founder | Deterministic replay command system shipped |
| `S-016` | Both | P2 | DONE | Founder | Pilot exit criteria documented in launch readiness |

Update rule:
- Update this board in the same commit whenever any item status changes.

## 3.1 Progress Log

- 2026-02-25 (Wave A):
  - Added centralized internal error capture and sanitized console error handling across all Twilio webhook routes.
  - Added sanitized logging in Twilio shared service client to remove raw error-object output.
  - Added stronger redaction for phone numbers, body/content fields, and secret/token-like values.
  - Extended `quality:logging-guard` with Twilio-specific raw-error and raw-payload checks.
  - Validation run: `quality:logging-guard`, targeted tests, and full `quality:no-regressions` all green.
- 2026-02-25 (Wave B):
  - Added operator kill switches via `system_settings`:
    - `ops.kill_switch.outbound_automations`
    - `ops.kill_switch.smart_assist_auto_send`
    - `ops.kill_switch.voice_ai`
  - Wired outbound kill switch into compliance gateway send path.
  - Wired Smart Assist auto-send kill switch into AI send-policy resolution.
  - Wired Voice AI kill switch into voice AI webhook entry/gather paths with safe human fallback.
  - Added tests for kill-switch parsing and global Smart Assist policy behavior.
  - Validation run: full `quality:no-regressions` green.
- 2026-02-25 (Wave C):
  - Standardized one deploy path and one rollback path in `operations/01-OPERATIONS-GUIDE.md`.
  - Deploy path: `quality:feature-sweep` -> `cf:deploy` -> `wrangler deployments status`.
  - Rollback path: `wrangler versions list` -> `wrangler versions deploy <version-id>@100`.
- 2026-02-25 (Wave D):
  - Added `Solo Reliability Dashboard` to `/admin/settings` with aggregated high-signal runtime/ops metrics.
  - Added deterministic replay tooling: `./scripts/ops/replay.sh` + npm aliases (`ops:replay`, `ops:replay:core`).
  - Added export recovery drill script: `npm run ops:drill:export -- --client-id <client-id>`.
  - Added policy guardrail for no-client-specific code in `AGENTS.md` and `CLAUDE.md`.
  - Added pilot exit criteria to launch readiness docs.
- 2026-02-25 (Wave E):
  - Migrated cron catch/failure paths to `safeErrorResponse()` for centralized sanitized internal telemetry.
  - Removed raw `console.error` usage from `/api/cron/*` routes; replaced with sanitized logger calls where needed.
  - Normalized cron auth checks to `verifyCronSecret()` on no-show and win-back routes.
  - Reduced sensitive runtime logging from missed-call polling path (no raw Twilio to/from dumps).
  - Validation run: `ms:gate`, `quality:logging-guard`, and full `quality:no-regressions` green.
- 2026-02-25 (Wave F):
  - Migrated high-traffic direct routes to centralized safe telemetry:
    - `/api/leads/[id]`, `/api/leads/[id]/reply`, `/api/leads/[id]/score`, `/api/leads/[id]/media`
    - `/api/payments`, `/api/payments/[id]/send`
    - `/api/support-messages`, `/api/support-messages/[id]`, `/api/support-messages/[id]/replies`
  - Removed raw `console.error` from the above routes and standardized generic client-safe error responses.
  - Validation run: full `quality:no-regressions` green.
- 2026-02-25 (Wave G):
  - Migrated additional core API route groups to `safeErrorResponse()`:
    - claims + claim endpoints
    - sequence endpoints (`appointment`, `cancel`, `estimate`, `payment`, `review`)
    - escalation queue/detail/action endpoints
    - client analytics/outcomes/scores/escalation-rules endpoints
  - Removed raw `console.error` from the above catch paths and standardized generic external error responses.
  - Validation run: full `quality:no-regressions` green.
- 2026-02-25 (Wave H):
  - Migrated public/auth/onboarding/media route catches to centralized safe telemetry where applicable:
    - `/api/media/[id]`
    - `/api/public/onboarding/request-setup`, `/api/public/onboarding/status`, `/api/public/signup`
    - `/api/auth/callback/google-business`, `/api/auth/callback/google-calendar`
    - `/api/client/auth/send-otp`, `/api/client/auth/verify-otp`, `/api/client/auth/select-business`, `/api/client/auth/switch-business`
    - `/api/business-hours` (GET failure path)
  - Replaced raw catch logging in these routes with `safeErrorResponse` and/or sanitized logger usage with bounded context.
  - Validation run: full `quality:no-regressions` green.
- 2026-02-25 (Wave I):
  - Migrated additional ops-heavy API route groups to `safeErrorResponse()`:
    - calendar routes (`events`, `integrations`, `sync`)
    - agency team-member routes (`/api/team-members`, `/api/team-members/[id]`)
    - client conversations + team management + notification + invoice retry routes
  - Removed raw `console.error` usage from these route groups and replaced with centralized safe/sanitized logging.
  - Validation run: full `quality:no-regressions` green.
- 2026-02-25 (Wave J):
  - Completed remaining API logging hardening for admin Twilio, admin clients, flow-templates, Stripe webhook, form webhook, and ring-group webhook routes.
  - Removed the final raw `console.error` call sites in `src/app/api` (current grep baseline: zero matches).
  - Validation run: `ms:gate`, `quality:logging-guard`, and full `quality:no-regressions` all green.

## 4) Must-Do Actions (This Week)

Execution note:
- Remaining open items in this section are operator cadence/governance tasks, not application feature gaps.

- [ ] `S-001` Operator/Developer Time Blocks
  - Lens: Both
  - Action: enforce daily split in calendar (example: mornings Operator, afternoons Developer).
  - Done when: 2 weeks of calendar blocks exist and are followed >= 80%.

- [ ] `S-002` Daily Operator Cockpit Ritual
  - Lens: Operator
  - Action: run daily checklist from `operations/01-OPERATIONS-GUIDE.md` and record red/yellow/green status.
  - Done when: 10 consecutive business days logged.

- [ ] `S-003` Incident Escalation Standard
  - Lens: Operator
  - Action: use Sev1/Sev2/Sev3 definitions only; every Sev1/Sev2 gets a written postmortem.
  - Done when: template exists and first incident drill is completed.

- [ ] `S-004` Pilot Capacity Guardrail
  - Lens: Operator
  - Action: set hard cap for active pilot clients and new onboardings per week.
  - Done when: cap documented and tracked in weekly review.

- [x] `S-005` Gate Enforcement Everywhere
  - Lens: Developer
  - Action: ensure hooks are installed and CI runs full sweep.
  - Done when: `npm run quality:install-agent-hooks` completed locally and CI green.

- [x] `S-006` Centralized Error Telemetry Rollout
  - Lens: Developer
  - Action: migrate high-volume cron/webhook/direct routes to shared sanitized internal logging.
  - Done when: top 20 error-prone routes persist errors to `error_log`.

- [x] `S-007` Sensitive Log Redaction Sweep
  - Lens: Developer
  - Action: remove/plaintext-redact message bodies, full phone numbers, tokens, and secrets from logs.
  - Done when: grep audit shows no known sensitive log patterns in hot paths.

- [x] `S-008` Kill Switches for Risky Automations
  - Lens: Developer
  - Action: implement toggle controls for outbound automations, Smart Assist auto-send, and Voice AI.
  - Done when: operator can disable each path without code change.

- [x] `S-009` Single Deploy + Rollback Procedure
  - Lens: Developer
  - Action: codify one deploy command path and one rollback path.
  - Done when: runbook tested once in staging and documented.

- [ ] `S-010` Weekly Maintenance Budget
  - Lens: Developer
  - Action: reserve weekly hardening time (tests, refactors, debt cleanup) even during sales push.
  - Done when: recurring weekly block is active and protected.

- [x] `S-011` Backup/Export Recovery Drill
  - Lens: Both
  - Action: run one export + restore validation drill for client data.
  - Done when: drill completed and restore timing is recorded.

- [x] `S-012` No-Custom-Code Client Policy
  - Lens: Both
  - Action: reject one-off client code changes unless they become reusable platform capability.
  - Done when: policy is documented and applied to all new requests.

## 5) Next 30 Days (Scale-Safe Additions)

- [x] `S-013` Solo Reliability Dashboard
  - One page: failed cron jobs, webhook failures, unresolved escalations, report delivery failures, error-log trends.

- [x] `S-014` Alert Compression
  - Hourly digest for warnings; immediate alerts only for Sev1.

- [x] `S-015` Deterministic Replay Commands
  - Every critical pipeline has a verified manual replay command and runbook step.

- [x] `S-016` Pilot Exit Criteria
  - Move from pilot to paid scale only after defined reliability and support-load thresholds are met for 2+ weeks.

## 6) Weekly Solo Review (30 Minutes)

1. Are Operator/Developer time blocks holding?
2. Any repeated incidents from the same root cause?
3. Which one thing caused most stress this week?
4. Convert that stress source into one of: test, monitor, guardrail, runbook update.
5. Decide next week’s top 3 sanity actions from this file.

## 7) Command Checklist

```bash
# Core quality gates
npm run ms:gate
npm run quality:logging-guard
npm run quality:no-regressions
npm run quality:feature-sweep

# Hook enforcement (once per clone)
npm run quality:install-agent-hooks
```

If a gate fails: stop new feature work, fix root cause, rerun until green.
