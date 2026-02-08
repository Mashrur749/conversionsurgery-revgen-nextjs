import { auth } from '@/lib/auth';

/**
 * Get the effective client ID for the current user
 * - If user is an admin with a selected client, return the selected client ID
 * - Otherwise, return the user's own client ID
 *
 * This is used to filter data by client in all dashboard queries
 */
export async function getClientId(): Promise<string | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // If admin, they would have a selectedClientId in session
  // Otherwise, use their own clientId
  return (session as any).client?.id ?? null;
}

/**
 * Get the selected client ID for an admin user
 * Returns null if user is not an admin or hasn't selected a client
 */
export async function getSelectedClientId(): Promise<string | null> {
  const session = await auth();

  if (!(session as any).selectedClientId) {
    return null;
  }

  return (session as any).selectedClientId;
}
