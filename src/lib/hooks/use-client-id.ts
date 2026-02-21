'use client';

import { useSession } from 'next-auth/react';
import { useAdmin } from '@/lib/admin-context';

export function useClientId(): string | null {
  const { data: session } = useSession();
  const { selectedClientId } = useAdmin();

  const isAgency = session?.user?.isAgency || false;

  if (isAgency) {
    return selectedClientId;
  }

  return session?.client?.id || null;
}
