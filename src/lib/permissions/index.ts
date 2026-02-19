// Barrel export for permission system
export {
  PORTAL_PERMISSIONS,
  AGENCY_PERMISSIONS,
  ALL_PORTAL_PERMISSIONS,
  ALL_AGENCY_PERMISSIONS,
  ALL_PERMISSIONS,
  type PortalPermission,
  type AgencyPermission,
  type Permission,
} from './constants';

export { BUILT_IN_TEMPLATES, type BuiltInTemplateSlug } from './templates';

export {
  resolvePermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  type PermissionOverrides,
} from './resolve';

export { preventEscalation, validateOverrides } from './escalation-guard';

export {
  invalidateClientSession,
  invalidateAgencySession,
} from './session-invalidation';

export {
  getPortalSession,
  requirePortalPermission,
  type PortalSession,
} from './require-portal-permission';

export {
  getAgencySession,
  requireAgencyPermission,
  requireAgencyClientPermission,
  canAccessClient,
  type AgencySession,
} from './require-agency-permission';
