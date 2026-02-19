import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema/auth';
import { clients } from '@/db/schema/clients';
import { adminUsers } from '@/db/schema/admin-users';
import { agencyMemberships, roleTemplates, agencyClientAssignments } from '@/db/schema';
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
          personId: users.personId,
        })
        .from(users)
        .where(eq(users.email, user.email!))
        .limit(1);

      if (dbUser) {
        session.user.id = dbUser.id;
        session.user.isAdmin = dbUser.isAdmin ?? false;
        session.user.personId = dbUser.personId;

        // New path: if user has personId, enrich with agency membership data
        if (dbUser.personId) {
          const [membership] = await db
            .select({
              id: agencyMemberships.id,
              roleTemplateId: agencyMemberships.roleTemplateId,
              clientScope: agencyMemberships.clientScope,
              isActive: agencyMemberships.isActive,
              sessionVersion: agencyMemberships.sessionVersion,
            })
            .from(agencyMemberships)
            .where(eq(agencyMemberships.personId, dbUser.personId))
            .limit(1);

          if (membership && membership.isActive) {
            // Check if session version has changed (role/scope was updated)
            if (
              session.user.agencySessionVersion !== undefined &&
              membership.sessionVersion > session.user.agencySessionVersion
            ) {
              // Session is stale — clear agency data to force re-auth
              session.user.isAgency = false;
              session.user.permissions = [];
              session.user.role = undefined;
              session.user.clientScope = undefined;
              session.user.assignedClientIds = undefined;
              session.user.agencySessionVersion = membership.sessionVersion;
              return session;
            }

            const [template] = await db
              .select({
                permissions: roleTemplates.permissions,
                slug: roleTemplates.slug,
              })
              .from(roleTemplates)
              .where(eq(roleTemplates.id, membership.roleTemplateId))
              .limit(1);

            if (template) {
              session.user.permissions = template.permissions;
              session.user.role = template.slug;
              session.user.clientScope = membership.clientScope as 'all' | 'assigned';
              session.user.isAgency = true;
              session.user.agencySessionVersion = membership.sessionVersion;

              if (membership.clientScope === 'assigned') {
                const assignments = await db
                  .select({ clientId: agencyClientAssignments.clientId })
                  .from(agencyClientAssignments)
                  .where(eq(agencyClientAssignments.agencyMembershipId, membership.id));

                session.user.assignedClientIds = assignments.map((a) => a.clientId);
              }
            }
          }
        }

        // Legacy fallback: look up admin role from admin_users
        if (dbUser.isAdmin && !session.user.isAgency) {
          const [adminRecord] = await db
            .select({ role: adminUsers.role })
            .from(adminUsers)
            .where(eq(adminUsers.email, user.email!))
            .limit(1);
          session.user.role = adminRecord?.role || 'admin';
        }

        let clientId = dbUser.clientId;

        // Auto-link: if user has no clientId, try to find a matching client
        // by email. This handles the first-login race condition where the
        // signIn callback runs before the adapter creates the user record.
        if (!dbUser.isAdmin && !session.user.isAgency && !clientId) {
          const [matchingClient] = await db
            .select({ id: clients.id })
            .from(clients)
            .where(eq(clients.email, user.email!))
            .limit(1);

          if (matchingClient) {
            clientId = matchingClient.id;
            await db
              .update(users)
              .set({ clientId })
              .where(eq(users.id, dbUser.id));
            console.log(
              `[Auth] Auto-linked user ${dbUser.id} to client ${clientId}`,
            );
          }
        }

        if (!dbUser.isAdmin && !session.user.isAgency && clientId) {
          const [client] = await db
            .select({
              id: clients.id,
              businessName: clients.businessName,
              ownerName: clients.ownerName,
            })
            .from(clients)
            .where(eq(clients.id, clientId))
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

      // Check if user has an agency membership (via personId)
      if (dbUser?.personId) {
        const [membership] = await db
          .select({ id: agencyMemberships.id })
          .from(agencyMemberships)
          .where(eq(agencyMemberships.personId, dbUser.personId))
          .limit(1);

        if (membership) return true;
      }

      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.email, user.email))
        .limit(1);

      if (!client) return false;

      // Link user to client if not already linked.
      if (dbUser && !dbUser.clientId) {
        await db
          .update(users)
          .set({ clientId: client.id })
          .where(eq(users.id, dbUser.id));
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
      async sendVerificationRequest({ identifier, url, expires }) {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[next-auth][info][EMAIL_VERIFICATION_SEND]`);
            console.log(`Email: ${identifier}`);
            console.log(`Magic Link URL: ${url}`);
            console.log(`Token expires at: ${new Date(expires).toISOString()}`);
          }

          const emailResult = await sendEmail({
            to: identifier,
            subject: `Sign in to ConversionSurgery`,
            html: `
              <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1B2F26;">Sign in to ConversionSurgery</h2>
                <p>Click the link below to sign in with your email address:</p>
                <a href="${url}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Sign In</a>
                <p style="color: #6b6762; font-size: 12px;">This link expires at ${new Date(expires).toLocaleString()}</p>
                <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, please ignore this email.</p>
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
