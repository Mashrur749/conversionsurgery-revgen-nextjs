# SPEC-07: Unlimited Messaging Parity

## Goal
Align the application with the sold promise for Professional managed-service clients:
- unlimited lead conversations
- no message caps
- no overage charges

## Why This Matters
This is a client-facing pricing promise. Any hard limit or overage invoice creates immediate trust and billing disputes.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Centralized compliant send gateway in `src/lib/compliance/compliance-gateway.ts`.
- Usage and cost monitoring in `src/lib/services/usage-tracking.ts` and `src/lib/services/usage-alerts.ts`.
- Plan/subscription sync flow in `src/lib/services/subscription.ts`.

### Misaligned behavior to change
- Message blocking at `monthlyMessageLimit` in `src/lib/compliance/compliance-gateway.ts`.
- Scheduled send skip when limit reached in `src/app/api/cron/process-scheduled/route.ts`.
- Overage invoicing in `src/lib/services/overage-billing.ts` and `src/app/api/cron/monthly-reset/route.ts`.
- Plan seeds still include message caps/overage pricing for sold path in `scripts/seed.ts` and `src/db/seeds/plans.ts`.

## Target State
- Professional plan clients are not blocked by message or lead caps.
- No overage invoice items are generated for Professional plan usage.
- Internal usage/cost alerts remain active for margin and anomaly control.
- Enterprise can keep separate limits if desired.

## Work Units (Tiny, Executable)
### Milestone A: Domain flags and plan policy
1. Add feature policy flags on plan features:
- `isUnlimitedMessaging`
- `isUnlimitedLeads`
- `chargesOverage`
2. Add resolver helper in `src/lib/services/subscription.ts`:
- `getClientUsagePolicy(clientId)`
3. Update seed data so Professional is unlimited and overage-disabled.

Refactor checkpoint A:
- Extract all usage-limit decisions into one shared module (no duplicated limit logic in routes/services).

### Milestone B: Runtime enforcement alignment
1. Update `sendCompliantMessage()` to skip message-limit block when policy is unlimited.
2. Update `process-scheduled` limit checks to respect usage policy.
3. Keep monthly counter incrementing for observability, but do not block sends for unlimited policy.

Refactor checkpoint B:
- Remove direct `monthlyMessageLimit` comparisons from route handlers; use policy helper only.

### Milestone C: Billing alignment
1. Update `applyMonthlyOverages()` to no-op for overage-disabled plans.
2. Update monthly reset response payload to clearly indicate overage skipped by policy.
3. Ensure no stale overage line items are created for Professional clients.

Refactor checkpoint C:
- Move overage eligibility checks into a dedicated `billing-policy` helper.

### Milestone D: UI and operator alignment
1. Update billing/usage UI to show "Unlimited" instead of numeric cap for Professional.
2. Remove/disable overage estimate copy for unlimited clients.
3. Keep internal usage alerts in admin/ops tools.

Refactor checkpoint D:
- Centralize display formatting for limits/usage in one UI util.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove Professional plan overage defaults from seeds and admin plan defaults.
- Remove Professional-specific cap warning copy in client/admin dashboards.
- Remove any test fixtures asserting Professional message cap behavior.

## Testing & Acceptance
### Automated
1. Unit test: unlimited policy bypasses compliance message-limit block.
2. Unit test: monthly overage invoicing skips unlimited plans.
3. Regression test: capped plans still enforce limits (if retained for other tiers).

### Manual
1. Professional client > previous cap threshold can still send/respond.
2. Monthly reset does not create overage invoice items for Professional.
3. Usage/cost alerts still fire internally when thresholds are exceeded.

## Definition of Done
- No cap-based message blocks for Professional clients.
- No overage line items for Professional clients.
- Internal monitoring preserved.
- Docs updated: offer parity + testing guide + operations guide.
