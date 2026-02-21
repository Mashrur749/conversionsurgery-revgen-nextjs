import { redirect } from 'next/navigation';
import type { PortalPermission } from './constants';
import { getPortalSession, type PortalSession } from './require-portal-permission';

export async function requirePortalPagePermission(
  permission: PortalPermission
): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    redirect('/client-login');
  }

  if (!session.permissions.has(permission)) {
    redirect('/client');
  }

  return session;
}

export async function requireAnyPortalPagePermission(
  permissions: PortalPermission[]
): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    redirect('/client-login');
  }

  if (!permissions.some((permission) => session.permissions.has(permission))) {
    redirect('/client');
  }

  return session;
}
