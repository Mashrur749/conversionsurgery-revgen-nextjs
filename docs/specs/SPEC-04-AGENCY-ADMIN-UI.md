# SPEC-04: Agency Admin UI

## Goal

Build the admin-facing UI pages for managing agency team members, role templates, client team access, and viewing the audit log. These are the interfaces that allow the agency owner (and authorized admins) to control who has access to what.

## Context

### Problem

Currently, there is no UI for:
- Inviting agency team members or controlling what they can see
- Managing client portal access for team members (PA, office manager)
- Creating custom role templates with specific permissions
- Viewing an audit trail of who did what

The admin dashboard has a flat structure where all admins see everything.

### Solution

Four new admin pages:
1. **Agency Team** &mdash; Invite/manage agency members, assign roles and client scope
2. **Role Templates** &mdash; View/create/edit permission bundles
3. **Client Team &amp; Access** &mdash; Unified page within client detail for managing portal access
4. **Audit Log** &mdash; Searchable, filterable log of all access-related actions

## Dependencies

- **SPEC-01** (Schema): All new tables
- **SPEC-02** (Permissions): Permission constants, `requireAgencyPermission()`
- **SPEC-03** (Auth Flows): `getAgencySession()` with permissions

## Page 1: Agency Team Management

### Route: `/admin/team`

**Permission required:** `agency.team.manage`

### API Endpoints

```
GET  /api/admin/team          - List all agency members with role info
POST /api/admin/team          - Invite new agency member
PATCH /api/admin/team/[id]    - Update member role, client scope, active status
DELETE /api/admin/team/[id]   - Deactivate member (soft delete via isActive=false)
```

### UI Design

```
Page Title: "Agency Team"
Subtitle: "Manage who has access to the agency dashboard."

[+ Invite Member] button (top right)

Search bar (search by name, email)

Table/List:
  | Name | Email | Role | Client Access | Status | Actions |
  |------|-------|------|---------------|--------|---------|
  | Mashrur Rahman | m@... | Agency Owner | All clients | Active | (owner badge) |
  | Sarah Rahman | s@... | Content Specialist | 3 clients | Active | Edit | Remove |
  | John Doe | j@... | Account Manager | All clients | Active | Edit | Remove |

Invite Dialog (Sheet or Dialog):
  - Email (required)
  - Name (required)
  - Role Template (select from agency-scoped templates)
  - Client Access:
    - All clients (default)
    - Specific clients (multi-select from client list)
  - [Send Invite] button

  On invite:
  1. Create person record (if not exists by email)
  2. Create agency_membership with selected role + client scope
  3. If scope=assigned, create agency_client_assignments
  4. Send invite email with magic link (via NextAuth)
  5. Audit log: member.invited

Edit Dialog:
  - Role Template (dropdown)
  - Client Access (all / specific)
  - Active toggle
  - Save triggers session invalidation for that member
  - Audit log: role.changed or client_scope.changed
```

### UX Details

- Agency owner row shows a crown/owner badge, cannot be edited or removed
- Remove action uses AlertDialog confirmation: &ldquo;Remove [Name] from the agency team? They will lose all dashboard access immediately.&rdquo;
- Removing a member sets `isActive = false` and bumps `sessionVersion` (immediate logout)
- Role changes show a warning: &ldquo;Changing [Name]&apos;s role will update their permissions and log them out.&rdquo;
- Client access column shows &ldquo;All clients&rdquo; or &ldquo;N clients&rdquo; with a tooltip listing the names
- Empty state: &ldquo;You&apos;re the only team member. Invite your first team member to delegate work.&rdquo; with [Invite Member] button

## Page 2: Role Templates Management

### Route: `/admin/roles`

**Permission required:** `agency.team.manage`

### API Endpoints

```
GET    /api/admin/roles        - List all role templates
POST   /api/admin/roles        - Create custom template
PATCH  /api/admin/roles/[id]   - Edit template (name, permissions)
DELETE /api/admin/roles/[id]   - Delete custom template (not built-in)
```

### UI Design

```
Page Title: "Role Templates"
Subtitle: "Define permission bundles for team members."

Two sections:

--- Built-in Roles ---
Cards showing each built-in template:
  Agency Owner | 18 permissions | System role — cannot be modified
  Agency Admin | 16 permissions | [View Permissions]
  Account Manager | 9 permissions | [View Permissions]
  Content Specialist | 4 permissions | [View Permissions]
  Business Owner | 14 permissions | Client portal role
  Office Manager | 12 permissions | Client portal role
  Team Member | 3 permissions | Client portal role

--- Custom Roles ---
[+ Create Custom Role] button

Card for each custom role:
  [Name] | [N] permissions | [Scope badge] | [Edit] [Delete]

Create/Edit Dialog:
  - Name (text input)
  - Scope (select: Agency / Client Portal)
  - Permissions checklist:
    Grouped by domain:

    Agency Permissions:
    [ ] Clients
      [x] View clients
      [x] Create clients
      [ ] Edit clients
      [ ] Delete clients
    [ ] Conversations
      [x] View conversations
      [x] Respond to conversations
    ... etc

    Client Portal Permissions:
    [ ] Dashboard
    [ ] Leads
      [x] View leads
      [ ] Edit leads
    ... etc

  - [Save] button

View Permissions Dialog (for built-in roles):
  Same checklist but all disabled/read-only
```

### UX Details

- Built-in templates show a lock icon and cannot be edited or deleted
- Deleting a custom template is only allowed if no memberships currently use it; otherwise show error: &ldquo;This role is assigned to N members. Reassign them first.&rdquo;
- Editing a template that has active members shows warning: &ldquo;N members use this role. Changes will take effect immediately and they will be logged out.&rdquo;
- Permission groups are collapsible for readability
- Scope selector is disabled after creation (can&apos;t change a client role to agency or vice versa)
- Escalation prevention: the permission checklist only shows permissions the current user holds (you can&apos;t create a role with permissions you don&apos;t have)

## Page 3: Client Team &amp; Access

### Route: `/admin/clients/[id]/team`

**New tab within the existing client detail page**

**Permission required:** `agency.clients.edit`

### API Endpoints

```
GET    /api/admin/clients/[id]/team          - List client memberships
POST   /api/admin/clients/[id]/team          - Add team member to client
PATCH  /api/admin/clients/[id]/team/[mid]    - Update member role, permissions, active
DELETE /api/admin/clients/[id]/team/[mid]    - Remove member access
POST   /api/admin/clients/[id]/team/transfer-ownership - Transfer ownership
```

### UI Design

```
Tab: "Team & Access" (new tab alongside existing Knowledge, Phone, Reviews tabs)

--- Owner Section ---
Card with green left border:
  Owner: [Name] ([email/phone])
  Role: Business Owner
  Portal access: Full access (14 permissions)
  [Transfer Ownership] button (AlertDialog: "This will transfer business ownership to another member.")

--- Team Members Section ---
[+ Add Team Member] button

Table:
  | Name | Contact | Role | Status | Permissions | Actions |
  |------|---------|------|--------|-------------|---------|
  | Jane Smith | jane@... | Office Manager | Active | 12/14 | Edit | Remove |
  | Bob Johnson | 555... | Team Member | Active | 3/14 | Edit | Remove |

Add Member Dialog:
  - Search existing people (by email/phone) OR create new
  - If existing person found: "Found: [Name] ([email]). Add them to [BusinessName]?"
  - If new person:
    - Name (required)
    - Email or Phone (at least one required)
  - Role Template (select from client-scoped templates)
  - Permission Overrides (collapsible advanced section):
    - Grant additional: [multi-select from permissions not in template]
    - Revoke specific: [multi-select from permissions in template]
  - Escalation settings:
    - [ ] Receive escalations
    - [ ] Receive hot transfers
    - Priority: [1-10]
  - [Add Member] button

  On add:
  1. Create person record if new
  2. Create client_membership
  3. Send welcome message (SMS or email) with portal link
  4. Audit log: member.invited

Edit Dialog:
  - Role Template (dropdown)
  - Permission Overrides (grant/revoke)
  - Escalation settings
  - Active toggle
  - [Save] triggers session invalidation
  - Audit log: role.changed / permission.overridden

Remove:
  AlertDialog: "Remove [Name]'s access to [BusinessName]? They will be logged out immediately."
  Sets isActive = false, bumps sessionVersion
  Audit log: member.removed
```

### UX Details

- This page replaces the need to manage team members separately &mdash; it&apos;s the single source of truth for who can access a client&apos;s portal
- Owner card is always visible at the top and cannot be removed (only transferred)
- Ownership transfer requires AlertDialog with the target member&apos;s name typed for confirmation
- Permission overrides section is collapsed by default (&ldquo;Advanced: Customize permissions&rdquo;) &mdash; most users will just use the role template
- Effective permissions shown as a fraction (e.g., &ldquo;12/14&rdquo;) with a tooltip showing the full list
- Welcome message is customizable per client (future: template in email-templates)
- The escalation settings (receiveEscalations, receiveHotTransfers, priority) migrate from the old `team_members` table
- Empty state: &ldquo;Only the business owner has portal access. Add team members to give their staff access to leads, conversations, and analytics.&rdquo;

## Page 4: Audit Log

### Route: `/admin/audit-log`

**Permission required:** `agency.settings.manage`

### API Endpoints

```
GET /api/admin/audit-log?page=1&limit=50&action=member.invited&personId=xxx&clientId=xxx&from=2026-01-01&to=2026-02-01
```

### UI Design

```
Page Title: "Audit Log"
Subtitle: "Track who did what across the platform."

Filters (horizontal bar):
  [Action type dropdown] [Person search] [Client search] [Date range picker]
  [Clear filters]

Table:
  | Timestamp | Actor | Action | Client | Details | IP |
  |-----------|-------|--------|--------|---------|-----|
  | Feb 17, 2:30 PM | Mashrur Rahman | Invited member | Acme Plumbing | Added Jane Smith as Office Manager | 192.168.1.1 |
  | Feb 17, 2:15 PM | Mashrur Rahman | Changed role | Acme Plumbing | Bob: Team Member → Office Manager | 192.168.1.1 |
  | Feb 17, 1:00 PM | Jane Smith | Logged in | Acme Plumbing | Portal login via email OTP | 10.0.0.5 |

Action type filter options:
  - All actions
  - Authentication (auth.login, auth.logout, auth.session_invalidated)
  - Team changes (member.invited, member.removed, member.reactivated)
  - Role changes (role.changed, permission.overridden)
  - Ownership (owner.transferred)
  - Client status (client.suspended, client.reactivated)

Pagination: standard offset pagination with page size selector (25/50/100)

Row expansion (click to expand):
  Shows full metadata JSON in a formatted view:
  {
    "previousRole": "team_member",
    "newRole": "office_manager",
    "memberName": "Bob Johnson",
    "clientName": "Acme Plumbing"
  }
```

### UX Details

- Most recent entries first (DESC by createdAt)
- Timestamps shown in the agency&apos;s timezone
- Actor column links to the person&apos;s profile (if they&apos;re an agency member) or shows name with client context
- Client column is empty for agency-wide actions
- Details column is a human-readable summary generated from the metadata
- Export to CSV button for compliance/reporting
- No edit or delete actions on audit log entries (immutable)
- Empty state: &ldquo;No audit entries yet. Actions will be logged here as team members are added and permissions change.&rdquo;

## Navigation Updates

### Admin sidebar/nav

Add new navigation items:

```
Team (icon: Users)          -> /admin/team
Roles (icon: Shield)        -> /admin/roles
Audit Log (icon: FileText)  -> /admin/audit-log
```

**Permission gating:**
- Team and Roles: visible only if user has `agency.team.manage`
- Audit Log: visible only if user has `agency.settings.manage`

### Client detail page tabs

Add &ldquo;Team &amp; Access&rdquo; tab:

```
Existing tabs: Overview | Knowledge | Phone | Reviews
New:          Overview | Team & Access | Knowledge | Phone | Reviews
```

## API Route Patterns

All new API routes follow the existing pattern:

```typescript
// Example: GET /api/admin/team
export async function GET() {
  const session = await requireAgencyPermission(AGENCY_PERMISSIONS.TEAM_MANAGE);
  const db = getDb();
  // ... query and return data
}
```

All mutations include audit logging:

```typescript
// Example: POST /api/admin/team (invite member)
export async function POST(request: Request) {
  const session = await requireAgencyPermission(AGENCY_PERMISSIONS.TEAM_MANAGE);
  const body = await request.json();
  const validated = inviteMemberSchema.parse(body);

  // ... create person + membership

  await db.insert(auditLog).values({
    personId: session.personId,
    action: 'member.invited',
    resourceType: 'agency_membership',
    resourceId: newMembership.id,
    metadata: { memberName: validated.name, role: template.slug },
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });
}
```

## File Checklist

| # | File | Action |
|---|------|--------|
| 1 | `src/app/(dashboard)/admin/team/page.tsx` | CREATE |
| 2 | `src/app/(dashboard)/admin/roles/page.tsx` | CREATE |
| 3 | `src/app/(dashboard)/admin/clients/[id]/team/page.tsx` | CREATE |
| 4 | `src/app/(dashboard)/admin/audit-log/page.tsx` | CREATE |
| 5 | `src/app/api/admin/team/route.ts` | CREATE |
| 6 | `src/app/api/admin/team/[id]/route.ts` | CREATE |
| 7 | `src/app/api/admin/roles/route.ts` | CREATE |
| 8 | `src/app/api/admin/roles/[id]/route.ts` | CREATE |
| 9 | `src/app/api/admin/clients/[id]/team/route.ts` | CREATE |
| 10 | `src/app/api/admin/clients/[id]/team/[mid]/route.ts` | CREATE |
| 11 | `src/app/api/admin/clients/[id]/team/transfer-ownership/route.ts` | CREATE |
| 12 | `src/app/api/admin/audit-log/route.ts` | CREATE |
| 13 | `src/components/admin/admin-nav.tsx` | MODIFY (add Team, Roles, Audit Log links) |
| 14 | `src/components/mobile-nav.tsx` | MODIFY (add new nav items) |
| 15 | `src/app/(dashboard)/admin/clients/[id]/page.tsx` or layout | MODIFY (add Team &amp; Access tab) |

## Implementation Steps

1. Create API routes first (data layer):
   a. `/api/admin/team` (GET, POST)
   b. `/api/admin/team/[id]` (PATCH, DELETE)
   c. `/api/admin/roles` (GET, POST)
   d. `/api/admin/roles/[id]` (PATCH, DELETE)
   e. `/api/admin/clients/[id]/team` (GET, POST)
   f. `/api/admin/clients/[id]/team/[mid]` (PATCH, DELETE)
   g. `/api/admin/clients/[id]/team/transfer-ownership` (POST)
   h. `/api/admin/audit-log` (GET)
2. Create UI pages:
   a. Agency Team page
   b. Role Templates page
   c. Client Team &amp; Access page
   d. Audit Log page
3. Update navigation (admin-nav, mobile-nav)
4. Add Team &amp; Access tab to client detail
5. Run `npm run typecheck` and `npm run build`

## Verification

- [ ] Agency owner can invite team members
- [ ] Invited members receive email with login link
- [ ] Agency owner can change member roles
- [ ] Role change triggers session invalidation
- [ ] Client team page shows all members with roles
- [ ] Permission overrides work (grant/revoke)
- [ ] Ownership transfer works with confirmation
- [ ] Audit log captures all actions
- [ ] Audit log filters work (action, person, client, date)
- [ ] Navigation updates show new pages
- [ ] Permission gating hides nav items for insufficient permissions
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

## Risks

- **Complex forms**: The role template editor with grouped permission checkboxes is the most complex UI component. Build it as a reusable `PermissionChecklist` component.
- **Ownership transfer**: This is a high-impact action. The UI must make it very clear what&apos;s happening (typed confirmation of the target member&apos;s name).
- **N+1 queries**: The team list page needs to join people + memberships + role_templates. Use a single JOIN query, not individual lookups.
