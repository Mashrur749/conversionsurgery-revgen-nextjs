# Module: team-hours
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Team member management and business hours configuration — defines who works for each client, when they're available, and provides the scheduling logic used by escalation and routing systems.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/team-members.ts` | `teamMembers` table — staff per client |
| `src/db/schema/business-hours.ts` | `businessHours` table — operating hours per client |
| `src/lib/services/business-hours.ts` | Business hours check/init service |
| `src/lib/services/team-escalation.ts` | Team notification for escalation events |
| `src/app/api/team-members/route.ts` | GET/POST — list and add team members |
| `src/app/api/team-members/[id]/route.ts` | PATCH/DELETE — update and remove members |
| `src/app/api/business-hours/route.ts` | PUT — update business hours for client |
| `src/app/(dashboard)/settings/page.tsx` | Client settings page (includes hours config) |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/business-hours.ts
export async function isWithinBusinessHours(clientId: string): Promise<boolean>
export async function initializeBusinessHours(clientId: string): Promise<void>

// From src/lib/services/team-escalation.ts
export async function notifyTeamForEscalation(
  clientId: string,
  lead: { name: string; phone: string },
  conversation: { id: string },
  urgency: 'low' | 'medium' | 'high' | 'critical'
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
- `sendSMS` from `@/lib/services/twilio`
- `sendEmail` from `@/lib/services/resend`

## REFACTORING GOALS

1. **Type safety** — Add interfaces for team member roles, business hours config, timezone handling
2. **Business hours service** — Clean up timezone logic, ensure DST handling is documented
3. **Team escalation** — Add proper typing for notification channels and urgency levels
4. **API routes** — Consistent Zod validation, proper auth checks, async params
5. **Settings page** — Ensure business hours UI properly handles all 7 days and timezone display

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Timezone handling documented and typed
- [ ] All API routes use Zod validation
- [ ] Team members CRUD fully typed
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(team-hours): ...` format
- [ ] `.refactor-complete` sentinel created
