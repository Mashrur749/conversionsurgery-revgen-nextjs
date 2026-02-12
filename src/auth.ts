import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema/auth';
import { clients } from '@/db/schema/clients';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/services/resend';

export const { auth, handlers, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === 'development',
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts as any,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    async session({ session, user }) {
      const db = getDb();
      const [dbUser] = await db
        .select({
          id: users.id,
          clientId: users.clientId,
          isAdmin: users.isAdmin,
        })
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.isAdmin = dbUser.isAdmin ?? false;

        if (!dbUser.isAdmin && dbUser.clientId) {
          const [client] = await db
            .select({
              id: clients.id,
              businessName: clients.businessName,
              ownerName: clients.ownerName,
            })
            .from(clients)
            .where(eq(clients.id, dbUser.clientId))
            .limit(1);

          if (client) {
            session.client = {
              id: client.id,
              businessName: client.businessName,
              ownerName: client.ownerName,
            };
          }
        }
      }

      return session;
    },
    async signIn({ user }) {
      if (!user.email) return false;

      const db = getDb();

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (dbUser?.isAdmin) return true;

      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.email, user.email))
        .limit(1);

      if (!client) return false;

      if (user.id && dbUser && !dbUser.clientId) {
        await db
          .update(users)
          .set({ clientId: client.id })
          .where(eq(users.id, user.id));
      }

      return true;
    },
  },
  providers: [
    {
      id: 'email',
      name: 'Email',
      type: 'email',
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({ identifier, url, expires, provider }) {
        console.log(`[EmailProvider] sendVerificationRequest called!`);
        console.log(`[EmailProvider] identifier: ${identifier}`);
        console.log(`[EmailProvider] url: ${url}`);
        console.log(`[EmailProvider] provider: ${JSON.stringify(provider)}`);

        try {
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
    },
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/verify',
    error: '/login',
  },
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.AUTH_SECRET,
});
