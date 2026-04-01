import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  leads,
  escalationClaims,
  scheduledMessages,
  appointments,
  payments,
} from '@/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import {
  portalRoute,
  PORTAL_PERMISSIONS,
} from '@/lib/utils/route-handler';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  link?: string;
}

/**
 * GET /api/client/notifications/feed
 *
 * Derives in-app notifications from existing data for the client portal.
 * Returns up to 20 items sorted newest first.
 */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session }) => {
    const db = getDb();
    const clientId = session.clientId;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const notifications: NotificationItem[] = [];

    // 1. New leads (last 24h)
    const recentLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        source: leads.source,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          gte(leads.createdAt, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(leads.createdAt))
      .limit(10);

    for (const lead of recentLeads) {
      const sourceLabel =
        lead.source === 'missed_call'
          ? 'missed call'
          : lead.source === 'form'
            ? 'web form'
            : lead.source === 'widget'
              ? 'lead widget'
              : lead.source || 'unknown source';
      notifications.push({
        id: `lead-${lead.id}`,
        type: 'new_lead',
        title: 'New lead received',
        description: `${lead.name || lead.phone} via ${sourceLabel}`,
        timestamp: lead.createdAt.toISOString(),
        icon: 'phone',
        link: '/client/conversations',
      });
    }

    // 2. Pending escalation claims
    const pendingClaims = await db
      .select({
        id: escalationClaims.id,
        escalationReason: escalationClaims.escalationReason,
        createdAt: escalationClaims.createdAt,
      })
      .from(escalationClaims)
      .where(
        and(
          eq(escalationClaims.clientId, clientId),
          eq(escalationClaims.status, 'pending')
        )
      )
      .orderBy(desc(escalationClaims.createdAt))
      .limit(5);

    for (const claim of pendingClaims) {
      notifications.push({
        id: `escalation-${claim.id}`,
        type: 'escalation',
        title: 'Escalation needs attention',
        description:
          claim.escalationReason ||
          'A lead requires your personal attention',
        timestamp: claim.createdAt.toISOString(),
        icon: 'alert-triangle',
        link: '/client/conversations',
      });
    }

    // 3. Smart Assist pending approval
    const pendingAssist = await db
      .select({
        id: scheduledMessages.id,
        assistCategory: scheduledMessages.assistCategory,
        createdAt: scheduledMessages.createdAt,
      })
      .from(scheduledMessages)
      .where(
        and(
          eq(scheduledMessages.clientId, clientId),
          eq(scheduledMessages.assistStatus, 'pending_approval'),
          eq(scheduledMessages.sent, false),
          eq(scheduledMessages.cancelled, false)
        )
      )
      .orderBy(desc(scheduledMessages.createdAt))
      .limit(5);

    for (const msg of pendingAssist) {
      notifications.push({
        id: `assist-${msg.id}`,
        type: 'ai_suggestion',
        title: 'AI suggestion pending approval',
        description: msg.assistCategory
          ? `${msg.assistCategory} draft ready for review`
          : 'A message draft is ready for your review',
        timestamp: msg.createdAt.toISOString(),
        icon: 'message-square',
      });
    }

    // 4. Recent appointments (booked/cancelled in last 48h)
    const recentAppointments = await db
      .select({
        id: appointments.id,
        status: appointments.status,
        appointmentDate: appointments.appointmentDate,
        appointmentTime: appointments.appointmentTime,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clientId, clientId),
          gte(appointments.createdAt, fortyEightHoursAgo)
        )
      )
      .orderBy(desc(appointments.createdAt))
      .limit(5);

    for (const appt of recentAppointments) {
      const isCancelled = appt.status === 'cancelled';
      notifications.push({
        id: `appt-${appt.id}`,
        type: isCancelled ? 'appointment_cancelled' : 'appointment_booked',
        title: isCancelled ? 'Appointment cancelled' : 'Appointment booked',
        description: `${appt.appointmentDate} at ${appt.appointmentTime}`,
        timestamp: appt.createdAt.toISOString(),
        icon: 'calendar',
      });
    }

    // 5. Recent payments received (last 48h)
    const recentPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.clientId, clientId),
          eq(payments.status, 'paid'),
          gte(
            sql`COALESCE(${payments.paidAt}, ${payments.createdAt})`,
            fortyEightHoursAgo
          )
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(5);

    for (const payment of recentPayments) {
      const dollars = (payment.amount / 100).toFixed(2);
      notifications.push({
        id: `payment-${payment.id}`,
        type: 'payment_received',
        title: 'Payment received',
        description: `$${dollars} payment collected`,
        timestamp: (payment.paidAt || payment.createdAt).toISOString(),
        icon: 'dollar-sign',
      });
    }

    // Sort all by timestamp descending, take 20
    notifications.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      notifications: notifications.slice(0, 20),
    });
  }
);
