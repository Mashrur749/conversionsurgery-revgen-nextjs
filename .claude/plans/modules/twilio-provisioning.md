# Module: twilio-provisioning
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Twilio phone number lifecycle management — search available numbers, purchase, configure webhooks, release, and reassign numbers across clients. Includes the admin Twilio dashboard and phone number management UI.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/lib/services/twilio-provisioning.ts` | Twilio provisioning service (search, purchase, configure, release) |
| `src/app/api/admin/twilio/search/route.ts` | POST — search available phone numbers |
| `src/app/api/admin/twilio/purchase/route.ts` | POST — purchase and assign phone number |
| `src/app/api/admin/twilio/configure/route.ts` | POST — configure webhooks on existing number |
| `src/app/api/admin/twilio/release/route.ts` | POST — release phone number |
| `src/app/api/admin/twilio/account/route.ts` | GET — Twilio account balance and info |
| `src/app/api/admin/phone-numbers/reassign/route.ts` | POST — reassign number between clients |
| `src/app/(dashboard)/admin/twilio/page.tsx` | Admin Twilio dashboard |
| `src/app/(dashboard)/admin/phone-numbers/page.tsx` | Phone number management console |
| `src/app/(dashboard)/admin/clients/[id]/phone/page.tsx` | Client phone assignment page |
| `src/app/(dashboard)/admin/clients/[id]/phone/phone-number-manager.tsx` | Phone number manager component |

## FROZEN_EXPORTS

None — this module has no exports consumed by other modules.

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
- `clients` from `@/db/schema`
- `authOptions` from `@/lib/auth`
- `normalizePhoneNumber` from `@/lib/utils/phone`

## REFACTORING GOALS

1. **Type safety** — Add interfaces for search results, purchase requests, account info
2. **Mock number handling** — Clean up development mock number logic, make it configurable
3. **Error handling** — Improve error messages from Twilio API failures
4. **API consistency** — Ensure all 7 admin routes use consistent Zod validation and auth checks
5. **Component cleanup** — Type the phone number manager component props and state
6. **Webhook configuration** — Document and type the webhook URL configuration logic

## DONE WHEN

- [ ] All admin routes check `isAdmin`
- [ ] All routes use Zod validation
- [ ] Twilio provisioning service fully typed
- [ ] Mock number fallback works in development
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(twilio-provisioning): ...` format
- [ ] `.refactor-complete` sentinel created
