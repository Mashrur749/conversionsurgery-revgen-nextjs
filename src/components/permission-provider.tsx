'use client';

import { PermissionContext } from '@/hooks/use-permissions';

export function PermissionProvider({
  children,
  permissions,
  isOwner,
  personId,
  clientId,
}: {
  children: React.ReactNode;
  permissions: string[];
  isOwner: boolean;
  personId: string;
  clientId: string;
}) {
  return (
    <PermissionContext.Provider value={{ permissions, isOwner, personId, clientId }}>
      {children}
    </PermissionContext.Provider>
  );
}
