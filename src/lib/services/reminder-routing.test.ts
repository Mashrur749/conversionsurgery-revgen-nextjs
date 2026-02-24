import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_ROUTING_POLICY,
  resolveReminderRecipientsFromContext,
  sanitizeReminderRoutingPolicy,
} from './reminder-routing';

describe('sanitizeReminderRoutingPolicy', () => {
  it('deduplicates role lists and removes primary role from fallback/secondary', () => {
    const policy = sanitizeReminderRoutingPolicy({
      appointment_reminder_contractor: {
        primaryRole: 'owner',
        fallbackRoles: ['owner', 'assistant', 'assistant', 'escalation_team'],
        secondaryRoles: ['owner', 'assistant', 'any_active_member'],
      },
      booking_notification: {
        primaryRole: 'assistant',
        fallbackRoles: ['assistant', 'owner'],
        secondaryRoles: ['owner', 'owner'],
      },
    });

    expect(policy.appointment_reminder_contractor.fallbackRoles).toEqual([
      'assistant',
      'escalation_team',
    ]);
    expect(policy.appointment_reminder_contractor.secondaryRoles).toEqual([
      'any_active_member',
    ]);
    expect(policy.booking_notification.fallbackRoles).toEqual(['owner']);
    expect(policy.booking_notification.secondaryRoles).toEqual([]);
  });
});

describe('resolveReminderRecipientsFromContext', () => {
  const baseContext = {
    ownerPhone: '+14035550001',
    memberships: [
      {
        membershipId: 'm_owner',
        personId: 'p_owner',
        name: 'Owner',
        phone: '+14035550001',
        isOwner: true,
        receiveEscalations: true,
        priority: 1,
      },
      {
        membershipId: 'm_assistant',
        personId: 'p_assistant',
        name: 'Assistant',
        phone: '+14035550002',
        isOwner: false,
        receiveEscalations: true,
        priority: 2,
      },
    ],
  };

  it('resolves primary recipient from configured primary role', () => {
    const resolution = resolveReminderRecipientsFromContext({
      context: baseContext as any,
      reminderType: 'appointment_reminder_contractor',
      policy: DEFAULT_REMINDER_ROUTING_POLICY,
    });

    expect(resolution.primaryChain[0]?.role).toBe('owner');
    expect(resolution.primaryChain[0]?.phone).toBe('+14035550001');
  });

  it('falls back when the primary role has no valid recipient', () => {
    const resolution = resolveReminderRecipientsFromContext({
      context: {
        ownerPhone: null,
        memberships: baseContext.memberships.filter((m) => !m.isOwner),
      } as any,
      reminderType: 'booking_notification',
      policy: {
        ...DEFAULT_REMINDER_ROUTING_POLICY,
        booking_notification: {
          primaryRole: 'owner',
          fallbackRoles: ['assistant'],
          secondaryRoles: [],
        },
      },
    });

    expect(resolution.primarySteps[0]?.missing).toBe(true);
    expect(resolution.primaryChain[0]?.role).toBe('assistant');
    expect(resolution.primaryChain[0]?.phone).toBe('+14035550002');
  });

  it('de-duplicates identical phone numbers across chain and secondary recipients', () => {
    const resolution = resolveReminderRecipientsFromContext({
      context: {
        ownerPhone: '+14035550001',
        memberships: [
          {
            membershipId: 'm1',
            personId: 'p1',
            name: 'Owner',
            phone: '+14035550001',
            isOwner: true,
            receiveEscalations: true,
            priority: 1,
          },
          {
            membershipId: 'm2',
            personId: 'p2',
            name: 'Assistant',
            phone: '+14035550001',
            isOwner: false,
            receiveEscalations: true,
            priority: 2,
          },
        ],
      } as any,
      reminderType: 'booking_notification',
      policy: {
        ...DEFAULT_REMINDER_ROUTING_POLICY,
        booking_notification: {
          primaryRole: 'owner',
          fallbackRoles: ['assistant'],
          secondaryRoles: ['escalation_team'],
        },
      },
    });

    expect(resolution.primaryChain).toHaveLength(1);
    expect(resolution.secondaryRecipients).toHaveLength(0);
  });
});
