import { cookies } from 'next/headers';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';

export async function getClientSession(): Promise<{
  clientId: string;
  client: typeof clients.$inferSelect;
} | null> {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return null;
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return null;
  }

  return { clientId, client };
}
