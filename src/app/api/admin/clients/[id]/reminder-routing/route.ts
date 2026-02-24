import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { auditLog, people } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  REMINDER_ROUTING_ROLES,
  resolveReminderRecipients,
  sanitizeReminderRoutingPolicy,
  updateReminderRoutingPolicy,
} from '@/lib/services/reminder-routing';

const roleSchema = z.enum(REMINDER_ROUTING_ROLES);

const ruleSchema = z.object({
  primaryRole: roleSchema,
  fallbackRoles: z.array(roleSchema).max(3).optional(),
  secondaryRoles: z.array(roleSchema).max(3).optional(),
});

const patchSchema = z.object({
  policy: z.object({
    appointment_reminder_contractor: ruleSchema.optional(),
    booking_notification: ruleSchema.optional(),
  }),
});

const HISTORY_ACTIONS = [
  'reminder_routing_policy_updated',
  'reminder_delivery_sent',
  'reminder_delivery_no_recipient',
] as const;

export const GET = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_VIEW,
    clientIdFrom: (params) => params.id,
  },
  async ({ clientId }) => {
    const db = getDb();

    const [appointmentRouting, bookingRouting] = await Promise.all([
      resolveReminderRecipients(clientId, 'appointment_reminder_contractor'),
      resolveReminderRecipients(clientId, 'booking_notification'),
    ]);

    const history = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
        actorName: people.name,
      })
      .from(auditLog)
      .leftJoin(people, eq(auditLog.personId, people.id))
      .where(and(
        eq(auditLog.clientId, clientId),
        inArray(auditLog.action, [...HISTORY_ACTIONS])
      ))
      .orderBy(desc(auditLog.createdAt))
      .limit(20);

    return NextResponse.json({
      success: true,
      policy: appointmentRouting.policy,
      previews: {
        appointment_reminder_contractor: {
          rule: appointmentRouting.rule,
          primarySteps: appointmentRouting.primarySteps,
          secondarySteps: appointmentRouting.secondarySteps,
        },
        booking_notification: {
          rule: bookingRouting.rule,
          primarySteps: bookingRouting.primarySteps,
          secondarySteps: bookingRouting.secondarySteps,
        },
      },
      history,
    });
  }
);

export const PATCH = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_EDIT,
    clientIdFrom: (params) => params.id,
  },
  async ({ request, clientId, session }) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const incoming = sanitizeReminderRoutingPolicy(parsed.data.policy);
    await updateReminderRoutingPolicy({
      clientId,
      actorPersonId: session.personId,
      policy: incoming,
    });

    const db = getDb();
    const [appointmentRouting, bookingRouting] = await Promise.all([
      resolveReminderRecipients(clientId, 'appointment_reminder_contractor'),
      resolveReminderRecipients(clientId, 'booking_notification'),
    ]);

    const history = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
        actorName: people.name,
      })
      .from(auditLog)
      .leftJoin(people, eq(auditLog.personId, people.id))
      .where(and(
        eq(auditLog.clientId, clientId),
        inArray(auditLog.action, [...HISTORY_ACTIONS])
      ))
      .orderBy(desc(auditLog.createdAt))
      .limit(20);

    return NextResponse.json({
      success: true,
      policy: appointmentRouting.policy,
      previews: {
        appointment_reminder_contractor: {
          rule: appointmentRouting.rule,
          primarySteps: appointmentRouting.primarySteps,
          secondarySteps: appointmentRouting.secondarySteps,
        },
        booking_notification: {
          rule: bookingRouting.rule,
          primarySteps: bookingRouting.primarySteps,
          secondarySteps: bookingRouting.secondarySteps,
        },
      },
      history,
    });
  }
);
