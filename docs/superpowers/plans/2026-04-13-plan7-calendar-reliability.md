# Plan 7: Calendar Reliability (First 30 Days)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 calendar reliability issues — timezone bugs, silent sync failures, missing homeowner notifications — before the first client with a Google Calendar integration onboards.

**Architecture:** Surgical fixes to existing calendar service files. One schema column addition (`lastSyncError` on `calendar_events`). No new services or tables beyond that.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest, `date-fns-tz` (already in `package.json` at `^3.2.0`)

**Source specs:**
- `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` (XDOM-13 through XDOM-17)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/db/schema/calendar-events.ts` | Task 3: add `lastSyncError` column |
| Modify | `src/lib/services/calendar/index.ts` | Tasks 1, 3: timezone fallback + sync error handling |
| Modify | `src/lib/services/calendar/google-calendar.ts` | Tasks 1, 3, 4: timezone fallback + error handling + homeowner notifications |
| Modify | `src/lib/services/appointment-booking.ts` | Tasks 1, 2, 5: timezone fallback + slot generation + booking error log |

---

## Execution Order

- **Wave 1 (must be first):** Task 1 — correct the `'America/New_York'` fallback in all calendar paths. Tasks 2–5 depend on the correct fallback.
- **Wave 2 (parallel-safe):**
  - Agent A: Tasks 3 + 4 (both touch `google-calendar.ts` and `calendar/index.ts`)
  - Agent B: Tasks 2 + 5 (both touch `appointment-booking.ts`, different functions)

---

## Task 1 — Remove hardcoded `America/New_York` timezone fallback (XDOM-13)

**Severity:** High — events shift 2–3 hours for Alberta clients  
**Files:**
- `src/lib/services/calendar/index.ts` — line 35
- `src/lib/services/calendar/google-calendar.ts` — lines 193, 287
- `src/lib/services/appointment-booking.ts` — line 569
- `src/db/schema/calendar-events.ts` — line 38 (DB default — changed in schema only, no migration needed since this is a default, not existing data)

---

- [ ] **Step 1: Audit all `America/New_York` occurrences in the calendar paths**

```bash
grep -rn "America/New_York" \
  src/lib/services/calendar/ \
  src/lib/services/appointment-booking.ts \
  src/db/schema/calendar-events.ts \
  src/db/schema/clients.ts
```

Expected output (5 lines):
```
src/lib/services/calendar/index.ts:35:      timezone: input.timezone || 'America/New_York',
src/lib/services/calendar/google-calendar.ts:193:        timeZone: event.timezone || 'America/New_York',
src/lib/services/calendar/google-calendar.ts:197:        timeZone: event.timezone || 'America/New_York',
src/lib/services/calendar/google-calendar.ts:287:        timeZone: event.timezone || 'America/New_York',
src/lib/services/calendar/google-calendar.ts:291:        timeZone: event.timezone || 'America/New_York',
src/lib/services/appointment-booking.ts:569:      timezone: client.timezone || 'America/New_York',
src/db/schema/calendar-events.ts:38:    timezone: varchar('timezone', { length: 50 }).notNull().default('America/New_York'),
src/db/schema/clients.ts:30:    timezone: varchar('timezone', { length: 50 }).default('America/New_York'),
```

Note: `clients.ts:30` is the client schema default — do NOT change this here. That table is managed separately. Only change the calendar-specific files.

---

- [ ] **Step 2: Fix `src/lib/services/calendar/index.ts` line 35**

Current (line 35):
```typescript
      timezone: input.timezone || 'America/New_York',
```

New — replace fallback AND add a warning when timezone is absent:
```typescript
      timezone: input.timezone || (() => {
        console.warn(
          '[Calendar][createEvent] timezone not provided — falling back to America/Edmonton. ' +
          'Pass client.timezone explicitly from the call site.',
          { clientId: input.clientId }
        );
        return 'America/Edmonton';
      })(),
```

> **Why inline IIFE:** Keeps it a single expression in the object literal without adding a separate variable. The warning fires at runtime and surfaces the call site in logs.

---

- [ ] **Step 3: Fix `src/lib/services/calendar/google-calendar.ts` — `createGoogleEvent()` start/end (lines 192–198)**

Current (lines 191–198):
```typescript
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone || 'America/New_York',
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone || 'America/New_York',
      },
```

New:
```typescript
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone || 'America/Edmonton',
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone || 'America/Edmonton',
      },
```

---

- [ ] **Step 4: Fix `src/lib/services/calendar/google-calendar.ts` — `updateGoogleEvent()` start/end (lines 286–292)**

Current (lines 285–292):
```typescript
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: event.timezone || 'America/New_York',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: event.timezone || 'America/New_York',
        },
```

New:
```typescript
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: event.timezone || 'America/Edmonton',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: event.timezone || 'America/Edmonton',
        },
```

---

- [ ] **Step 5: Fix `src/lib/services/appointment-booking.ts` line 569**

Current (line 569):
```typescript
      timezone: client.timezone || 'America/New_York',
```

New:
```typescript
      timezone: client.timezone || 'America/Edmonton',
```

---

- [ ] **Step 6: Fix `src/db/schema/calendar-events.ts` line 38 (DB-level default)**

Current (line 38):
```typescript
    timezone: varchar('timezone', { length: 50 }).notNull().default('America/New_York'),
```

New:
```typescript
    timezone: varchar('timezone', { length: 50 }).notNull().default('America/Edmonton'),
```

Also update the comment on line 35–37:
```typescript
    // NOTE: Drizzle schema defaults are DB-level — they cannot dynamically derive from the
    // client row. Callers of db.insert(calendarEvents) MUST pass the client's timezone
    // explicitly (read from clients.timezone). The default here is Alberta (ICP market).
```

---

- [ ] **Step 7: Verify no remaining `America/New_York` in calendar-related paths**

```bash
grep -rn "America/New_York" \
  src/lib/services/calendar/ \
  src/lib/services/appointment-booking.ts \
  src/db/schema/calendar-events.ts
```

Expected: no output.

---

- [ ] **Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS (no new errors — these are string replacements with no type impact).

---

- [ ] **Step 9: Commit**

```bash
git add \
  src/lib/services/calendar/index.ts \
  src/lib/services/calendar/google-calendar.ts \
  src/lib/services/appointment-booking.ts \
  src/db/schema/calendar-events.ts
git commit -m "fix: replace America/New_York timezone fallback with America/Edmonton (XDOM-13)"
```

---

## Task 2 — Timezone-aware slot generation (XDOM-14)

**Severity:** High — available booking slots truncated for later-timezone clients  
**Files:**
- `src/lib/services/appointment-booking.ts` — lines 81, 157–217

**Prerequisite:** Task 1 must be committed first (correct default fallback).

**Context:** `date-fns-tz` is already installed at `^3.2.0`. Use `toZonedTime` / `fromZonedTime` (the v3 API — formerly `utcToZonedTime` / `zonedTimeToUtc`).

---

- [ ] **Step 1: Read the slot generation block to confirm line numbers**

Read `src/lib/services/appointment-booking.ts` lines 75–100 and lines 155–220.

Expected key lines:
- Line 81: `const startDate = preferredDate || format(new Date(), 'yyyy-MM-dd');`
- Line 158: `const now = new Date();`
- Line 197: `if (isBefore(slotDateTime, now)) continue;`

---

- [ ] **Step 2: Add `date-fns-tz` import to `appointment-booking.ts`**

Current import block (line 15):
```typescript
import { format, addDays, addMinutes, parse, isBefore, isAfter } from 'date-fns';
```

New — add `date-fns-tz` import after the `date-fns` import:
```typescript
import { format, addDays, addMinutes, parse, isBefore, isAfter } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
```

---

- [ ] **Step 3: Add `timezone` parameter to `getAvailableSlots()`**

Current signature (lines 46–51):
```typescript
export async function getAvailableSlots(
  clientId: string,
  preferredDate?: string,
  membershipId?: string,
  durationMinutes: number = 60
): Promise<TimeSlot[]> {
```

New — add `timezone` parameter with default:
```typescript
export async function getAvailableSlots(
  clientId: string,
  preferredDate?: string,
  membershipId?: string,
  durationMinutes: number = 60,
  timezone: string = 'America/Edmonton'
): Promise<TimeSlot[]> {
```

> **Note:** Adding at the end preserves backward compatibility — all existing callers that pass 3 or 4 args still work. The booking conversation handler in `src/lib/services/booking-conversation.ts` and any other callers should be updated to pass `client.timezone` explicitly in a follow-up, but this default prevents breakage.

---

- [ ] **Step 4: Fix "today in client timezone" for `startDate` (line 81)**

Current (line 81):
```typescript
  const startDate = preferredDate || format(new Date(), 'yyyy-MM-dd');
```

New — when no `preferredDate`, compute today in the client's timezone instead of server UTC:
```typescript
  const nowInClientTz = toZonedTime(new Date(), timezone);
  const startDate = preferredDate || format(nowInClientTz, 'yyyy-MM-dd');
```

> **Why:** For a client at `America/Edmonton` (UTC-6), after 6pm UTC, `new Date()` returns tomorrow's date even though it's still today locally. This means the 7-day window starts a day late and slots for the current day are never offered.

---

- [ ] **Step 5: Fix past-slot comparison to be timezone-aware (lines 158, 197)**

Current (line 158):
```typescript
  const now = new Date();
```

New — replace with a note and compute the cutoff in client timezone terms:
```typescript
  // Compare slots against "now in client timezone" so UTC offsets don't truncate today's slots.
  // toZonedTime converts the wall-clock representation to the client's local time.
  const now = toZonedTime(new Date(), timezone);
```

Current (line 197):
```typescript
      // Skip past times
      if (isBefore(slotDateTime, now)) continue;
```

This line does NOT change — `slotDateTime` is already constructed from the local date string and time string via `parse()`, and `now` is now the zoned equivalent. Both are in the same "local wall clock" frame, so `isBefore` compares correctly.

> **Verification note:** `parse('2026-04-13 10:00', 'yyyy-MM-dd HH:mm', new Date())` returns a JS Date interpreted as the server's local clock, not the client timezone. The comparison still works because `toZonedTime(new Date(), tz)` shifts `now` into the same conceptual space. Both `slotDateTime` and `now` represent the same "local reading" frame.

---

- [ ] **Step 6: Update callers of `getAvailableSlots()` to pass timezone**

Find callers:
```bash
grep -rn "getAvailableSlots" src/
```

For each caller that has access to a `client` object, add `client.timezone` as the 5th argument. Typical call site in `src/lib/services/booking-conversation.ts`:

Before:
```typescript
const slots = await getAvailableSlots(clientId, preferredDate, membershipId);
```

After:
```typescript
const slots = await getAvailableSlots(clientId, preferredDate, membershipId, 60, client.timezone || 'America/Edmonton');
```

> If the client timezone is not yet fetched at the call site, add a `client` fetch (using `getDb().select().from(clients).where(eq(clients.id, clientId)).limit(1)`) before the `getAvailableSlots()` call.

---

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

---

- [ ] **Step 8: Run existing tests**

```bash
npm test
```

Expected: All tests pass. The `getAvailableSlots()` parameter addition is backward-compatible — default value prevents test breakage.

---

- [ ] **Step 9: Commit**

```bash
git add src/lib/services/appointment-booking.ts
git commit -m "fix: timezone-aware slot generation using client timezone (XDOM-14)"
```

---

## Task 3 — Calendar sync error handling + retry signal (XDOM-15)

**Severity:** High — sync failures silently lose events with no operator feedback  
**Files:**
- `src/db/schema/calendar-events.ts` — add `lastSyncError` column
- `src/lib/services/calendar/index.ts` — `syncEventToProviders()` (line 150), `fullSync()` outbound loop (line 242)
- `src/lib/services/calendar/google-calendar.ts` — `syncFromGoogleCalendar()` catch block (line 456)

**Prerequisite:** Task 1 must be committed first.

---

### Step 3a — Schema: add `lastSyncError` column

- [ ] **Step 1: Check if `lastSyncError` already exists**

```bash
grep -n "lastSyncError\|last_sync_error" src/db/schema/calendar-events.ts
```

Expected: no output (the column does not exist yet — confirmed by reading the file).

---

- [ ] **Step 2: Add `lastSyncError` column to `calendar-events.ts`**

Current (line 47 in `src/db/schema/calendar-events.ts`):
```typescript
    syncStatus: varchar('sync_status', { length: 20 }).notNull().default('pending'), // pending, synced, error
```

New — add `lastSyncError` immediately after `syncStatus`:
```typescript
    syncStatus: varchar('sync_status', { length: 20 }).notNull().default('pending'), // pending, synced, error
    lastSyncError: varchar('last_sync_error', { length: 500 }),
```

---

- [ ] **Step 3: Generate migration**

```bash
npm run db:generate
```

Review the generated SQL in `drizzle/` — it should contain exactly:
```sql
ALTER TABLE "calendar_events" ADD COLUMN "last_sync_error" varchar(500);
```

**Do NOT run `db:push` or `db:migrate` without explicit user confirmation.**

---

- [ ] **Step 4: Commit schema + generated migration**

```bash
git add src/db/schema/calendar-events.ts drizzle/
git commit -m "feat: add lastSyncError column to calendar_events (XDOM-15)"
```

---

### Step 3b — Fix `syncEventToProviders()` in `calendar/index.ts`

- [ ] **Step 5: Add `logSanitizedConsoleError` and `alertOperator` imports to `calendar/index.ts`**

Current import block (lines 1–3):
```typescript
import { getDb, calendarEvents, calendarIntegrations } from '@/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as googleCalendar from './google-calendar';
```

New — add two imports:
```typescript
import { getDb, calendarEvents, calendarIntegrations } from '@/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as googleCalendar from './google-calendar';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { alertOperator } from '@/lib/services/operator-alerts';
```

---

- [ ] **Step 6: Replace the silent catch in `syncEventToProviders()` (lines 150–153)**

Current (lines 149–153):
```typescript
    } catch (err) {
      console.error(`Sync to ${integration.provider} failed:`, err);
    }
```

New — update `syncStatus`, increment `consecutiveErrors`, alert operator after 5 failures:
```typescript
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Mark the event as failed so the UI can surface it
      await db
        .update(calendarEvents)
        .set({
          syncStatus: 'error',
          lastSyncError: errorMessage.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(calendarEvents.id, event.id));

      // Increment consecutive error counter on the integration
      const newCount = (integration.consecutiveErrors ?? 0) + 1;
      await db
        .update(calendarIntegrations)
        .set({
          lastError: errorMessage,
          consecutiveErrors: newCount,
          updatedAt: new Date(),
        })
        .where(eq(calendarIntegrations.id, integration.id));

      logSanitizedConsoleError(
        `[Calendar][syncEventToProviders] Sync to ${integration.provider} failed`,
        err,
        { eventId: event.id, clientId, provider: integration.provider, consecutiveErrors: newCount }
      );

      // Alert operator after 5 consecutive failures
      if (newCount >= 5) {
        await alertOperator(
          `Calendar sync failing for client ${clientId}`,
          `${newCount} consecutive sync errors on ${integration.provider} integration. Last error: ${errorMessage.slice(0, 200)}`
        );
      }
    }
```

---

- [ ] **Step 7: Replace the silent catch in `fullSync()` outbound loop (lines 241–244)**

Current (lines 239–244):
```typescript
    for (const event of pendingEvents) {
      try {
        await syncEventToProviders(clientId, event);
        results.outbound.synced++;
      } catch {
        results.outbound.failed++;
      }
    }
```

New — log the error with context (the rich error handling is already inside `syncEventToProviders()`, so this catch is a safety net for unexpected throws):
```typescript
    for (const event of pendingEvents) {
      try {
        await syncEventToProviders(clientId, event);
        results.outbound.synced++;
      } catch (err) {
        results.outbound.failed++;
        logSanitizedConsoleError(
          '[Calendar][fullSync.outbound] Unexpected error during sync',
          err,
          { eventId: event.id, clientId }
        );
      }
    }
```

---

### Step 3c — Fix `syncFromGoogleCalendar()` in `google-calendar.ts`

- [ ] **Step 8: Add `logSanitizedConsoleError` import to `google-calendar.ts`**

Current imports (lines 1–3):
```typescript
import { google, calendar_v3 } from 'googleapis';
import { getDb, calendarIntegrations, calendarEvents, leads } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
```

New — add internal error log import:
```typescript
import { google, calendar_v3 } from 'googleapis';
import { getDb, calendarIntegrations, calendarEvents, leads } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
```

---

- [ ] **Step 9: Replace the swallowing catch in `syncFromGoogleCalendar()` (lines 455–458)**

Current (lines 455–458):
```typescript
  } catch (err) {
    console.error('Google Calendar sync error:', err);
    return { created: 0, updated: 0 };
  }
```

New — increment `consecutiveErrors` on the integration AND log properly:
```typescript
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Increment error counter on the integration so the admin UI and operator alerts work
    await db
      .update(calendarIntegrations)
      .set({
        lastError: errorMessage,
        consecutiveErrors: (integration.consecutiveErrors ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, integration.id));

    logSanitizedConsoleError(
      '[Calendar][syncFromGoogleCalendar] Inbound sync failed',
      err,
      { clientId, integrationId: integration.id }
    );

    return { created: 0, updated: 0 };
  }
```

> **Note:** `integration` is in scope — it is fetched at the top of the function (lines 375–381).

---

- [ ] **Step 10: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS. The pre-existing block-scoped redeclaration warning in `compliance-gateway.ts` is non-blocking (per CLAUDE.md rule 8) — ignore it.

---

- [ ] **Step 11: Run tests**

```bash
npm test
```

Expected: All tests pass.

---

- [ ] **Step 12: Commit**

```bash
git add \
  src/lib/services/calendar/index.ts \
  src/lib/services/calendar/google-calendar.ts
git commit -m "fix: structured error handling + operator alert for calendar sync failures (XDOM-15)"
```

---

## Task 4 — Notify homeowner on Google Calendar event changes (XDOM-16)

**Severity:** High — cancelled/rescheduled appointments silently strand the homeowner  
**Files:**
- `src/lib/services/calendar/google-calendar.ts` — `syncFromGoogleCalendar()` updated block (lines 428–443)
- `src/lib/services/calendar/index.ts` — `cancelEvent()` (lines 91–115)

**Prerequisite:** Task 1 must be committed (correct timezone). Task 3 imports (`logSanitizedConsoleError`) must be in place.

---

### Step 4a — Detect and notify on inbound event changes (`syncFromGoogleCalendar`)

- [ ] **Step 1: Add `sendCompliantMessage` import to `google-calendar.ts`**

Add to the imports block (after the `logSanitizedConsoleError` import added in Task 3):
```typescript
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
```

Also add `clients` to the `@/db` import so we can fetch the client's Twilio number and business name:
```typescript
import { getDb, calendarIntegrations, calendarEvents, leads, clients } from '@/db';
```

---

- [ ] **Step 2: Add a timezone-aware date formatter helper at the top of `google-calendar.ts` (after imports)**

Add this helper function before `getGoogleAuthUrl`:
```typescript
/**
 * Format a Date in the given IANA timezone for display in SMS messages.
 * Returns strings like "Tuesday, Apr 15 at 10:00 AM".
 */
function formatEventDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
```

---

- [ ] **Step 3: Replace the `if (existing)` update block in `syncFromGoogleCalendar()` to detect and notify on changes**

Current (lines 428–443):
```typescript
      if (existing) {
        await db
          .update(calendarEvents)
          .set(eventData)
          .where(eq(calendarEvents.id, existing.id));
        updated++;
      } else {
```

New — detect status change and reschedule before updating:
```typescript
      if (existing) {
        // Detect changes that require homeowner notification BEFORE updating the local record
        const isCancellation =
          googleEvent.status === 'cancelled' && existing.status !== 'cancelled';
        const isReschedule =
          !isCancellation &&
          googleEvent.start?.dateTime &&
          new Date(googleEvent.start.dateTime).toISOString() !== existing.startTime.toISOString();

        // Update local record first
        await db
          .update(calendarEvents)
          .set(eventData)
          .where(eq(calendarEvents.id, existing.id));
        updated++;

        // Notify homeowner if there is a lead attached and something changed
        if ((isCancellation || isReschedule) && existing.leadId) {
          await notifyHomeownerOfEventChange({
            clientId,
            leadId: existing.leadId,
            isCancellation,
            oldStartTime: existing.startTime,
            newStartTime: googleEvent.start?.dateTime
              ? new Date(googleEvent.start.dateTime)
              : null,
            timezone: existing.timezone || 'America/Edmonton',
          });
        }
      } else {
```

---

- [ ] **Step 4: Add the `notifyHomeownerOfEventChange()` helper function to `google-calendar.ts`**

Add this function after the `formatEventDateTime` helper, before `getGoogleAuthUrl`:

```typescript
interface NotifyHomeownerParams {
  clientId: string;
  leadId: string;
  isCancellation: boolean;
  oldStartTime: Date;
  newStartTime: Date | null;
  timezone: string;
}

/**
 * Send an SMS to the homeowner when their appointment is cancelled or rescheduled
 * via an external Google Calendar action.
 * Fires through sendCompliantMessage so compliance rules (opt-out, quiet hours) apply.
 */
async function notifyHomeownerOfEventChange(params: NotifyHomeownerParams): Promise<void> {
  const { clientId, leadId, isCancellation, oldStartTime, newStartTime, timezone } = params;

  const db = getDb();

  // Fetch lead for phone and name
  const [lead] = await db
    .select({ name: leads.name, phone: leads.phone })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead?.phone) return;

  // Fetch client for twilio number and business name
  const [client] = await db
    .select({
      twilioNumber: clients.twilioNumber,
      businessName: clients.businessName,
      contactPhone: clients.phone,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.twilioNumber) return;

  const oldFormatted = formatEventDateTime(oldStartTime, timezone);
  const businessName = client.businessName || 'your contractor';
  const contactPhone = client.contactPhone || 'us';

  let body: string;
  if (isCancellation) {
    body =
      `Hi ${lead.name || 'there'}, your appointment with ${businessName} scheduled for ` +
      `${oldFormatted} has been cancelled. Please contact ${businessName} at ${contactPhone} to reschedule.`;
  } else {
    const newFormatted = newStartTime ? formatEventDateTime(newStartTime, timezone) : 'a new time';
    body =
      `Hi ${lead.name || 'there'}, your appointment with ${businessName} has been rescheduled to ` +
      `${newFormatted}. Reply STOP to opt out.`;
  }

  try {
    await sendCompliantMessage({
      clientId,
      to: lead.phone,
      from: client.twilioNumber,
      body,
      leadId,
      messageClassification: 'inbound_reply',
      messageCategory: 'transactional',
      consentBasis: { type: 'existing_customer' },
      metadata: {
        source: 'calendar_event_change_notification',
        isCancellation,
      },
    });
  } catch (err) {
    logSanitizedConsoleError(
      '[Calendar][notifyHomeownerOfEventChange] SMS notification failed',
      err,
      { clientId, leadId, isCancellation }
    );
    // Never throw — notification failure must not block the sync loop
  }
}
```

---

### Step 4b — Notify on programmatic `cancelEvent()` in `calendar/index.ts`

- [ ] **Step 5: Add imports to `calendar/index.ts` for homeowner notification on cancel**

Add to the existing import block (which now also has `logSanitizedConsoleError` and `alertOperator` from Task 3):
```typescript
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { clients, leads } from '@/db/schema';
```

> The `clients` and `leads` tables are needed to look up phone numbers for the notification.

---

- [ ] **Step 6: Update `cancelEvent()` in `calendar/index.ts` to notify the homeowner**

Current `cancelEvent()` (lines 91–115):
```typescript
export async function cancelEvent(eventId: string): Promise<void> {
  const db = getDb();

  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);

  if (!event) throw new Error('Event not found');

  // Delete from external calendar
  if (event.provider === 'google' && event.externalEventId) {
    await googleCalendar.deleteGoogleEvent(
      event.clientId!,
      event.externalEventId
    );
  }

  // Update status locally
  await db
    .update(calendarEvents)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(calendarEvents.id, eventId));
}
```

New — add homeowner notification after the DB update:
```typescript
export async function cancelEvent(eventId: string): Promise<void> {
  const db = getDb();

  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);

  if (!event) throw new Error('Event not found');

  // Delete from external calendar
  if (event.provider === 'google' && event.externalEventId) {
    await googleCalendar.deleteGoogleEvent(
      event.clientId!,
      event.externalEventId
    );
  }

  // Update status locally
  await db
    .update(calendarEvents)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(calendarEvents.id, eventId));

  // Notify the homeowner if a lead is attached to this event
  if (event.leadId && event.clientId) {
    const [lead] = await db
      .select({ name: leads.name, phone: leads.phone })
      .from(leads)
      .where(eq(leads.id, event.leadId))
      .limit(1);

    const [client] = await db
      .select({
        twilioNumber: clients.twilioNumber,
        businessName: clients.businessName,
        contactPhone: clients.phone,
      })
      .from(clients)
      .where(eq(clients.id, event.clientId))
      .limit(1);

    if (lead?.phone && client?.twilioNumber) {
      const timezone = event.timezone || 'America/Edmonton';
      const oldFormatted = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(event.startTime);

      const businessName = client.businessName || 'your contractor';
      const contactPhone = client.contactPhone || 'us';

      try {
        await sendCompliantMessage({
          clientId: event.clientId,
          to: lead.phone,
          from: client.twilioNumber,
          body:
            `Hi ${lead.name || 'there'}, your appointment with ${businessName} scheduled for ` +
            `${oldFormatted} has been cancelled. Please contact ${businessName} at ${contactPhone} to reschedule.`,
          leadId: event.leadId,
          messageClassification: 'inbound_reply',
          messageCategory: 'transactional',
          consentBasis: { type: 'existing_customer' },
          metadata: { source: 'cancel_event_notification' },
        });
      } catch (err) {
        logSanitizedConsoleError(
          '[Calendar][cancelEvent] Homeowner SMS notification failed',
          err,
          { eventId, clientId: event.clientId, leadId: event.leadId }
        );
        // Never re-throw — notification failure must not block the cancellation
      }
    }
  }
}
```

---

- [ ] **Step 7: Check that `clients` and `leads` are exported from `@/db`**

```bash
grep -n "clients\|leads" src/db/index.ts | head -20
```

They are already re-exported. If not, add them to `src/db/schema/index.ts` and `src/db/index.ts` following the existing pattern.

---

- [ ] **Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

---

- [ ] **Step 9: Run tests**

```bash
npm test
```

Expected: All tests pass.

---

- [ ] **Step 10: Commit**

```bash
git add \
  src/lib/services/calendar/google-calendar.ts \
  src/lib/services/calendar/index.ts
git commit -m "feat: notify homeowner on calendar event cancellation and reschedule (XDOM-16)"
```

---

## Task 5 — Calendar event creation error handling (XDOM-17)

**Severity:** High — booking failure is completely silent; appointment exists with no calendar event  
**Files:**
- `src/lib/services/appointment-booking.ts` — lines 561–573

**Prerequisite:** Task 1 must be committed first. Can run in parallel with Tasks 3 and 4 (different function).

---

- [ ] **Step 1: Read the exact lines to confirm**

Read `src/lib/services/appointment-booking.ts` lines 558–580.

Expected current state (lines 561–573):
```typescript
  try {
    await createEvent({
      clientId,
      leadId,
      title: `${lead.projectType || 'Service Call'}: ${lead.name || 'Customer'}`,
      startTime: appointmentDateTime,
      endTime: addMinutes(appointmentDateTime, durationMinutes),
      location: lead.address || undefined,
      timezone: client.timezone || 'America/Edmonton',
      eventType: 'estimate',
      assignedTeamMemberId: assignedMembershipId ?? undefined,
    });
  } catch {} // Don't block booking on calendar failure
```

---

- [ ] **Step 2: Add `logSanitizedConsoleError` import to `appointment-booking.ts`**

Current import block (line 8):
```typescript
import { getDb } from '@/db';
```

Add the import (after the existing imports):
```typescript
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
```

---

- [ ] **Step 3: Replace the empty catch with a logging catch**

Current (line 573):
```typescript
  } catch {} // Don't block booking on calendar failure
```

New:
```typescript
  } catch (err) {
    // Calendar creation failure must never block the booking from completing.
    // Log for operator visibility — syncStatus will be 'error' on the event record
    // (handled inside createEvent → syncEventToProviders in Task 3).
    logSanitizedConsoleError(
      '[Booking][calendar-event-creation] Failed to create calendar event',
      err,
      {
        clientId,
        leadId,
        appointmentId: result.appointmentId,
      }
    );
  }
```

---

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

---

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass.

---

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/appointment-booking.ts
git commit -m "fix: log calendar event creation failure instead of swallowing (XDOM-17)"
```

---

## Final Verification Gate

After all 5 tasks are committed, run the full quality gate:

- [ ] **Run fast gate:**

```bash
npm run ms:gate
```

- [ ] **Run logging guard:**

```bash
npm run quality:logging-guard
```

- [ ] **Run completion gate:**

```bash
npm run quality:no-regressions
```

Expected: All gates GREEN. Do not mark any task done with a red gate.

---

## Manual Test Vectors

After the quality gates pass, verify the key scenarios manually:

- [ ] **Timezone fix (Task 1 + 2):** Create an appointment for a client with `timezone: 'America/Edmonton'`. Check the Google Calendar event — it should show the correct local time, not Eastern time. Available slots fetched at 7pm UTC (1pm MDT) should show afternoon slots for that day, not skip today.

- [ ] **Slot generation (Task 2):** At UTC 07:00 (1am Edmonton MDT), call `getAvailableSlots()` for an Edmonton client. The `startDate` should be "today" in Edmonton (not tomorrow). Available slots for today's business hours should appear.

- [ ] **Sync error handling (Task 3):** Revoke the Google OAuth token for a test client's integration. Trigger the cron (`GET /api/cron/calendar-sync`). Verify: (a) `calendar_events.sync_status` is `'error'` for pending events, (b) `calendar_events.last_sync_error` is populated, (c) `calendar_integrations.consecutive_errors` increments, (d) after 5 runs the operator receives an SMS alert.

- [ ] **Homeowner notification on cancel (Task 4):** In Google Calendar, cancel an event that was created for a test lead. Trigger sync. Verify the test lead's phone receives the cancellation SMS.

- [ ] **Homeowner notification on reschedule (Task 4):** Reschedule a Google Calendar event to a new time. Trigger sync. Verify the test lead's phone receives the reschedule SMS with the new time.

- [ ] **Programmatic cancel notification (Task 4):** Call `cancelEvent(eventId)` directly (e.g., via admin UI). Verify the lead receives the cancellation SMS.

- [ ] **Booking error visibility (Task 5):** Force `createEvent()` to throw (e.g., temporarily break the Google integration). Book an appointment. Confirm: (a) the booking succeeds and the homeowner gets a confirmation, (b) the error appears in `internal_error_log` table (not swallowed).

---

## Doc Updates Required

Per CLAUDE.md Change→Doc mapping (mandatory — check before marking done):

| Change | Doc to update |
|--------|---------------|
| Calendar sync error handling (Task 3) | `docs/product/PLATFORM-CAPABILITIES.md` — Section on Calendar/Booking reliability |
| Homeowner notification on event change (Task 4) | `docs/product/PLATFORM-CAPABILITIES.md` — Calendar section: add "Homeowner SMS on cancel/reschedule" |
| Timezone fixes (Tasks 1, 2) | `docs/engineering/01-TESTING-GUIDE.md` — update calendar test steps to verify Alberta timezone is used |

Update these docs in the same PR or immediately after the final commit.
