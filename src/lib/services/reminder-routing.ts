import { getDb } from '@/db';
import { auditLog, clientMemberships, clients, people } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';

export const REMINDER_ROUTING_TYPES = [
  'appointment_reminder_contractor',
  'booking_notification',
] as const;
export type ReminderRoutingType = (typeof REMINDER_ROUTING_TYPES)[number];

export const REMINDER_ROUTING_ROLES = [
  'owner',
  'assistant',
  'escalation_team',
  'any_active_member',
] as const;
export type ReminderRoutingRole = (typeof REMINDER_ROUTING_ROLES)[number];

export interface ReminderRoutingRule {
  primaryRole: ReminderRoutingRole;
  fallbackRoles: ReminderRoutingRole[];
  secondaryRoles: ReminderRoutingRole[];
}

export type ReminderRoutingPolicy = Record<ReminderRoutingType, ReminderRoutingRule>;

export interface ReminderRoutingRecipient {
  role: ReminderRoutingRole;
  phone: string;
  personId: string | null;
  membershipId: string | null;
  label: string;
}

export interface ReminderRoutingStep {
  role: ReminderRoutingRole;
  recipient: ReminderRoutingRecipient | null;
  missing: boolean;
}

export interface ReminderRoutingResolution {
  policy: ReminderRoutingPolicy;
  rule: ReminderRoutingRule;
  primaryChain: ReminderRoutingRecipient[];
  secondaryRecipients: ReminderRoutingRecipient[];
  primarySteps: ReminderRoutingStep[];
  secondarySteps: ReminderRoutingStep[];
}

interface ReminderRoutingContextMembership {
  membershipId: string;
  personId: string;
  name: string | null;
  phone: string | null;
  isOwner: boolean;
  receiveEscalations: boolean;
  priority: number;
}

interface ReminderRoutingContext {
  ownerPhone: string | null;
  memberships: ReminderRoutingContextMembership[];
}

export const DEFAULT_REMINDER_ROUTING_POLICY: ReminderRoutingPolicy = {
  appointment_reminder_contractor: {
    primaryRole: 'owner',
    fallbackRoles: ['assistant', 'escalation_team'],
    secondaryRoles: [],
  },
  booking_notification: {
    primaryRole: 'owner',
    fallbackRoles: ['assistant', 'escalation_team'],
    secondaryRoles: [],
  },
};

function isReminderRoutingRole(value: unknown): value is ReminderRoutingRole {
  return typeof value === 'string' && REMINDER_ROUTING_ROLES.includes(value as ReminderRoutingRole);
}

function normalizeRoleList(raw: unknown, excluded: ReminderRoutingRole[] = []): ReminderRoutingRole[] {
  if (!Array.isArray(raw)) return [];
  const excludedSet = new Set<ReminderRoutingRole>(excluded);
  const seen = new Set<ReminderRoutingRole>();
  const roles: ReminderRoutingRole[] = [];
  for (const item of raw) {
    if (!isReminderRoutingRole(item)) continue;
    if (excludedSet.has(item) || seen.has(item)) continue;
    roles.push(item);
    seen.add(item);
  }
  return roles;
}

function sanitizeRule(raw: unknown, fallback: ReminderRoutingRule): ReminderRoutingRule {
  const primaryRole = isReminderRoutingRole((raw as ReminderRoutingRule | undefined)?.primaryRole)
    ? (raw as ReminderRoutingRule).primaryRole
    : fallback.primaryRole;
  const fallbackRoles = normalizeRoleList(
    (raw as ReminderRoutingRule | undefined)?.fallbackRoles,
    [primaryRole]
  );
  const secondaryRoles = normalizeRoleList(
    (raw as ReminderRoutingRule | undefined)?.secondaryRoles,
    [primaryRole, ...fallbackRoles]
  );
  return {
    primaryRole,
    fallbackRoles,
    secondaryRoles,
  };
}

export function sanitizeReminderRoutingPolicy(raw: unknown): ReminderRoutingPolicy {
  return {
    appointment_reminder_contractor: sanitizeRule(
      (raw as ReminderRoutingPolicy | undefined)?.appointment_reminder_contractor,
      DEFAULT_REMINDER_ROUTING_POLICY.appointment_reminder_contractor
    ),
    booking_notification: sanitizeRule(
      (raw as ReminderRoutingPolicy | undefined)?.booking_notification,
      DEFAULT_REMINDER_ROUTING_POLICY.booking_notification
    ),
  };
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  try {
    return normalizePhoneNumber(value);
  } catch {
    return null;
  }
}

function uniqueRecipients(
  recipients: ReminderRoutingRecipient[]
): ReminderRoutingRecipient[] {
  const seen = new Set<string>();
  const unique: ReminderRoutingRecipient[] = [];
  for (const recipient of recipients) {
    if (seen.has(recipient.phone)) continue;
    seen.add(recipient.phone);
    unique.push(recipient);
  }
  return unique;
}

function buildRolePools(context: ReminderRoutingContext): Record<ReminderRoutingRole, ReminderRoutingRecipient[]> {
  const sortedMemberships = [...context.memberships].sort((a, b) => a.priority - b.priority);

  const toRecipient = (membership: ReminderRoutingContextMembership, role: ReminderRoutingRole): ReminderRoutingRecipient | null => {
    const phone = normalizePhone(membership.phone);
    if (!phone) return null;
    return {
      role,
      phone,
      personId: membership.personId,
      membershipId: membership.membershipId,
      label: membership.name || 'Team member',
    };
  };

  const ownerFromMemberships = uniqueRecipients(
    sortedMemberships
      .filter((membership) => membership.isOwner)
      .map((membership) => toRecipient(membership, 'owner'))
      .filter((recipient): recipient is ReminderRoutingRecipient => Boolean(recipient))
  );

  const ownerPhone = normalizePhone(context.ownerPhone);
  const ownerPool = [...ownerFromMemberships];
  if (ownerPool.length === 0 && ownerPhone) {
    ownerPool.push({
      role: 'owner',
      phone: ownerPhone,
      personId: null,
      membershipId: null,
      label: 'Business owner',
    });
  }

  const assistantPool = uniqueRecipients(
    sortedMemberships
      .filter((membership) => !membership.isOwner)
      .map((membership) => toRecipient(membership, 'assistant'))
      .filter((recipient): recipient is ReminderRoutingRecipient => Boolean(recipient))
  );

  const escalationPool = uniqueRecipients(
    sortedMemberships
      .filter((membership) => membership.receiveEscalations)
      .map((membership) => toRecipient(membership, 'escalation_team'))
      .filter((recipient): recipient is ReminderRoutingRecipient => Boolean(recipient))
  );

  const anyActivePool = uniqueRecipients(
    sortedMemberships
      .map((membership) => toRecipient(membership, 'any_active_member'))
      .filter((recipient): recipient is ReminderRoutingRecipient => Boolean(recipient))
  );

  return {
    owner: ownerPool,
    assistant: assistantPool,
    escalation_team: escalationPool,
    any_active_member: anyActivePool,
  };
}

function pickFirstAvailableRecipient(
  pool: ReminderRoutingRecipient[],
  usedPhones: Set<string>
): ReminderRoutingRecipient | null {
  for (const recipient of pool) {
    if (usedPhones.has(recipient.phone)) continue;
    return recipient;
  }
  return null;
}

export function resolveReminderRecipientsFromContext(input: {
  context: ReminderRoutingContext;
  reminderType: ReminderRoutingType;
  policy?: ReminderRoutingPolicy;
}): ReminderRoutingResolution {
  const policy = sanitizeReminderRoutingPolicy(input.policy ?? DEFAULT_REMINDER_ROUTING_POLICY);
  const rule = policy[input.reminderType];
  const pools = buildRolePools(input.context);
  const usedPhones = new Set<string>();

  const primarySteps: ReminderRoutingStep[] = [];
  const primaryChain: ReminderRoutingRecipient[] = [];
  for (const role of [rule.primaryRole, ...rule.fallbackRoles]) {
    const recipient = pickFirstAvailableRecipient(pools[role], usedPhones);
    primarySteps.push({
      role,
      recipient,
      missing: recipient === null,
    });
    if (!recipient) continue;
    usedPhones.add(recipient.phone);
    primaryChain.push(recipient);
  }

  const secondarySteps: ReminderRoutingStep[] = [];
  const secondaryRecipients: ReminderRoutingRecipient[] = [];
  for (const role of rule.secondaryRoles) {
    const recipient = pickFirstAvailableRecipient(pools[role], usedPhones);
    secondarySteps.push({
      role,
      recipient,
      missing: recipient === null,
    });
    if (!recipient) continue;
    usedPhones.add(recipient.phone);
    secondaryRecipients.push(recipient);
  }

  return {
    policy,
    rule,
    primaryChain,
    secondaryRecipients,
    primarySteps,
    secondarySteps,
  };
}

export async function resolveReminderRecipients(
  clientId: string,
  reminderType: ReminderRoutingType
): Promise<ReminderRoutingResolution> {
  const db = getDb();
  const [client] = await db
    .select({
      phone: clients.phone,
      reminderRoutingPolicy: clients.reminderRoutingPolicy,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    throw new Error('Client not found');
  }

  const memberships = await db
    .select({
      membershipId: clientMemberships.id,
      personId: people.id,
      name: people.name,
      phone: people.phone,
      isOwner: clientMemberships.isOwner,
      receiveEscalations: clientMemberships.receiveEscalations,
      priority: clientMemberships.priority,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(and(
      eq(clientMemberships.clientId, clientId),
      eq(clientMemberships.isActive, true)
    ))
    .orderBy(asc(clientMemberships.priority));

  return resolveReminderRecipientsFromContext({
    context: {
      ownerPhone: client.phone,
      memberships,
    },
    reminderType,
    policy: sanitizeReminderRoutingPolicy(client.reminderRoutingPolicy),
  });
}

export async function updateReminderRoutingPolicy(input: {
  clientId: string;
  actorPersonId: string;
  policy: unknown;
}) {
  const db = getDb();
  const now = new Date();

  const [existing] = await db
    .select({ reminderRoutingPolicy: clients.reminderRoutingPolicy })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!existing) {
    throw new Error('Client not found');
  }

  const previousPolicy = sanitizeReminderRoutingPolicy(existing.reminderRoutingPolicy);
  const nextPolicy = sanitizeReminderRoutingPolicy(input.policy);

  await db
    .update(clients)
    .set({
      reminderRoutingPolicy: nextPolicy,
      updatedAt: now,
    })
    .where(eq(clients.id, input.clientId));

  await db.insert(auditLog).values({
    personId: input.actorPersonId,
    clientId: input.clientId,
    action: 'reminder_routing_policy_updated',
    resourceType: 'client',
    resourceId: input.clientId,
    metadata: {
      previousPolicy,
      nextPolicy,
    },
    createdAt: now,
  });

  return nextPolicy;
}
