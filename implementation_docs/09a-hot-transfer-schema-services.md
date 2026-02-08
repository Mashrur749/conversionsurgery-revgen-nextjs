# Phase 9a: Hot Transfer Schema & Services

## Current State (after Phase 8)
- Team escalation working with claim system
- Team members can be managed in settings

## Goal
Add business hours and ring group functionality for high-intent leads.

---

## Step 1: Add Business Hours and Call Attempts Tables

**APPEND** to `src/lib/db/schema.ts` (add BEFORE the RELATIONS section):

```typescript
// ============================================
// BUSINESS HOURS
// ============================================
export const businessHours = pgTable('business_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  openTime: time('open_time'),
  closeTime: time('close_time'),
  isOpen: boolean('is_open').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  clientDayUnique: uniqueIndex('business_hours_client_day_unique').on(table.clientId, table.dayOfWeek),
}));

// ============================================
// CALL ATTEMPTS
// ============================================
export const callAttempts = pgTable('call_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  callSid: varchar('call_sid', { length: 50 }),
  status: varchar('status', { length: 20 }),
  answeredBy: uuid('answered_by').references(() => teamMembers.id),
  duration: integer('duration'),
  recordingUrl: varchar('recording_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
  answeredAt: timestamp('answered_at'),
  endedAt: timestamp('ended_at'),
});
```

**APPEND** to the RELATIONS section:

```typescript
export const businessHoursRelations = relations(businessHours, ({ one }) => ({
  client: one(clients, { fields: [businessHours.clientId], references: [clients.id] }),
}));

export const callAttemptsRelations = relations(callAttempts, ({ one }) => ({
  lead: one(leads, { fields: [callAttempts.leadId], references: [leads.id] }),
  client: one(clients, { fields: [callAttempts.clientId], references: [clients.id] }),
  answeredByMember: one(teamMembers, { fields: [callAttempts.answeredBy], references: [teamMembers.id] }),
}));
```

Then push:
```bash
npx drizzle-kit push
```

---

## Step 2: Create Business Hours Service

**CREATE** `src/lib/services/business-hours.ts`:

```typescript
import { db } from '@/lib/db';
import { businessHours } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function initializeBusinessHours(clientId: string) {
  const defaults = [
    { day: 0, isOpen: false },
    { day: 1, isOpen: true },
    { day: 2, isOpen: true },
    { day: 3, isOpen: true },
    { day: 4, isOpen: true },
    { day: 5, isOpen: true },
    { day: 6, isOpen: false },
  ];

  for (const { day, isOpen } of defaults) {
    await db
      .insert(businessHours)
      .values({
        clientId,
        dayOfWeek: day,
        openTime: '08:00',
        closeTime: '18:00',
        isOpen,
      })
      .onConflictDoNothing();
  }
}

export async function isWithinBusinessHours(
  clientId: string,
  timezone: string = 'America/Edmonton'
): Promise<boolean> {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;

  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
  };

  const dayOfWeek = dayMap[weekday || 'Mon'];
  const currentTime = `${hour}:${minute}`;

  const [hours] = await db
    .select()
    .from(businessHours)
    .where(and(
      eq(businessHours.clientId, clientId),
      eq(businessHours.dayOfWeek, dayOfWeek)
    ))
    .limit(1);

  if (!hours || !hours.isOpen) {
    return false;
  }

  const openTime = hours.openTime || '00:00';
  const closeTime = hours.closeTime || '23:59';

  return currentTime >= openTime && currentTime <= closeTime;
}

export async function getBusinessHours(clientId: string) {
  return db
    .select()
    .from(businessHours)
    .where(eq(businessHours.clientId, clientId))
    .orderBy(businessHours.dayOfWeek);
}
```

---

## Step 3: Add Hot Intent Detection to OpenAI Service

**APPEND** to `src/lib/services/openai.ts`:

```typescript
const HOT_INTENT_TRIGGERS = [
  'ready to schedule',
  'ready to book',
  'can you call me',
  'call me',
  'give me a call',
  'want to proceed',
  'let\'s do it',
  'let\'s move forward',
  'when can you start',
  'i\'m ready',
  'book an appointment',
  'schedule an estimate',
  'come out today',
  'come out tomorrow',
  'available today',
  'available tomorrow',
];

export function detectHotIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return HOT_INTENT_TRIGGERS.some(trigger => lowerMessage.includes(trigger));
}
```

---

## Step 4: Create Ring Group Service

**CREATE** `src/lib/services/ring-group.ts`:

```typescript
import twilio from 'twilio';
import { db } from '@/lib/db';
import { teamMembers, callAttempts, leads, clients } from '@/lib/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and } from 'drizzle-orm';
import { formatPhoneNumber } from '@/lib/utils/phone';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

interface RingGroupPayload {
  leadId: string;
  clientId: string;
  leadPhone: string;
  twilioNumber: string;
}

export async function initiateRingGroup(payload: RingGroupPayload) {
  const { leadId, clientId, leadPhone, twilioNumber } = payload;

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ))
    .orderBy(teamMembers.priority);

  if (members.length === 0) {
    console.log('No team members configured for hot transfers');
    return { initiated: false, reason: 'No team members' };
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  const leadDisplay = lead?.name || formatPhoneNumber(leadPhone);

  const [callAttempt] = await db
    .insert(callAttempts)
    .values({
      leadId,
      clientId,
      status: 'initiated',
    })
    .returning();

  const connectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-connect?attemptId=${callAttempt.id}&leadPhone=${encodeURIComponent(leadPhone)}`;
  const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-status?attemptId=${callAttempt.id}`;

  try {
    const call = await twilioClient.calls.create({
      to: leadPhone,
      from: twilioNumber,
      url: connectUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      timeout: 30,
    });

    await db
      .update(callAttempts)
      .set({ callSid: call.sid, status: 'ringing' })
      .where(eq(callAttempts.id, callAttempt.id));

    for (const member of members) {
      await sendSMS(
        member.phone,
        twilioNumber,
        `🔥 Hot lead calling! ${leadDisplay} wants to talk NOW. Your phone will ring shortly.`
      );
    }

    return {
      initiated: true,
      callSid: call.sid,
      attemptId: callAttempt.id,
      membersToRing: members.length,
    };
  } catch (error) {
    console.error('Failed to initiate ring group:', error);

    await db
      .update(callAttempts)
      .set({ status: 'failed' })
      .where(eq(callAttempts.id, callAttempt.id));

    return { initiated: false, error };
  }
}

export async function handleNoAnswer(payload: RingGroupPayload) {
  const { leadId, clientId, leadPhone, twilioNumber } = payload;

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ));

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  const leadDisplay = lead?.name || formatPhoneNumber(leadPhone);

  for (const member of members) {
    await sendSMS(
      member.phone,
      twilioNumber,
      `⚠️ Missed hot transfer! ${leadDisplay} wanted to talk but no one answered. Call them back ASAP: ${formatPhoneNumber(leadPhone)}`
    );
  }

  await sendSMS(
    leadPhone,
    twilioNumber,
    `Sorry we missed you! We'll call you right back. If urgent, you can also call us directly at this number.`
  );

  await db
    .update(leads)
    .set({
      actionRequired: true,
      actionRequiredReason: 'Hot transfer - no answer',
    })
    .where(eq(leads.id, leadId));
}
```

---

## Verify

1. Schema pushed successfully
2. Files exist:
   - `src/lib/services/business-hours.ts`
   - `src/lib/services/ring-group.ts`
3. `detectHotIntent` added to openai.ts
4. No TypeScript errors

---

## Next
Proceed to **Phase 9b** for webhooks, UI, and SMS update.
