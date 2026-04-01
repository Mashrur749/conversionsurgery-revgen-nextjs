# FIX-01: Calendar Double-Booking Prevention

Status: Ready
Priority: DEALBREAKER
Estimated files: 1-2

---

## Problem

`getAvailableSlots()` in `src/lib/services/appointment-booking.ts` only checks the `appointments` table for conflicts. It ignores the `calendar_events` table (which stores Google Calendar synced events). If a contractor books something in Google Calendar, the AI will offer that slot to a lead — causing a double-booking.

## Solution

Modify `getAvailableSlots()` to also query `calendar_events` and merge those into the `blockedSlots` set before generating available slots.

## Implementation

### Step 1: Modify `getAvailableSlots()` in `src/lib/services/appointment-booking.ts`

**After line 59** (after the existing `existingAppointments` query), add a query for `calendar_events`:

```typescript
import { calendarEvents } from '@/db/schema';

// Also check calendar events (Google Calendar, etc.) for conflicts
const externalEvents = await db
  .select({
    startTime: calendarEvents.startTime,
    endTime: calendarEvents.endTime,
  })
  .from(calendarEvents)
  .where(and(
    eq(calendarEvents.clientId, clientId),
    gte(calendarEvents.startTime, new Date(`${startDate}T00:00:00`)),
    lte(calendarEvents.startTime, new Date(`${endDate}T23:59:59`)),
    not(eq(calendarEvents.status, 'cancelled'))
  ));
```

**Merge into `blockedSlots`** (after line 64, after the existing Set creation):

```typescript
// Block slots that overlap with external calendar events
for (const event of externalEvents) {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  // Block every hourly slot that overlaps with this event
  for (let i = 0; i < 7; i++) {
    const date = addDays(new Date(startDate), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayHours = hoursByDay.get(date.getDay());
    if (!dayHours?.isOpen || !dayHours.openTime || !dayHours.closeTime) continue;
    const [openHour] = dayHours.openTime.split(':').map(Number);
    const [closeHour] = dayHours.closeTime.split(':').map(Number);
    for (let hour = openHour; hour < closeHour; hour++) {
      const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
      const slotEnd = addHours(slotStart, 1);
      // Check overlap: slot overlaps event if slot starts before event ends AND slot ends after event starts
      if (isBefore(slotStart, eventEnd) && isAfter(slotEnd, eventStart)) {
        const timeStr = `${String(hour).padStart(2, '0')}:00`;
        blockedSlots.add(`${dateStr}|${timeStr}`);
      }
    }
  }
}
```

**Important:** `addHours`, `isBefore`, `isAfter` are already imported from `date-fns`.

### Step 2: Also block in `bookAppointment()` race-condition check

The existing race-condition guard at lines 158-172 only checks `appointments`. Add a parallel check against `calendar_events` to prevent booking into an externally-blocked slot.

After the existing appointment conflict check, add:

```typescript
// Also check calendar event conflicts
const [calendarConflict] = await db
  .select({ id: calendarEvents.id })
  .from(calendarEvents)
  .where(and(
    eq(calendarEvents.clientId, clientId),
    not(eq(calendarEvents.status, 'cancelled')),
    lte(calendarEvents.startTime, slotEnd),
    gte(calendarEvents.endTime, slotStart)
  ))
  .limit(1);

if (calendarConflict) {
  return { success: false, error: 'This time slot is no longer available (calendar conflict).' };
}
```

### Edge Cases

1. **Calendar event spans multiple hours** — The overlap loop handles this by checking each hourly slot against the event's start/end range.
2. **Calendar event with no endTime** — `calendar_events.endTime` is NOT NULL in schema, so this can't happen.
3. **Google Calendar sync hasn't run yet** — Events won't be in `calendar_events`. This is acceptable — the 15-min sync interval is the maximum exposure window. Document this as a known limitation.
4. **Timezone mismatch** — `calendar_events.startTime` is a timestamp (UTC-stored), while `appointments` uses naive date/time. The slot generation uses local date strings. Use the client's timezone when constructing `Date` objects for comparison. For MVP, compare as UTC — the sync already stores in UTC.
5. **All-day events in Google Calendar** — These have midnight-to-midnight times. The overlap logic will correctly block all business-hour slots for that day.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/services/appointment-booking.ts` | Add `calendarEvents` import, query, and merge into `blockedSlots`. Add conflict check in `bookAppointment()`. |

### Verification

1. `npm run typecheck` passes
2. `npm run build` passes
3. `npm test` passes (existing booking tests still work)
4. Manual test: create a `calendar_events` row for a slot, verify `getAvailableSlots()` excludes it
5. `npm run quality:no-regressions` passes

### Resume Point

If interrupted, check:
- Did `appointment-booking.ts` get the `calendarEvents` import? → If not, start from Step 1.
- Did `getAvailableSlots()` get the external events query? → If not, add it after the `existingAppointments` query.
- Did `bookAppointment()` get the calendar conflict check? → If not, add it after the appointment conflict check.
- Run `npm run typecheck` to verify state.
