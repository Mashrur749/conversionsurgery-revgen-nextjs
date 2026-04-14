# Pre-Launch Critical Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 pre-launch issues — compliance risks, data bugs, race conditions — before first client onboards.

**Architecture:** Surgical fixes to existing files. No new services or tables. One new shared utility (`send-window.ts`). No schema migrations.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest, Zod

**Source specs:**
- `docs/superpowers/specs/2026-04-13-ai-audit-issues.md` (AUDIT-01, 02, 03, 11)
- `docs/superpowers/specs/2026-04-13-scenario-simulation.md` (SIM-01, 08, 10, RACE-02, 03)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/utils/send-window.ts` | Shared timezone-aware send window check |
| Create | `src/lib/utils/send-window.test.ts` | Tests for send window utility |
| Modify | `src/app/api/cron/process-scheduled/route.ts` | AUDIT-01: freshness gate before AI generation |
| Modify | `src/lib/automations/win-back.ts` | AUDIT-02: use shared send window; AUDIT-03: temperature 0.6 |
| Modify | `src/lib/automations/dormant-reengagement.ts` | AUDIT-02: use shared send window |
| Modify | `src/lib/services/signal-detection.ts` | AUDIT-11: chatJSON → chatStructured with Zod |
| Modify | `src/lib/compliance/opt-out-handler.ts` | SIM-10: 'active' → 'contacted' |
| Modify | `src/lib/agent/orchestrator.ts` | SIM-01: update leads.status; SIM-08: escalation ack |
| Modify | `src/lib/services/smart-assist-lifecycle.ts` | RACE-02: auto-cancel on manual reply |
| Modify | `src/lib/automations/incoming-sms.ts` | RACE-03: PAUSE cancels flow executions |
| Modify | `src/lib/services/flow-execution.ts` | RACE-03: helper to cancel active flows |

---

### Task 1: Shared Timezone-Aware Send Window Utility (AUDIT-02)

**Files:**
- Create: `src/lib/utils/send-window.ts`
- Create: `src/lib/utils/send-window.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// src/lib/utils/send-window.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isWithinLocalSendWindow } from './send-window';

// Standard win-back/dormant overrides: Monday no earlier than 11am, Friday no later than 1pm
const WIN_BACK_OVERRIDES = [
  { day: 1, startHour: 11 },  // Monday: 11am-2pm
  { day: 5, endHour: 13 },    // Friday: 10am-1pm
];

describe('isWithinLocalSendWindow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true during weekday business window in Alberta', () => {
    // Tuesday 11am Mountain Time = Tuesday 5pm UTC (MDT is UTC-6)
    vi.setSystemTime(new Date('2026-04-14T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
  });

  it('returns false before window opens in Alberta timezone', () => {
    // Tuesday 9am Mountain = Tuesday 3pm UTC
    vi.setSystemTime(new Date('2026-04-14T15:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('returns false after window closes in Alberta timezone', () => {
    // Tuesday 3pm Mountain = Tuesday 9pm UTC
    vi.setSystemTime(new Date('2026-04-14T21:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('returns false on Saturday', () => {
    vi.setSystemTime(new Date('2026-04-18T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('returns false on Sunday', () => {
    vi.setSystemTime(new Date('2026-04-19T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('handles edge at exactly window open', () => {
    vi.setSystemTime(new Date('2026-04-14T16:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
  });

  it('handles edge at exactly window close', () => {
    vi.setSystemTime(new Date('2026-04-14T20:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('works with different timezone', () => {
    vi.setSystemTime(new Date('2026-04-14T15:00:00Z'));
    expect(isWithinLocalSendWindow('America/Toronto', 10, 14)).toBe(true);
  });

  // Day-specific override tests
  it('blocks Monday before 11am with day override', () => {
    // Monday 10:30am Mountain = Monday 4:30pm UTC
    vi.setSystemTime(new Date('2026-04-13T16:30:00Z'));
    // Without override: 10:30am is within 10-14 → true
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
    // With override: Monday starts at 11am → false
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(false);
  });

  it('allows Monday at 11am with day override', () => {
    // Monday 11am Mountain = Monday 5pm UTC
    vi.setSystemTime(new Date('2026-04-13T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(true);
  });

  it('blocks Friday at 1pm with day override', () => {
    // Friday 1pm Mountain = Friday 7pm UTC
    vi.setSystemTime(new Date('2026-04-17T19:00:00Z'));
    // Without override: 1pm is within 10-14 → true
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
    // With override: Friday ends at 1pm → false
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(false);
  });

  it('allows Friday at 12pm with day override', () => {
    // Friday 12pm Mountain = Friday 6pm UTC
    vi.setSystemTime(new Date('2026-04-17T18:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(true);
  });

  it('Tuesday unaffected by day overrides', () => {
    // Tuesday 10:30am Mountain
    vi.setSystemTime(new Date('2026-04-14T16:30:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/utils/send-window.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the utility**

```typescript
// src/lib/utils/send-window.ts

export interface DayOverride {
  /** Day of week: 0=Sunday, 1=Monday ... 6=Saturday */
  day: number;
  /** Override start hour for this day (inclusive, 0-23) */
  startHour?: number;
  /** Override end hour for this day (exclusive, 0-23) */
  endHour?: number;
}

/**
 * Timezone-aware send window check.
 * Returns true if current time is within the specified hour range on a weekday
 * in the given timezone, respecting optional day-specific overrides.
 *
 * @param timezone - IANA timezone string (e.g., 'America/Edmonton')
 * @param startHour - Default window open hour (inclusive, 0-23)
 * @param endHour - Default window close hour (exclusive, 0-23)
 * @param dayOverrides - Optional per-day start/end hour overrides
 */
export function isWithinLocalSendWindow(
  timezone: string,
  startHour: number,
  endHour: number,
  dayOverrides?: DayOverride[],
): boolean {
  const now = new Date();

  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);

  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(now);

  const isWeekend = dayStr === 'Sat' || dayStr === 'Sun';
  if (isWeekend) return false;

  // Map day string to number for override lookup
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayNum = dayMap[dayStr];

  // Apply day-specific overrides if present
  let effectiveStart = startHour;
  let effectiveEnd = endHour;

  if (dayOverrides && dayNum !== undefined) {
    const override = dayOverrides.find((o) => o.day === dayNum);
    if (override) {
      if (override.startHour !== undefined) effectiveStart = override.startHour;
      if (override.endHour !== undefined) effectiveEnd = override.endHour;
    }
  }

  if (hour < effectiveStart || hour >= effectiveEnd) return false;

  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/utils/send-window.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/send-window.ts src/lib/utils/send-window.test.ts
git commit -m "feat: add timezone-aware send window utility (AUDIT-02)"
```

---

### Task 2: Fix Timezone in Win-Back (AUDIT-02) + Temperature (AUDIT-03)

**Files:**
- Modify: `src/lib/automations/win-back.ts:44-51,343`

- [ ] **Step 1: Read current file to confirm line numbers**

Run: Read `src/lib/automations/win-back.ts` lines 1-60 and line 340-350.

- [ ] **Step 2: Replace inline send window check with shared utility**

Replace the inline UTC-based time check (around lines 44-51) with:

```typescript
import { isWithinLocalSendWindow } from '@/lib/utils/send-window';
```

Then replace the body of the time-check block:

```typescript
// Old (lines ~44-51):
const now = new Date();
const hour = now.getHours();
const dayOfWeek = now.getDay();
if (dayOfWeek === 0 || dayOfWeek === 6) return { processed: 0, sent: 0, skipped: 0 };
if (hour < 10 || hour >= 14) return { processed: 0, sent: 0, skipped: 0 };
```

```typescript
// New — replaces ALL 4 lines (44-51) including Monday/Friday rules:
const WIN_BACK_DAY_OVERRIDES = [
  { day: 1, startHour: 11 },  // Monday: 11am-2pm (no early Monday)
  { day: 5, endHour: 13 },    // Friday: 10am-1pm (early Friday cutoff)
];

if (!isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_DAY_OVERRIDES)) {
  return { eligible: 0, messaged: 0, markedDormant: 0, errors: [] };
}
```

This replaces ALL 8 lines (44-51): the `now`, `hour`, `dayOfWeek` variables AND the 4 conditional returns (weekends, hours, Monday, Friday). The utility handles all of it. The return value shape must match `processWinBacks()` return type — verified as `{ eligible, messaged, markedDormant, errors }`.

- [ ] **Step 3: Reduce temperature from 0.9 to 0.6**

```typescript
// Old (line ~343):
temperature: 0.9,

// New:
temperature: 0.6,
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no new errors)

- [ ] **Step 5: Run existing tests**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/automations/win-back.ts
git commit -m "fix: timezone-aware send window + reduce temperature to 0.6 (AUDIT-02, AUDIT-03)"
```

---

### Task 3: Fix Timezone in Dormant Re-engagement (AUDIT-02)

**Files:**
- Modify: `src/lib/automations/dormant-reengagement.ts:55-66`

- [ ] **Step 1: Read current file to confirm line numbers**

Run: Read `src/lib/automations/dormant-reengagement.ts` lines 50-70.

- [ ] **Step 2: Replace isWithinSendWindow with shared utility**

```typescript
import { isWithinLocalSendWindow } from '@/lib/utils/send-window';
```

Replace the local `isWithinSendWindow()` function (lines ~55-66):

```typescript
// Old:
function isWithinSendWindow(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  if (hour < 10 || hour >= 14) return false;
  return true;
}

// New — delete the function entirely, use the import at call sites.
// The dormant-reengagement file has the SAME day-specific rules as win-back.
// Replace calls from: isWithinSendWindow()
// To:
const DORMANT_DAY_OVERRIDES = [
  { day: 1, startHour: 11 },  // Monday: 11am-2pm
  { day: 5, endHour: 13 },    // Friday: 10am-1pm
];
if (!isWithinLocalSendWindow('America/Edmonton', 10, 14, DORMANT_DAY_OVERRIDES)) {
  return { processed: 0, sent: 0, skipped: 0, errors: [] };
}
// NOTE: Verify the return type shape matches runDormantReengagement() return type.
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/automations/dormant-reengagement.ts
git commit -m "fix: use timezone-aware send window in dormant re-engagement (AUDIT-02)"
```

---

### Task 4: Freshness Gate for __AI_GENERATE__ Scheduled Messages (AUDIT-01)

**Files:**
- Modify: `src/app/api/cron/process-scheduled/route.ts:152-168`

- [ ] **Step 1: Read current code to confirm exact insertion point**

Run: Read `src/app/api/cron/process-scheduled/route.ts` lines 145-175.

- [ ] **Step 2: Add freshness gate before AI generation**

Add `leadContext` to the existing `@/db/schema` import on line 11:

```typescript
// Line 11 currently:
import { auditLog, calendarEvents, clientMemberships, people } from '@/db/schema';
// Change to:
import { auditLog, calendarEvents, clientMemberships, people, leadContext } from '@/db/schema';
```

VERIFIED: `conversations` is already imported from `@/db` (line 2). `gte` and `and` are already imported from `drizzle-orm` (line 12). `leadContext` is NOT currently imported — this is the only addition needed.

Insert freshness gate after `if (message.content === '__AI_GENERATE__')` and before `let generated`:

```typescript
if (message.content === '__AI_GENERATE__') {
  // Freshness gate: check if context has changed since scheduling (AUDIT-01)
  const [ctx] = await db
    .select({ stage: leadContext.stage })
    .from(leadContext)
    .where(eq(leadContext.leadId, lead.id))
    .limit(1);

  if (ctx && ['booked', 'won', 'lost'].includes(ctx.stage)) {
    await markCancelled(db, message.id, `Lead stage changed to ${ctx.stage} since scheduling`);
    skipped++;
    continue;
  }

  // Check for recent inbound activity (lead replied within 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentInbound] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, lead.id),
        eq(conversations.direction, 'inbound'),
        gte(conversations.createdAt, sevenDaysAgo),
      )
    )
    .limit(1);

  if (recentInbound) {
    await markCancelled(db, message.id, 'Lead had recent inbound activity');
    skipped++;
    continue;
  }

  let generated: string | null = null;
  // ... rest of existing code
```

- [ ] **Step 3: Verify imports are correct**

Check that `leadContext`, `conversations`, `gte`, and `and` are all imported. Add any missing:

```typescript
// Likely needed addition:
import { gte } from 'drizzle-orm';  // May already be imported — check
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/process-scheduled/route.ts
git commit -m "fix: add freshness gate before AI-generated scheduled messages (AUDIT-01)"
```

---

### Task 5: Signal Detection — chatJSON to chatStructured (AUDIT-11)

**Files:**
- Modify: `src/lib/services/signal-detection.ts:1-127`

- [ ] **Step 1: Read current file**

Run: Read `src/lib/services/signal-detection.ts` full file.

- [ ] **Step 2: Add Zod schema for DetectedSignals**

Add import and schema definition at top of file:

```typescript
import { z } from 'zod';

const detectedSignalsSchema = z.object({
  readyToSchedule: z.boolean(),
  wantsEstimate: z.boolean(),
  jobComplete: z.boolean(),
  satisfied: z.boolean(),
  frustrated: z.boolean(),
  priceObjection: z.boolean(),
  urgentNeed: z.boolean(),
  justBrowsing: z.boolean(),
  referralMention: z.boolean(),
  paymentMention: z.boolean(),
  confidence: z.number().min(0).max(100),
  rawSignals: z.array(z.string()),
});
```

- [ ] **Step 3: Replace chatJSON with chatStructured**

Replace the `ai.chatJSON<DetectedSignals>(...)` call (around line 63) with:

```typescript
// Old:
const { data } = await ai.chatJSON<DetectedSignals>(
  [{ role: 'user', content: conversationText }],
  {
    systemPrompt: SIGNAL_PROMPT,
    temperature: 0.3,
    maxTokens: 500,
  },
);

// New:
const { data } = await ai.chatStructured(
  [{ role: 'user', content: conversationText }],
  detectedSignalsSchema,
  {
    systemPrompt: SIGNAL_PROMPT,
    temperature: 0.3,
    maxTokens: 500,
  },
);
```

- [ ] **Step 4: Remove the || false defaults**

The lines after the chatJSON call that apply `|| false` defaults per field are now unnecessary — Zod enforces the schema. Remove them. Keep any post-processing that does real logic (like `mapSignalsToFlows()`).

- [ ] **Step 5: Run typecheck + existing tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/signal-detection.ts
git commit -m "fix: use chatStructured with Zod validation for signal detection (AUDIT-11)"
```

---

### Task 6: Fix opt-out-handler 'active' Bug (SIM-10)

**Files:**
- Modify: `src/lib/compliance/opt-out-handler.ts:81`

- [ ] **Step 1: Read the file to confirm exact line**

Run: Read `src/lib/compliance/opt-out-handler.ts` lines 75-90.

- [ ] **Step 2: Fix the bug**

```typescript
// Old (line ~81):
status: 'active',

// New:
status: 'contacted',
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/compliance/opt-out-handler.ts
git commit -m "fix: use 'contacted' not 'active' on re-subscribe (SIM-10)"
```

---

### Task 7: Update leads.status on First AI Response + Escalation Acknowledgment (SIM-01, SIM-08)

**Files:**
- Modify: `src/lib/agent/orchestrator.ts`

- [ ] **Step 1: Read orchestrator response-sending block and escalation block**

Run: Read `src/lib/agent/orchestrator.ts` lines 410-515.

- [ ] **Step 2: Add `and` to drizzle-orm imports**

```typescript
// Line 14 currently:
import { eq, desc } from 'drizzle-orm';
// Change to:
import { eq, desc, and } from 'drizzle-orm';
```

VERIFIED: `and` is NOT currently imported. Both `leads` and `conversations` ARE already imported from `@/db/schema`.

- [ ] **Step 3: Add leads.status update after first successful AI response (SIM-01)**

After `responseSent = true` (around line 483), add:

```typescript
if (responseSent) {
  // SIM-01: Update leads.status to 'contacted' on first AI response
  if (lead.status === 'new') {
    await db
      .update(leads)
      .set({ status: 'contacted', updatedAt: new Date() })
      .where(and(eq(leads.id, leadId), eq(leads.status, 'new')));
  }
}
```

- [ ] **Step 4: Add escalation acknowledgment (SIM-08)**

In the escalation block (around line 495-514), BEFORE creating the escalation queue entry, send an acknowledgment:

```typescript
// Handle escalation
if (finalState.needsEscalation) {
  // SIM-08: Send acknowledgment before escalating — homeowner shouldn't get silence
  const escalationAck = `I hear you, and I want to make sure this gets handled properly. I'm connecting you with ${client.ownerName} directly — expect to hear from them shortly.`;

  const ackResult = await sendCompliantMessage({
    clientId: client.id,
    to: lead.phone,
    from: client.twilioNumber,
    body: escalationAck,
    messageClassification: 'inbound_reply',
    messageCategory: 'transactional',
    consentBasis: { type: 'lead_reply' },
    leadId,
    queueOnQuietHours: false,
    metadata: { source: 'escalation_acknowledgment' },
  });

  if (ackResult.sent) {
    await db.insert(conversations).values({
      leadId,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'ai_response',
      content: escalationAck,
      twilioSid: ackResult.messageSid || undefined,
    });
    responseSent = true;
  }

  // Existing escalation queue insert follows...
  await db.insert(escalationQueue).values({
    // ... existing code unchanged
  });

  escalated = true;
  // ... rest of existing escalation code
}
```

- [ ] **Step 4: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/orchestrator.ts
git commit -m "fix: update leads.status on first response + send escalation ack (SIM-01, SIM-08)"
```

---

### Task 8: Smart Assist Auto-Cancel on Manual Reply (RACE-02)

**Files:**
- Modify: `src/lib/services/smart-assist-lifecycle.ts`

- [ ] **Step 1: Read processDueSmartAssistDrafts**

Run: Read `src/lib/services/smart-assist-lifecycle.ts` lines 480-529.

- [ ] **Step 2: Add freshness check before auto-sending**

In `sendSmartAssistDraftNow()`, after loading the `row` (the scheduled message + lead + client), add a check for recent outbound messages:

Read lines 194-220 first to find exact insertion point. After the `not_pending` check (around line 221) and before the atomic claim (around line 245):

First, add `gte` to the drizzle-orm import on line 2:

```typescript
// Line 2 currently:
import { and, eq, lte, sql } from 'drizzle-orm';
// Change to:
import { and, eq, gte, lte, sql } from 'drizzle-orm';
```

VERIFIED: `conversations` IS already imported (line 1). `gte` is NOT imported — needs adding.

Then insert the check. After the `resolveSmartAssistTransition` check (~line 229) and before the atomic claim (~line 245):

```typescript
// RACE-02: Auto-cancel if ANY outbound message was sent for this lead since draft was queued.
// This catches: manual dashboard replies (messageType: 'manual'), AI auto-responses,
// and any other outbound. If something was already sent, the draft is redundant.
if (params.action === 'auto_send') {
  const draftCreatedAt = message.createdAt ?? new Date(0);
  const [recentOutbound] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, message.leadId!),
        eq(conversations.direction, 'outbound'),
        gte(conversations.createdAt, draftCreatedAt),
      )
    )
    .limit(1);

  if (recentOutbound) {
    await cancelSmartAssistDraft({
      scheduledMessageId: message.id,
      reason: 'Outbound message sent after draft was queued',
      source: 'auto_cancel_outbound_exists',
    });
    return { success: false, status: 'cancelled', reason: 'blocked' as const };
  }
}
```

NOTE: We check for ANY outbound (not just `messageType: 'manual'`) because if the AI already auto-sent a different response, or a scheduled message fired, the draft is stale regardless of who sent it.

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/smart-assist-lifecycle.ts
git commit -m "fix: auto-cancel smart assist draft when contractor replies manually (RACE-02)"
```

---

### Task 9: PAUSE Cancels Flow Executions (RACE-03)

**Files:**
- Modify: `src/lib/services/flow-execution.ts` (add helper)
- Modify: `src/lib/automations/incoming-sms.ts` (call helper from PAUSE handler)

- [ ] **Step 1: Read flow-execution.ts to find insertion point for helper**

Run: Read `src/lib/services/flow-execution.ts` lines 1-40 (imports and exports).

- [ ] **Step 2: Add cancelActiveFlowsForClient helper**

Add to `src/lib/services/flow-execution.ts`:

```typescript
/**
 * Cancel all active flow executions for a client.
 * Used by PAUSE command to stop all automated sequences.
 */
export async function cancelActiveFlowsForClient(clientId: string): Promise<number> {
  const db = getDb();
  const cancelled = await db
    .update(flowExecutions)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(flowExecutions.clientId, clientId),
        eq(flowExecutions.status, 'active'),
      )
    )
    .returning({ id: flowExecutions.id });

  return cancelled.length;
}
```

VERIFIED: `flowExecutions` IS imported from `@/db/schema` (line 2). It HAS `clientId`, `status` columns. It does NOT have `updatedAt` — use `cancelledAt` instead:

```typescript
.set({
  status: 'cancelled',
  cancelledAt: new Date(),
  cancelReason: 'PAUSE command',
})
```

Also add `and` to the drizzle-orm import in flow-execution.ts:

```typescript
// Line 3 currently:
import { eq } from 'drizzle-orm';
// Change to:
import { eq, and } from 'drizzle-orm';
```

- [ ] **Step 3: Read PAUSE handler in incoming-sms.ts**

Run: Read `src/lib/automations/incoming-sms.ts` lines 300-340 to find PAUSE block.

- [ ] **Step 4: Add flow cancellation to PAUSE handler**

After the existing `scheduledMessages` cancellation in the PAUSE block, add:

```typescript
import { cancelActiveFlowsForClient } from '@/lib/services/flow-execution';

// Inside PAUSE handler, after scheduledMessages cancellation:
const cancelledFlows = await cancelActiveFlowsForClient(client.id);
if (cancelledFlows > 0) {
  console.log(`[PAUSE] Cancelled ${cancelledFlows} active flow executions for client ${client.id}`);
}
```

- [ ] **Step 5: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/flow-execution.ts src/lib/automations/incoming-sms.ts
git commit -m "fix: PAUSE command cancels active flow executions (RACE-03)"
```

---

### Task 10: Run Full Quality Gate

- [ ] **Step 1: Run no-regressions gate**

Run: `npm run quality:no-regressions`
Expected: All green

- [ ] **Step 2: Run AI tests (if API key available)**

Run: `npm run test:ai`
Expected: All pass (signal-detection tests may need schema alignment)

- [ ] **Step 3: Final commit if any fixes needed**

If any quality gate issues arise from the changes, fix and commit.

---

## Verification Checklist

After all tasks complete, verify each issue is resolved:

| Issue | Verification |
|-------|-------------|
| AUDIT-01 | grep `__AI_GENERATE__` in process-scheduled → freshness gate before generation |
| AUDIT-02 | grep `getHours` in win-back.ts and dormant-reengagement.ts → should NOT find raw getHours |
| AUDIT-03 | grep `temperature` in win-back.ts → should show 0.6 |
| AUDIT-11 | grep `chatJSON` in signal-detection.ts → should NOT find chatJSON |
| SIM-01 | grep `leads.status` in orchestrator.ts → should find 'contacted' update |
| SIM-08 | grep `escalation_acknowledgment` in orchestrator.ts → should find ack message |
| SIM-10 | grep `active` in opt-out-handler.ts → should NOT find status: 'active' |
| RACE-02 | grep `auto_cancel_manual_reply` in smart-assist-lifecycle.ts → should find check |
| RACE-03 | grep `cancelActiveFlowsForClient` in incoming-sms.ts → should find call |
