# Phase 8a: Team Escalation Schema & Service

## Current State (after Phase 7)
- Admin system working
- `getClientId()` helper exists
- All dashboard pages support admin view

## Goal
Add team members table, escalation claims table, and escalation service.

---

## Step 1: Update Schema with Team Tables

**APPEND** to `src/lib/db/schema.ts` (add BEFORE the RELATIONS section):

```typescript
// ============================================
// TEAM MEMBERS
// ============================================
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }),
  role: varchar('role', { length: 50 }),
  receiveEscalations: boolean('receive_escalations').default(true),
  receiveHotTransfers: boolean('receive_hot_transfers').default(true),
  priority: integer('priority').default(1),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  clientIdIdx: index('idx_team_members_client_id').on(table.clientId),
}));

// ============================================
// ESCALATION CLAIMS
// ============================================
export const escalationClaims = pgTable('escalation_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  claimedBy: uuid('claimed_by').references(() => teamMembers.id),
  claimToken: varchar('claim_token', { length: 64 }).notNull().unique(),
  escalationReason: varchar('escalation_reason', { length: 255 }),
  lastLeadMessage: text('last_lead_message'),
  status: varchar('status', { length: 20 }).default('pending'),
  notifiedAt: timestamp('notified_at').defaultNow(),
  claimedAt: timestamp('claimed_at'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  leadIdIdx: index('idx_escalation_claims_lead_id').on(table.leadId),
  tokenIdx: index('idx_escalation_claims_token').on(table.claimToken),
}));
```

**APPEND** to the RELATIONS section in `src/lib/db/schema.ts`:

```typescript
export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  client: one(clients, { fields: [teamMembers.clientId], references: [clients.id] }),
  claims: many(escalationClaims),
}));

export const escalationClaimsRelations = relations(escalationClaims, ({ one }) => ({
  lead: one(leads, { fields: [escalationClaims.leadId], references: [leads.id] }),
  client: one(clients, { fields: [escalationClaims.clientId], references: [clients.id] }),
  claimedByMember: one(teamMembers, { fields: [escalationClaims.claimedBy], references: [teamMembers.id] }),
}));
```

**UPDATE** `clientsRelations` in `src/lib/db/schema.ts` to add teamMembers:

```typescript
export const clientsRelations = relations(clients, ({ many }) => ({
  leads: many(leads),
  conversations: many(conversations),
  scheduledMessages: many(scheduledMessages),
  appointments: many(appointments),
  invoices: many(invoices),
  blockedNumbers: many(blockedNumbers),
  messageTemplates: many(messageTemplates),
  dailyStats: many(dailyStats),
  teamMembers: many(teamMembers),
}));
```

Then push:
```bash
npx drizzle-kit push
```

---

## Step 2: Create Token Utility

**CREATE** `src/lib/utils/tokens.ts`:

```typescript
import { randomBytes } from 'crypto';

export function generateClaimToken(): string {
  return randomBytes(32).toString('hex');
}
```

---

## Step 3: Create Team Escalation Service

**CREATE** `src/lib/services/team-escalation.ts`:

```typescript
import { db } from '@/lib/db';
import { teamMembers, escalationClaims, leads, clients } from '@/lib/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail, actionRequiredEmail } from '@/lib/services/resend';
import { eq, and } from 'drizzle-orm';
import { generateClaimToken } from '@/lib/utils/tokens';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface EscalationPayload {
  leadId: string;
  clientId: string;
  twilioNumber: string;
  reason: string;
  lastMessage: string;
}

export async function notifyTeamForEscalation(payload: EscalationPayload) {
  const { leadId, clientId, twilioNumber, reason, lastMessage } = payload;

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveEscalations, true)
    ))
    .orderBy(teamMembers.priority);

  if (members.length === 0) {
    console.log('No team members configured for escalations');
    return { notified: 0 };
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    return { notified: 0, error: 'Lead not found' };
  }

  const claimToken = generateClaimToken();
  const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL}/claim?token=${claimToken}`;

  const [escalation] = await db
    .insert(escalationClaims)
    .values({
      leadId,
      clientId,
      claimToken,
      escalationReason: reason,
      lastLeadMessage: lastMessage,
      status: 'pending',
    })
    .returning();

  const leadDisplay = lead.name || formatPhoneNumber(lead.phone);
  const truncatedMessage = lastMessage.length > 80
    ? lastMessage.substring(0, 80) + '...'
    : lastMessage;

  let notifiedCount = 0;

  for (const member of members) {
    const smsBody = `🔥 ${leadDisplay} needs help!\n\n"${truncatedMessage}"\n\nReason: ${reason}\n\nClaim to respond: ${claimUrl}`;

    const smsResult = await sendSMS(member.phone, twilioNumber, smsBody);
    if (smsResult.success) notifiedCount++;

    if (member.email) {
      const emailData = actionRequiredEmail({
        businessName: '',
        leadName: lead.name || undefined,
        leadPhone: formatPhoneNumber(lead.phone),
        reason,
        lastMessage,
        dashboardUrl: claimUrl,
      });
      await sendEmail({ to: member.email, ...emailData });
    }
  }

  return {
    notified: notifiedCount,
    escalationId: escalation.id,
    claimToken,
  };
}

export async function claimEscalation(token: string, teamMemberId: string) {
  const [escalation] = await db
    .select()
    .from(escalationClaims)
    .where(eq(escalationClaims.claimToken, token))
    .limit(1);

  if (!escalation) {
    return { success: false, error: 'Invalid claim link' };
  }

  if (escalation.status !== 'pending') {
    const [claimer] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, escalation.claimedBy!))
      .limit(1);

    return {
      success: false,
      error: 'Already claimed',
      claimedBy: claimer?.name || 'Someone',
    };
  }

  const [member] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, teamMemberId))
    .limit(1);

  if (!member) {
    return { success: false, error: 'Team member not found' };
  }

  await db
    .update(escalationClaims)
    .set({
      claimedBy: teamMemberId,
      claimedAt: new Date(),
      status: 'claimed',
    })
    .where(eq(escalationClaims.id, escalation.id));

  await db
    .update(leads)
    .set({
      actionRequired: false,
      actionRequiredReason: null,
    })
    .where(eq(leads.id, escalation.leadId));

  // Notify other team members
  const otherMembers = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, escalation.clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveEscalations, true)
    ));

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, escalation.leadId))
    .limit(1);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, escalation.clientId))
    .limit(1);

  if (client?.twilioNumber) {
    const leadDisplay = lead?.name || formatPhoneNumber(lead?.phone || '');

    for (const otherMember of otherMembers) {
      if (otherMember.id === teamMemberId) continue;

      await sendSMS(
        otherMember.phone,
        client.twilioNumber,
        `✓ ${member.name} is handling ${leadDisplay}`
      );
    }
  }

  return {
    success: true,
    leadId: escalation.leadId,
    leadPhone: lead?.phone,
  };
}
```

---

## Verify

1. Schema pushed successfully
2. Files exist:
   - `src/lib/utils/tokens.ts`
   - `src/lib/services/team-escalation.ts`
3. No TypeScript errors

---

## Next
Proceed to **Phase 8b** for claim pages and API routes.
