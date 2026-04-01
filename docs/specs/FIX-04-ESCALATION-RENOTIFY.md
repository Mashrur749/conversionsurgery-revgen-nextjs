# FIX-04: Escalation Re-Notification (15-Minute Timeout)

Status: Ready
Priority: HIGH — lost handoffs kill the speed-to-lead promise
Estimated files: 3-4

---

## Problem

When the AI escalates a hot lead to the contractor, a claim SMS is sent. If nobody claims it within any timeframe, nothing happens — the lead goes cold. There's no re-notification, no timeout, no fallback. The system's speed advantage disappears at the human handoff point.

## Solution

1. Add a `reNotifiedAt` column to `escalation_claims`
2. Create a cron job that checks for unclaimed escalations older than 15 minutes and re-sends notifications
3. Register the cron job in the main orchestrator

## Implementation

### Step 1: Add schema column

**File:** `src/db/schema/escalation-claims.ts`

Add after line 34 (`resolvedAt`):

```typescript
reNotifiedAt: timestamp('re_notified_at'),
```

No migration blocker — this is a nullable column addition. Run `npm run db:generate` after.

### Step 2: Create re-notification function

**File:** `src/lib/services/team-escalation.ts`

Add a new exported function:

```typescript
/**
 * Re-notify team for escalation claims that have been pending > 15 minutes.
 * Called by cron every 5 minutes.
 * Only re-notifies once per claim (checks reNotifiedAt).
 */
export async function reNotifyPendingEscalations(): Promise<{ reNotified: number }> {
  const db = getDb();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Find pending claims older than 15 min that haven't been re-notified
  const staleClaims = await db
    .select()
    .from(escalationClaims)
    .where(and(
      eq(escalationClaims.status, 'pending'),
      lt(escalationClaims.notifiedAt, fifteenMinutesAgo),
      isNull(escalationClaims.reNotifiedAt)
    ));

  let reNotified = 0;

  for (const claim of staleClaims) {
    // Get client info for notification
    const [client] = await db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(eq(clients.id, claim.clientId))
      .limit(1);

    if (!client) continue;

    // Re-send SMS to all team members who receive escalations
    const members = await db
      .select()
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .where(and(
        eq(clientMemberships.clientId, claim.clientId),
        eq(clientMemberships.receiveEscalations, true)
      ));

    for (const member of members) {
      const phone = member.people.phone;
      if (!phone) continue;

      // Send re-notification SMS via Twilio directly (not compliance gateway — this is internal)
      // Message: "⚠️ UNCLAIMED: Lead escalation still waiting (15+ min). Claim: {url}"
      await sendInternalNotificationSms(
        phone,
        `REMINDER: Escalated lead for ${client.businessName} still unclaimed (15+ min). ${claim.lastLeadMessage ? `"${claim.lastLeadMessage.substring(0, 60)}..."` : ''} Claim: ${process.env.NEXT_PUBLIC_APP_URL}/claims?token=${claim.claimToken}`
      );
    }

    // Mark as re-notified
    await db
      .update(escalationClaims)
      .set({ reNotifiedAt: new Date() })
      .where(eq(escalationClaims.id, claim.id));

    reNotified++;
  }

  return { reNotified };
}
```

**Note:** Use `sendInternalNotificationSms()` helper — check if it exists in `team-escalation.ts`. If the existing notification uses Twilio directly, follow the same pattern. Internal notifications to team members don't go through compliance gateway.

### Step 3: Create cron route

**New file:** `src/app/api/cron/escalation-renotify/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { reNotifyPendingEscalations } from '@/lib/services/team-escalation';

export async function POST(request: NextRequest) {
  verifyCronSecret(request);
  const result = await reNotifyPendingEscalations();
  return NextResponse.json(result);
}
```

### Step 4: Register in cron orchestrator

**File:** `src/app/api/cron/route.ts`

Add dispatch to the escalation re-notification cron. It should run every 5 minutes (same frequency as `process-scheduled`). Find where the 5-minute jobs are dispatched and add:

```typescript
// Every 5 minutes: re-notify unclaimed escalations
await dispatchCronJob('escalation-renotify');
```

### Edge Cases

1. **Claim is claimed between check and re-notification** — The `reNotifyPendingEscalations` query filters by `status = 'pending'`. If claimed between query and SMS send, the re-notification SMS is harmless (claim link will show "already claimed").
2. **No team members receive escalations** — Loop produces zero sends. `reNotified` still increments for the claim (it was processed). This is fine — the claim gets marked so it's not retried.
3. **Client has been deactivated** — Still re-notifies. Acceptable — deactivation should resolve the claim separately.
4. **Multiple stale claims for same lead** — Each is re-notified independently. This is correct — they may be for different escalation events.
5. **SMS delivery failure** — Logged but not retried. The 15-minute window is already a safety net — one more attempt is sufficient.

### Files Changed

| File | Change |
|------|--------|
| `src/db/schema/escalation-claims.ts` | Add `reNotifiedAt` column |
| `src/lib/services/team-escalation.ts` | Add `reNotifyPendingEscalations()` function |
| `src/app/api/cron/escalation-renotify/route.ts` | **NEW** — Cron endpoint |
| `src/app/api/cron/route.ts` | Register escalation-renotify dispatch |

### Post-Implementation

- Run `npm run db:generate` → review migration SQL → confirm with user before `db:push`/`db:migrate`

### Verification

1. `npm run typecheck` passes
2. `npm run build` passes
3. `npm test` passes
4. `npm run db:generate` produces clean migration
5. `npm run quality:no-regressions` passes

### Resume Point

If interrupted, check:
- Did `escalation-claims.ts` get the `reNotifiedAt` column? → If not, add it.
- Did `team-escalation.ts` get `reNotifyPendingEscalations()`? → If not, add it.
- Does `src/app/api/cron/escalation-renotify/route.ts` exist? → If not, create it.
- Did `cron/route.ts` get the dispatch? → If not, add it.
- Run `npm run db:generate` if schema changed.
- Run `npm run typecheck` to verify state.
