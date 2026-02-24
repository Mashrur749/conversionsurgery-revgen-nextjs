# SPEC-16: Add-On Billing Transparency Parity

## Goal
Make add-on pricing fully transparent and traceable for paying clients:
- additional team members
- additional phone numbers
- optional voice AI usage

## Why This Matters
Offer claims transparent add-on billing. Hidden or unclear charges are a direct CX failure and churn driver.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Team member and number limit enforcement APIs:
- `src/app/api/team-members/route.ts`
- `src/app/api/admin/twilio/purchase/route.ts`
- Usage tracking foundation in `src/lib/services/usage-tracking.ts`.

### Misaligned behavior to change
- End-to-end invoice line-item clarity is incomplete.
- Voice usage visibility exists internally but not clearly productized in client billing UX.

## Target State
- Each add-on has explicit pricing metadata and billable event records.
- Invoices show clear itemized lines tied to usage/events.
- Client can audit each charge inside account UI.

## Work Units (Tiny, Executable)
### Milestone A: Billing catalog normalization
1. Define add-on price catalog keys (`extra_team_member`, `extra_number`, `voice_minutes`).
2. Add effective-date support for pricing revisions.
3. Add resolver `getAddonPricing(clientId, date)`.

Refactor checkpoint A:
- Remove hard-coded add-on amounts from route handlers.

### Milestone B: Billable event ledger
1. Create billable event entity with:
- `addonType`
- `quantity`
- `unitPrice`
- `sourceRef`
- `period`
2. Emit events for team seat over base, number purchases, and voice usage rollups.
3. Add idempotency keys to prevent duplicate billing events.

Refactor checkpoint B:
- Route all add-on billing through one ledger writer service.

### Milestone C: Invoice itemization + UI
1. Convert ledger events into invoice line items with clear labels.
2. Add billing UI section for add-on breakdown per cycle.
3. Add downloadable CSV detail for add-on events.

Refactor checkpoint C:
- Use shared formatter for labels, units, and currency.

### Milestone D: Dispute and support traceability
1. Link each invoice line to underlying event rows.
2. Add operator view for charge provenance.
3. Add basic dispute annotation workflow.

Refactor checkpoint D:
- Reuse existing billing support notes model where possible.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove generic "extra usage" labels without add-on type detail.
- Remove duplicate manual reconciliation scripts if ledger becomes source of truth.
- Remove stale docs that mention non-itemized add-on billing.

## Testing & Acceptance
### Automated
1. Team member add-on generates correct monthly event(s).
2. Number purchase generates correct recurring event.
3. Voice usage rollup generates correct per-minute charge events.

### Manual
1. Client invoice shows itemized add-on charges with units and dates.
2. Billing page provides per-item detail that matches invoice totals.
3. Support can trace any charge to concrete source events.

## Definition of Done
- Add-on billing is transparent, itemized, and auditable from product UI.
