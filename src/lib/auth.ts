import { getServerSession, type Session } from 'next-auth';
import { authOptions } from './auth-options';

// Get server session for use in server components and API routes
export async function auth(): Promise<Session | null> {
  try {
    return await getServerSession(authOptions);
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// Re-export auth options for route handler
export { authOptions };

