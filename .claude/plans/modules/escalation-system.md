# Module: escalation-system
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Lead escalation management — creates and tracks escalation events when leads need human attention, manages claim queues for team members, enforces SLA breach detection, and provides escalation dashboard UI.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/escalation-claims.ts` | `escalationClaims` table — team member claims on escalations |
| `src/db/schema/escalation-queue.ts` | `escalationQueue` table — pending escalation items |
| `src/db/schema/escalation-rules.ts` | `escalationRules` table — escalation trigger rules |
| `src/lib/services/escalation.ts` | Escalation creation, SLA checking service |
| `src/app/api/escalations/route.ts` | GET/POST — list and create escalations |
| `src/app/api/claims/route.ts` | GET/POST — list and create claims |
| `src/app/api/claims/claim/route.ts` | POST — claim an escalation |
| `src/app/api/claim/route.ts` | POST — alternative claim endpoint |
| `src/app/(dashboard)/escalations/page.tsx` | Escalation queue dashboard |
| `src/app/(dashboard)/escalations/[id]/page.tsx` | Escalation detail page |
| `src/components/escalations/escalation-queue.tsx` | Escalation queue component |
| `src/components/escalations/escalation-detail.tsx` | Escalation detail component |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/escalation.ts
export async function createEscalation(
  leadId: string,
  conversationId: string,
  reason: string,
  urgency: 'low' | 'medium' | 'high' | 'critical'
): Promise<{ id: string }>

export async function checkSlaBreaches(): Promise<{ breached: number; notified: number }>
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- `src/lib/services/team-escalation.ts` — belongs to team-hours module
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads`, `conversations`, `teamMembers` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`
- `notifyTeamForEscalation` from `@/lib/services/team-escalation`
- `sendEmail` from `@/lib/services/resend`

## REFACTORING GOALS

1. **Type safety** — Define `Escalation`, `EscalationClaim`, `EscalationRule` interfaces
2. **Urgency enum** — Type the urgency levels consistently across service and routes
3. **SLA logic** — Clean up SLA breach detection with proper time calculations
4. **Claim workflow** — Type the claim lifecycle (pending → claimed → resolved)
5. **Consolidate claim routes** — If `/claims/claim` and `/claim` are duplicates, document which is canonical
6. **Dashboard components** — Type escalation queue and detail component props
7. **API consistency** — Zod validation on all routes, proper auth

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Urgency and status types properly defined
- [ ] SLA logic documented and typed
- [ ] All routes use Zod validation
- [ ] Auth checks on all routes
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(escalation-system): ...` format
- [ ] `.refactor-complete` sentinel created
