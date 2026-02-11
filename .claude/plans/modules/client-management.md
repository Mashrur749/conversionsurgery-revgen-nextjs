# Module: client-management
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Client account management and authentication — NextAuth configuration, client CRUD, admin user management, system settings, client setup wizard, error/webhook logging, and the core authentication infrastructure.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/clients.ts` | `clients` table — core client accounts |
| `src/db/schema/admin-users.ts` | `adminUsers` table — admin user records |
| `src/db/schema/system-settings.ts` | `systemSettings` table — platform config |
| `src/db/schema/auth.ts` | NextAuth tables (users, accounts, sessions, verificationTokens) |
| `src/db/schema/magic-link-tokens.ts` | `magicLinkTokens` table — auth tokens |
| `src/db/schema/error-log.ts` | `errorLog` table — system error tracking |
| `src/db/schema/webhook-log.ts` | `webhookLog` table — webhook event log |
| `src/lib/auth.ts` | NextAuth configuration (authOptions, auth()) |
| `src/lib/services/magic-link.ts` | Magic link generation and verification |
| `src/lib/services/slack.ts` | Slack notification integration |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth API route handler |
| `src/app/api/auth/signin/route.ts` | Custom sign-in route |
| `src/app/api/auth/verify/route.ts` | Magic link verification route |
| `src/app/api/admin/clients/route.ts` | GET/POST — list and create clients |
| `src/app/api/admin/clients/[id]/route.ts` | GET/PATCH/DELETE — client operations |
| `src/app/api/admin/clients/[id]/stats/route.ts` | GET — client statistics |
| `src/app/api/admin/clients/[id]/jobs/route.ts` | GET/POST — client background jobs |
| `src/app/api/admin/clients/[id]/jobs/[jobId]/route.ts` | GET/PATCH — job management |
| `src/app/api/admin/clients/[id]/templates/route.ts` | GET — client message templates |
| `src/app/api/admin/users/route.ts` | GET — list users |
| `src/app/api/admin/users/[id]/route.ts` | PATCH — update user role |
| `src/app/api/test-db/route.ts` | GET — database connectivity test |
| `src/app/(dashboard)/admin/page.tsx` | Agency dashboard |
| `src/app/(dashboard)/admin/clients/page.tsx` | Clients list page |
| `src/app/(dashboard)/admin/clients/new/page.tsx` | New client entry page |
| `src/app/(dashboard)/admin/clients/new/wizard/page.tsx` | Client setup wizard |
| `src/app/(dashboard)/admin/clients/[id]/page.tsx` | Client detail page |
| `src/app/(dashboard)/admin/users/page.tsx` | Users management page |
| `src/app/(dashboard)/dashboard/page.tsx` | Main dashboard page |
| `src/components/admin/client-selector.tsx` | Admin client selector component |
| `src/components/client-selector.tsx` | Client selector component |
| `src/components/providers.tsx` | React context providers (NextAuth, etc.) |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/auth.ts
export const authOptions: AuthOptions
export async function auth(): Promise<Session | null>
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- Various schema tables from `@/db/schema`
- `sendEmail` from `@/lib/services/resend`
- `normalizePhoneNumber` from `@/lib/utils/phone`

## REFACTORING GOALS

1. **Type safety** — Define `Client`, `AdminUser`, `SystemSetting` interfaces
2. **Auth configuration** — Clean up authOptions, type session extensions
3. **Magic link service** — Type token generation and verification
4. **Client CRUD** — Ensure all admin client routes have consistent validation and responses
5. **Setup wizard** — Type wizard step data and state management
6. **Error logging** — Type error log entries, add structured logging
7. **Webhook logging** — Type webhook event entries
8. **Dashboard** — Type agency dashboard data and component props
9. **Slack integration** — Type notification payloads

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Auth session type extended properly
- [ ] Client interfaces defined
- [ ] All admin routes check `isAdmin`
- [ ] All routes use Zod validation
- [ ] Wizard steps typed
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(client-management): ...` format
- [ ] `.refactor-complete` sentinel created
