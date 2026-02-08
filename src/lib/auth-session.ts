import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { sessions, users } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';

/**
 * Get authenticated user session from our custom authentication
 * Reads the next-auth.session-token cookie and validates against database
 */
export async function getAuthSession() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('next-auth.session-token')?.value;

    if (!sessionToken) {
      return null;
    }

    const db = getDb();

    // Look up session in database
    const sessionRecord = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    if (!sessionRecord.length) {
      return null;
    }

    const session = sessionRecord[0];

    // Check if session is expired
    if (new Date() > session.expires) {
      return null;
    }

    // Get user info
    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!userRecord.length) {
      return null;
    }

    const user = userRecord[0];

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      session: {
        sessionToken,
        expires: session.expires,
      },
      clientId: user.clientId,
    };
  } catch (error) {
    console.error('[Auth Session] Error:', error);
    return null;
  }
}
