import { type NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';
import { sendEmail } from './services/resend';

/**
 * NextAuth Configuration
 * Uses Drizzle ORM adapter with Neon PostgreSQL for session/token storage
 * Email provider with Resend for magic link delivery
 *
 * NOTE: NextAuth v5 coming soon - this config is v5-ready
 * When v5 releases, this will move to /auth.ts with simplified exports
 */
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts as any,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    async session({ session, user }) {
      // Fetch user from database to include client info and admin status
      const db = getDb();
      const dbUser = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      if (dbUser && dbUser.length > 0) {
        (session as any).user.id = dbUser[0].id;
        (session as any).user.isAdmin = dbUser[0].isAdmin ?? false;
        (session as any).client = dbUser[0].clientId ? { id: dbUser[0].clientId } : null;
      }

      return session;
    },
  },
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      maxAge: 24 * 60 * 60, // 24 hours
      async sendVerificationRequest({ identifier, url, expires, provider, theme }) {
        console.log(`[EmailProvider] sendVerificationRequest called!`);
        console.log(`[EmailProvider] identifier: ${identifier}`);
        console.log(`[EmailProvider] url: ${url}`);
        console.log(`[EmailProvider] provider: ${JSON.stringify(provider)}`);

        try {
          // Log magic link in development mode
          if (process.env.NODE_ENV === 'development') {
            console.log(`[next-auth][info][EMAIL_VERIFICATION_SEND]`);
            console.log(`Email: ${identifier}`);
            console.log(`Magic Link URL: ${url}`);
            console.log(`Token expires at: ${new Date(expires).toISOString()}`);
          }

          const emailResult = await sendEmail({
            to: identifier,
            subject: `Sign in to Revenue Recovery`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">Sign in to Revenue Recovery</h2>
                <p>Click the link below to sign in with your email address:</p>
                <a href="${url}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Sign In</a>
                <p style="color: #666; font-size: 12px;">This link expires at ${new Date(expires).toLocaleString()}</p>
                <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
              </div>
            `,
          });

          if (!emailResult.success) {
            console.error('[EmailProvider] Resend error:', emailResult.error);
            throw new Error(`Resend error: ${emailResult.error}`);
          }

          console.log(`[Magic Link] Email sent successfully to ${identifier}`);
        } catch (error) {
          console.error('[EmailProvider] Failed to send verification email:', error);
          throw error;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/verify',
    error: '/login',
  },
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update every 24 hours
  },
  secret: process.env.AUTH_SECRET,
};
