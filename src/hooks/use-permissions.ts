'use client';

import { createContext, useContext } from 'react';
import type { Permission } from '@/lib/permissions/constants';

interface PermissionContextValue {
  permissions: string[];
  isOwner: boolean;
  personId: string;
  clientId?: string;
}

export const PermissionContext = createContext<PermissionContextValue>({
  permissions: [],
  isOwner: false,
  personId: '',
});

export function usePermissions() {
  const ctx = useContext(PermissionContext);

  return {
    ...ctx,
    hasPermission: (p: Permission) => ctx.permissions.includes(p),
    hasAnyPermission: (ps: Permission[]) => ps.some((p) => ctx.permissions.includes(p)),
    hasAllPermissions: (ps: Permission[]) => ps.every((p) => ctx.permissions.includes(p)),
  };
}
