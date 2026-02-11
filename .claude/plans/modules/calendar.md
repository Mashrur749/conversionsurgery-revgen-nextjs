# Module: calendar
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Calendar integration system — Google Calendar OAuth, event sync, scheduling, and cron-based sync jobs. Allows clients to connect their calendars for appointment visibility.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/calendar-integrations.ts` | `calendarIntegrations` table — OAuth tokens, provider config |
| `src/db/schema/calendar-events.ts` | `calendarEvents` table — synced events |
| `src/app/api/calendar/integrations/route.ts` | GET/POST — list and create calendar integrations |
| `src/app/api/calendar/integrations/[id]/route.ts` | PATCH/DELETE — update and remove integrations |
| `src/app/api/calendar/events/route.ts` | GET/POST — list and create calendar events |
| `src/app/api/calendar/sync/route.ts` | POST — trigger manual calendar sync |
| `src/app/api/auth/callback/google-calendar/route.ts` | GET — Google OAuth callback handler |
| `src/app/api/cron/calendar-sync/route.ts` | GET/POST — cron job for periodic calendar sync |
| `src/components/calendar/calendar-integrations.tsx` | Calendar integration management UI |

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
- `clients` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`

## REFACTORING GOALS

1. **Extract calendar service** — If Google Calendar API logic is inline in routes, extract to a service file within module scope
2. **Add TypeScript interfaces** — Proper types for calendar events, integration config, OAuth tokens
3. **Standardize API routes** — Consistent Zod validation, error handling, async params pattern
4. **Secure OAuth flow** — Ensure callback validates state param, handles errors gracefully
5. **Cron job hardening** — Add proper error handling and logging to calendar-sync cron
6. **Component types** — Typed props for calendar-integrations component

## DONE WHEN

- [ ] All API routes use Zod validation
- [ ] OAuth callback handles error states
- [ ] Cron job has proper error handling
- [ ] No `any` types in module files
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(calendar): ...` format
- [ ] `.refactor-complete` sentinel created
