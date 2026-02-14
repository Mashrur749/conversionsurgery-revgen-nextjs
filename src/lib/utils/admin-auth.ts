import { Session } from 'next-auth';

/**
 * Check if session user is an admin. Throws if not.
 */
export function requireAdmin(session: Session | null): void {
  if (!(session as any)?.user?.isAdmin) {
    throw new Error('Forbidden: admin access required');
  }
}

/**
 * Check if session user is a super admin. Returns false for regular admins.
 */
export function isSuperAdmin(session: Session | null): boolean {
  return (session as any)?.user?.role === 'super_admin';
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
