# Module: support-discussions
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Internal support discussion system — threaded conversations between clients and admin, with reply tracking. Allows clients to ask questions and admins to respond.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/support-messages.ts` | `supportMessages` table — discussion threads |
| `src/db/schema/support-replies.ts` | `supportReplies` table — replies to threads |
| `src/app/(dashboard)/discussions/page.tsx` | Client-facing discussions list page |
| `src/app/(dashboard)/discussions/[id]/page.tsx` | Client-facing single discussion thread |
| `src/app/(dashboard)/admin/discussions/page.tsx` | Admin discussions list page |
| `src/app/(dashboard)/admin/discussions/[id]/page.tsx` | Admin single discussion thread with reply |

## FROZEN_EXPORTS

None — this module has no exports consumed by other modules.

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
- `clients`, `users` from `@/db/schema`
- `auth` from `@/lib/auth`

## REFACTORING GOALS

1. **Add TypeScript types** — Create proper interfaces for support messages and replies
2. **Standardize page patterns** — Ensure all 4 pages follow consistent data fetching patterns
3. **Admin auth** — Verify admin pages check `isAdmin` properly
4. **Client scoping** — Verify client pages only show discussions for the logged-in user's client
5. **Component extraction** — If pages have large inline components, extract to dedicated component files (within scope)

## DONE WHEN

- [ ] All pages properly authenticated
- [ ] Admin pages check `isAdmin`
- [ ] Client pages scoped to user's client
- [ ] No `any` types
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(support-discussions): ...` format
- [ ] `.refactor-complete` sentinel created
