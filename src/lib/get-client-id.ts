import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { canAccessClient, getAgencySession } from '@/lib/permissions';

export async function getClientId(): Promise<string | null> {
  const session = await auth();

  if (!session) return null;

  const isAgency = session.user?.isAgency || false;

  if (isAgency) {
    const agencySession = await getAgencySession();
    if (!agencySession) return null;

    const cookieStore = await cookies();
    const adminClientId = cookieStore.get('adminSelectedClientId')?.value;

    if (adminClientId && canAccessClient(agencySession, adminClientId)) {
      return adminClientId;
    }

    // For assigned-scope users, default to first accessible client to avoid stale cookie lockout.
    if (agencySession.clientScope === 'assigned') {
      return agencySession.assignedClientIds?.[0] ?? null;
    }

    return null;
  }

  return session?.client?.id || null;
}
