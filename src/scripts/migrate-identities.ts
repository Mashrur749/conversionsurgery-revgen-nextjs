/**
 * Identity Migration Script (SPEC-06 Phase A)
 *
 * Migrates existing user data from the fragmented identity model to the
 * new `people` + memberships model.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-identities.ts --dry-run    # Preview changes
 *   npx tsx src/scripts/migrate-identities.ts               # Execute migration
 *   npx tsx src/scripts/migrate-identities.ts --verbose     # With detailed logging
 *
 * Idempotent: checks for existing records before creating. Safe to re-run.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or, sql } from 'drizzle-orm';
import { people } from '../db/schema/people';
import { clients } from '../db/schema/clients';
import { teamMembers } from '../db/schema/team-members';
import { adminUsers } from '../db/schema/admin-users';
import { users } from '../db/schema/auth';
import { roleTemplates } from '../db/schema/role-templates';
import { clientMemberships } from '../db/schema/client-memberships';
import { agencyMemberships } from '../db/schema/agency-memberships';

// --- CLI flags ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// --- Counters ---
const stats = {
  people: { created: 0, merged: 0, fromClients: 0, fromTeamMembers: 0, fromAdmins: 0, fromOrphans: 0 },
  clientMemberships: { created: 0, owners: 0, teamMembers: 0, skippedDuplicates: 0 },
  agencyMemberships: { created: 0, owners: 0, admins: 0, skippedDuplicates: 0 },
  users: { linked: 0, orphaned: 0 },
  warnings: [] as string[],
};

function log(msg: string) {
  console.log(msg);
}

function verbose(msg: string) {
  if (VERBOSE) console.log(`  [verbose] ${msg}`);
}

type DbType = ReturnType<typeof drizzle>;

// --- Helper: find or create person ---
async function findOrCreatePerson(
  db: DbType,
  name: string,
  email: string | null,
  phone: string | null,
  source: 'client' | 'team_member' | 'admin' | 'orphan_user',
): Promise<string> {
  // Try to find existing person by email or phone
  const conditions = [];
  if (email) conditions.push(eq(people.email, email));
  if (phone) conditions.push(eq(people.phone, phone));

  if (conditions.length > 0) {
    const existing = await db
      .select()
      .from(people)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .limit(1);

    if (existing.length > 0) {
      const person = existing[0];

      // Merge: update missing fields
      const updates: Record<string, unknown> = {};
      if (!person.name && name) updates.name = name;
      if (!person.email && email) updates.email = email;
      if (!person.phone && phone) updates.phone = phone;

      if (Object.keys(updates).length > 0 && !DRY_RUN) {
        updates.updatedAt = new Date();
        await db.update(people).set(updates).where(eq(people.id, person.id));
        verbose(`Merged ${source} "${name}" into existing person ${person.id} (added: ${Object.keys(updates).join(', ')})`);
      }

      stats.people.merged++;
      return person.id;
    }
  }

  // No matching person found — create one
  if (!email && !phone) {
    // Person with no identifiers — can be created but can't log in
    stats.warnings.push(`${source} "${name}" has no email or phone — created but cannot log in`);
  }

  if (DRY_RUN) {
    verbose(`[DRY RUN] Would create person: ${name} (${email || phone || 'no identifier'})`);
    stats.people.created++;
    switch (source) {
      case 'client': stats.people.fromClients++; break;
      case 'team_member': stats.people.fromTeamMembers++; break;
      case 'admin': stats.people.fromAdmins++; break;
      case 'orphan_user': stats.people.fromOrphans++; break;
    }
    return 'dry-run-id';
  }

  // The CHECK constraint requires at least one of email/phone.
  // If neither exists, we must skip creation.
  if (!email && !phone) {
    stats.warnings.push(`Skipped creating person for ${source} "${name}" — CHECK constraint requires email or phone`);
    return '';
  }

  const [newPerson] = await db
    .insert(people)
    .values({
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    })
    .returning({ id: people.id });

  verbose(`Created person ${newPerson.id} from ${source}: ${name} (${email || phone})`);
  stats.people.created++;
  switch (source) {
    case 'client': stats.people.fromClients++; break;
    case 'team_member': stats.people.fromTeamMembers++; break;
    case 'admin': stats.people.fromAdmins++; break;
    case 'orphan_user': stats.people.fromOrphans++; break;
  }

  return newPerson.id;
}

// --- Step A1: Migrate Client Owners ---
async function migrateClientOwners(db: DbType, businessOwnerTemplateId: string) {
  log('\n--- Step A1: Migrate Client Owners ---');

  const allClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      email: clients.email,
      phone: clients.phone,
      status: clients.status,
    })
    .from(clients);

  log(`Found ${allClients.length} clients to process`);

  for (const client of allClients) {
    const personId = await findOrCreatePerson(
      db,
      client.ownerName,
      client.email,
      client.phone,
      'client',
    );

    if (!personId) continue;

    // Check if membership already exists
    if (!DRY_RUN) {
      const [existing] = await db
        .select({ id: clientMemberships.id })
        .from(clientMemberships)
        .where(
          and(
            eq(clientMemberships.personId, personId),
            eq(clientMemberships.clientId, client.id),
          ),
        )
        .limit(1);

      if (existing) {
        stats.clientMemberships.skippedDuplicates++;
        verbose(`Skipped: membership already exists for ${client.ownerName} -> ${client.businessName}`);
        continue;
      }

      await db.insert(clientMemberships).values({
        personId,
        clientId: client.id,
        roleTemplateId: businessOwnerTemplateId,
        isOwner: true,
        isActive: client.status === 'active',
        receiveEscalations: true,
        receiveHotTransfers: true,
        priority: 1,
      });

      verbose(`Created ownership: ${client.ownerName} -> ${client.businessName}`);
    } else {
      verbose(`[DRY RUN] Would create ownership: ${client.ownerName} -> ${client.businessName}`);
    }

    stats.clientMemberships.created++;
    stats.clientMemberships.owners++;
  }
}

// --- Step A2: Migrate Team Members ---
async function migrateTeamMembers(db: DbType, teamMemberTemplateId: string) {
  log('\n--- Step A2: Migrate Team Members ---');

  const allTeamMembers = await db
    .select({
      id: teamMembers.id,
      clientId: teamMembers.clientId,
      name: teamMembers.name,
      phone: teamMembers.phone,
      email: teamMembers.email,
      receiveEscalations: teamMembers.receiveEscalations,
      receiveHotTransfers: teamMembers.receiveHotTransfers,
      priority: teamMembers.priority,
      isActive: teamMembers.isActive,
    })
    .from(teamMembers);

  log(`Found ${allTeamMembers.length} team members to process`);

  for (const tm of allTeamMembers) {
    const personId = await findOrCreatePerson(
      db,
      tm.name,
      tm.email,
      tm.phone,
      'team_member',
    );

    if (!personId) continue;

    // Check if membership already exists (e.g., team member is also the owner)
    if (!DRY_RUN) {
      const [existing] = await db
        .select({ id: clientMemberships.id })
        .from(clientMemberships)
        .where(
          and(
            eq(clientMemberships.personId, personId),
            eq(clientMemberships.clientId, tm.clientId),
          ),
        )
        .limit(1);

      if (existing) {
        // Update escalation settings on existing membership if this is the owner
        await db
          .update(clientMemberships)
          .set({
            receiveEscalations: tm.receiveEscalations ?? false,
            receiveHotTransfers: tm.receiveHotTransfers ?? false,
            priority: tm.priority ?? 1,
            updatedAt: new Date(),
          })
          .where(eq(clientMemberships.id, existing.id));

        stats.clientMemberships.skippedDuplicates++;
        verbose(`Merged escalation settings for existing membership: ${tm.name} (${tm.clientId})`);
        continue;
      }

      await db.insert(clientMemberships).values({
        personId,
        clientId: tm.clientId,
        roleTemplateId: teamMemberTemplateId,
        isOwner: false,
        isActive: tm.isActive ?? true,
        receiveEscalations: tm.receiveEscalations ?? false,
        receiveHotTransfers: tm.receiveHotTransfers ?? false,
        priority: tm.priority ?? 1,
      });

      verbose(`Created team membership: ${tm.name} -> client ${tm.clientId}`);
    } else {
      verbose(`[DRY RUN] Would create team membership: ${tm.name} -> client ${tm.clientId}`);
    }

    stats.clientMemberships.created++;
    stats.clientMemberships.teamMembers++;
  }
}

// --- Step A3: Migrate Agency Admins ---
async function migrateAgencyAdmins(
  db: DbType,
  agencyOwnerTemplateId: string,
  agencyAdminTemplateId: string,
) {
  log('\n--- Step A3: Migrate Agency Admins ---');

  const allAdmins = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
    })
    .from(adminUsers);

  log(`Found ${allAdmins.length} admin users to process`);

  for (const admin of allAdmins) {
    const personId = await findOrCreatePerson(
      db,
      admin.name || admin.email,
      admin.email,
      null,
      'admin',
    );

    if (!personId) continue;

    // Check if agency membership already exists
    if (!DRY_RUN) {
      const [existing] = await db
        .select({ id: agencyMemberships.id })
        .from(agencyMemberships)
        .where(eq(agencyMemberships.personId, personId))
        .limit(1);

      if (existing) {
        stats.agencyMemberships.skippedDuplicates++;
        verbose(`Skipped: agency membership already exists for ${admin.email}`);
        continue;
      }

      const templateId =
        admin.role === 'super_admin' ? agencyOwnerTemplateId : agencyAdminTemplateId;

      await db.insert(agencyMemberships).values({
        personId,
        roleTemplateId: templateId,
        clientScope: 'all',
        isActive: true,
      });

      verbose(`Created agency membership: ${admin.email} as ${admin.role}`);
    } else {
      verbose(`[DRY RUN] Would create agency membership: ${admin.email} as ${admin.role}`);
    }

    stats.agencyMemberships.created++;
    if (admin.role === 'super_admin') {
      stats.agencyMemberships.owners++;
    } else {
      stats.agencyMemberships.admins++;
    }
  }
}

// --- Step A4: Link NextAuth Users to People ---
async function linkNextAuthUsers(db: DbType) {
  log('\n--- Step A4: Link NextAuth Users to People ---');

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      personId: users.personId,
    })
    .from(users);

  log(`Found ${allUsers.length} NextAuth users to process`);

  for (const user of allUsers) {
    // Skip if already linked
    if (user.personId) {
      verbose(`Skipped: user ${user.email} already linked to person ${user.personId}`);
      continue;
    }

    // Find matching person by email
    const [matchingPerson] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.email, user.email))
      .limit(1);

    if (matchingPerson) {
      if (!DRY_RUN) {
        await db
          .update(users)
          .set({ personId: matchingPerson.id, updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }
      stats.users.linked++;
      verbose(`Linked user ${user.email} to person ${matchingPerson.id}`);
    } else {
      // Create person from user data (orphaned NextAuth user)
      const personId = await findOrCreatePerson(
        db,
        user.name || user.email,
        user.email,
        null,
        'orphan_user',
      );

      if (personId && !DRY_RUN) {
        await db
          .update(users)
          .set({ personId, updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }
      stats.users.orphaned++;
      verbose(`Created person for orphaned NextAuth user: ${user.email}`);
    }
  }
}

// --- Main ---
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = neon(databaseUrl);
  const db = drizzle(client);

  log('=== Identity Migration (SPEC-06 Phase A) ===');
  if (DRY_RUN) log('>>> DRY RUN MODE — no changes will be made <<<');
  log('');

  // Load required role template IDs
  const templates = await db
    .select({ id: roleTemplates.id, slug: roleTemplates.slug })
    .from(roleTemplates);

  const templateMap = new Map(templates.map((t) => [t.slug, t.id]));

  const businessOwnerTemplateId = templateMap.get('business_owner');
  const teamMemberTemplateId = templateMap.get('team_member');
  const agencyOwnerTemplateId = templateMap.get('agency_owner');
  const agencyAdminTemplateId = templateMap.get('agency_admin');

  if (!businessOwnerTemplateId || !teamMemberTemplateId || !agencyOwnerTemplateId || !agencyAdminTemplateId) {
    console.error('Missing required role templates. Run seed first:');
    console.error('  npx tsx src/scripts/seed-role-templates.ts');
    console.error('');
    console.error('Found templates:', [...templateMap.keys()].join(', '));
    process.exit(1);
  }

  // Execute migration steps in order
  await migrateClientOwners(db, businessOwnerTemplateId);
  await migrateTeamMembers(db, teamMemberTemplateId);
  await migrateAgencyAdmins(db, agencyOwnerTemplateId, agencyAdminTemplateId);
  await linkNextAuthUsers(db);

  // Print summary
  log('\n=== Identity Migration Summary ===');
  log('');
  log(`People created:          ${stats.people.created}`);
  log(`  From clients:          ${stats.people.fromClients}`);
  log(`  From team_members:     ${stats.people.fromTeamMembers}`);
  log(`  From admin_users:      ${stats.people.fromAdmins}`);
  log(`  From orphaned users:   ${stats.people.fromOrphans}`);
  log(`  Merged (deduped):      ${stats.people.merged}`);
  log('');
  log(`Client memberships created: ${stats.clientMemberships.created}`);
  log(`  Business owners:       ${stats.clientMemberships.owners}`);
  log(`  Team members:          ${stats.clientMemberships.teamMembers}`);
  log(`  Skipped (dupes):       ${stats.clientMemberships.skippedDuplicates}`);
  log('');
  log(`Agency memberships created: ${stats.agencyMemberships.created}`);
  log(`  Agency owners:         ${stats.agencyMemberships.owners}`);
  log(`  Agency admins:         ${stats.agencyMemberships.admins}`);
  log(`  Skipped (dupes):       ${stats.agencyMemberships.skippedDuplicates}`);
  log('');
  log(`NextAuth users linked:   ${stats.users.linked + stats.users.orphaned}`);
  log(`  Matched to person:     ${stats.users.linked}`);
  log(`  Orphaned (created):    ${stats.users.orphaned}`);
  log('');

  if (stats.warnings.length > 0) {
    log(`Warnings: ${stats.warnings.length}`);
    for (const w of stats.warnings) {
      log(`  - ${w}`);
    }
  } else {
    log('Warnings: 0');
  }

  log('');
  if (DRY_RUN) {
    log('>>> This was a dry run. No changes were made. <<<');
    log('>>> Run without --dry-run to execute the migration. <<<');
  } else {
    log('Migration complete.');
    log('Next step: run verification queries:');
    log('  npx tsx src/scripts/verify-migration.ts');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
