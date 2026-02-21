# Access Management

Last updated: 2026-02-21
Owner: Operations + Engineering

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

## References
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/lib/permissions/require-portal-page-permission.ts`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/lib/get-client-id.ts`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/app/(dashboard)/layout.tsx`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/app/api/admin/clients/route.ts`
