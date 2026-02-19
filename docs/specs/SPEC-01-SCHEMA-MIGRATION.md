# SPEC-01: Schema Migration

## Goal

Create the foundational database tables for the access management system. This spec introduces universal identity (`people`), membership tables (`client_memberships`, `agency_memberships`), role templates, client assignment scoping, and audit logging. It also modifies the existing `users` table to link to the new identity model.

## Context

### Problem

Identity is currently fragmented across 4 tables:
- `users` (NextAuth adapter &mdash; email, isAdmin, clientId)
- `admin_users` (agency admins &mdash; email, passwordHash, role)
- `team_members` (escalation contacts &mdash; name, phone, email, clientId)
- `clients` (business entity &mdash; ownerName, email, phone embedded in business record)

There is no way for multiple people to access a single business, no granular permissions, no agency team scoping, and no audit trail.

### Solution

Introduce a `people` table as the universal identity anchor. All auth flows resolve to a person. Memberships link people to contexts (businesses or agency) with role-based permissions.

## Dependencies

- None (this is the foundation spec)

## New Tables

### 1. `people`

Universal identity table. One row per human being.

```
File: src/db/schema/people.ts

people
  id            uuid        PK, defaultRandom
  name          varchar(255) NOT NULL
  email         varchar(255) UNIQUE, NULLABLE
  phone         varchar(20)  UNIQUE, NULLABLE
  avatarUrl     varchar(500) NULLABLE
  lastLoginAt   timestamp    NULLABLE
  createdAt     timestamp    NOT NULL, defaultNow
  updatedAt     timestamp    NOT NULL, defaultNow

Indexes:
  - UNIQUE on email (WHERE email IS NOT NULL) -- partial unique
  - UNIQUE on phone (WHERE phone IS NOT NULL) -- partial unique
  - idx_people_email ON (email)
  - idx_people_phone ON (phone)

Constraints:
  - CHECK (email IS NOT NULL OR phone IS NOT NULL) -- must have at least one identifier

Types:
  export type Person = typeof people.$inferSelect
  export type NewPerson = typeof people.$inferInsert
```

**Design notes:**
- Email and phone are both nullable individually but at least one must be present (CHECK constraint)
- Partial unique indexes allow multiple NULLs (Postgres behavior) while enforcing uniqueness on non-null values
- `lastLoginAt` is updated on every successful OTP or magic link authentication
- `avatarUrl` is reserved for future profile support

### 2. `role_templates`

Reusable permission bundles. Built-in templates are seeded; custom templates can be created by agency owners.

```
File: src/db/schema/role-templates.ts

role_templates
  id            uuid          PK, defaultRandom
  name          varchar(100)  NOT NULL
  slug          varchar(100)  NOT NULL, UNIQUE
  description   text          NULLABLE
  scope         varchar(20)   NOT NULL  -- 'agency' | 'client'
  permissions   text[]        NOT NULL  -- Array of permission strings
  isBuiltIn     boolean       NOT NULL, default false
  createdAt     timestamp     NOT NULL, defaultNow
  updatedAt     timestamp     NOT NULL, defaultNow

Indexes:
  - UNIQUE on slug
  - idx_role_templates_scope ON (scope)

Types:
  export type RoleTemplate = typeof roleTemplates.$inferSelect
  export type NewRoleTemplate = typeof roleTemplates.$inferInsert
```

**Design notes:**
- `scope` determines whether this template applies to client portal or agency dashboard
- `permissions` is a Postgres text array containing permission strings like `['portal.dashboard', 'portal.leads.view']`
- `isBuiltIn` prevents deletion/modification of system templates
- `slug` is used in code references (e.g., `business_owner`, `agency_admin`)

**Seed data (built-in templates):**

| slug | scope | permissions |
|------|-------|------------|
| `business_owner` | client | All `portal.*` (14 permissions) |
| `office_manager` | client | All `portal.*` except `portal.settings.ai`, `portal.team.manage` (12 permissions) |
| `team_member` | client | `portal.dashboard`, `portal.leads.view`, `portal.conversations.view` (3 permissions) |
| `agency_owner` | agency | All `agency.*` (18 permissions) |
| `agency_admin` | agency | All `agency.*` except `agency.billing.manage`, `agency.settings.manage` (16 permissions) |
| `account_manager` | agency | 9 permissions (clients.view/edit, flows.*, conversations.*, analytics.view, knowledge.edit) |
| `content_specialist` | agency | 4 permissions (clients.view, conversations.view, templates.edit, knowledge.edit) |

### 3. `client_memberships`

Links a person to a business (client) with a role and optional permission overrides.

```
File: src/db/schema/client-memberships.ts

client_memberships
  id                    uuid        PK, defaultRandom
  personId              uuid        NOT NULL, FK -> people.id ON DELETE CASCADE
  clientId              uuid        NOT NULL, FK -> clients.id ON DELETE CASCADE
  roleTemplateId        uuid        NOT NULL, FK -> role_templates.id ON DELETE RESTRICT
  permissionOverrides   jsonb       NULLABLE, default null
  isOwner               boolean     NOT NULL, default false
  receiveEscalations    boolean     NOT NULL, default false
  receiveHotTransfers   boolean     NOT NULL, default false
  priority              integer     NOT NULL, default 1
  isActive              boolean     NOT NULL, default true
  sessionVersion        integer     NOT NULL, default 1
  invitedBy             uuid        NULLABLE, FK -> people.id ON DELETE SET NULL
  createdAt             timestamp   NOT NULL, defaultNow
  updatedAt             timestamp   NOT NULL, defaultNow

Indexes:
  - UNIQUE on (personId, clientId) -- one membership per person per business
  - idx_client_memberships_client_id ON (clientId)
  - idx_client_memberships_person_id ON (personId)
  - Partial unique index: UNIQUE on (clientId) WHERE isOwner = true
    -- Enforces exactly one owner per business at DB level

Constraints:
  - roleTemplateId must reference a role_template with scope = 'client' (enforced in application layer)
  - permissionOverrides format: { "grant": ["portal.settings.ai"], "revoke": ["portal.team.manage"] }

Types:
  export type ClientMembership = typeof clientMemberships.$inferSelect
  export type NewClientMembership = typeof clientMemberships.$inferInsert
```

**Design notes:**
- `permissionOverrides` is JSONB with `{ grant: string[], revoke: string[] }` structure
- Effective permissions = (role template permissions + grants) - revokes
- `isOwner` is the business owner designation; the partial unique index ensures exactly one per client
- `receiveEscalations` and `receiveHotTransfers` migrate from the current `team_members` table
- `priority` determines escalation call order (lower = called first)
- `sessionVersion` is incremented whenever permissions/role change; session cookie includes this version and is rejected if stale
- `invitedBy` tracks who added this member (for audit purposes)

### 4. `agency_memberships`

Links a person to the agency with a role and client scope.

```
File: src/db/schema/agency-memberships.ts

agency_memberships
  id                uuid          PK, defaultRandom
  personId          uuid          NOT NULL, UNIQUE, FK -> people.id ON DELETE CASCADE
  roleTemplateId    uuid          NOT NULL, FK -> role_templates.id ON DELETE RESTRICT
  clientScope       varchar(20)   NOT NULL, default 'all'  -- 'all' | 'assigned'
  isActive          boolean       NOT NULL, default true
  sessionVersion    integer       NOT NULL, default 1
  invitedBy         uuid          NULLABLE, FK -> people.id ON DELETE SET NULL
  createdAt         timestamp     NOT NULL, defaultNow
  updatedAt         timestamp     NOT NULL, defaultNow

Indexes:
  - UNIQUE on personId -- one agency membership per person
  - idx_agency_memberships_person_id ON (personId)

Constraints:
  - roleTemplateId must reference a role_template with scope = 'agency' (enforced in application layer)

Types:
  export type AgencyMembership = typeof agencyMemberships.$inferSelect
  export type NewAgencyMembership = typeof agencyMemberships.$inferInsert
```

**Design notes:**
- UNIQUE on `personId` because a person can only be an agency member once (single-tenant agency)
- `clientScope = 'all'` means the member sees all clients; `'assigned'` means they only see clients in `agency_client_assignments`
- No `permissionOverrides` at agency level &mdash; agency roles are more structured

### 5. `agency_client_assignments`

Join table specifying which clients a scoped agency member can access.

```
File: src/db/schema/agency-client-assignments.ts

agency_client_assignments
  id                    uuid        PK, defaultRandom
  agencyMembershipId    uuid        NOT NULL, FK -> agency_memberships.id ON DELETE CASCADE
  clientId              uuid        NOT NULL, FK -> clients.id ON DELETE CASCADE
  createdAt             timestamp   NOT NULL, defaultNow

Indexes:
  - UNIQUE on (agencyMembershipId, clientId)
  - idx_aca_membership_id ON (agencyMembershipId)
  - idx_aca_client_id ON (clientId)

Types:
  export type AgencyClientAssignment = typeof agencyClientAssignments.$inferSelect
  export type NewAgencyClientAssignment = typeof agencyClientAssignments.$inferInsert
```

**Design notes:**
- Only relevant when `agency_memberships.clientScope = 'assigned'`
- Uses a proper join table (not UUID array) for referential integrity &mdash; if a client is deleted, the assignment is cascade-deleted
- When adding new clients to the platform, agency owner must explicitly assign scoped members if needed

### 6. `audit_log`

Immutable log of all permission-relevant actions.

```
File: src/db/schema/audit-log.ts

audit_log
  id            uuid          PK, defaultRandom
  personId      uuid          NOT NULL, FK -> people.id ON DELETE SET NULL
  clientId      uuid          NULLABLE, FK -> clients.id ON DELETE SET NULL
  action        varchar(100)  NOT NULL  -- e.g., 'member.invited', 'role.changed', 'permission.overridden'
  resourceType  varchar(50)   NULLABLE  -- e.g., 'client_membership', 'lead', 'flow'
  resourceId    uuid          NULLABLE
  metadata      jsonb         NULLABLE  -- Action-specific context
  ipAddress     varchar(45)   NULLABLE  -- IPv4 or IPv6
  userAgent     text          NULLABLE
  sessionId     varchar(255)  NULLABLE  -- Cookie session ID for correlation
  createdAt     timestamp     NOT NULL, defaultNow

Indexes:
  - idx_audit_log_person_id ON (personId)
  - idx_audit_log_client_id ON (clientId)
  - idx_audit_log_action ON (action)
  - idx_audit_log_created_at ON (createdAt)
  - idx_audit_log_resource ON (resourceType, resourceId)

Types:
  export type AuditLog = typeof auditLog.$inferSelect
  export type NewAuditLog = typeof auditLog.$inferInsert
```

**Design notes:**
- Append-only &mdash; no UPDATE or DELETE operations on this table
- `personId` uses SET NULL on delete so audit entries survive person deletion
- `metadata` contains action-specific context (e.g., `{ previousRole: "team_member", newRole: "office_manager" }`)
- `ipAddress` and `userAgent` captured from request headers
- `sessionId` allows correlating multiple actions in a single session

**Audit actions to log:**

| Action | When |
|--------|------|
| `auth.login` | Successful OTP or magic link login |
| `auth.logout` | User signs out |
| `auth.session_invalidated` | sessionVersion bumped |
| `member.invited` | New membership created |
| `member.removed` | Membership deactivated |
| `member.reactivated` | Membership reactivated |
| `role.changed` | Role template changed on a membership |
| `permission.overridden` | Permission override granted or revoked |
| `owner.transferred` | Business ownership transferred |
| `client.suspended` | Client deactivated (cascades to memberships) |
| `client.reactivated` | Client reactivated |

## Modifications to Existing Tables

### `users` table (`src/db/schema/auth.ts`)

Add a `personId` foreign key to link NextAuth users to the universal identity:

```
ADD COLUMN: personId uuid NULLABLE, FK -> people.id ON DELETE SET NULL
ADD INDEX: idx_users_person_id ON (personId)
```

**Migration note:** Existing users will have `personId = NULL` until the data migration (SPEC-06) creates corresponding `people` records and backfills the FK.

### No changes to `clients` table

The `clients` table retains `ownerName`, `email`, `phone` for business contact information. These fields represent the business&apos;s primary contact, not an identity. The actual owner identity moves to `people` + `client_memberships` with `isOwner = true`.

## File Checklist

| # | File | Action |
|---|------|--------|
| 1 | `src/db/schema/people.ts` | CREATE |
| 2 | `src/db/schema/role-templates.ts` | CREATE |
| 3 | `src/db/schema/client-memberships.ts` | CREATE |
| 4 | `src/db/schema/agency-memberships.ts` | CREATE |
| 5 | `src/db/schema/agency-client-assignments.ts` | CREATE |
| 6 | `src/db/schema/audit-log.ts` | CREATE |
| 7 | `src/db/schema/auth.ts` | MODIFY (add personId) |
| 8 | `src/db/schema/index.ts` | MODIFY (re-export new tables) |
| 9 | `src/db/schema/relations.ts` | MODIFY (add new relations) |
| 10 | Migration seed script for role templates | CREATE |

## Implementation Steps

1. Create all 6 new schema files following existing patterns (see any file in `src/db/schema/` for reference)
2. Add `personId` column to `users` table in `src/db/schema/auth.ts`
3. Add all new exports to `src/db/schema/index.ts`
4. Update `src/db/schema/relations.ts` with new table relationships
5. Run `npm run db:generate` to produce migration SQL
6. Review generated migration SQL &mdash; verify:
   - Partial unique index on `client_memberships(clientId) WHERE isOwner = true` is correct
   - CHECK constraint on `people` for email/phone
   - CASCADE/SET NULL delete behaviors are correct
7. Create seed script for built-in role templates (can be a standalone TS file or embedded in migration)
8. Run `npm run typecheck` to verify no type errors
9. **Do NOT run `db:push` or `db:migrate` without user confirmation**

## Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run db:generate` produces clean migration
- [ ] All 6 new tables have proper types exported
- [ ] `index.ts` re-exports all new tables
- [ ] Relations file includes new table relationships
- [ ] Seed data for 7 built-in role templates is prepared

## Risks

- **Partial unique index**: Drizzle ORM may not natively support `WHERE` clauses on unique indexes. May need raw SQL in migration or a `.sql()` expression in the schema definition.
- **CHECK constraint**: Same issue &mdash; may need raw SQL for the `email IS NOT NULL OR phone IS NOT NULL` constraint.
- **Migration ordering**: The `role_templates` table must be created before `client_memberships` and `agency_memberships` (FK dependency).
