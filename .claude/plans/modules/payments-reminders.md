# Module: payments-reminders
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Payment link generation, invoice tracking, and automated payment/estimate reminders — creates Stripe payment links, tracks invoice status, sends SMS payment reminders, and manages estimate follow-up sequences.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/invoices.ts` | `invoices` table — invoice records |
| `src/db/schema/payments.ts` | `payments` table — payment transactions |
| `src/db/schema/payment-reminders.ts` | `paymentReminders` table — reminder schedule |
| `src/db/schema/revenue-events.ts` | `revenueEvents` table — revenue tracking events |
| `src/lib/services/revenue.ts` | Revenue service (payment links, formatting) |
| `src/lib/automations/payment-reminder.ts` | Payment reminder automation |
| `src/lib/automations/estimate-followup.ts` | Estimate follow-up automation |
| `src/app/api/payments/route.ts` | GET/POST — list and create payments |
| `src/app/api/payments/[id]/send/route.ts` | POST — send payment link via SMS |
| `src/app/api/sequences/payment/route.ts` | POST — trigger payment reminder sequence |
| `src/app/api/sequences/estimate/route.ts` | POST — trigger estimate follow-up sequence |
| `src/components/payments/send-payment-button.tsx` | Send payment link button component |
| `src/app/(dashboard)/admin/clients/[id]/revenue/page.tsx` | Client revenue detail page |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/revenue.ts
export async function createPaymentLink(invoiceId: string, amount: number): Promise<{ url: string }>
export function formatAmount(cents: number): string
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- `src/lib/services/stripe.ts` — belongs to billing-subscriptions module
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads` from `@/db/schema`
- `authOptions` from `@/lib/auth`
- `sendSMS` from `@/lib/services/twilio`
- `renderTemplate` from `@/lib/utils/templates`
- `normalizePhoneNumber` from `@/lib/utils/phone`

## REFACTORING GOALS

1. **Type safety** — Define `Invoice`, `Payment`, `PaymentReminder`, `RevenueEvent` interfaces
2. **Payment link flow** — Type the create → send → track lifecycle
3. **Reminder automation** — Type reminder sequence steps and timing
4. **Estimate follow-up** — Type the follow-up sequence and trigger conditions
5. **Revenue tracking** — Clean up revenue event recording
6. **API routes** — Zod validation, auth checks, consistent error handling
7. **Amount formatting** — Ensure formatAmount handles edge cases (0, negative, large values)

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Invoice/payment types properly defined
- [ ] Reminder automation typed
- [ ] All routes use Zod validation
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(payments-reminders): ...` format
- [ ] `.refactor-complete` sentinel created
