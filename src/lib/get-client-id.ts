import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function getClientId(): Promise<string | null> {
  const session = await auth();

  if (!session) return null;

  const isAgency = session.user?.isAgency || false;

  if (isAgency) {
    const cookieStore = await cookies();
    const adminClientId = cookieStore.get('adminSelectedClientId')?.value;
    return adminClientId || null;
  }

  return session?.client?.id || null;
}
