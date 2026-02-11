# Module: billing-subscriptions
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Stripe billing and subscription management — subscription plans, payment methods, invoicing, usage records, billing events, coupons, cancellation requests, and the Stripe webhook handler. Self-contained billing domain.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/billing-enums.ts` | Billing-related enum types |
| `src/db/schema/plans.ts` | `plans` table — available subscription plans |
| `src/db/schema/subscriptions.ts` | `subscriptions` table — active subscriptions |
| `src/db/schema/subscription-plans.ts` | `subscriptionPlans` table — plan configuration |
| `src/db/schema/billing-payment-methods.ts` | `billingPaymentMethods` table |
| `src/db/schema/subscription-invoices.ts` | `subscriptionInvoices` table |
| `src/db/schema/usage-records.ts` | `usageRecords` table — metered usage for billing |
| `src/db/schema/billing-events.ts` | `billingEvents` table — billing event log |
| `src/db/schema/coupons.ts` | `coupons` table — discount codes |
| `src/db/schema/cancellation-requests.ts` | `cancellationRequests` table |
| `src/lib/services/stripe.ts` | Stripe SDK integration service |
| `src/lib/services/subscription.ts` | Subscription lifecycle management |
| `src/lib/services/payment-methods.ts` | Payment method CRUD |
| `src/lib/services/subscription-invoices.ts` | Invoice management |
| `src/lib/services/cancellation.ts` | Cancellation workflow |
| `src/app/api/webhooks/stripe/route.ts` | POST — Stripe webhook handler |
| `src/app/api/admin/billing/subscriptions/route.ts` | GET — list all subscriptions (admin) |
| `src/app/api/client/cancel/route.ts` | POST — client cancellation request |
| `src/app/(dashboard)/admin/billing/page.tsx` | Admin billing dashboard |
| `src/components/billing/CancelSubscriptionDialog.tsx` | Cancel subscription dialog |
| `src/components/billing/PauseSubscriptionDialog.tsx` | Pause subscription dialog |
| `src/components/billing/SubscriptionCard.tsx` | Subscription info card |
| `src/components/billing/AddPaymentMethodDialog.tsx` | Add payment method dialog |
| `src/components/billing/PaymentMethodCard.tsx` | Payment method display card |
| `src/components/billing/InvoiceList.tsx` | Invoice list component |
| `src/components/billing/PlanSelector.tsx` | Plan selection component |
| `src/components/billing/UsageDisplay.tsx` | Usage display component |
| `src/components/admin/billing/RevenueChart.tsx` | Admin revenue chart |
| `src/components/admin/billing/AdminSubscriptionTable.tsx` | Admin subscriptions table |

## FROZEN_EXPORTS

None — this module is self-contained with no exports consumed by other modules.

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- `src/lib/services/revenue.ts` — belongs to payments-reminders module
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`
- `sendEmail` from `@/lib/services/resend`

## REFACTORING GOALS

1. **Type safety** — Define `Subscription`, `Plan`, `BillingEvent`, `Invoice`, `Coupon` interfaces
2. **Stripe service** — Type all Stripe API interactions, handle webhook event types
3. **Subscription lifecycle** — Type states (trial → active → paused → cancelled → expired)
4. **Webhook handler** — Ensure signature verification, type all handled event types
5. **Payment methods** — Type Stripe payment method data structures
6. **Cancellation flow** — Type the request → review → process workflow
7. **Component types** — Type all billing component props
8. **Coupon system** — Type coupon validation and application logic

## DONE WHEN

- [ ] Subscription lifecycle states typed
- [ ] Stripe webhook signature verification present
- [ ] All handled Stripe event types documented
- [ ] All admin routes check `isAdmin`
- [ ] All billing components typed
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(billing-subscriptions): ...` format
- [ ] `.refactor-complete` sentinel created
