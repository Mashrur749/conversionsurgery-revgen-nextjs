# Module: client-portal
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Client-facing portal — the dashboard layout, lead management views, conversation views, escalation views, settings, and client-side API routes. This is the UI layer that clients interact with after logging in.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/app/(dashboard)/layout.tsx` | Dashboard layout (sidebar nav, auth wrapper) |
| `src/app/api/client/conversations/[id]/send/route.ts` | POST — send message (shared with conversation-messaging) |
| `src/app/api/client/conversations/[id]/takeover/route.ts` | POST — human takeover (shared) |
| `src/app/api/client/conversations/[id]/handback/route.ts` | POST — hand back to AI (shared) |
| `src/app/api/client/leads/[id]/suggestions/route.ts` | GET — AI suggestions (shared with ai-agent) |
| `src/app/api/client/notifications/route.ts` | GET — notification preferences (shared) |
| `src/app/api/client/settings/summary/route.ts` | GET — settings summary (shared) |
| `src/app/api/client/cancel/route.ts` | POST — cancellation request (shared) |
| `src/app/(dashboard)/leads/page.tsx` | Leads list page |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Lead detail page |
| `src/app/(dashboard)/conversations/page.tsx` | Conversations page |
| `src/app/(dashboard)/escalations/page.tsx` | Escalations list page |
| `src/app/(dashboard)/escalations/[id]/page.tsx` | Escalation detail page |
| `src/app/(dashboard)/settings/page.tsx` | Client settings page |

**NOTE:** Several API routes in this module's manifest are shared with other modules. This module focuses on the **UI pages and layout** — the routes are listed for context but may already be handled by their primary module. Focus on the pages and layout.

## FROZEN_EXPORTS

None — this module has no exports consumed by other modules.

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above. **Primary focus**: layout.tsx and the page.tsx files.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- Various schema tables from `@/db/schema`
- `auth` from `@/lib/auth`
- Various services for data fetching in server components

## REFACTORING GOALS

1. **Layout cleanup** — Ensure dashboard layout has proper navigation structure, typed sidebar items
2. **Auth wrapper** — Verify all client pages redirect unauthenticated users
3. **Client scoping** — Ensure all client pages only show data for the authenticated user's client
4. **Page consistency** — Standardize data fetching patterns across all client-facing pages
5. **Component extraction** — If pages have large inline components, extract to dedicated files
6. **Navigation typing** — Type sidebar navigation items and admin/client role-based visibility
7. **Settings page** — Type settings form data and state

## DONE WHEN

- [ ] Dashboard layout properly handles auth redirect
- [ ] All client pages scoped to user's client
- [ ] Navigation typed with role-based visibility
- [ ] Pages use consistent data fetching patterns
- [ ] No `any` types in page files
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(client-portal): ...` format
- [ ] `.refactor-complete` sentinel created
