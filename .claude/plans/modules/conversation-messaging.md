# Module: conversation-messaging
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Core messaging infrastructure — Twilio SMS send/receive, phone number normalization, message template rendering, conversation state management, blocked number handling, and webhook processing.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/conversations.ts` | `conversations` table — SMS conversation threads |
| `src/db/schema/blocked-numbers.ts` | `blockedNumbers` table — opt-out number list |
| `src/lib/services/twilio.ts` | Core Twilio SMS service (send, track, validate) |
| `src/lib/utils/phone.ts` | Phone number utilities (normalize, format) |
| `src/lib/utils/templates.ts` | Message template rendering |
| `src/app/api/client/conversations/[id]/send/route.ts` | POST — send message in conversation |
| `src/app/api/client/conversations/[id]/takeover/route.ts` | POST — human takeover of AI conversation |
| `src/app/api/client/conversations/[id]/handback/route.ts` | POST — hand conversation back to AI |
| `src/app/api/webhooks/twilio/sms/route.ts` | POST — incoming SMS webhook |
| `src/app/api/webhooks/form/route.ts` | POST — form submission webhook |
| `src/app/(dashboard)/conversations/page.tsx` | Conversations list page |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/twilio.ts
export async function sendSMS(to: string, body: string, from: string): Promise<string>
export async function sendTrackedSMS(to: string, body: string, from: string, metadata: Record<string, any>): Promise<string>
export function validateTwilioWebhook(request: Request): boolean

// From src/lib/utils/phone.ts
export function normalizePhoneNumber(phone: string): string
export function formatPhoneNumber(phone: string): string

// From src/lib/utils/templates.ts
export function renderTemplate(template: string, data: Record<string, any>): string
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN (imports from this module but is off-limits)
- `src/lib/services/twilio-provisioning.ts` — belongs to twilio-provisioning module
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads`, `scheduledMessages`, `dailyStats` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`
- `trackUsage` from `@/lib/services/usage-tracking`

## REFACTORING GOALS

1. **Type safety** — Define `Conversation`, `ConversationMessage`, `BlockedNumber` interfaces
2. **Twilio service** — Type all Twilio API responses, message SID handling
3. **Phone utils** — Ensure normalizePhoneNumber handles all edge cases (international, with/without +1)
4. **Template rendering** — Type template variable definitions, add validation for missing variables
5. **Webhook security** — Ensure Twilio webhook signature validation is robust
6. **Conversation state** — Type conversation states (ai_active, human_takeover, paused, closed)
7. **API routes** — Zod validation, auth checks, consistent error handling
8. **Form webhook** — Type the form submission payload

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Conversation states fully typed
- [ ] Twilio webhook validation robust
- [ ] Phone utilities handle all edge cases
- [ ] Template rendering typed
- [ ] All routes use Zod validation
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(conversation-messaging): ...` format
- [ ] `.refactor-complete` sentinel created
