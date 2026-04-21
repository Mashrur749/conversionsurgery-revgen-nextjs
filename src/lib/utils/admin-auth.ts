import { Session } from 'next-auth';

/**
 * Check if session user is a super admin. Returns false for regular admins.
 */
export function isSuperAdmin(session: Session | null): boolean {
  return session?.user?.role === 'super_admin' || session?.user?.role === 'agency_owner';
}
