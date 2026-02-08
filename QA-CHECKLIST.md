# QA Checklist

## 01-admin-schema-auth

### Schema Verification
- [ ] `users` table has `is_admin` boolean column (default: false)
- [ ] `users` table has `client_id` FK referencing `clients.id`
- [ ] `accounts` table has unique constraint on `(provider, provider_account_id)`
- [ ] `sessions` table has `session_token` unique constraint
- [ ] `verification_tokens` table has composite PK on `(identifier, token)`
- [ ] All auth tables use `uuid` primary keys

### Auth Type Declarations
- [ ] `Session.user` includes `isAdmin?: boolean`
- [ ] `Session.client?` includes `id`, `businessName`, `ownerName`
- [ ] `User` interface includes `isAdmin?: boolean`

### signIn Callback
- [ ] Non-admin user without matching client email is denied sign-in
- [ ] Admin user can always sign in (even without client)
- [ ] User with matching client email is allowed sign-in
- [ ] User auto-linked to client on first sign-in when `clientId` is null

### Session Callback
- [ ] `session.user.isAdmin` is populated from DB
- [ ] Non-admin user with `clientId` gets `session.client` populated
- [ ] Admin user does NOT get `session.client` populated
- [ ] `session.user.id` is set from DB user ID

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:3000/login`
3. Sign in with admin email (must have `is_admin = true` in DB)
4. Open browser console and run:
   ```js
   fetch('/api/auth/session').then(r => r.json()).then(console.log)
   ```
5. Verify response includes `user.isAdmin: true`
6. Sign out and sign in with a client email
7. Verify response includes `client.id`, `client.businessName`, `client.ownerName`
8. Attempt sign-in with an email not in clients table — should be denied

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] All auth routes registered: `/api/auth/[...nextauth]`
