# Plan 7: Calendar Reliability (First 30 Days)

**Source:** `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` — XDOM-13 through XDOM-17
**Target:** `src/lib/services/calendar/index.ts`, `src/lib/services/calendar/google-calendar.ts`, `src/lib/services/appointment-booking.ts`

---

## Context

The calendar system has two structural problems: (1) hardcoded `'America/New_York'` fallbacks appear in four places across two files, causing events to appear shifted 2-3 hours for Alberta clients; (2) error handling is incomplete at the two points where most damage occurs — sync failure swallows exceptions silently, and the booking-time calendar event creation uses an empty `catch {}` block. A fifth issue is that when a Google Calendar event is cancelled or rescheduled externally, the affected homeowner is never notified.

---

## Task Breakdown

### Task 1 — Remove hardcoded America/New_York timezone fallback (XDOM-13)

**Severity:** High — appointments shift 2-3 hours for Alberta clients  
**Files:**
- `src/lib/services/calendar/index.ts` (line 35)
- `src/lib/services/calendar/google-calendar.ts` (line 193, line 287, line 569 in `createGoogleEvent` and `updateGoogleEvent`)

**Current state:**
- `calendar/index.ts:35` — `timezone: input.timezone || 'America/New_York'` in the `calendarEvents` insert inside `createEvent()`
- `google-calendar.ts:193` — `timeZone: event.timezone || 'America/New_York'` in `createGoogleEvent()` start/end
- `google-calendar.ts:287` — same pattern in `updateGoogleEvent()` start/end

**Approach:**

Step 1: Change all `|| 'America/New_York'` fallbacks to `|| 'America/Edmonton'`. Alberta (where the ICP lives) is `America/Edmonton`. This is the correct default for the initial market, not Eastern time.

Step 2: In `calendar/index.ts` `createEvent()`, add a runtime warning using `logSanitizedConsoleError` (or `console.warn`) when `input.timezone` is absent, so the call site can be identified and fixed to pass explicit timezone. Do not throw — fall back gracefully.

Step 3: In `appointment-booking.ts` (line ~569), the `createEvent()` call already passes `timezone: client.timezone || 'America/New_York'`. Update this fallback to `|| 'America/Edmonton'` as well.

Step 4: Audit the full codebase for any remaining `'America/New_York'` literal strings in calendar-related paths:

```bash
grep -rn "America/New_York" src/lib/services/calendar/ src/lib/services/appointment-booking.ts
```

Replace all remaining instances with `'America/Edmonton'`.

**Dependencies:** None — purely a string replacement plus warning annotation. Must be done before Task 2 (timezone-aware slot generation) since Task 2 depends on the fallback being correct.

---

### Task 2 — Timezone-aware slot generation (XDOM-14)

**Severity:** High — available booking slots truncated for later-timezone clients  
**Files:**
- `src/lib/services/appointment-booking.ts` (lines 81, 157-197)

**Current state:** Slot generation iterates `for (let i = 0; i < 7; i++)` starting from `new Date()` (server UTC time). Business hours are stored as local time strings (e.g. `openTime: '08:00'`, `closeTime: '17:00'`). The comparison `now` (UTC) is used to filter out past slots — for a client in `America/Edmonton` (UTC-6), slots before 6am UTC that are within business hours are incorrectly marked as past.

**Approach:**

1. At the start of the slot-generation block, compute "now in client timezone" using the client's `timezone` field. If the client record is not available in this function's scope, thread the timezone through as a parameter.

2. Replace the raw `new Date()` past-slot check with a timezone-aware comparison: convert the slot's local datetime to UTC before comparing against `Date.now()`. The safest approach without new dependencies is to use `Intl.DateTimeFormat` to get the UTC offset for the client's timezone at the specific date (important: offsets change with DST), then adjust.

3. Check whether `date-fns-tz` is already in `package.json`. If it is, use `zonedTimeToUtc` / `utcToZonedTime`. If not, implement the offset calculation with `Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })` — parse the offset string to get minutes.

4. The `startDate` string (line 81) is already computed as a date string (`format(new Date(), 'yyyy-MM-dd')`). This should use "today in client timezone" rather than "today in UTC". For a client at UTC-6, after 6pm UTC, `new Date()` returns tomorrow's date even though it's still today locally.

**Dependencies:** Task 1 should be complete first (correct fallback timezone). No other dependencies.

---

### Task 3 — Calendar sync error handling + retry (XDOM-15)

**Severity:** High — sync failures silently lose events with no operator feedback  
**Files:**
- `src/lib/services/calendar/index.ts` (lines 150, 239)
- `src/lib/services/calendar/google-calendar.ts` (lines ~455-458)

**Current state:**

In `syncEventToProviders()` (index.ts ~line 150):
```typescript
} catch (err) {
  console.error(`Sync to ${integration.provider} failed:`, err);
}
```
Sync failure is logged to console only. No retry, no DB status update, no operator alert.

In `fullSync()` (index.ts ~line 239):
```typescript
} catch {
  results.outbound.failed++;
}
```
Error is counted but not logged at all.

In `syncFromGoogleCalendar()` (google-calendar.ts ~line 455):
```typescript
} catch (err) {
  console.error('Google Calendar sync error:', err);
  return { created: 0, updated: 0 };
}
```
Inbound sync errors are swallowed. The `consecutiveErrors` counter on the integration is NOT incremented on inbound sync failure.

**Approach:**

1. In `syncEventToProviders()`, on catch:
   - Update the `calendarEvents` row: `syncStatus: 'error'`, `lastSyncError: err.message` (add this column if it doesn't exist — check schema first)
   - Increment `calendarIntegrations.consecutiveErrors`
   - If `consecutiveErrors >= 5`, log a sanitized error via `logSanitizedConsoleError` AND send an admin email: "Calendar sync failing for [clientName] — 5 consecutive errors. Last error: [sanitized message]."
   - Use `logSanitizedConsoleError` instead of `console.error` for all error paths

2. In `fullSync()` outbound loop, capture the error and log it with context (eventId, clientId):
   ```typescript
   } catch (err) {
     results.outbound.failed++;
     logSanitizedConsoleError('[Calendar][fullSync.outbound]', err, { eventId: event.id, clientId });
   }
   ```

3. In `syncFromGoogleCalendar()`, on catch:
   - Increment `consecutiveErrors` on the integration record (same as already done in `createGoogleEvent` and `updateGoogleEvent`)
   - Write `lastError` to the integration
   - Use `logSanitizedConsoleError`
   - Return `{ created: 0, updated: 0 }` (keep the graceful return, but make the error visible)

**Schema check:** Before implementing, check `src/db/schema/calendar-events.ts` for a `syncError`/`lastSyncError` column. If absent, add it (varchar, nullable) and run `npm run db:generate`. Do NOT push without user confirmation.

**Dependencies:** None on other tasks. The schema check is a prerequisite within this task.

---

### Task 4 — Notify homeowner on Google Calendar event changes (XDOM-16)

**Severity:** High — appointments cancelled/rescheduled in Google Calendar silently strand the homeowner  
**Files:**
- `src/lib/services/calendar/google-calendar.ts` (`syncFromGoogleCalendar`, lines 353-459)
- `src/lib/compliance/compliance-gateway.ts` (for outbound SMS)
- Possibly: `src/lib/services/calendar/index.ts` (`cancelEvent`)

**Current state:** `syncFromGoogleCalendar()` processes Google events including `status === 'cancelled'` ones, updates the local DB, but sends zero notifications. A homeowner who had an appointment can arrive at the wrong time with no warning.

**Approach:**

1. In `syncFromGoogleCalendar()`, when processing an existing local event (the `updated++` branch), detect status changes:
   - If `googleEvent.status === 'cancelled'` and `existing.status !== 'cancelled'`: this is a new cancellation. Notify the homeowner.
   - If `googleEvent.start.dateTime` differs from `existing.startTime.toISOString()`: this is a reschedule. Notify the homeowner.

2. For each case, look up the `leadId` from the existing calendar event. If `leadId` is present, fetch the lead's phone number. Fetch the client's `twilioNumber`.

3. Send via `sendCompliantMessage()` with:
   - `messageClassification: 'inbound_reply'` (responding to an existing relationship)
   - `messageCategory: 'transactional'`
   - `consentBasis: { type: 'existing_customer' }`
   - Cancellation message: "Hi [name], your appointment with [businessName] scheduled for [date] has been cancelled. Please call us at [phone] to reschedule."
   - Reschedule message: "Hi [name], your appointment with [businessName] has been rescheduled to [new date/time]. Reply STOP to opt out."

4. Also notify the `cancelEvent()` path in `index.ts` — if `cancelEvent()` is called programmatically (from admin), homeowner notification should fire there too. Currently it only deletes from Google Calendar. Add the same notification step.

**Timezone note:** Format the displayed date/time in the client's timezone, not UTC. Use `Intl.DateTimeFormat` with the client's timezone.

**Dependencies:** Task 1 (correct timezone fallback) must be complete. No dependency on Tasks 2-3.

---

### Task 5 — Calendar event creation error handling (XDOM-17)

**Severity:** High — booking failure is completely silent; appointment exists with no calendar event  
**Files:**
- `src/lib/services/appointment-booking.ts` (lines 561-573)

**Current state:**
```typescript
try {
  await createEvent({ ... });
} catch {} // Don't block booking on calendar failure
```
The empty catch block swallows all errors. No log, no error state, no operator visibility.

**Approach:**

1. Replace the empty catch with a logging catch:
```typescript
} catch (err) {
  logSanitizedConsoleError('[Booking][calendar-event-creation]', err, {
    clientId,
    leadId,
    appointmentId: result.appointmentId,
  });
}
```

2. The "don't block booking" intent is correct and should be preserved — do not re-throw. Just make the failure visible in the internal error log.

3. Optionally: after logging, mark the calendar event's `syncStatus` as `'error'` if the `createEvent()` call created a local DB record before failing. However, since `createEvent()` in `calendar/index.ts` inserts the DB record first and then calls `syncEventToProviders()`, Task 3's error handling in `syncEventToProviders()` will handle this path. Task 5 only covers the outer `try/catch` in `appointment-booking.ts`.

**Dependencies:** None. Can run in parallel with all other tasks.

---

## Parallelization

All 5 tasks touch different files or non-overlapping sections:

| Task | Files | Can parallelize with |
|------|-------|---------------------|
| Task 1 (XDOM-13) | `calendar/index.ts`, `google-calendar.ts`, `appointment-booking.ts` | Must run first (unblocks Task 2) |
| Task 2 (XDOM-14) | `appointment-booking.ts` (slot generation) | After Task 1 |
| Task 3 (XDOM-15) | `calendar/index.ts`, `google-calendar.ts` | After Task 1 (shares files but different functions) |
| Task 4 (XDOM-16) | `google-calendar.ts`, `calendar/index.ts` | After Task 1; can run parallel with Task 3 |
| Task 5 (XDOM-17) | `appointment-booking.ts` (booking path) | After Task 1; runs parallel with Tasks 3+4 |

**Recommended execution:**
- Wave 1: Task 1 alone (affects all other tasks as a prerequisite)
- Wave 2: Tasks 2, 3, 4, 5 in parallel (assign Tasks 3+4 to one agent since they share `google-calendar.ts`; Tasks 2+5 to another since they share `appointment-booking.ts`)

---

## Schema Changes

Task 3 may require a new column on `calendar_events`. Before implementing:

1. Check `src/db/schema/calendar-events.ts` for `syncError` or `lastSyncError`
2. If absent, add: `lastSyncError: varchar('last_sync_error', { length: 500 })`
3. Run `npm run db:generate` — review generated SQL
4. Ask user before running `db:push` or `db:migrate`

---

## Doc Update Requirements

Per CLAUDE.md Change→Doc mapping:

| Change | Doc to update |
|--------|---------------|
| Calendar sync error handling (Task 3) | `docs/product/PLATFORM-CAPABILITIES.md` — Section implied by calendar reliability |
| Homeowner notification on event change (Task 4) | `docs/product/PLATFORM-CAPABILITIES.md` — Section on Booking/Calendar |
| Timezone fixes (Tasks 1, 2) | `docs/engineering/01-TESTING-GUIDE.md` — update calendar test steps to verify Alberta timezone |

---

## Verification Gate

After implementation:
1. `npm run ms:gate` (fast check during development)
2. `npm run quality:no-regressions` (completion gate)

Key manual test vectors:
- Create an appointment for a client with `timezone: 'America/Edmonton'` — verify the Google Calendar event shows the correct local time
- Available slots for a client in `America/Edmonton` at 7pm UTC (1pm local) should show afternoon slots, not truncate them
- Force a sync error (revoke Google token) — verify `consecutiveErrors` increments, error logged, admin alerted after 5 failures
- Cancel a Google Calendar event externally, trigger sync — verify homeowner receives SMS
- Trigger a booking — confirm calendar creation failure is logged in internal error log, booking still succeeds
