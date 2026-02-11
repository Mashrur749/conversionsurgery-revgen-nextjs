# Module: notifications
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Notification preferences and email delivery — manages per-client notification settings and provides the email sending infrastructure used across the platform.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/notification-preferences.ts` | `notificationPreferences` table |
| `src/lib/services/notification-preferences.ts` | Notification preferences CRUD service |
| `src/app/api/client/notifications/route.ts` | GET — fetch notification preferences for client |
| `src/lib/services/resend.ts` | Email sending service via Resend API |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/resend.ts
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ id: string }>

export async function actionRequiredEmail(
  to: string,
  subject: string,
  data: { clientName: string; leadName: string; leadPhone: string; reason: string; dashboardUrl: string }
): Promise<void>
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
- `clients` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`

## REFACTORING GOALS

1. **Type safety** — Add interfaces for notification preference types, email options
2. **Resend service cleanup** — Ensure consistent error handling, retry logic documentation
3. **Notification preferences** — Standardize the preference schema and service API
4. **API route cleanup** — Zod validation, proper auth, consistent response format

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] All files have proper TypeScript types
- [ ] Notification API route authenticated
- [ ] Resend service has proper error handling
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(notifications): ...` format
- [ ] `.refactor-complete` sentinel created
