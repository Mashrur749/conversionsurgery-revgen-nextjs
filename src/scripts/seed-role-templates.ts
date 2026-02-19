/**
 * Seed built-in role templates.
 * Run: npx tsx src/scripts/seed-role-templates.ts
 *
 * This script is idempotent — it uses ON CONFLICT DO NOTHING
 * so it can be run multiple times safely.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { roleTemplates } from '../db/schema/role-templates';
import { sql } from 'drizzle-orm';

const ALL_PORTAL_PERMISSIONS = [
  'portal.dashboard',
  'portal.leads.view',
  'portal.leads.edit',
  'portal.conversations.view',
  'portal.analytics.view',
  'portal.revenue.view',
  'portal.knowledge.view',
  'portal.knowledge.edit',
  'portal.reviews.view',
  'portal.team.view',
  'portal.team.manage',
  'portal.settings.view',
  'portal.settings.edit',
  'portal.settings.ai',
];

const ALL_AGENCY_PERMISSIONS = [
  'agency.clients.view',
  'agency.clients.create',
  'agency.clients.edit',
  'agency.clients.delete',
  'agency.flows.view',
  'agency.flows.edit',
  'agency.templates.edit',
  'agency.knowledge.edit',
  'agency.conversations.view',
  'agency.conversations.respond',
  'agency.analytics.view',
  'agency.abtests.manage',
  'agency.ai.edit',
  'agency.billing.view',
  'agency.billing.manage',
  'agency.team.manage',
  'agency.settings.manage',
  'agency.phones.manage',
];

const BUILT_IN_TEMPLATES = [
  {
    name: 'Business Owner',
    slug: 'business_owner',
    description: 'Full access to all client portal features. Assigned to the business owner.',
    scope: 'client',
    permissions: ALL_PORTAL_PERMISSIONS,
  },
  {
    name: 'Office Manager',
    slug: 'office_manager',
    description: 'Access to most client portal features except AI settings and team management.',
    scope: 'client',
    permissions: ALL_PORTAL_PERMISSIONS.filter(
      (p) => p !== 'portal.settings.ai' && p !== 'portal.team.manage'
    ),
  },
  {
    name: 'Team Member',
    slug: 'team_member',
    description: 'Basic access to dashboard, leads, and conversations.',
    scope: 'client',
    permissions: [
      'portal.dashboard',
      'portal.leads.view',
      'portal.conversations.view',
    ],
  },
  {
    name: 'Agency Owner',
    slug: 'agency_owner',
    description: 'Full access to all agency features including billing and settings.',
    scope: 'agency',
    permissions: ALL_AGENCY_PERMISSIONS,
  },
  {
    name: 'Agency Admin',
    slug: 'agency_admin',
    description: 'Full agency access except billing management and system settings.',
    scope: 'agency',
    permissions: ALL_AGENCY_PERMISSIONS.filter(
      (p) => p !== 'agency.billing.manage' && p !== 'agency.settings.manage'
    ),
  },
  {
    name: 'Account Manager',
    slug: 'account_manager',
    description: 'Manage assigned clients: edit settings, flows, conversations, and knowledge base.',
    scope: 'agency',
    permissions: [
      'agency.clients.view',
      'agency.clients.edit',
      'agency.flows.view',
      'agency.flows.edit',
      'agency.conversations.view',
      'agency.conversations.respond',
      'agency.analytics.view',
      'agency.knowledge.edit',
      'agency.ai.edit',
    ],
  },
  {
    name: 'Content Specialist',
    slug: 'content_specialist',
    description: 'View clients and conversations, edit templates and knowledge base.',
    scope: 'agency',
    permissions: [
      'agency.clients.view',
      'agency.conversations.view',
      'agency.templates.edit',
      'agency.knowledge.edit',
    ],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = neon(databaseUrl);
  const db = drizzle(client);

  console.log('Seeding built-in role templates...\n');

  for (const template of BUILT_IN_TEMPLATES) {
    await db
      .insert(roleTemplates)
      .values({
        name: template.name,
        slug: template.slug,
        description: template.description,
        scope: template.scope,
        permissions: template.permissions,
        isBuiltIn: true,
      })
      .onConflictDoNothing({ target: roleTemplates.slug });

    console.log(`  [${template.scope}] ${template.name} (${template.slug}) — ${template.permissions.length} permissions`);
  }

  console.log(`\nDone. ${BUILT_IN_TEMPLATES.length} templates seeded.`);

  // Verify
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(roleTemplates);
  console.log(`Total role templates in database: ${count[0].count}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
