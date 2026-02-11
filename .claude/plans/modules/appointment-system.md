# Module: appointment-system
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Appointment scheduling and reminders — manages appointment records, sends reminder sequences, and handles cancellation flows.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/appointments.ts` | `appointments` table — appointment records |
| `src/lib/automations/appointment-reminder.ts` | Appointment reminder automation sequence |
| `src/app/api/sequences/appointment/route.ts` | POST — trigger appointment reminder sequence |
| `src/app/api/sequences/cancel/route.ts` | POST — trigger cancellation sequence |

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
- `clients`, `leads`, `scheduledMessages` from `@/db/schema`
- `sendSMS` from `@/lib/services/twilio`
- `renderTemplate` from `@/lib/utils/templates`

## REFACTORING GOALS

1. **Type safety** — Define `Appointment` interface with proper status enum
2. **Reminder automation** — Type the reminder sequence steps and timing
3. **Sequence routes** — Add Zod validation for sequence trigger payloads
4. **Cancellation flow** — Ensure cancellation properly cleans up scheduled messages
5. **Error handling** — Robust error handling in appointment-reminder automation

## DONE WHEN

- [ ] Appointment types properly defined
- [ ] Reminder sequence typed and documented
- [ ] Sequence routes use Zod validation
- [ ] Error handling in automations
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(appointment-system): ...` format
- [ ] `.refactor-complete` sentinel created
