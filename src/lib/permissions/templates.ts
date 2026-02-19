/**
 * Built-in role template definitions.
 * Used for seeding the database and as a reference for validation.
 */
import {
  PORTAL_PERMISSIONS,
  AGENCY_PERMISSIONS,
  ALL_PORTAL_PERMISSIONS,
  ALL_AGENCY_PERMISSIONS,
} from './constants';

export const BUILT_IN_TEMPLATES = {
  // Client portal roles
  business_owner: {
    name: 'Business Owner',
    scope: 'client' as const,
    permissions: ALL_PORTAL_PERMISSIONS,
  },
  office_manager: {
    name: 'Office Manager',
    scope: 'client' as const,
    permissions: ALL_PORTAL_PERMISSIONS.filter(
      (p) => p !== PORTAL_PERMISSIONS.SETTINGS_AI && p !== PORTAL_PERMISSIONS.TEAM_MANAGE
    ),
  },
  team_member: {
    name: 'Team Member',
    scope: 'client' as const,
    permissions: [
      PORTAL_PERMISSIONS.DASHBOARD,
      PORTAL_PERMISSIONS.LEADS_VIEW,
      PORTAL_PERMISSIONS.CONVERSATIONS_VIEW,
    ],
  },
  // Agency roles
  agency_owner: {
    name: 'Agency Owner',
    scope: 'agency' as const,
    permissions: ALL_AGENCY_PERMISSIONS,
  },
  agency_admin: {
    name: 'Agency Admin',
    scope: 'agency' as const,
    permissions: ALL_AGENCY_PERMISSIONS.filter(
      (p) =>
        p !== AGENCY_PERMISSIONS.BILLING_MANAGE && p !== AGENCY_PERMISSIONS.SETTINGS_MANAGE
    ),
  },
  account_manager: {
    name: 'Account Manager',
    scope: 'agency' as const,
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
  content_specialist: {
    name: 'Content Specialist',
    scope: 'agency' as const,
    permissions: [
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
      AGENCY_PERMISSIONS.TEMPLATES_EDIT,
      AGENCY_PERMISSIONS.KNOWLEDGE_EDIT,
    ],
  },
} as const;

export type BuiltInTemplateSlug = keyof typeof BUILT_IN_TEMPLATES;
