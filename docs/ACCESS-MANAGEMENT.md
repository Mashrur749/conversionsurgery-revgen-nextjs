# Access Management System

## Overview

ConversionSurgery currently has a flat identity model where business owners log in via OTP and agency admins log in via magic links. There is no support for:
- Multiple people accessing a single business (a PA, office manager, or business partner)
- Agency team members with scoped access (a copywriter reviewing conversations for one client)
- Granular permissions (a team member who can view analytics but not edit AI settings)
- Audit trail (who did what and when)

This document describes the complete access management system that resolves these gaps.

## Design Principles

1. **Agency controls access, not the client** &mdash; In the agency model, the agency decides who sees what. Clients see results (leads, conversations, revenue), not machinery (flows, AI prompts, A/B tests). When transitioning to self-serve SaaS, the client inherits full control.
2. **Universal identity** &mdash; One person, one record, regardless of how many businesses or roles they have.
3. **Permission escalation prevention** &mdash; No user can grant permissions they don&apos;t hold.
4. **Session-level enforcement** &mdash; Permissions are baked into signed sessions and verified on every request.
5. **Audit everything** &mdash; Every permission-relevant action is logged with actor, target, IP, and timestamp.

## Architecture Summary

### Identity Model

```
people (universal identity)
  |
  |-- client_memberships (person <-> business, with role + permissions)
  |     |-- role_templates (reusable permission bundles, scope=client)
  |
  |-- agency_memberships (person <-> agency, with role + client scope)
  |     |-- role_templates (reusable permission bundles, scope=agency)
  |     |-- agency_client_assignments (which clients a scoped member can access)
  |
  |-- users (NextAuth, linked via personId FK)
```

### Auth Flows

| Flow | Who | Method | Session |
|------|-----|--------|---------|
| Client portal login | Business owners + their team | OTP (SMS/email) | Signed cookie with personId + clientId + permissions + sessionVersion |
| Agency dashboard login | Agency owner + team | Magic link (NextAuth) | NextAuth DB session enriched with personId + permissions + clientScope |
| Client portal (agency user) | Agency member viewing client portal | Dashboard &rarr; &ldquo;View as client&rdquo; | Temporary read-only client session (agency permissions, client context) |

### Permission Model

Permissions are flat strings organized by domain:

- **Client portal**: `portal.dashboard`, `portal.leads.view`, `portal.leads.edit`, `portal.conversations.view`, `portal.analytics.view`, `portal.revenue.view`, `portal.knowledge.view`, `portal.knowledge.edit`, `portal.reviews.view`, `portal.team.view`, `portal.team.manage`, `portal.settings.view`, `portal.settings.edit`, `portal.settings.ai`
- **Agency**: `agency.clients.view`, `agency.clients.create`, `agency.clients.edit`, `agency.clients.delete`, `agency.flows.view`, `agency.flows.edit`, `agency.templates.edit`, `agency.knowledge.edit`, `agency.conversations.view`, `agency.conversations.respond`, `agency.analytics.view`, `agency.abtests.manage`, `agency.ai.edit`, `agency.billing.view`, `agency.billing.manage`, `agency.team.manage`, `agency.settings.manage`, `agency.phones.manage`

Each user&apos;s effective permissions = role template permissions + per-user overrides (grant/revoke).

## Spec Documents

The implementation is broken into 6 atomic specifications, each independently executable:

| Spec | Title | Depends On | Scope |
|------|-------|-----------|-------|
| [SPEC-01](specs/SPEC-01-SCHEMA-MIGRATION.md) | Schema Migration | None | New tables, FK modifications, indexes |
| [SPEC-02](specs/SPEC-02-PERMISSION-SYSTEM.md) | Permission System | SPEC-01 | Permission constants, checking middleware, escalation prevention |
| [SPEC-03](specs/SPEC-03-AUTH-FLOW-REWRITE.md) | Auth Flow Rewrite | SPEC-01, SPEC-02 | OTP flow, NextAuth session, session invalidation, business picker |
| [SPEC-04](specs/SPEC-04-AGENCY-ADMIN-UI.md) | Agency Admin UI | SPEC-01, SPEC-02, SPEC-03 | Team management, role templates, client access, audit log pages |
| [SPEC-05](specs/SPEC-05-CLIENT-PORTAL-UPDATES.md) | Client Portal Updates | SPEC-01, SPEC-02, SPEC-03 | Permission-gated nav, API checks, business switcher, welcome flow |
| [SPEC-06](specs/SPEC-06-DATA-MIGRATION-CLEANUP.md) | Data Migration &amp; Cleanup | SPEC-01 through SPEC-05 | Migrate existing data, deprecate old tables, remove dead code |

## Execution Order

```
SPEC-01 (Schema)
    |
    v
SPEC-02 (Permissions)
    |
    v
SPEC-03 (Auth Flows)
   / \
  v   v
SPEC-04  SPEC-05  (can run in parallel)
  \   /
   v v
SPEC-06 (Migration + Cleanup)
```

Each spec is designed to be committed and verified independently. After each spec, run `npm run typecheck` and `npm run build` to ensure no regressions.

## Current State (Before)

### Identity Tables

| Table | Purpose | Problems |
|-------|---------|----------|
| `users` | NextAuth adapter (id, email, clientId, isAdmin) | Conflates identity with auth adapter; `clientId` is 1:1; `isAdmin` is boolean not role-based |
| `admin_users` | Separate admin table (email, passwordHash, role) | Unused `passwordHash`; duplicates identity; role is just admin/super_admin |
| `team_members` | Escalation contacts (name, phone, email, clientId) | No auth capability; no portal access; no permissions |
| `clients` | Business entity (ownerName, email, phone + 50 config cols) | Owner identity embedded in business entity; no multi-user support |

### Auth Flows

| Flow | Current Implementation |
|------|----------------------|
| Agency login | NextAuth magic link &rarr; `users` table &rarr; `isAdmin` check &rarr; `adminUsers.role` lookup |
| Client login | OTP &rarr; match phone/email to `clients.phone`/`clients.email` &rarr; signed cookie with `clientId` |
| Admin check | `(session as any)?.user?.isAdmin` with `as any` cast |

### Key Limitations

1. **One person per business**: Only the owner (matched by phone/email on `clients` table) can log in
2. **No agency team roles**: All admins are equal except admin vs super_admin
3. **No client scoping for agency**: Every admin sees every client
4. **No audit trail**: No record of who did what
5. **Identity fragmented**: Same person could exist in `users`, `admin_users`, `team_members`, and `clients` with no link between them

## Target State (After)

### Identity Tables

| Table | Purpose |
|-------|---------|
| `people` | Universal identity (one row per human, deduplicated by email/phone) |
| `client_memberships` | Person &harr; business relationship with role template + permission overrides |
| `agency_memberships` | Person &harr; agency relationship with role template + client scope |
| `agency_client_assignments` | Which clients a scoped agency member can access |
| `role_templates` | Named permission bundles (business_owner, office_manager, agency_admin, etc.) |
| `audit_log` | Who did what, when, from where |
| `users` | NextAuth adapter (unchanged structure, gains `personId` FK) |

### Auth Flows

| Flow | New Implementation |
|------|-------------------|
| Agency login | Magic link &rarr; `users` &rarr; `users.personId` &rarr; `agency_memberships` &rarr; session enriched with permissions + clientScope |
| Client login | OTP &rarr; match person by phone/email &rarr; `client_memberships` &rarr; business picker (if multi) &rarr; signed cookie with personId + clientId + permissions + sessionVersion |
| Permission check | `requirePermission('portal.leads.edit')` middleware on every API route and page |
| Session invalidation | `sessionVersion` integer on memberships; baked into cookie; compared on each request |

## Role Templates (Built-in)

### Client Portal Roles

| Role | Slug | Permissions |
|------|------|------------|
| Business Owner | `business_owner` | All `portal.*` permissions |
| Office Manager | `office_manager` | All except `portal.settings.ai`, `portal.team.manage` |
| Team Member | `team_member` | `portal.dashboard`, `portal.leads.view`, `portal.conversations.view` |

### Agency Roles

| Role | Slug | Permissions |
|------|------|------------|
| Agency Owner | `agency_owner` | All `agency.*` permissions |
| Agency Admin | `agency_admin` | All except `agency.billing.manage`, `agency.settings.manage` |
| Account Manager | `account_manager` | `agency.clients.view/edit`, `agency.flows.view/edit`, `agency.conversations.*`, `agency.analytics.view`, `agency.knowledge.edit` |
| Content Specialist | `content_specialist` | `agency.clients.view`, `agency.conversations.view`, `agency.templates.edit`, `agency.knowledge.edit` |

## Security Considerations

1. **Permission escalation prevention**: When granting permissions, the API checks that the granting user holds every permission being granted
2. **Session invalidation**: Changing a user&apos;s role or revoking access bumps `sessionVersion`, immediately invalidating their existing session
3. **Client suspension cascade**: When a client is suspended/deactivated, all `client_memberships` for that client have `isActive` set to false
4. **Audit logging**: All permission changes, role assignments, access grants/revokes, and login events are logged
5. **Partial unique index**: DB-level constraint ensures exactly one `isOwner = true` per client
6. **Join table for client assignments**: `agency_client_assignments` uses proper FK references instead of UUID arrays for referential integrity
