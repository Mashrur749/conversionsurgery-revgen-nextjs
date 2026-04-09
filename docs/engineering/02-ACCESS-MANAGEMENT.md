# Access Management

Last updated: 2026-04-09
Owner: Operations + Engineering
Last verified commit: `API-wide safe error logging hardening working tree (2026-02-25)`

## Purpose
This document is the current source of truth for access control across agency and client portals.

## Current State (Implemented)

### Identity model
- `people`: single human identity record.
- `client_memberships`: person-to-client access, role template, overrides, ownership flags.
- `agency_memberships`: person-to-agency access, role template, scope (`all` or `assigned`).
- `agency_client_assignments`: client allowlist for assigned-scope agency members.
- `users` (NextAuth): linked to `people` for agency login.

### Authentication
- Agency users: magic link via NextAuth.
- Client portal users: OTP flow (phone/email) with membership-based session.

### Authorization
- Agency routes use permission checks via route handlers (`agency.*`).
- Client portal API routes use permission checks via route handlers (`portal.*`).
- Client portal pages are server-guarded with `requirePortalPagePermission(...)`.

### Scope enforcement (implemented)
- Assigned-scope agency users only see/access assigned clients.
- Admin client selector is filtered by assigned scope.
- APIs now reject cross-client access attempts for assigned users.

## Role Model

### Client roles
- `business_owner`
- `office_manager`
- `team_member`

### Agency roles
- `agency_owner`
- `agency_admin`
- `account_manager`
- `content_specialist`

Permission templates and overrides resolve effective access at runtime.

## Operational Flows

### Add internal monitor (e.g., spouse operations monitor)
1. Create a person identity if needed.
2. Add agency membership.
3. Assign role template (`agency_admin` or narrower).
4. Use `assigned` scope and client assignments where needed.

### Add contractor-side assistant
1. Add client team member through portal/admin team flow.
2. Assign appropriate client role template.
3. Team-member plan limit is enforced at creation/reactivation.

## Guardrails
- No privilege escalation: non-owners cannot assign roles above their effective permissions.
- Session invalidation on role/scope changes (`sessionVersion` bump).
- Audit logging on key team management actions.
- Monthly access-review automation sends stale-access digest to agency owners.

## Remaining Gaps
- No dedicated invitation lifecycle UI for role approvals/workflows.
- No MFA policy layer yet (OTP exists, but no mandatory MFA policy engine).

## Admin UI Changes (SPEC-UX-02, 2026-04-09)

The Team, Roles, and Users pages have been consolidated:

- `/admin/team` now has 3 sub-tabs: **Members** (agency team), **Roles** (permission templates), **Portal Users** (all user access). Tabs are URL-persisted via `?tab=members|roles|users`.
- `/admin/roles` redirects to `/admin/team?tab=roles`.
- `/admin/users` redirects to `/admin/team?tab=users`.
- The "Team &amp; Access" nav group shows only: **Team** + **Audit Log** (Roles and Users removed from top-level nav).

No auth surfaces changed &mdash; existing role/user permissions, escalation prevention, and session invalidation remain unchanged.

## MS-06 Continuity Note
- Bi-weekly report "Without Us" model implementation (`MS-06`) introduced no new role surfaces or access paths.
- Existing agency-only report access boundaries remain unchanged.

## MS-07 Access Note
- Cancellation/export parity (`MS-07`) keeps client data export access within portal permissions:
1. `GET /api/client/exports` requires `portal.settings.view`.
2. `POST /api/client/exports` requires `portal.settings.edit`.
3. Download endpoint requires both client session scope and matching expiring token.

## MS-08 Access Note
- Quiet-hours policy diagnostics endpoint is agency-only and permission-wrapped:
1. `GET /api/admin/compliance/quiet-hours-policy` requires `agency.settings.manage`.
2. Visibility is read-only from admin compliance dashboard; no policy mutation route was introduced.

## MS-09 Access Note
- Day-One activation workflow adds one agency-only client-scoped route:
1. `GET/PATCH /api/admin/clients/[id]/onboarding/day-one`
2. Read requires `agency.clients.view`.
3. Mutations require `agency.clients.edit`.
- Public onboarding status/checklist endpoints remain client-identity scoped (`clientId + email` pair) and do not expose cross-client data.

## MS-10 Access Note (Milestones A-D)
- Add-on pricing resolver + add-on billing ledger + billing CSV export + dispute workflow introduced no new top-level permission scopes.
- Updated limit-copy behavior remains on existing permission-guarded routes:
1. `/api/team-members` (session + client scope)
2. `/api/admin/twilio/purchase` (`agency.phones.manage`)
- Added cron route remains on existing cron bearer guard:
3. `/api/cron/voice-usage-rollup` (`verifyCronSecret`)
- Added client billing export route remains in existing portal billing permission surface:
4. `/api/client/billing/addons/export` (`portal.settings.view`)
- Added admin provenance/dispute routes remain in existing billing permission surfaces:
5. `GET /api/admin/clients/[id]/billing/addons` (`agency.billing.view`)
6. `PATCH /api/admin/clients/[id]/billing/addons/[eventId]` (`agency.billing.manage`)

## MS-11 Access Note (Milestone A)
- Report delivery lifecycle model (`report_deliveries`, `report_delivery_events`) adds no new auth surface.
- Existing report access boundaries remain:
1. Admin report APIs: `agency.analytics.view`.
2. Bi-weekly cron execution: `verifyCronSecret` bearer guard.

## MS-11 Access Note (Milestone B)
- Retry engine adds one cron-only endpoint and no new user-facing role surface:
1. `GET /api/cron/report-delivery-retries` guarded by `verifyCronSecret`.
- Retry service reads existing client/report records and writes lifecycle state transitions in existing report-delivery tables only.

## MS-11 Access Note (Milestone C)
- Operator observability adds analytics-scoped admin endpoints only:
1. `GET /api/admin/reports/deliveries` requires `agency.analytics.view`.
2. `POST /api/admin/reports/deliveries/[deliveryId]/retry` requires `agency.analytics.view`.
- No additional cross-client scope exceptions were introduced.

## MS-11 Access Note (Milestone D)
- Client-facing delivery clarity adds portal-scoped endpoints only:
1. `GET /api/client/reports/delivery` requires `portal.dashboard`.
2. `GET /api/client/reports/[id]/download` requires `portal.dashboard` and matching `clientId`.
- Report download endpoint enforces tenant ownership (`reports.client_id == session.clientId`) before returning artifact.

## MS-12 Access Note
- Cron catch-up guarantees add one agency settings surface and preserve existing cron bearer guard:
1. `GET /api/admin/cron-catchup` requires `agency.settings.manage`.
2. `POST /api/admin/cron-catchup` requires `agency.settings.manage`.
3. `GET /api/cron/monthly-reset` and `GET /api/cron/biweekly-reports` remain `verifyCronSecret` guarded.
- No new client-portal permission surfaces were introduced.

## MS-13 Access Note
- Knowledge-gap closure queue adds agency knowledge-edit surfaces only:
1. `GET /api/admin/clients/[id]/knowledge/gaps` requires `agency.knowledge.edit`.
2. `PATCH /api/admin/clients/[id]/knowledge/gaps/[gapId]` requires `agency.knowledge.edit`.
3. `POST /api/admin/clients/[id]/knowledge/gaps/bulk` requires `agency.knowledge.edit`.
4. `GET /api/cron/knowledge-gap-alerts` remains `verifyCronSecret` guarded.
- No new portal/client-facing permission scopes were introduced.

## MS-14 Access Note
- Onboarding quality gate enforcement and override workflow add agency client-scoped routes only:
1. `GET /api/admin/clients/[id]/onboarding/quality` requires `agency.clients.view`.
2. `PATCH /api/admin/clients/[id]/onboarding/quality` requires `agency.clients.edit`.
3. Autonomous transition check in `PATCH /api/admin/clients/[id]` remains `agency.clients.edit` and now returns `409` when quality gates fail in enforce mode.
- Public onboarding checklist receives read-only quality readiness summary through existing `clientId + email` scoped endpoint.

## MS-15 Access Note
- Reminder routing policy and history add agency client-scoped routes only:
1. `GET /api/admin/clients/[id]/reminder-routing` requires `agency.clients.view`.
2. `PATCH /api/admin/clients/[id]/reminder-routing` requires `agency.clients.edit`.
- Reminder delivery outcomes are written to existing `audit_log` with client scope (`reminder_delivery_sent`, `reminder_delivery_no_recipient`) and are queryable through existing audit permissions.
- No new client-portal edit surfaces were introduced for routing policy in this milestone.

## Logging Hardening Access Note (2026-02-25)
- API-wide error-path logging hardening introduced no new auth or scope surfaces.
- Route changes were limited to centralized safe/sanitized failure handling behavior.

## AI Evaluation Features Access Note (2026-03-28)

- AI message flagging and quality monitoring add agency client-scoped routes:
1. `POST /api/admin/clients/[id]/conversations/[messageId]/flag` requires `AGENCY_PERMISSIONS.CONVERSATIONS_VIEW` via `adminClientRoute`.
2. `DELETE /api/admin/clients/[id]/conversations/[messageId]/flag` requires `AGENCY_PERMISSIONS.CONVERSATIONS_VIEW` via `adminClientRoute`.
3. `GET /api/admin/ai-quality` requires `AGENCY_PERMISSIONS.CONVERSATIONS_VIEW` via `adminRoute`. Optional `?clientId=X` for per-client filtering.
- AI attribution, model routing, and decision confidence logging introduce no new auth surfaces (data written by orchestrator during message processing, read via existing admin routes).
- No new portal/client-facing permission scopes were introduced.

## AI Effectiveness Dashboard Access Note (2026-03-28)

- Production observability dashboard adds one agency analytics-scoped route:
1. `GET /api/admin/ai-effectiveness` requires `AGENCY_PERMISSIONS.ANALYTICS_VIEW` via `adminRoute`. Optional `?days=N&clientId=X` for period/client filtering.
- AI effectiveness summary is automatically embedded in biweekly reports via `roiSummary.aiEffectiveness` — no new auth surface (uses existing report generation pipeline).
- No new portal/client-facing permission scopes were introduced.

## References
- `src/lib/permissions/require-portal-page-permission.ts`
- `src/lib/get-client-id.ts`
- `src/app/(dashboard)/layout.tsx`
- `src/app/api/admin/clients/route.ts`
