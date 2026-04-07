# Feature Plan: Phone Number Data Model Consolidation

> **Created:** 2026-04-07
> **Status:** Complete
> **Slices:** 3

## Overview

Two data stores exist for client phone numbers:
1. `clients.twilioNumber` — a VARCHAR column on the clients table, used by 52 files as the source of truth for "this client's phone number"
2. `client_phone_numbers` — a junction table added later for multi-number support, used by 10 files (phone manager UI, billing ledger, purchase flow)

The phone manager UI reads from the junction table. The wizard and 50+ services/automations/webhooks read/write `clients.twilioNumber`. They drift apart: assigning a number via the wizard populates the column but not the table, so the phone manager shows "no business lines."

### Decision: `clients.twilioNumber` stays as the primary read column

**Why not migrate everything to the junction table?**
- 52 files read `clients.twilioNumber` — touching all of them is high-risk for a running pre-launch system
- The column is a fast, indexed, single-value lookup — perfect for the 95% case (one number per client)
- Inbound webhooks resolve client by `WHERE twilioNumber = ?` — this must stay fast and simple

**Strategy: make `client_phone_numbers` the write authority, `clients.twilioNumber` a sync'd cache**
- All writes go through `client-phone-management.ts` service functions
- The service syncs `clients.twilioNumber` to the primary number (it already does this)
- Existing 50+ readers of `clients.twilioNumber` need zero changes
- The wizard and provisioning code call the service instead of writing the column directly

This is a data flow fix, not a schema migration. No new tables, no dropped columns, no migration SQL.

## Success Criteria

1. Assigning a number via the setup wizard populates both `clients.twilioNumber` AND `client_phone_numbers`
2. Purchasing a number populates both (already works — verify only)
3. Phone manager page shows the correct number for wizard-onboarded clients
4. All number writes flow through `client-phone-management.ts` (single write path)
5. No behavior change for the 50+ files that read `clients.twilioNumber`
6. `npm run quality:no-regressions` passes
7. No schema migration needed

---

## Slices

### Slice 0: Centralize write paths in client-phone-management service
> **Branch:** `feature/phone-consolidation/slice-0`
> **Dependencies:** None
> **Status:** ⬜ Not Started

**What:** Make `client-phone-management.ts` the single write authority for phone number assignment. Update `twilio-provisioning.ts` to call the service instead of writing `clients.twilioNumber` directly. Remove the duplicate junction-table insert I added earlier in this session from `assignExistingNumber`.

**Scope:**
- `src/lib/services/twilio-provisioning.ts` — remove direct `clients.twilioNumber` writes from `purchaseNumber()` and `assignExistingNumber()`, replace with calls to `addNumber()` from client-phone-management
- `src/lib/services/client-phone-management.ts` — ensure `addNumber()` handles the sync (it already does lines 63-68), verify `removeNumber()` and `setPrimary()` sync correctly (they do)
- `src/app/api/admin/phone-numbers/reassign/route.ts` — update to use service functions instead of direct column writes

**Files NOT touched:** All 50+ reader files. They continue reading `clients.twilioNumber` unchanged.

**Contract:**
- Produces: single write path through `addNumber()` / `removeNumber()` / `setPrimary()`
- Consumes: existing `client-phone-management.ts` API (no new functions needed)

**Key changes in `twilio-provisioning.ts`:**

`purchaseNumber()` currently:
1. Writes `clients.twilioNumber` directly (line 186-192)
2. Inserts into `client_phone_numbers` (line 211-234)
3. Syncs milestones

After:
1. Calls `addNumber(clientId, phoneNumber, { isPrimary: true, friendlyName: ... })`  — this handles both the junction insert AND the `clients.twilioNumber` sync
2. Syncs milestones (unchanged)
3. Remove the direct DB writes for both column and junction table

`assignExistingNumber()` currently:
1. Writes `clients.twilioNumber` directly (line 283-291)
2. Has the junction-table insert I added earlier in this session
3. Syncs milestones

After:
1. Calls `addNumber(clientId, phoneNumber, { isPrimary: true, friendlyName: ... })`
2. Syncs milestones (unchanged)
3. Remove both direct writes

**Done when:**
- [ ] `purchaseNumber()` uses `addNumber()` instead of direct writes
- [ ] `assignExistingNumber()` uses `addNumber()` instead of direct writes
- [ ] Reassign route uses `removeNumber()` + `addNumber()` instead of direct column writes
- [ ] No file directly writes `clients.twilioNumber` except `client-phone-management.ts`
- [ ] `npm run typecheck` passes
- [ ] `npm run quality:no-regressions` passes

---

### Slice 1: Fix phone manager to show primary number from any source
> **Branch:** `feature/phone-consolidation/slice-1`
> **Dependencies:** Slice 0
> **Status:** ⬜ Not Started

**What:** Handle the edge case where existing clients have `clients.twilioNumber` set but no row in `client_phone_numbers` (data from before this fix). Add a backfill-on-read pattern: when the phone manager loads and finds no numbers in the junction table but `clients.twilioNumber` exists, auto-insert a row.

**Scope:**
- `src/app/api/admin/clients/[id]/phone-numbers/route.ts` — GET handler: if junction table returns empty but client has `twilioNumber`, call `addNumber()` to backfill, then return the result
- `src/lib/services/client-phone-management.ts` — add `ensurePrimaryNumberSynced(clientId)` helper that checks and backfills if needed

**Contract:**
- Produces: `ensurePrimaryNumberSynced()` — idempotent backfill function
- Consumes: `addNumber()` from Slice 0, `clients.twilioNumber` for the source value

**Done when:**
- [ ] Phone manager shows the correct number for clients onboarded before this fix
- [ ] Backfill is idempotent (calling twice doesn't create duplicates — `onConflictDoUpdate` handles this)
- [ ] `npm run typecheck` passes
- [ ] `npm run quality:no-regressions` passes

---

### Slice 2: Cleanup and verification
> **Branch:** `feature/phone-consolidation/slice-2`
> **Dependencies:** Slice 0, Slice 1
> **Status:** ⬜ Not Started

**What:** Verify no direct writes to `clients.twilioNumber` remain outside the service. Remove the `clients.twilioNumber` column from any direct-write UPDATE queries that shouldn't be there (e.g., the admin client PATCH route). Update the `findClientByPhoneNumber()` function to prefer junction table but keep the column fallback. Update docs.

**Scope:**
- `src/app/api/admin/clients/[id]/route.ts` — remove `twilioNumber` from the PATCH schema (it should not be directly settable; number changes go through the phone management flow)
- `src/lib/services/client-phone-management.ts` — verify `findClientByPhoneNumber()` fallback chain is correct
- `docs/product/PLATFORM-CAPABILITIES.md` — update phone management section to document single write path
- `docs/engineering/01-TESTING-GUIDE.md` — add test step for phone assignment flow

**Verification (not code changes):**
- Grep for `\.set\(.*twilioNumber` and `.update(clients).set(.*twilioNumber` — confirm only `client-phone-management.ts` writes this column
- Grep for `insert(clientPhoneNumbers)` — confirm only `client-phone-management.ts` writes this table

**Done when:**
- [ ] Only `client-phone-management.ts` writes to `clients.twilioNumber` (grep verified)
- [ ] Only `client-phone-management.ts` writes to `client_phone_numbers` (grep verified)
- [ ] Admin PATCH route does not allow direct `twilioNumber` updates
- [ ] Docs updated
- [ ] `npm run quality:no-regressions` passes

---

## Merge Order

```
Slice 0 (centralize writes) → Slice 1 (backfill-on-read) → Slice 2 (cleanup + docs)
```

Each slice is independently deployable — Slice 0 fixes the forward path (new clients), Slice 1 fixes existing data, Slice 2 hardens the invariant.

## Risks

- **Existing clients with orphaned data:** Clients onboarded before this fix have `clients.twilioNumber` but no `client_phone_numbers` row. Slice 1's backfill-on-read handles this without a data migration.
- **Twilio provisioning failure partway:** If `addNumber()` succeeds (junction + column) but milestone sync fails, the number is still correctly assigned. Milestone sync is already fire-and-forget with `.catch()`.
- **Status column side effect:** `assignExistingNumber()` currently sets `status: 'active'` in the same UPDATE that sets `twilioNumber`. After refactoring, we still need to set status — this must be kept as a separate update in `twilio-provisioning.ts`, not moved into the phone management service.
- **Agency `twilioNumber`:** The `agencies` table also has a `twilioNumber` column (line 14 of `agencies.ts`). This is a separate concept (the agency's notification number, not a client business line) and is NOT part of this consolidation.
