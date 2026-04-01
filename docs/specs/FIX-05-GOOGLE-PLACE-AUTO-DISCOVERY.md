# FIX-05: Google Place ID Auto-Discovery on Client Creation

Status: Ready
Priority: MEDIUM — saves onboarding friction
Estimated files: 1

---

## Problem

`findGooglePlaceId()` exists in `src/lib/services/google-places.ts` (lines 78-104) but is never called during client creation. Admins must manually find and configure the Google Place ID for review monitoring. This means review generation is broken by default until manual setup.

## Solution

Call `findGooglePlaceId()` during client creation (in `/api/admin/clients` POST handler) and auto-create a `review_sources` record if a Place ID is found. This is fire-and-forget — if discovery fails, client creation still succeeds.

## Implementation

### Step 1: Modify client creation handler

**File:** `src/app/api/admin/clients/route.ts`

**After line 130** (after `return createdClient;` inside the transaction), but **outside** the transaction (so that a Google API failure doesn't roll back client creation):

```typescript
// Auto-discover Google Place ID (non-blocking — don't fail client creation)
try {
  if (data.businessName) {
    const googlePlaceId = await findGooglePlaceId(data.businessName);
    if (googlePlaceId) {
      await db.insert(reviewSources).values({
        clientId: client.id,
        source: 'google',
        googlePlaceId,
        isActive: true,
      });
    }
  }
} catch (error) {
  // Log but don't fail — Place ID discovery is best-effort
  console.log('[Onboarding] Google Place ID auto-discovery failed (non-critical):',
    error instanceof Error ? error.message : 'Unknown error');
}
```

**Add imports at top of file:**

```typescript
import { findGooglePlaceId } from '@/lib/services/google-places';
import { reviewSources } from '@/db/schema';
```

**Important:** This code runs AFTER the transaction succeeds (after line 131), so client creation is already committed. The Google API call and review source insert happen as a separate operation.

### Edge Cases

1. **`GOOGLE_PLACES_API_KEY` not set** — `findGooglePlaceId()` already handles this (returns null, logs warning). Client creation succeeds.
2. **Business name too generic** — Google returns wrong place. Acceptable — admin can update/override in `/admin/clients/[id]/reviews`.
3. **Review source already exists** — If this somehow runs twice, the insert will fail on the unique constraint (clientId + source). Wrap in try/catch (already done).
4. **Multiple Google results** — `findGooglePlaceId()` returns the first candidate. Good enough for auto-discovery; admin can correct.
5. **No Google Business Profile** — `findGooglePlaceId()` returns null. No review source created. Review request automation will still send SMS but with a generic "our Google page" fallback.

### Files Changed

| File | Change |
|------|--------|
| `src/app/api/admin/clients/route.ts` | Add auto-discovery call after transaction, add imports |

### Verification

1. `npm run typecheck` passes
2. `npm run build` passes
3. `npm test` passes
4. Manual test: create a client with a real business name → check `review_sources` table for auto-created Google entry
5. Manual test: create a client with a fake name → no review source created, client still created successfully
6. `npm run quality:no-regressions` passes

### Resume Point

If interrupted, check:
- Did `src/app/api/admin/clients/route.ts` get the imports? → If not, add them.
- Did it get the auto-discovery block after the transaction? → If not, add it.
- Run `npm run typecheck` to verify state.
