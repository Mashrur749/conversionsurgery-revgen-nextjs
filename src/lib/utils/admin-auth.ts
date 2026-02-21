import { Session } from 'next-auth';

/**
 * Check if session user is an agency member. Throws if not.
 */
export function requireAdmin(session: Session | null): void {
  if (!session?.user?.isAgency) {
    throw new Error('Forbidden: admin access required');
  }
}

/**
 * Check if session user is a super admin. Returns false for regular admins.
 */
export function isSuperAdmin(session: Session | null): boolean {
  return session?.user?.role === 'super_admin' || session?.user?.role === 'agency_owner';
}

/**
 * Check if session user is a super admin. Throws if not.
 */
export function requireSuperAdmin(session: Session | null): void {
  requireAdmin(session);
  if (!isSuperAdmin(session)) {
    throw new Error('Forbidden: super admin access required');
  }
}
