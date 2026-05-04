# Codebase Concerns

**Analysis Date:** 2026-05-04

## Tech Debt

**Compliance gateway bypass — direct sendSMS calls in 53 callsites:**
- Issue: CLAUDE.md Rule 1 mandates all outbound messages go through `sendCompliantMessage()`. At least 53 call sites import and call `sendSMS` directly from `@/lib/services/twilio`, bypassing quiet-hours, consent, usage-limit, and kill-switch checks.
- Files: `src/lib/services/team-escalation.ts`, `src/lib/services/smart-assist-lifecycle.ts`, `src/lib/services/ring-group.ts`, `src/lib/services/compliance-queue.ts`, `src/lib/services/weekly-summary.ts`, `src/lib/services/flow-suggestions.ts`, `src/lib/services/usage-alerts.ts`, `src/lib/services/otp.ts`, `src/lib/services/review-monitoring.ts`, `src/app/api/webhooks/stripe/route.ts` (3 calls), `src/app/api/webhooks/twilio/member-answered/route.ts`, `src/app/api/cron/process-scheduled/route.ts` (2 calls), `src/lib/automations/incoming-sms.ts` (contractor-side notifications and command replies)
- Impact: Messages sent to homeowners outside quiet hours, bypassing CASL/TCPA consent checks and usage limits. Compliance violations and potential regulatory exposure.
- Fix approach: Audit each call site. Transactional/system messages (OTP, billing alerts, operator notifications) may legitimately bypass compliance; document which category each belongs to. Homeowner-facing messages must route through `sendCompliantMessage()`. Consider making `sendSMS` package-private or adding a lint rule.

**`agency-communication.ts` calls Twilio SDK directly:**
- Issue: `src/lib/services/agency-communication.ts` (1697 lines) instantiates a module-level `twilioClient` at line 21 and calls `twilioClient.messages.create()` directly at lines 89, 697, 909 — bypassing both `sendSMS` and `sendCompliantMessage`.
- Files: `src/lib/services/agency-communication.ts`
- Impact: Agency-to-homeowner messages sent through this service completely bypass all compliance, quiet-hours, and kill-switch infrastructure.
- Fix approach: Replace direct Twilio SDK calls with `sendCompliantMessage()` or `sendSMS()` depending on message recipient (homeowner vs contractor).

**`hasFeatureAccess()` defined but never called in API routes:**
- Issue: `src/lib/services/subscription.ts` exports `hasFeatureAccess()` (line 594) to gate features by plan. Zero API routes import or call it. Features like voice AI, quarterly campaigns, and advanced reporting are accessible regardless of subscription status.
- Files: `src/lib/services/subscription.ts`, all feature API routes under `src/app/api/`
- Impact: Clients on lower-tier plans or no subscription can access premium features; billing integrity is broken.
- Fix approach: Audit which features are plan-gated per `docs/product/PLATFORM-CAPABILITIES.md` Section 8, then add `hasFeatureAccess()` guards to the corresponding API routes.

**AI health-check metrics hardcoded to zero:**
- Issue: `src/lib/services/ai-health-check.ts` lines 132, 147–149 return hardcoded `0` for four key metrics: `outputGuardViolationRate`, `winBackOptOutRate`, `smartAssistCorrectionRate`, `voyageFallbackRate`. Each has a `// TODO` comment acknowledging the gap.
- Files: `src/lib/services/ai-health-check.ts`
- Impact: AI quality alerts tied to these metrics never fire. Dashboard shows misleading healthy-green status.
- Fix approach: `outputGuardViolationRate` — query `agentDecisions` where `confidence = 0`; `winBackOptOutRate` — query opt-out records filtered to win-back sequence; `smartAssistCorrectionRate` — integrate `smart-assist-learning.ts`; `voyageFallbackRate` — add counter in embedding service.

**In-memory rate limiting and deduplication resets on serverless cold start:**
- Issue: `src/app/api/public/leads/route.ts` and `src/app/api/public/roi-calculator/route.ts` implement IP rate-limiting and deduplication via module-level `Map` objects (`ipRateLimitMap`, `recentSubmissions`). On Cloudflare Workers, each isolate has its own memory; state is not shared across requests or workers.
- Files: `src/app/api/public/leads/route.ts` (lines 22, 67), `src/app/api/public/roi-calculator/route.ts` (line 19)
- Impact: Rate limits and dedup windows can be trivially bypassed by hitting multiple edge nodes simultaneously. Duplicate lead submissions and spam are possible at scale.
- Fix approach: Replace in-memory maps with a durable KV store (Cloudflare KV or Neon short-TTL table) for cross-isolate state.

**`incoming-sms.ts` hourly digest cron unimplemented:**
- Issue: `src/lib/automations/incoming-sms.ts` line 1414 has `// TODO: implement hourly batch digest cron for high-volume clients`. High-volume clients (20+ leads/day) get per-message SMS notifications with no batching.
- Files: `src/lib/automations/incoming-sms.ts`
- Impact: Contractor notification spam at scale; individual messages not sent for clients exceeding 5/hour threshold (silently dropped per line 1427).
- Fix approach: Add a cron under `src/app/api/cron/` that queries recent `contractor_notify` conversations, groups by client, and sends a digest SMS for clients over the threshold.

**`win-back.ts` uses `Math.random()` for timing:**
- Issue: `src/lib/automations/win-back.ts` lines 200–205 use `Math.random()` to randomize second-attempt delay (20–30 days) and send-hour (10am–2pm). Non-deterministic scheduling makes test assertions unreliable and observability difficult.
- Files: `src/lib/automations/win-back.ts`
- Impact: Cannot write deterministic unit tests for timing logic; difficult to audit send patterns in production.
- Fix approach: Accept optional `seed` or `now` parameter for testing; keep random in production but log the resolved value.

---

## Known Bugs

**`compliance-gateway.ts` pre-existing typecheck warning:**
- Symptoms: Block-scoped variable redeclaration warning on typecheck. Noted in CLAUDE.md Rule 8 as a known pre-existing issue to ignore.
- Files: `src/lib/compliance/compliance-gateway.ts`
- Trigger: `pnpm run typecheck`
- Workaround: Suppress; do not attempt to fix (per CLAUDE.md Rule 8).

**Row number lost after lead import dedup:**
- Symptoms: `src/app/api/leads/import/route.ts` line 144 sets `row: 0` for all skipped/existing leads after deduplication, losing the original CSV row number.
- Files: `src/app/api/leads/import/route.ts`
- Trigger: Import CSV with duplicate rows; error report shows row 0 for all skipped entries.
- Workaround: None; row context is lost before dedup comparison.

---

## Security Considerations

**Form webhook uses static bearer token without replay protection:**
- Risk: `src/app/api/webhooks/form/route.ts` authenticates via `Authorization: Bearer <FORM_WEBHOOK_SECRET>`. No timestamp, nonce, or HMAC prevents replaying a captured valid request.
- Files: `src/app/api/webhooks/form/route.ts`
- Current mitigation: Static bearer token gating.
- Recommendations: Add HMAC-SHA256 signature on request body with timestamp, reject requests older than 5 minutes.

**`error.message` leaked in one admin API route:**
- Risk: `src/app/api/admin/clients/route.ts` line 158 returns `error.message` directly in a 500 response. Internal implementation details or DB error text exposed to admin clients.
- Files: `src/app/api/admin/clients/route.ts`
- Current mitigation: Admin-only route (requires session); not exposed to homeowners.
- Recommendations: Replace with `safeErrorResponse()` from `@/lib/utils/api-errors` to sanitize before logging.

**`business-hours` route uses error message content for auth decision:**
- Risk: `src/app/api/business-hours/route.ts` line 110 checks `error.message.includes('Unauthorized')` to decide response code. This pattern is fragile — any error whose message happens to contain "Unauthorized" gets a 403 rather than 500.
- Files: `src/app/api/business-hours/route.ts`
- Current mitigation: Limited blast radius (single route).
- Recommendations: Use typed error classes or explicit status codes instead of string-matching error messages.

**Module-level Twilio client initialized at import time:**
- Risk: `src/lib/services/twilio.ts` line 4 creates `const client = twilio(...)` at module load. If `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` are missing, the app silently starts with a broken Twilio client (non-null assertions `!` suppress the error). Same pattern in `src/lib/services/agency-communication.ts` line 21.
- Files: `src/lib/services/twilio.ts`, `src/lib/services/agency-communication.ts`
- Current mitigation: Runtime failure on first SMS attempt.
- Recommendations: Validate env vars at startup (e.g., in a boot check) or use lazy initialization with explicit error throw.

---

## Performance Bottlenecks

**`agency-communication.ts` 1697-line monolith:**
- Problem: Single file handles agency outbound SMS, email, weekly digest, notification preferences, knowledge gap queueing, and contractor notifications. 30+ other files import from it.
- Files: `src/lib/services/agency-communication.ts`
- Cause: Accumulated scope creep over time; no service boundary enforcement.
- Improvement path: Extract into focused modules: `contractor-notifications.ts`, `agency-outbound-sms.ts`, `digest.ts`. Reduces coupling and import graph weight.

**`incoming-sms.ts` 1511-line automation handler:**
- Problem: Single function processes every inbound SMS end-to-end: dedup, compliance, AI orchestration, contractor notification, flow suggestions. Long cold-start path; any added feature increases median latency for all SMS.
- Files: `src/lib/automations/incoming-sms.ts`
- Cause: Monolithic handler; async side effects (flow suggestions, contractor notify) block the Twilio webhook response.
- Improvement path: Return 200 to Twilio quickly; push AI orchestration and notifications to a background queue or separate edge function.

**`report-generation.ts` and `analytics-aggregation.ts` at 801/705 lines each:**
- Problem: Complex aggregation queries in single large functions. No caching layer; every report request hits Neon directly.
- Files: `src/lib/services/report-generation.ts`, `src/lib/services/analytics-aggregation.ts`
- Cause: No materialized view or caching strategy for expensive aggregate queries.
- Improvement path: Cache generated reports in `reports` table (already exists in schema) for TTL-based reuse; add Neon indexes on date-range columns used in WHERE clauses.

**`Promise.all` with per-member DB queries in escalation and revenue services:**
- Problem: `src/lib/services/escalation.ts` line 153 and `src/lib/services/revenue.ts` line 456 use `Promise.all(members.map(async (m) => {...}))` with a DB call per member. For teams with many members this fires N parallel DB connections.
- Files: `src/lib/services/escalation.ts`, `src/lib/services/revenue.ts`
- Cause: Per-record async pattern instead of batched query with `inArray`.
- Improvement path: Replace with a single `SELECT ... WHERE id IN (...)` then map results in memory.

---

## Fragile Areas

**`relations.ts` at 1237 lines — entire ORM relation graph in one file:**
- Files: `src/db/schema/relations.ts`
- Why fragile: Every schema change requires editing this single file. Merge conflicts are likely when multiple feature branches add relations simultaneously. TypeScript must re-parse the entire file on any schema change.
- Safe modification: Always run `pnpm run db:generate` after edits; check for duplicate relation names before adding.
- Test coverage: No automated tests for relation correctness; caught only at query time.

**`conversations-shell.tsx` at 1196 lines — single client component:**
- Files: `src/app/(client)/client/conversations/conversations-shell.tsx`
- Why fragile: React hooks, polling, state, and render logic all colocated. Line 346 has `// eslint-disable-next-line react-hooks/exhaustive-deps` — known dep-array bypass that may cause stale closures.
- Safe modification: Isolate state slices before adding features; extract sub-components for distinct panels.
- Test coverage: No unit tests; only E2E coverage if any.

**`team-client.tsx` at 980 lines — admin team management page:**
- Files: `src/app/(dashboard)/admin/clients/[id]/team/team-client.tsx`
- Why fragile: Large client component with complex permission and team management logic. No test coverage inferred from file structure.
- Safe modification: Read the entire file before editing; state interactions are non-obvious at this size.
- Test coverage: None detected.

**`orchestrator.ts` at 834 lines — AI agent core:**
- Files: `src/lib/agent/orchestrator.ts`
- Why fragile: Central routing for all AI decisions. 17 DB calls within the module. Any schema change to `agentDecisions`, `leads`, or `conversations` tables can silently break routing.
- Safe modification: Run `pnpm run test:ai` after any change; `pnpm test` covers strategy-resolver but not full orchestration flow.
- Test coverage: `strategy-resolver.test.ts` (725 lines) covers resolver logic; orchestrator itself has limited direct test coverage.

**`stripe/route.ts` at 832 lines — entire Stripe event handler:**
- Files: `src/app/api/webhooks/stripe/route.ts`
- Why fragile: All Stripe webhook event types handled in a single `switch` statement. Silent `sendSMS` calls at lines 171, 296, 536 bypass compliance gateway. Adding new event types risks breaking existing handlers via scope bleed.
- Safe modification: Verify webhook secret is validated before any business logic (lines 27–47 do this — do not move or refactor that block).
- Test coverage: No unit tests detected for individual event handlers.

---

## Scaling Limits

**Neon serverless HTTP client — no connection pooling:**
- Current capacity: `getDb()` creates a new Neon HTTP client per request (by design per CLAUDE.md). Works for current load.
- Limit: At high concurrency, 805 `getDb()` call sites firing in parallel each open HTTP connections to Neon. Neon's serverless HTTP endpoint is stateless but cold-start latency accumulates under burst traffic.
- Scaling path: Evaluate Neon connection pooler (PgBouncer) for transaction-mode pooling if p95 latency degrades above ~50 req/s.

**44 cron routes — all scheduled independently:**
- Current capacity: 44 separate cron routes in `src/app/api/cron/`. Each fires on its own schedule.
- Limit: No coordination or rate-limiting between crons. At full client scale, simultaneous cron execution could saturate Neon connection limit.
- Scaling path: Implement a cron dispatcher pattern (single entry cron `route.ts` already partially exists) that serializes sub-job execution or adds per-job concurrency limits.

---

## Dependencies at Risk

**`@neondatabase/serverless` — Cloudflare Workers WebSocket dependency:**
- Risk: Neon serverless driver requires WebSocket support. Cloudflare Workers support is in active development; breaking changes in the Workers runtime could affect the DB driver.
- Impact: Total DB outage if driver breaks on Cloudflare.
- Migration plan: Pin `@neondatabase/serverless` version in `package.json`; monitor Neon changelog for Workers compatibility notes.

**`next-auth` v4 — approaching end-of-life:**
- Risk: NextAuth v5 (Auth.js) is the current release with breaking API changes. v4 receives security patches only.
- Impact: Future Next.js upgrades may require simultaneous NextAuth migration.
- Migration plan: Track Auth.js v5 migration guide; plan migration as a dedicated phase before Next.js major upgrade.

---

## Missing Critical Features

**Plan-based feature gating not enforced at API layer:**
- Problem: `hasFeatureAccess()` exists in `src/lib/services/subscription.ts` but is imported and called by zero API routes. All features are effectively available to all clients regardless of plan.
- Blocks: Monetization integrity, upsell enforcement, billing plan differentiation.

**Hourly batch digest for high-volume contractor notifications:**
- Problem: `incoming-sms.ts` line 1414 documents this as a TODO. Currently notifications beyond 5/hour are silently dropped rather than batched.
- Blocks: Contractor experience at scale; clients handling 20+ leads/day lose notification visibility.

**Recipient timezone inference from phone area code:**
- Problem: `src/lib/compliance/compliance-gateway.ts` line 47 documents `// TODO: Infer recipient timezone from phone area code when recipientTimezone not provided`. Falls back to client (contractor) timezone when omitted.
- Blocks: Correct TCPA/CASL quiet-hours enforcement for leads in different time zones than their contractor.

---

## Test Coverage Gaps

**API route handlers have no unit tests:**
- What's not tested: The majority of `src/app/api/` route handlers (including all webhook handlers, cron routes, and client portal endpoints) have no dedicated unit or integration tests.
- Files: `src/app/api/webhooks/stripe/route.ts`, `src/app/api/cron/*/route.ts` (44 routes), `src/app/api/client/*/route.ts`
- Risk: Billing logic bugs, webhook processing errors, and cron failures only caught in production.
- Priority: High — billing and webhook routes process financial transactions.

**`orchestrator.ts` not directly tested:**
- What's not tested: `src/lib/agent/orchestrator.ts` (834 lines). Strategy resolver tested separately but full orchestration pipeline (DB reads → AI call → message send → decision log) has no test coverage.
- Files: `src/lib/agent/orchestrator.ts`
- Risk: Orchestration bugs (wrong AI mode selected, decision not logged, message not sent) invisible until production.
- Priority: High — core product functionality.

**`compliance-gateway.ts` integration path not tested:**
- What's not tested: The full `sendCompliantMessage()` call chain including quiet-hours scheduling, kill-switch checks, and usage-limit enforcement together.
- Files: `src/lib/compliance/compliance-gateway.ts`, `src/lib/compliance/compliance-service.ts`
- Risk: Compliance regression when any layer is modified — violations sent to homeowners without detection.
- Priority: Critical — regulatory compliance.

**`conversations-shell.tsx` has no component tests:**
- What's not tested: Client portal conversation UI (1196 lines). Polling logic, message send, unread tracking.
- Files: `src/app/(client)/client/conversations/conversations-shell.tsx`
- Risk: Silent regressions in contractor-facing primary workflow.
- Priority: Medium.

---

*Concerns audit: 2026-05-04*
