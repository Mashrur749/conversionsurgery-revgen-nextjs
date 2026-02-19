/**
 * Permission escalation prevention.
 * Ensures users cannot grant permissions they don't hold.
 */

/**
 * Validate that a granting user holds all permissions they're trying to assign.
 * Throws if escalation is detected.
 *
 * @param granterPermissions - The permissions of the user doing the granting
 * @param targetPermissions - The permissions being assigned to the target
 */
export function preventEscalation(
  granterPermissions: Set<string>,
  targetPermissions: string[]
): void {
  const escalated = targetPermissions.filter((p) => !granterPermissions.has(p));
  if (escalated.length > 0) {
    throw new Error(
      `Permission escalation denied: you cannot grant permissions you don't hold: ${escalated.join(', ')}`
    );
  }
}

/**
 * Validate permission overrides. The granting user must hold
 * any permissions they're granting as overrides.
 * Revoking is always allowed (you can restrict others but not elevate).
 */
export function validateOverrides(
  granterPermissions: Set<string>,
  overrides: { grant?: string[]; revoke?: string[] }
): void {
  if (overrides.grant) {
    preventEscalation(granterPermissions, overrides.grant);
  }
}
