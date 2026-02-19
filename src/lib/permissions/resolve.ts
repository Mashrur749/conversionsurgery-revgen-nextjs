/**
 * Permission resolution logic.
 * Computes effective permissions from a role template's permissions
 * plus optional per-user overrides.
 */
import type { Permission } from './constants';

export interface PermissionOverrides {
  grant?: string[];
  revoke?: string[];
}

/**
 * Resolve effective permissions from a role template's permissions
 * plus optional per-user overrides.
 *
 * Effective = (templatePermissions + grants) - revokes
 */
export function resolvePermissions(
  templatePermissions: string[],
  overrides: PermissionOverrides | null
): Set<string> {
  const effective = new Set(templatePermissions);

  if (overrides?.grant) {
    for (const p of overrides.grant) {
      effective.add(p);
    }
  }

  if (overrides?.revoke) {
    for (const p of overrides.revoke) {
      effective.delete(p);
    }
  }

  return effective;
}

/**
 * Check if a permission set includes a specific permission.
 */
export function hasPermission(
  permissions: Set<string>,
  required: Permission
): boolean {
  return permissions.has(required);
}

/**
 * Check if a permission set includes ALL of the required permissions.
 */
export function hasAllPermissions(
  permissions: Set<string>,
  required: Permission[]
): boolean {
  return required.every((p) => permissions.has(p));
}

/**
 * Check if a permission set includes ANY of the required permissions.
 */
export function hasAnyPermission(
  permissions: Set<string>,
  required: Permission[]
): boolean {
  return required.some((p) => permissions.has(p));
}
