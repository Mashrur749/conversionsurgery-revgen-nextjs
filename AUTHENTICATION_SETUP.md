# Authentication Setup Guide

This document explains how authentication works in this Revenue Recovery SaaS application.

## Overview

**Authentication Method**: Email magic links (passwordless)
**Session Storage**: PostgreSQL (Neon) via Drizzle ORM adapter
**Framework**: NextAuth v4 (v5 upgrade path prepared)
**Email Service**: Resend

## Architecture

```
┌─────────────────┐
│   User/Browser  │
└────────┬────────┘
         │
    1. Request magic link
         │
    ┌────▼──────────────┐
    │   /api/auth/signin│  ← Email endpoint
    └────┬──────────────┘
         │
    2. Generate token
         │
    ┌────▼──────────────────────┐
    │   NextAuth (Drizzle)      │
    │   verificationTokens table │  ← Stores token
    └────┬──────────────────────┘
         │
    3. Send email via Resend
         │
    ┌────▼──────────────┐
    │  Resend API       │
    │  (email service)  │
    └────┬──────────────┘
         │
    4. User clicks link
         │
    ┌────▼──────────────────────────┐
    │ /api/auth/callback/email      │
    │ (verify token, create session) │
    └────┬──────────────────────────┘
         │
    5. Set session cookie
         │
    ┌────▼──────────────┐
    │  sessions table   │
    │  (Neon DB)        │
    └────┬──────────────┘
         │
    6. Redirect to dashboard
         │
    └────▼──────────────┐
         /dashboard
    └───────────────────┘
```

## Files & Configuration

### Core Configuration

- **`/src/lib/auth-options.ts`** - NextAuth configuration with providers
- **`/src/lib/auth.ts`** - Auth helper (gets server session)
- **`/src/app/api/auth/[...nextauth]/route.ts`** - NextAuth route handler

### Database Schema

- **`/src/db/schema/auth.ts`** - NextAuth tables
  - `users` - User accounts
  - `sessions` - Active sessions
  - `verificationTokens` - Magic link tokens (valid for 24 hours)
  - `accounts` - OAuth accounts (for future use)

### UI Components

- **`/src/app/login/page.tsx`** - Email input form
- **`/src/app/verify/page.tsx`** - Verification message page
- **`/src/app/(dashboard)/signout-button.tsx`** - Sign-out button component

### API Routes

- **`POST /api/auth/signin`** - Request magic link
- **`GET/POST /api/auth/[...nextauth]`** - NextAuth handler
- **`GET /api/auth/callback/email`** - Email verification callback

## Environment Variables

Required for authentication:

```env
# Required
AUTH_SECRET=<random-32-byte-string>
DATABASE_URL=<neon-postgres-url>

# Email
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM="Revenue Recovery <noreply@contact.getconversionsurgery.com>"

# Optional
AUTH_URL=http://localhost:3000  # Auto-detected, needed behind proxy
```

### Generate AUTH_SECRET

```bash
# macOS/Linux
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Maximum 256}))
```

## Database Tables

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  emailVerified TIMESTAMP,
  image VARCHAR(500),
  clientId UUID REFERENCES clients(id),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### sessions

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessionToken VARCHAR(255) UNIQUE NOT NULL,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP NOT NULL
);
```

### verificationTokens

```sql
CREATE TABLE verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires TIMESTAMP NOT NULL,
  PRIMARY KEY (identifier, token)
);
```

## How It Works

### 1. User Requests Magic Link

```typescript
// POST /api/auth/signin
const response = await fetch("/api/auth/signin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@example.com" }),
});
```

### 2. NextAuth Creates Token

- Generates random verification token
- Stores in `verificationTokens` table with 24-hour expiry
- Emails magic link to user

### 3. User Clicks Link

Magic link contains: `/api/auth/callback/email?token=<token>&email=<email>`

### 4. NextAuth Verifies Token

- Looks up token in database
- Checks if not expired
- Creates or updates user record
- Creates session record
- Sets session cookie

### 5. User Authenticated

Session cookie automatically sent with subsequent requests. Available in:

```typescript
// Server components
import { auth } from "@/lib/auth";
const session = await auth();

// Middleware
import { auth } from "@/lib/auth";
export default auth(async function middleware(req) {
  const session = req.auth;
});

// API routes
const session = await getServerSession(authOptions);

// Client components (React)
import { useSession } from "next-auth/react";
const { data: session } = useSession();
```

## Security Features

✅ **Passwordless**: No passwords stored
✅ **Time-Limited**: Tokens expire in 24 hours
✅ **Secure Transmission**: HTTPS only in production
✅ **Database-Backed Sessions**: Can't be forged
✅ **CSRF Protected**: NextAuth includes CSRF token verification
✅ **Encrypted Cookies**: Session cookies are signed and encrypted

## Protected Pages

All pages under `/dashboard` require authentication:

```typescript
// /src/app/(dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return <>{children}</>
}
```

## Deployment Considerations

### Local Development

- Magic links sent via Resend
- Links logged to console in debug mode
- Session stored in Neon (same as production)

### Production (Cloudflare Workers)

- Magic links sent via Resend
- Links in email only
- Sessions stored in Neon
- No session data stored on Edge

### Environment Variables (Wrangler)

```bash
# Set via wrangler CLI
wrangler secret put AUTH_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put DATABASE_URL

# Or in wrangler.toml [vars]
```

## Testing Authentication

### Test Magic Link Flow

```bash
# 1. Request link
curl -X POST http://localhost:3000/api/auth/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

# 2. Check console for magic link URL
# In dev mode, link prints to terminal

# 3. Click link or open in browser
http://localhost:3000/api/auth/callback/email?token=...&email=test@example.com

# 4. Should redirect to /dashboard
# Check database: SELECT * FROM sessions WHERE userId = '...'
```

### Common Issues

**"Email requires adapter"**

- Solution: Ensure `DrizzleAdapter(getDb())` is in auth config

**"Session not found"**

- Check `verificationTokens` table has valid token
- Check `sessions` table has entry for user
- Check session hasn't expired

**"Magic link not received"**

- Check Resend API key is valid
- Check EMAIL_FROM format: "Name <email@domain>"
- Check spam folder

**"Token expired"**

- Tokens expire after 24 hours
- User must request new link

## Customization

### Change Email Template

Edit `/src/lib/auth-options.ts`:

```typescript
sendVerificationRequest: async ({ identifier, url, expires }) => {
  await sendEmail({
    to: identifier,
    subject: "Your custom subject",
    html: `<a href="${url}">Click to login</a>`, // Your HTML
  });
};
```

### Change Session Duration

```typescript
// auth-options.ts
session: {
  strategy: 'database',
  maxAge: 7 * 24 * 60 * 60, // 7 days instead of 30
  updateAge: 24 * 60 * 60,   // Refresh every 24 hours
}
```

### Add OAuth (Future)

```typescript
// When adding Google/GitHub:
import GoogleProvider from "next-auth/providers/google"

providers: [
  EmailProvider({...}),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  // GitHub, etc...
]
```

## NextAuth v5 Migration

When NextAuth v5 is released:

- Single `auth()` function replaces `getServerSession`, `useSession`, etc.
- Configuration moves to `/auth.ts` at project root
- API route becomes one line
- Better Cloudflare Workers support

See `NEXTAUTH_V5_MIGRATION.md` for detailed upgrade steps.

## Additional Resources

- [NextAuth Docs](https://next-auth.js.org)
- [Drizzle Adapter](https://authjs.dev/getting-started/database)
- [Resend Email](https://resend.com)
- [Neon PostgreSQL](https://neon.tech)

---

**Last Updated**: February 2026
**Status**: Production-Ready
