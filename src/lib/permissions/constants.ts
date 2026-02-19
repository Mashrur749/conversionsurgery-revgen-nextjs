/**
 * Permission constants for the access management system.
 *
 * Flat string-based permissions organized by context (portal vs agency)
 * and domain (leads, conversations, etc.).
 */

// Client portal permissions
export const PORTAL_PERMISSIONS = {
  DASHBOARD: 'portal.dashboard',
  LEADS_VIEW: 'portal.leads.view',
  LEADS_EDIT: 'portal.leads.edit',
  CONVERSATIONS_VIEW: 'portal.conversations.view',
  ANALYTICS_VIEW: 'portal.analytics.view',
  REVENUE_VIEW: 'portal.revenue.view',
  KNOWLEDGE_VIEW: 'portal.knowledge.view',
  KNOWLEDGE_EDIT: 'portal.knowledge.edit',
  REVIEWS_VIEW: 'portal.reviews.view',
  TEAM_VIEW: 'portal.team.view',
  TEAM_MANAGE: 'portal.team.manage',
  SETTINGS_VIEW: 'portal.settings.view',
  SETTINGS_EDIT: 'portal.settings.edit',
  SETTINGS_AI: 'portal.settings.ai',
} as const;

// Agency permissions
export const AGENCY_PERMISSIONS = {
  CLIENTS_VIEW: 'agency.clients.view',
  CLIENTS_CREATE: 'agency.clients.create',
  CLIENTS_EDIT: 'agency.clients.edit',
  CLIENTS_DELETE: 'agency.clients.delete',
  FLOWS_VIEW: 'agency.flows.view',
  FLOWS_EDIT: 'agency.flows.edit',
  TEMPLATES_EDIT: 'agency.templates.edit',
  KNOWLEDGE_EDIT: 'agency.knowledge.edit',
  CONVERSATIONS_VIEW: 'agency.conversations.view',
  CONVERSATIONS_RESPOND: 'agency.conversations.respond',
  ANALYTICS_VIEW: 'agency.analytics.view',
  ABTESTS_MANAGE: 'agency.abtests.manage',
  AI_EDIT: 'agency.ai.edit',
  BILLING_VIEW: 'agency.billing.view',
  BILLING_MANAGE: 'agency.billing.manage',
  TEAM_MANAGE: 'agency.team.manage',
  SETTINGS_MANAGE: 'agency.settings.manage',
  PHONES_MANAGE: 'agency.phones.manage',
} as const;

export type PortalPermission = (typeof PORTAL_PERMISSIONS)[keyof typeof PORTAL_PERMISSIONS];
export type AgencyPermission = (typeof AGENCY_PERMISSIONS)[keyof typeof AGENCY_PERMISSIONS];
export type Permission = PortalPermission | AgencyPermission;

// All permissions as flat arrays (for validation)
export const ALL_PORTAL_PERMISSIONS = Object.values(PORTAL_PERMISSIONS);
export const ALL_AGENCY_PERMISSIONS = Object.values(AGENCY_PERMISSIONS);
export const ALL_PERMISSIONS = [...ALL_PORTAL_PERMISSIONS, ...ALL_AGENCY_PERMISSIONS];
