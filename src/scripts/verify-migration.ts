/**
 * Migration Verification Script (SPEC-06 Phase C)
 *
 * Runs verification queries after the identity migration to confirm
 * all data was correctly migrated.
 *
 * Usage:
 *   npx tsx src/scripts/verify-migration.ts
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { people } from '../db/schema/people';
import { clients } from '../db/schema/clients';
import { teamMembers } from '../db/schema/team-members';
import { adminUsers } from '../db/schema/admin-users';
import { users } from '../db/schema/auth';
import { clientMemberships } from '../db/schema/client-memberships';
import { agencyMemberships } from '../db/schema/agency-memberships';

type CheckResult = { name: string; passed: boolean; details: string };
const results: CheckResult[] = [];

function check(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const icon = passed ? '\u2705' : '\u274C';
  console.log(`${icon} ${name}: ${details}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = neon(databaseUrl);
  const db = drizzle(client);

  console.log('=== Migration Verification (SPEC-06 Phase C) ===\n');

  // --- C1: Every active client has an owner membership ---
  const clientsWithoutOwner = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
    })
    .from(clients)
    .leftJoin(
      clientMemberships,
      and(
        eq(clientMemberships.clientId, clients.id),
        eq(clientMemberships.isOwner, true),
      ),
    )
    .where(
      and(
        eq(clients.status, 'active'),
        isNull(clientMemberships.id),
      ),
    );

  check(
    'C1: Every active client has an owner membership',
    clientsWithoutOwner.length === 0,
    clientsWithoutOwner.length === 0
      ? 'All active clients have owner memberships'
      : `${clientsWithoutOwner.length} client(s) missing owner: ${clientsWithoutOwner.map((c) => c.businessName).join(', ')}`,
  );

  // --- C2: Every admin_user has an agency_membership ---
  const adminsWithoutMembership = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
    })
    .from(adminUsers)
    .leftJoin(people, eq(people.email, adminUsers.email))
    .leftJoin(agencyMemberships, eq(agencyMemberships.personId, people.id))
    .where(isNull(agencyMemberships.id));

  check(
    'C2: Every admin_user has an agency_membership',
    adminsWithoutMembership.length === 0,
    adminsWithoutMembership.length === 0
      ? 'All admins have agency memberships'
      : `${adminsWithoutMembership.length} admin(s) missing: ${adminsWithoutMembership.map((a) => a.email).join(', ')}`,
  );

  // --- C3: Every NextAuth user has a personId ---
  const usersWithoutPerson = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(isNull(users.personId));

  check(
    'C3: Every NextAuth user has a personId',
    usersWithoutPerson.length === 0,
    usersWithoutPerson.length === 0
      ? 'All users linked to a person'
      : `${usersWithoutPerson.length} user(s) unlinked: ${usersWithoutPerson.map((u) => u.email).join(', ')}`,
  );

  // --- C4: No duplicate client_memberships ---
  const duplicateMemberships = await db
    .select({
      personId: clientMemberships.personId,
      clientId: clientMemberships.clientId,
      count: sql<number>`count(*)::int`,
    })
    .from(clientMemberships)
    .groupBy(clientMemberships.personId, clientMemberships.clientId)
    .having(sql`count(*) > 1`);

  check(
    'C4: No duplicate client_memberships',
    duplicateMemberships.length === 0,
    duplicateMemberships.length === 0
      ? 'No duplicates found'
      : `${duplicateMemberships.length} duplicate pair(s) found`,
  );

  // --- C5: Exactly one isOwner per active client ---
  const multipleOwners = await db
    .select({
      clientId: clientMemberships.clientId,
      count: sql<number>`count(*)::int`,
    })
    .from(clientMemberships)
    .where(eq(clientMemberships.isOwner, true))
    .groupBy(clientMemberships.clientId)
    .having(sql`count(*) != 1`);

  check(
    'C5: Exactly one isOwner per active client',
    multipleOwners.length === 0,
    multipleOwners.length === 0
      ? 'One owner per client confirmed'
      : `${multipleOwners.length} client(s) with wrong owner count`,
  );

  // --- C6: Team member escalation data preserved ---
  // Compare team_members settings with their corresponding client_memberships
  const allTeamMembers = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      email: teamMembers.email,
      phone: teamMembers.phone,
      clientId: teamMembers.clientId,
      receiveEscalations: teamMembers.receiveEscalations,
      receiveHotTransfers: teamMembers.receiveHotTransfers,
      priority: teamMembers.priority,
    })
    .from(teamMembers);

  let escalationMismatches = 0;
  const mismatchDetails: string[] = [];

  for (const tm of allTeamMembers) {
    // Find the person by email or phone
    const conditions = [];
    if (tm.email) conditions.push(eq(people.email, tm.email));
    if (tm.phone) conditions.push(eq(people.phone, tm.phone));
    if (conditions.length === 0) continue;

    const [person] = await db
      .select({ id: people.id })
      .from(people)
      .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} OR ${conditions[1]}`)
      .limit(1);

    if (!person) continue;

    const [membership] = await db
      .select({
        receiveEscalations: clientMemberships.receiveEscalations,
        receiveHotTransfers: clientMemberships.receiveHotTransfers,
        priority: clientMemberships.priority,
      })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.personId, person.id),
          eq(clientMemberships.clientId, tm.clientId),
        ),
      )
      .limit(1);

    if (!membership) continue;

    const escMatch = membership.receiveEscalations === (tm.receiveEscalations ?? false);
    const hotMatch = membership.receiveHotTransfers === (tm.receiveHotTransfers ?? false);
    const priMatch = membership.priority === (tm.priority ?? 1);

    if (!escMatch || !hotMatch || !priMatch) {
      escalationMismatches++;
      mismatchDetails.push(
        `${tm.name}: esc=${membership.receiveEscalations}!=${tm.receiveEscalations}, hot=${membership.receiveHotTransfers}!=${tm.receiveHotTransfers}, pri=${membership.priority}!=${tm.priority}`,
      );
    }
  }

  check(
    'C6: Team member escalation data preserved',
    escalationMismatches === 0,
    escalationMismatches === 0
      ? `${allTeamMembers.length} team members verified`
      : `${escalationMismatches} mismatch(es): ${mismatchDetails.slice(0, 3).join('; ')}`,
  );

  // --- Summary stats ---
  console.log('\n--- Entity Counts ---');

  const [peopleCount] = await db.select({ count: sql<number>`count(*)::int` }).from(people);
  const [clientMembershipCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clientMemberships);
  const [agencyMembershipCount] = await db.select({ count: sql<number>`count(*)::int` }).from(agencyMemberships);
  const [linkedUserCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`person_id IS NOT NULL`);

  console.log(`People:              ${peopleCount.count}`);
  console.log(`Client memberships:  ${clientMembershipCount.count}`);
  console.log(`Agency memberships:  ${agencyMembershipCount.count}`);
  console.log(`Users with personId: ${linkedUserCount.count}`);

  // --- Final verdict ---
  console.log('\n=== Verification Result ===');
  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log('\u2705 ALL CHECKS PASSED');
  } else {
    const failed = results.filter((r) => !r.passed);
    console.log(`\u274C ${failed.length} CHECK(S) FAILED:`);
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.details}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
