# Module: voice-hot-transfer
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Voice call handling and hot transfer system — manages inbound calls via Twilio, AI-powered call screening, ring group routing to team members, call transfer, and call history tracking.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/voice-calls.ts` | `voiceCalls` table — call records |
| `src/db/schema/active-calls.ts` | `activeCalls` / `activeCallsArchive` tables — in-progress calls |
| `src/db/schema/call-attempts.ts` | `callAttempts` table — ring attempts to team members |
| `src/lib/services/hot-transfer.ts` | Hot transfer routing logic |
| `src/lib/services/ring-group.ts` | Ring group initiation and management |
| `src/lib/services/voice-summary.ts` | Post-call summary generation |
| `src/app/api/webhooks/twilio/voice/route.ts` | POST — inbound voice webhook |
| `src/app/api/webhooks/twilio/voice/ai/route.ts` | POST — AI voice handler |
| `src/app/api/webhooks/twilio/voice/ai/gather/route.ts` | POST — AI voice gather input |
| `src/app/api/webhooks/twilio/voice/ai/transfer/route.ts` | POST — AI voice transfer |
| `src/app/api/webhooks/twilio/voice/ai/dial-complete/route.ts` | POST — dial completion handler |
| `src/app/api/webhooks/twilio/ring-connect/route.ts` | POST — ring group connect webhook |
| `src/app/api/webhooks/twilio/member-answered/route.ts` | POST — member answered webhook |
| `src/app/api/webhooks/twilio/ring-result/route.ts` | POST — ring attempt result webhook |
| `src/app/api/webhook/ring-group/route.ts` | POST — ring group webhook (legacy?) |
| `src/app/api/admin/clients/[id]/voice-calls/route.ts` | GET — voice calls for client |
| `src/app/(dashboard)/admin/voice-ai/page.tsx` | Voice AI admin dashboard |
| `src/components/voice/call-history.tsx` | Call history component |
| `src/components/settings/voice-settings.tsx` | Voice settings component |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/hot-transfer.ts
export async function routeHighIntentLead(
  callSid: string,
  clientId: string,
  leadId: string
): Promise<{ transferred: boolean; teamMemberId?: string }>

// From src/lib/services/ring-group.ts
export async function initiateRingGroup(
  clientId: string,
  callSid: string,
  leadPhone: string
): Promise<{ initiated: boolean; attempts: number }>
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- `src/lib/services/twilio.ts` — belongs to conversation-messaging module
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads`, `teamMembers`, `businessHours` from `@/db/schema`
- `authOptions` from `@/lib/auth`
- `sendSMS` from `@/lib/services/twilio`
- `isWithinBusinessHours` from `@/lib/services/business-hours`
- `generateAIResponse`, `detectHotIntent` from `@/lib/services/openai`
- `normalizePhoneNumber` from `@/lib/utils/phone`

## REFACTORING GOALS

1. **Type safety** — Define `VoiceCall`, `ActiveCall`, `CallAttempt`, `RingGroupResult` interfaces
2. **Webhook handlers** — Ensure all Twilio webhooks validate signatures
3. **Call state machine** — Type the call lifecycle (incoming → screening → transfer → connected → completed)
4. **Ring group logic** — Type the sequential/simultaneous ring strategies
5. **Voice summary** — Type the post-call summary data structure
6. **Error handling** — Robust TwiML error responses for webhook failures
7. **Legacy cleanup** — Determine if `/webhook/ring-group` and `/webhooks/twilio/ring-connect` are duplicates

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Call lifecycle states fully typed
- [ ] Webhook signature validation present
- [ ] TwiML error handling robust
- [ ] All admin routes check `isAdmin`
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(voice-hot-transfer): ...` format
- [ ] `.refactor-complete` sentinel created
