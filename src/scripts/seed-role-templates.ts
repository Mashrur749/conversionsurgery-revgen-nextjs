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
import {
  PORTAL_PERMISSIONS,
  AGENCY_PERMISSIONS,
  ALL_PORTAL_PERMISSIONS,
  ALL_AGENCY_PERMISSIONS,
} from '../lib/permissions/constants';

const BUILT_IN_TEMPLATES = [
  {
    name: 'Business Owner',
    slug: 'business_owner',
    description: 'Full access to all client portal features. Assigned to the business owner.',
    scope: 'client',
    permissions: [...ALL_PORTAL_PERMISSIONS],
  },
  {
    name: 'Office Manager',
    slug: 'office_manager',
    description: 'Access to most client portal features except AI settings and team management.',
    scope: 'client',
    permissions: ALL_PORTAL_PERMISSIONS.filter(
      (p) => p !== PORTAL_PERMISSIONS.SETTINGS_AI && p !== PORTAL_PERMISSIONS.TEAM_MANAGE
    ),
  },
  {
    name: 'Team Member',
    slug: 'team_member',
    description: 'Basic access to dashboard, leads, and conversations.',
    scope: 'client',
    permissions: [
      PORTAL_PERMISSIONS.DASHBOARD,
      PORTAL_PERMISSIONS.LEADS_VIEW,
      PORTAL_PERMISSIONS.CONVERSATIONS_VIEW,
    ],
  },
  {
    name: 'Agency Owner',
    slug: 'agency_owner',
    description: 'Full access to all agency features including billing and settings.',
    scope: 'agency',
    permissions: [...ALL_AGENCY_PERMISSIONS],
  },
  {
    name: 'Agency Admin',
    slug: 'agency_admin',
    description: 'Full agency access except billing management and system settings.',
    scope: 'agency',
    permissions: ALL_AGENCY_PERMISSIONS.filter(
      (p) => p !== AGENCY_PERMISSIONS.BILLING_MANAGE && p !== AGENCY_PERMISSIONS.SETTINGS_MANAGE
    ),
  },
  {
    name: 'Account Manager',
    slug: 'account_manager',
    description: 'Manage assigned clients: edit settings, flows, conversations, and knowledge base.',
    scope: 'agency',
    permissions: [
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CLIENTS_EDIT,
      AGENCY_PERMISSIONS.FLOWS_VIEW,
      AGENCY_PERMISSIONS.FLOWS_EDIT,
      AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
      AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND,
      AGENCY_PERMISSIONS.ANALYTICS_VIEW,
      AGENCY_PERMISSIONS.KNOWLEDGE_EDIT,
      AGENCY_PERMISSIONS.AI_EDIT,
    ],
  },
  {
    name: 'Content Specialist',
    slug: 'content_specialist',
    description: 'View clients and conversations, edit templates and knowledge base.',
    scope: 'agency',
    permissions: [
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
      AGENCY_PERMISSIONS.TEMPLATES_EDIT,
      AGENCY_PERMISSIONS.KNOWLEDGE_EDIT,
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
