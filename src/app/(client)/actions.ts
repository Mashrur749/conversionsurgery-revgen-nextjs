'use server';

import { clearClientSessionCookie } from '@/lib/client-auth';

export async function clearClientSessionCookieAction(): Promise<void> {
  await clearClientSessionCookie();
}
