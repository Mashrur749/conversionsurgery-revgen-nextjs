# Module: automation-engine
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Core automation handlers — missed call handling, form submission processing, and review request automation. These are the entry-point automations triggered by webhooks (distinct from incoming-sms.ts which is FROZEN).

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/lib/automations/missed-call.ts` | Missed call automation handler |
| `src/lib/automations/form-response.ts` | Form submission automation handler |
| `src/lib/automations/review-request.ts` | Review request automation |
| `src/app/api/sequences/review/route.ts` | POST — trigger review request sequence |
| `src/app/api/client/settings/summary/route.ts` | GET — client settings summary |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/automations/missed-call.ts
export async function handleMissedCall(payload: {
  To: string;
  From: string;
  CallSid: string;
  CallStatus: string;
}): Promise<void>

// From src/lib/automations/form-response.ts
export async function handleFormSubmission(payload: {
  clientId: string;
  formData: Record<string, any>;
  source: string;
}): Promise<void>
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
- `clients`, `leads`, `conversations`, `scheduledMessages`, `dailyStats` from `@/db/schema`
- `sendSMS` from `@/lib/services/twilio`
- `sendEmail` from `@/lib/services/resend`
- `generateAIResponse` from `@/lib/services/openai`
- `scoreLead`, `quickScore` from `@/lib/services/lead-scoring`
- `normalizePhoneNumber` from `@/lib/utils/phone`
- `renderTemplate` from `@/lib/utils/templates`
- `isWithinBusinessHours` from `@/lib/services/business-hours`
- `routeHighIntentLead` from `@/lib/services/hot-transfer`
- `trackUsage` from `@/lib/services/usage-tracking`
- `authOptions` from `@/lib/auth`

## REFACTORING GOALS

1. **Type safety** — Improve payload types for missed-call and form-response handlers
2. **Error handling** — Robust try/catch in automation handlers, log failures without crashing
3. **Missed call flow** — Document and type the full missed call → lead creation → response chain
4. **Form submission flow** — Type form data parsing and lead creation logic
5. **Review request** — Type review request trigger and sequence
6. **Settings summary** — Type the client settings summary response

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Automation handlers have proper error handling
- [ ] Missed call flow documented and typed
- [ ] Form submission typed
- [ ] All routes use Zod validation
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(automation-engine): ...` format
- [ ] `.refactor-complete` sentinel created
