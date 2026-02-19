# SPEC-06: Data Migration &amp; Cleanup

## Goal

Migrate existing user data from the fragmented identity model to the new `people` + memberships model. Deprecate and eventually remove old tables and columns. Ensure zero downtime and backward compatibility during the transition.

## Context

### Problem

After SPEC-01 through SPEC-05 are implemented, the new tables exist alongside the old ones. Existing data lives in:
- `users` (NextAuth adapter) &mdash; agency admins who logged in via magic link
- `admin_users` &mdash; admin records with roles
- `team_members` &mdash; escalation contacts per client
- `clients` &mdash; business owner identity embedded in business entity (ownerName, email, phone)

This data must be migrated to:
- `people` &mdash; universal identity
- `client_memberships` &mdash; person-to-business links
- `agency_memberships` &mdash; person-to-agency links
- `role_templates` &mdash; (already seeded in SPEC-01)

### Strategy

Phased migration with backward compatibility during transition:

1. **Phase A**: Create people records + memberships from existing data (additive)
2. **Phase B**: Update auth flows to use new tables (SPEC-03 handles this)
3. **Phase C**: Verify all data is correctly migrated
4. **Phase D**: Remove deprecated columns and tables

## Dependencies

- **SPEC-01** through **SPEC-05** must be complete and verified
- The new auth flows (SPEC-03) must be working before old tables are removed

## Phase A: Data Migration Script

### File: `src/scripts/migrate-identities.ts`

A one-time migration script that creates people records and memberships from existing data.

### Step A1: Migrate Client Owners to People

For each row in `clients`:

```
1. Check if a person already exists with this email or phone
   SELECT * FROM people WHERE email = client.email OR phone = client.phone

2. If no person exists:
   INSERT INTO people (name, email, phone)
   VALUES (client.ownerName, client.email, client.phone)

3. If person exists (by email or phone):
   - Update name if empty
   - Add phone if person only had email (or vice versa)
   - Log: "Merged client owner [name] into existing person [id]"

4. Create client_membership:
   INSERT INTO client_memberships (personId, clientId, roleTemplateId, isOwner, isActive)
   VALUES (person.id, client.id, business_owner_template.id, true, client.status = 'active')

5. Log: "Created ownership membership for [name] -> [businessName]"
```

**Edge cases:**
- Two clients with the same email &mdash; same person, two memberships (both isOwner for their respective businesses)
- Client with email that matches an agency admin &mdash; same person gets both client_membership and agency_membership

### Step A2: Migrate Team Members to People

For each row in `team_members`:

```
1. Check if a person already exists with this email or phone
   SELECT * FROM people WHERE email = tm.email OR phone = tm.phone

2. If no person exists:
   INSERT INTO people (name, email, phone)
   VALUES (tm.name, tm.email, tm.phone)

3. If person exists: merge (same as above)

4. Create client_membership:
   INSERT INTO client_memberships (
     personId, clientId, roleTemplateId,
     receiveEscalations, receiveHotTransfers, priority,
     isOwner, isActive
   )
   VALUES (
     person.id, tm.clientId, team_member_template.id,
     tm.receiveEscalations, tm.receiveHotTransfers, tm.priority,
     false, tm.isActive
   )

5. Skip if a client_membership already exists for this personId + clientId
   (handles the case where a team member is also the business owner)
```

**Edge cases:**
- Team member with same email/phone as the business owner &mdash; skip creating a duplicate membership (the owner membership from Step A1 takes precedence)
- Team member with no email AND no phone &mdash; create person with name only (they can&apos;t log in until contact info is added)

### Step A3: Migrate Agency Admins to People

For each row in `admin_users`:

```
1. Check if a person already exists with this email
   SELECT * FROM people WHERE email = adminUser.email

2. If no person exists:
   INSERT INTO people (name, email)
   VALUES (adminUser.name, adminUser.email)

3. If person exists: merge name if empty

4. Determine role template:
   - If adminUser.role = 'super_admin' -> agency_owner template
   - If adminUser.role = 'admin' -> agency_admin template

5. Create agency_membership:
   INSERT INTO agency_memberships (personId, roleTemplateId, clientScope, isActive)
   VALUES (person.id, template.id, 'all', true)

6. Skip if agency_membership already exists for this personId
```

### Step A4: Link NextAuth Users to People

For each row in `users`:

```
1. Find matching person by email
   SELECT * FROM people WHERE email = user.email

2. If found:
   UPDATE users SET personId = person.id WHERE id = user.id

3. If not found:
   - Create person from user data
   - Update users.personId
   - Log: "Created person for orphaned NextAuth user [email]"
```

### Migration Script Output

The script should produce a summary report:

```
=== Identity Migration Summary ===

People created:     42
  From clients:     35
  From team_members: 5
  From admin_users:  2
  Merged (deduped):  3

Client memberships created: 47
  Business owners:  35
  Team members:     12
  Skipped (dupes):   2

Agency memberships created: 2
  Agency owners:     1
  Agency admins:     1

NextAuth users linked: 37
  Matched to person: 35
  Orphaned (created): 2

Warnings: 1
  - Team member "Bob" (id: xxx) has no email or phone
```

### Running the Migration

```bash
# Preview mode (dry run):
npx tsx src/scripts/migrate-identities.ts --dry-run

# Execute:
npx tsx src/scripts/migrate-identities.ts

# With verbose logging:
npx tsx src/scripts/migrate-identities.ts --verbose
```

## Phase B: Backward Compatibility (During Transition)

While both old and new code paths exist, ensure:

### `getClientSession()` fallback

```typescript
// New getPortalSession() tries:
// 1. New cookie format (personId + clientId + permissions)
// 2. Fallback: Old cookie format (clientId only)
//    -> Look up client, find owner's client_membership
//    -> Return with full permissions (business_owner template)
//    -> Log warning: "Legacy session detected for client [id]"
```

### `getAuthSession()` / `requireAdmin()` fallback

```typescript
// New getAgencySession() tries:
// 1. users.personId -> agency_memberships (new path)
// 2. Fallback: users.isAdmin -> adminUsers.role (old path)
//    -> Map admin role to permissions
//    -> Log warning: "Legacy admin session for user [id]"
```

### API routes during transition

All API routes should work with both old and new session formats. The new `requirePortalPermission()` and `requireAgencyPermission()` functions handle fallback internally.

## Phase C: Verification

After migration, run verification queries:

### C1: Every active client has an owner membership

```sql
SELECT c.id, c.business_name
FROM clients c
LEFT JOIN client_memberships cm ON cm.client_id = c.id AND cm.is_owner = true
WHERE c.status = 'active' AND cm.id IS NULL;
-- Expected: 0 rows
```

### C2: Every admin_user has an agency_membership

```sql
SELECT au.id, au.email
FROM admin_users au
LEFT JOIN people p ON p.email = au.email
LEFT JOIN agency_memberships am ON am.person_id = p.id
WHERE am.id IS NULL;
-- Expected: 0 rows
```

### C3: Every NextAuth user has a personId

```sql
SELECT u.id, u.email
FROM users u
WHERE u.person_id IS NULL;
-- Expected: 0 rows
```

### C4: No duplicate client_memberships

```sql
SELECT person_id, client_id, COUNT(*)
FROM client_memberships
GROUP BY person_id, client_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

### C5: Exactly one isOwner per active client

```sql
SELECT client_id, COUNT(*)
FROM client_memberships
WHERE is_owner = true
GROUP BY client_id
HAVING COUNT(*) != 1;
-- Expected: 0 rows
```

### C6: Team member data preserved

```sql
SELECT tm.id, tm.name,
  cm.receive_escalations AS new_esc,
  tm.receive_escalations AS old_esc,
  cm.receive_hot_transfers AS new_hot,
  tm.receive_hot_transfers AS old_hot,
  cm.priority AS new_pri,
  tm.priority AS old_pri
FROM team_members tm
JOIN people p ON (p.email = tm.email OR p.phone = tm.phone)
JOIN client_memberships cm ON cm.person_id = p.id AND cm.client_id = tm.client_id
WHERE cm.receive_escalations != tm.receive_escalations
  OR cm.receive_hot_transfers != tm.receive_hot_transfers
  OR cm.priority != tm.priority;
-- Expected: 0 rows (all escalation settings preserved)
```

## Phase D: Deprecation and Removal

**Only proceed after Phase C verification passes and the new auth flows have been running in production for at least 1 week.**

### D1: Remove `admin_users` table

```
1. Remove all references to adminUsers in code:
   - src/db/schema/admin-users.ts (delete file)
   - src/db/schema/index.ts (remove re-export)
   - src/db/schema/relations.ts (remove relations)
   - src/auth.ts (remove admin role lookup from session callback)
   - Any imports of adminUsers or AdminUser type

2. Generate migration to DROP TABLE admin_users
```

### D2: Remove `users.isAdmin` and `users.clientId` columns

```
1. Remove references:
   - src/db/schema/auth.ts (remove columns)
   - src/auth.ts (remove isAdmin/clientId from session callback)
   - src/lib/utils/admin-auth.ts (already replaced by requireAgencyPermission)
   - Any other references to user.isAdmin or user.clientId

2. Generate migration to ALTER TABLE users DROP COLUMN is_admin, DROP COLUMN client_id
```

### D3: Remove `team_members` table

```
1. Remove all references:
   - src/db/schema/team-members.ts (delete file)
   - src/db/schema/index.ts (remove re-export)
   - src/db/schema/relations.ts (remove relations)
   - All API routes that query team_members
   - All components that display team_members
   - Escalation service (update to use client_memberships with receiveEscalations=true)

2. Key files to update:
   - Escalation logic: query client_memberships WHERE receiveEscalations = true
   - Hot transfer logic: query client_memberships WHERE receiveHotTransfers = true
   - Admin client detail team tab (now uses client_memberships)

3. Generate migration to DROP TABLE team_members
```

### D4: Clean up `clients` table owner fields

The `clients.ownerName`, `clients.email`, and `clients.phone` fields remain as **business contact information** (not identity). These fields continue to serve their purpose:
- `ownerName`: Used in reports, emails, UI labels (&ldquo;John&apos;s Plumbing&rdquo;)
- `email`: Business contact email (may differ from owner&apos;s personal email in future)
- `phone`: Business primary phone number (for OTP fallback and display)

**No changes needed** to the clients table. These fields are business metadata, not identity.

### D5: Remove backward compatibility fallbacks

```
1. Remove legacy cookie format handling from getPortalSession()
2. Remove isAdmin fallback from getAgencySession()
3. Remove auto-linking logic from auth.ts session callback
4. Clean up any "Legacy session detected" warning logs
```

### D6: Remove old auth utility

```
1. Delete src/lib/utils/admin-auth.ts (replaced by requireAgencyPermission)
2. Update all imports to use new permission system
```

## File Checklist

| # | File | Action |
|---|------|--------|
| 1 | `src/scripts/migrate-identities.ts` | CREATE |
| 2 | `src/scripts/verify-migration.ts` | CREATE |
| 3 | `src/db/schema/admin-users.ts` | DELETE (Phase D) |
| 4 | `src/db/schema/team-members.ts` | DELETE (Phase D) |
| 5 | `src/db/schema/auth.ts` | MODIFY (remove isAdmin, clientId in Phase D; add personId in SPEC-01) |
| 6 | `src/db/schema/index.ts` | MODIFY (remove old exports in Phase D) |
| 7 | `src/db/schema/relations.ts` | MODIFY (remove old relations in Phase D) |
| 8 | `src/auth.ts` | MODIFY (remove legacy lookups in Phase D) |
| 9 | `src/lib/utils/admin-auth.ts` | DELETE (Phase D) |
| 10 | All escalation/hot-transfer logic | MODIFY (use client_memberships in Phase D) |

## Implementation Steps

### Phase A (run once, after SPEC-01)

1. Write `migrate-identities.ts` script
2. Test with `--dry-run` flag
3. Review output carefully
4. Execute migration
5. Run Phase C verification queries

### Phase B (during SPEC-03 implementation)

6. Implement backward compatibility fallbacks in auth functions
7. Test that both old and new session formats work

### Phase C (after SPEC-03 + SPEC-04 + SPEC-05)

8. Write `verify-migration.ts` script with all verification queries
9. Run and confirm all checks pass
10. Monitor logs for &ldquo;Legacy session detected&rdquo; warnings (should decrease over time)

### Phase D (1+ week after production deploy)

11. Remove `admin_users` table and references
12. Remove `users.isAdmin` and `users.clientId`
13. Remove `team_members` table and references (update escalation logic first)
14. Remove backward compatibility fallbacks
15. Remove `admin-auth.ts`
16. Run `npm run db:generate` for DROP TABLE/COLUMN migrations
17. **Confirm with user before running `db:push` or `db:migrate`**
18. Run `npm run typecheck` and `npm run build`

## Verification

### Phase A

- [ ] Migration script runs without errors
- [ ] All people records created
- [ ] All client_memberships created with correct roles
- [ ] All agency_memberships created with correct roles
- [ ] All NextAuth users linked to people
- [ ] No duplicate memberships

### Phase C

- [ ] Every active client has exactly one owner membership
- [ ] Every admin has an agency membership
- [ ] Every user has a personId
- [ ] Escalation settings preserved correctly
- [ ] No data loss detected

### Phase D

- [ ] `admin_users` table dropped, no code references remain
- [ ] `team_members` table dropped, escalation logic updated
- [ ] `users.isAdmin` and `users.clientId` removed
- [ ] Backward compatibility code removed
- [ ] `admin-auth.ts` deleted
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Grep confirms no remaining references to deleted tables/columns

## Risks

- **Data loss**: The migration script creates new records but does not delete old ones. Old tables remain until Phase D explicit deletion. Always back up before Phase D.
- **Identity deduplication**: If a team member&apos;s phone matches a client&apos;s phone, they&apos;ll be merged into one person. This is usually correct (it&apos;s the same human) but verify edge cases.
- **Orphaned records**: If a person is created from a team_member with no email/phone, they can&apos;t log in. The migration report flags these as warnings.
- **Production deployment timing**: Phase D (table drops) should happen during low-traffic hours. The schema migration will lock tables briefly.

## Rollback Plan

### If Phase A fails

- Delete all created `people`, `client_memberships`, `agency_memberships` records
- Reset `users.personId` to NULL
- The migration script is idempotent (checks for existing records before creating)

### If Phase D causes issues

- Phase D is irreversible at the DB level (tables are dropped)
- Before Phase D, take a full database backup
- If issues arise, restore from backup and revert code changes
- This is why Phase D has a 1-week buffer after production deploy
