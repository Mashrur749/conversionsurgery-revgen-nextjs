# Module: lead-management
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Lead tracking, scoring, and management — captures leads from multiple sources, scores them based on conversation history and signals, provides lead detail views and scoring distribution analytics.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/leads.ts` | `leads` table — core lead data |
| `src/db/schema/lead-context.ts` | `leadContext` table — enriched lead context |
| `src/lib/services/lead-scoring.ts` | Lead scoring service (AI + rule-based) |
| `src/app/api/leads/[id]/route.ts` | GET/PATCH — view and update lead |
| `src/app/api/leads/[id]/reply/route.ts` | POST — send reply to lead |
| `src/app/api/leads/[id]/score/route.ts` | GET — get lead score |
| `src/app/api/clients/[id]/leads/scores/route.ts` | GET — all lead scores for client |
| `src/app/(dashboard)/leads/page.tsx` | Leads list page |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Lead detail page |
| `src/components/leads/lead-score-badge.tsx` | Lead score display badge |
| `src/components/leads/lead-score-distribution.tsx` | Score distribution chart |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/lead-scoring.ts
export async function scoreLead(leadId: string, conversationHistory: any[]): Promise<LeadScore>
export function quickScore(messageBody: string): number
export async function scoreClientLeads(clientId: string): Promise<LeadScore[]>
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
- `clients`, `conversations` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`
- `sendSMS` from `@/lib/services/twilio`
- `generateAIResponse` from `@/lib/services/openai`
- `normalizePhoneNumber` from `@/lib/utils/phone`

## REFACTORING GOALS

1. **Type the `any[]` in scoreLead** — Replace `conversationHistory: any[]` with a proper `ConversationMessage[]` type (keep function signature compatible via type widening)
2. **Define LeadScore interface** — If not already typed, create a proper interface
3. **Lead context service** — Clean up lead context enrichment logic
4. **API routes** — Consistent Zod validation, auth checks, error handling
5. **Lead detail page** — Type all props and data fetching
6. **Score visualization** — Ensure lead-score-distribution component is properly typed

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged (function name + param count + return type)
- [ ] LeadScore interface properly defined
- [ ] All API routes use Zod validation
- [ ] Auth checks on all routes
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(lead-management): ...` format
- [ ] `.refactor-complete` sentinel created
