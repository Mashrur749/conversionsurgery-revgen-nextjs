# Runtime Reliability System

Last updated: 2026-02-26
Owner: Engineering + Operations
Status: Active

## Goal
1. Detect runtime errors across critical software surfaces before release.
2. Prevent introducing new runtime/build/test regressions during ongoing development.

## Pillar 1: Runtime Error Detection

Use layered checks:
1. Automated quality gate:
```bash
npm run quality:no-regressions
```
This runs:
- `npm run ms:gate`
- `npm run quality:logging-guard`
- `npm run build`
- `npm test`
- `npm run quality:runtime-smoke`

2. Full feature sweep (release/refactor gate):
```bash
npm run quality:feature-sweep
```
This runs:
- `npm run ms:gate`
- `npm run quality:logging-guard`
- `npm run build`
- `npm test`
- `SMOKE_PROFILE=full npm run quality:runtime-smoke`

3. Runtime smoke checks (`quality:runtime-smoke`)
- starts production server (`next start`)
- validates critical pages load (`/login`, `/signup`, `/client-login`)
- validates core API guardrails respond correctly (no 5xx baseline for malformed/unauthorized calls):
  - `POST /api/cron` with empty JSON -> `401`
  - `/api/public/onboarding/status` -> `400`
  - `/api/public/signup` with `{}` -> `400`
  - `/api/public/onboarding/request-setup` with `{}` -> `400`
- with `SMOKE_PROFILE=full`, also validates protected-route/auth behavior:
  - `/admin`, `/dashboard`, `/client` redirect for unauthenticated users (`302/303/307`)
  - `/api/admin/clients`, `/api/client/revenue` deny unauthenticated calls (`401/403`)

4. Full manual ops validation:
- run `/docs/engineering/01-TESTING-GUIDE.md` sequentially before release.

Runtime smoke script behavior:
- startup timeout is configurable with `SMOKE_STARTUP_TIMEOUT_SECONDS` (default `90`)
- healthcheck path is configurable with `SMOKE_HEALTHCHECK_PATH` (default `/login`)
- if the server exits or does not become ready, smoke test fails fast and prints server log tail

## Pillar 2: Regression Prevention

1. CI enforcement:
- GitHub Actions workflow `CI` now runs:
```bash
npm run quality:feature-sweep
```

2. Local dev rule before commit/PR:
```bash
npm run quality:no-regressions
```

3. Optional local hard gate (recommended):
```bash
npm run quality:install-pre-push-hook
```
This installs a git `pre-push` hook that blocks push when the no-regressions gate fails.
If you already have a pre-push hook, it is preserved as `.git/hooks/pre-push.user` and executed first.

4. Recommended local quick gate:
```bash
npm run quality:install-pre-commit-hook
```
This installs a git `pre-commit` hook that runs `npm run ms:gate`.
It also runs `npm run quality:logging-guard`.
If you already have a pre-commit hook, it is preserved as `.git/hooks/pre-commit.user` and executed first.

5. Install both hooks:
```bash
npm run quality:install-agent-hooks
```

6. Restricted-environment fallback:
- If your shell environment cannot bind a local server port (some remote sandboxes), run:
```bash
SKIP_RUNTIME_SMOKE=1 npm run quality:no-regressions
```
- Use this fallback only in constrained environments. CI and normal local development should run runtime smoke.

7. Release gate rule:
- No release if any quality step fails.
- Releases and major refactors require `npm run quality:feature-sweep` to be green.

## Pillar 3: Internal Error Telemetry + Safe Logging

1. Centralized internal error sink:
- Route-level failures should persist into `error_log` via `logInternalError(...)`.
- No client-facing response should include raw stack traces or unbounded internal error text.

2. Sanitized logging defaults:
- Use sanitized logging helpers for error output.
- Message body content, full phone numbers, and secret-like tokens are redacted in logging helpers.

3. Current hardened surface (2026-02-25):
- Twilio webhook routes:
  - `/api/webhooks/twilio/sms`
  - `/api/webhooks/twilio/agency-sms`
  - `/api/webhooks/twilio/status`
  - `/api/webhooks/twilio/voice`
  - `/api/webhooks/twilio/voice/ai`
  - `/api/webhooks/twilio/voice/ai/session-end`
  - `/api/webhooks/twilio/voice/ai/dial-complete`
  - `/api/webhooks/twilio/member-answered`
  - `/api/webhooks/twilio/ring-connect`
  - `/api/webhooks/twilio/ring-result`
- Twilio client utility:
  - `src/lib/services/twilio.ts`

4. Guardrail enforcement:
- `quality:logging-guard` now blocks:
  - raw `error/err` object logging in Twilio webhook routes
  - raw `error/err` object logging in Twilio service client
  - verbose raw payload logging in Twilio webhook routes

## Pillar 4: Runtime Containment Controls

Emergency containment can be activated without deploy using `system_settings` keys:
- `ops.kill_switch.outbound_automations`
- `ops.kill_switch.smart_assist_auto_send`
- `ops.kill_switch.voice_ai`

These switches are intended for incident containment and should be reset after remediation and validation.

## Pillar 5: Cron + Message Delivery Reliability (2026-02-26)

Hardened controls to prevent double-texts, lost messages, and infinite retries:

1. **Atomic claims:** Both `process-scheduled` and `check-missed-calls` crons use UPDATE-WHERE atomic claims to prevent double-processing on concurrent runs. If a row has already been claimed by another process, the claim returns 0 rows and the message/call is skipped.

2. **Stuck message recovery:** `process-scheduled` recovers messages that were claimed (`sent=true`) more than 5 minutes ago but never completed (process killed mid-send). A 1-hour lookback guard prevents unclaiming legitimately-sent old messages.

3. **Max-attempts retry cap:** Scheduled messages track `attempts` and `maxAttempts` (default 3). After exceeding max attempts, the message is permanently cancelled instead of retrying indefinitely.

4. **Ambiguous send classification:** When Twilio may have accepted a message but the SDK response was lost (network timeout after retries), a `TwilioAmbiguousError` is thrown. The cron leaves the message claimed (does NOT retry) and relies on the Twilio status callback to reconcile actual delivery status.

5. **Unique DB constraints:**
   - `conversations.twilio_sid` partial unique index (prevents duplicate conversation records from webhook replays)
   - `active_calls.call_sid` unique index (prevents duplicate call records)
   - `webhook_log` indexes on `(client_id, event_type)` and `created_at` for debugging

6. **Compliance gateway coverage:** All lead-facing outbound SMS routes through `sendCompliantMessage()` for opt-out/DNC/consent/quiet-hours enforcement. Direct `sendSMS()` is reserved for internal team notifications and compliance-exempt responses (HELP, opt-in/opt-out confirmations).

7. **CTIA HELP keyword:** Inbound `HELP`/`INFO` messages trigger mandatory auto-reply (business contact + opt-out instructions). All exempt sends produce `compliance_exempt_send` audit events.

## Operational Notes
- This system reduces runtime risk significantly but cannot prove "zero runtime errors" in all real-world conditions.
- Production monitoring and incident response remain mandatory:
  - `/docs/operations/01-OPERATIONS-GUIDE.md`
  - `/docs/onboarding/02-OPERATOR-MASTERY-PLAYBOOK.md`

## Escalation Rule
If `quality:no-regressions` fails:
1. Fix root cause.
2. Re-run full command.
3. Do not merge or deploy until green.
