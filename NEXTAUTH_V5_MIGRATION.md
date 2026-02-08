# NextAuth v4 → v5 Migration Guide

This project is currently running **NextAuth v4** with optimizations for **NextAuth v5 compatibility**. When v5 is officially released, use this guide to upgrade.

## Current Status

- **Current Version**: NextAuth v4.24.13
- **Target Version**: NextAuth v5 (when released)
- **Migration Difficulty**: LOW (most code already v5-ready)

## What's Ready for v5

✅ **Already implemented:**
- Drizzle ORM adapter (same in v5)
- Database session strategy (recommended in v5)
- Email provider with custom templates
- Environment variables using `AUTH_*` prefix (v5 standard)
- Type-safe authentication patterns

✅ **Zero-breaking-change areas:**
- Middleware authentication
- Session callbacks
- Email sending logic
- Database schema

## Migration Steps (When v5 Releases)

### Step 1: Update Dependencies

```bash
npm install next-auth@latest
npm install @auth/drizzle-adapter@latest
```

### Step 2: Create `/auth.ts` at Project Root

Create a new file `/auth.ts` with v5 pattern:

```typescript
// /auth.ts
import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { getDb } from "@/db"
import { sendEmail } from "@/lib/services/resend"

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb()),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      sendVerificationRequest: async ({ identifier, url, expires }) => {
        await sendEmail({
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
      },
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/verify',
    error: '/login',
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
})
```

### Step 3: Update API Route

Replace `/src/app/api/auth/[...nextauth]/route.ts` with:

```typescript
// /src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

### Step 4: Update Auth Imports Throughout App

Replace all instances of:

```typescript
// OLD (v4)
import { auth } from "@/lib/auth"
import { getServerSession } from "next-auth"
const session = await getServerSession(authOptions)

// NEW (v5)
import { auth } from "@/auth"
const session = await auth()
```

**Files to update:**
- `/src/app/(dashboard)/layout.tsx`
- `/src/app/(dashboard)/dashboard/page.tsx`
- `/src/app/(dashboard)/leads/page.tsx`
- `/src/app/(dashboard)/leads/[id]/page.tsx`
- `/src/app/(dashboard)/conversations/page.tsx`
- `/src/app/(dashboard)/scheduled/page.tsx`
- `/src/app/(dashboard)/settings/page.tsx`
- `/src/app/api/leads/[id]/route.ts`
- `/src/app/api/leads/[id]/reply/route.ts`
- Any other files using `getServerSession`

### Step 5: Update Middleware (if using)

```typescript
// middleware.ts (if you add this later)
import { auth } from "@/auth"

export default auth(async function middleware(req) {
  // Custom middleware logic here
})

export const config = {
  matcher: ["/dashboard/:path*", "/api/protected/:path*"]
}
```

### Step 6: Update Sign-Out Component

```typescript
// OLD (v4)
import { signOut } from "next-auth/react"

// NEW (v5)
import { signOut } from "@/auth"
```

### Step 7: Clean Up Old Files

After migration, delete:
- `/src/lib/auth-options.ts` (moved to `/auth.ts`)
- `/src/lib/auth.ts` (no longer needed)
- Old auth route handlers

## Testing After Migration

1. **Test magic link flow**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/signin \
     -H 'Content-Type: application/json' \
     -d '{"email":"test@example.com"}'
   ```

2. **Test dashboard access**: Navigate to `/dashboard` and verify login works

3. **Test sign-out**: Verify sign-out button works and redirects properly

4. **Test Cloudflare deployment**: Redeploy with new config

## Breaking Changes to Watch For

- `getServerSession` → `auth()` (simpler, single call)
- `useSession` stays the same (client-side)
- `authOptions` no longer passed around
- Environment variables auto-detected from `AUTH_*` prefix
- Session strategy must be explicitly set (database recommended)

## Compatibility Notes

✅ **Cloudflare Workers**: v5 is more compatible, with proper configuration
✅ **Edge Functions**: v5 supports edge-compatible adapters better
✅ **Database**: Neon + Drizzle works seamlessly in v5
✅ **Email**: Resend integration works in both versions

## Rollback Plan

If issues occur:
1. Revert to `next-auth@4`
2. Restore original files from git
3. Keep this guide for future migration attempts

## Additional Resources

- [NextAuth v5 Docs](https://authjs.dev) (when released)
- [NextAuth GitHub Releases](https://github.com/nextauthjs/next-auth/releases)
- [Drizzle Adapter Docs](https://authjs.dev/getting-started/database)
- [Cloudflare Workers Deployment](https://authjs.dev/guides/deploying/cloudflare-workers)

## Questions?

If you encounter issues during migration:
1. Check the official NextAuth migration guide
2. Review error logs in detail
3. Test each component in isolation
4. Consult the NextAuth GitHub issues

---

**Last Updated**: February 2026
**Status**: Ready for v5 (when released)
