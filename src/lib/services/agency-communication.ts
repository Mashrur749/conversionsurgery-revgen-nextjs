import twilio from 'twilio';
import { getDb } from '@/db';
import {
  agencyMessages,
  clients,
  systemSettings,
  dailyStats,
  notificationPreferences,
} from '@/db/schema';
import { eq, and, desc, gte, lte, lt, sql } from 'drizzle-orm';
import { sendEmail, onboardingWelcomeEmail, agencyWeeklyDigestEmail } from './resend';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

// ---------------------------------------------------------------------------
// Agency number helper
// ---------------------------------------------------------------------------

/** Read the agency Twilio number from systemSettings. */
export async function getAgencyNumber(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'agency_twilio_number'))
    .limit(1);
  return row?.value ?? null;
}

// ---------------------------------------------------------------------------
// Quiet hours check
// ---------------------------------------------------------------------------

async function isInQuietHours(clientId: string, isUrgent = false): Promise<boolean> {
  const db = getDb();
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.clientId, clientId))
    .limit(1);

  if (!prefs?.quietHoursEnabled) return false;
  if (isUrgent && prefs.urgentOverride) return false;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  return currentTime >= start && currentTime < end;
}

// ---------------------------------------------------------------------------
// Send SMS via agency number
// ---------------------------------------------------------------------------

async function sendAgencySMS(params: {
  clientId: string;
  toPhone: string;
  body: string;
  category: string;
  promptType?: string;
  actionPayload?: Record<string, unknown>;
  expiresAt?: Date;
  inReplyTo?: string;
}): Promise<string | null> {
  const agencyNumber = await getAgencyNumber();
  if (!agencyNumber) {
    console.error('[Agency] No agency number configured');
    return null;
  }

  const db = getDb();

  try {
    const message = await twilioClient.messages.create({
      to: params.toPhone,
      from: agencyNumber,
      body: params.body,
    });

    const [inserted] = await db
      .insert(agencyMessages)
      .values({
        clientId: params.clientId,
        direction: 'outbound',
        channel: 'sms',
        content: params.body,
        category: params.category,
        promptType: params.promptType ?? null,
        actionPayload: params.actionPayload ?? null,
        actionStatus: params.promptType ? 'pending' : null,
        inReplyTo: params.inReplyTo ?? null,
        twilioSid: message.sid,
        delivered: true,
        expiresAt: params.expiresAt ?? null,
      })
      .returning();

    console.log(`[Agency] SMS sent to ${params.toPhone}: ${message.sid}`);
    return inserted.id;
  } catch (error) {
    console.error('[Agency] Failed to send SMS:', error);

    // Still log the attempt
    await db
      .insert(agencyMessages)
      .values({
        clientId: params.clientId,
        direction: 'outbound',
        channel: 'sms',
        content: params.body,
        category: params.category,
        promptType: params.promptType ?? null,
        actionPayload: params.actionPayload ?? null,
        actionStatus: params.promptType ? 'pending' : null,
        delivered: false,
      })
      .catch(() => {});

    return null;
  }
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

/** Send welcome SMS + email when a client is activated. */
export async function sendOnboardingNotification(clientId: string): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    console.error(`[Agency] Client not found: ${clientId}`);
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';
  const loginUrl = `${appUrl}/login`;

  // Send welcome SMS
  if (client.phone) {
    const smsBody = `Welcome to ConversionSurgery, ${client.ownerName}!\n\nYour account for ${client.businessName} is now active.\n\nLog in: ${loginUrl}\n\nWe'll handle your missed calls, follow-ups, and reviews.`;

    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: smsBody,
      category: 'onboarding',
    });
  }

  // Send welcome email
  if (client.email) {
    const emailData = onboardingWelcomeEmail({
      ownerName: client.ownerName,
      businessName: client.businessName,
      loginUrl,
    });

    const result = await sendEmail({
      to: client.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    // Log email in agency_messages
    await db
      .insert(agencyMessages)
      .values({
        clientId: client.id,
        direction: 'outbound',
        channel: 'email',
        content: emailData.html,
        subject: emailData.subject,
        category: 'onboarding',
        delivered: result.success,
      })
      .catch(() => {});
  }

  console.log(`[Agency] Onboarding notification sent for client: ${client.businessName}`);
}

// ---------------------------------------------------------------------------
// Action Prompts
// ---------------------------------------------------------------------------

/** Send an interactive prompt that the client can reply YES/NO to. */
export async function sendActionPrompt(params: {
  clientId: string;
  promptType: string;
  message: string;
  actionPayload: Record<string, unknown>;
  expiresInHours?: number;
}): Promise<string | null> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.clientId))
    .limit(1);

  if (!client?.phone) return null;

  // Check quiet hours
  if (await isInQuietHours(params.clientId)) {
    console.log(`[Agency] Skipping prompt for ${client.businessName} — quiet hours`);
    return null;
  }

  // Expire any existing pending prompts for this client
  await db
    .update(agencyMessages)
    .set({ actionStatus: 'expired' })
    .where(
      and(
        eq(agencyMessages.clientId, params.clientId),
        eq(agencyMessages.actionStatus, 'pending'),
      ),
    );

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (params.expiresInHours ?? 24));

  return sendAgencySMS({
    clientId: params.clientId,
    toPhone: client.phone,
    body: params.message,
    category: 'action_prompt',
    promptType: params.promptType,
    actionPayload: params.actionPayload,
    expiresAt,
  });
}

/** Send a non-interactive alert to a client. */
export async function sendAlert(params: {
  clientId: string;
  message: string;
  isUrgent?: boolean;
}): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.clientId))
    .limit(1);

  if (!client?.phone) return;

  // Check quiet hours (urgent can override)
  if (await isInQuietHours(params.clientId, params.isUrgent)) {
    console.log(`[Agency] Skipping alert for ${client.businessName} — quiet hours`);
    return;
  }

  await sendAgencySMS({
    clientId: params.clientId,
    toPhone: client.phone,
    body: params.message,
    category: 'alert',
  });
}

// ---------------------------------------------------------------------------
// Inbound reply handling
// ---------------------------------------------------------------------------

/** Handle an inbound SMS from a client to the agency number. */
export async function handleAgencyInboundSMS(payload: {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}): Promise<void> {
  const db = getDb();
  const fromPhone = payload.From;
  const body = payload.Body.trim();

  // Look up client by their personal phone number
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.phone, fromPhone))
    .limit(1);

  if (!client) {
    console.log(`[Agency Inbound] No client found for phone: ${fromPhone}`);
    return;
  }

  // Log the inbound message
  const [inboundMsg] = await db
    .insert(agencyMessages)
    .values({
      clientId: client.id,
      direction: 'inbound',
      channel: 'sms',
      content: body,
      category: 'reply',
      twilioSid: payload.MessageSid,
      delivered: true,
    })
    .returning();

  // Find most recent pending prompt for this client
  const [pendingPrompt] = await db
    .select()
    .from(agencyMessages)
    .where(
      and(
        eq(agencyMessages.clientId, client.id),
        eq(agencyMessages.actionStatus, 'pending'),
        gte(agencyMessages.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(agencyMessages.createdAt))
    .limit(1);

  if (!pendingPrompt) {
    console.log(`[Agency Inbound] No pending prompt for client: ${client.businessName}`);
    // Send acknowledgment
    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: `Thanks for your message. Our team will follow up shortly.`,
      category: 'reply',
      inReplyTo: inboundMsg.id,
    });
    return;
  }

  // Update inbound message to reference the prompt
  await db
    .update(agencyMessages)
    .set({ inReplyTo: pendingPrompt.id })
    .where(eq(agencyMessages.id, inboundMsg.id));

  const normalizedReply = body.toUpperCase();

  // Handle STOP/opt-out
  if (normalizedReply === 'STOP') {
    await db
      .update(agencyMessages)
      .set({ actionStatus: 'replied', clientReply: body })
      .where(eq(agencyMessages.id, pendingPrompt.id));
    // Twilio handles STOP automatically — no reply needed
    console.log(`[Agency Inbound] Client ${client.businessName} opted out`);
    return;
  }

  // Handle YES/Y
  if (normalizedReply === 'YES' || normalizedReply === 'Y') {
    await db
      .update(agencyMessages)
      .set({ actionStatus: 'executed', clientReply: body })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    // Execute the action
    await executePromptAction(pendingPrompt.promptType!, pendingPrompt.actionPayload as Record<string, unknown>, client.id);

    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: `Done! We've started the action for ${client.businessName}.`,
      category: 'reply',
      inReplyTo: pendingPrompt.id,
    });
    return;
  }

  // Handle NO/N
  if (normalizedReply === 'NO' || normalizedReply === 'N') {
    await db
      .update(agencyMessages)
      .set({ actionStatus: 'replied', clientReply: body })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: `No problem — we'll skip this one.`,
      category: 'reply',
      inReplyTo: pendingPrompt.id,
    });
    return;
  }

  // Any other reply — store but don't execute
  await db
    .update(agencyMessages)
    .set({ actionStatus: 'replied', clientReply: body })
    .where(eq(agencyMessages.id, pendingPrompt.id));

  await sendAgencySMS({
    clientId: client.id,
    toPhone: client.phone,
    body: `Got it — our team will review your response.`,
    category: 'reply',
    inReplyTo: pendingPrompt.id,
  });
}

/** Dispatch prompt action based on promptType. */
async function executePromptAction(
  promptType: string,
  actionPayload: Record<string, unknown>,
  clientId: string,
): Promise<void> {
  console.log(`[Agency] Executing action: ${promptType}`, { clientId, actionPayload });

  switch (promptType) {
    case 'start_sequences':
      // Not yet implemented — follow-up sequence triggering requires flow engine integration
      console.warn(`[Agency] start_sequences action not implemented. LeadIds:`, actionPayload.leadIds);
      break;
    case 'schedule_callback':
      // Not yet implemented — callback scheduling requires escalation system integration
      console.warn(`[Agency] schedule_callback action not implemented for client: ${clientId}`);
      break;
    case 'confirm_action':
      // Generic confirmation — action is simply marked as executed
      console.log(`[Agency] Generic action confirmed for client: ${clientId}`);
      break;
    default:
      console.log(`[Agency] Unknown prompt type: ${promptType}`);
  }
}

// ---------------------------------------------------------------------------
// Weekly Digest
// ---------------------------------------------------------------------------

/** Send a weekly digest SMS + email for a single client. */
export async function sendWeeklyDigest(clientId: string): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return;

  // Get stats for last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const weekStr = weekAgo.toISOString().split('T')[0];
  const twoWeeksStr = twoWeeksAgo.toISOString().split('T')[0];
  const nowStr = now.toISOString().split('T')[0];

  // Current week stats
  const currentWeekStats = await db
    .select({
      totalLeads: sql<number>`coalesce(sum(${dailyStats.missedCallsCaptured}) + sum(${dailyStats.formsResponded}), 0)`,
      totalMessages: sql<number>`coalesce(sum(${dailyStats.messagesSent}), 0)`,
      totalAppointments: sql<number>`coalesce(sum(${dailyStats.appointmentsReminded}), 0)`,
      missedCalls: sql<number>`coalesce(sum(${dailyStats.missedCallsCaptured}), 0)`,
      formsResponded: sql<number>`coalesce(sum(${dailyStats.formsResponded}), 0)`,
      estimatesFollowed: sql<number>`coalesce(sum(${dailyStats.estimatesFollowedUp}), 0)`,
      reviewsRequested: sql<number>`coalesce(sum(${dailyStats.reviewsRequested}), 0)`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, clientId),
        gte(dailyStats.date, weekStr),
        lte(dailyStats.date, nowStr),
      ),
    );

  // Previous week stats for trend
  const prevWeekStats = await db
    .select({
      totalLeads: sql<number>`coalesce(sum(${dailyStats.missedCallsCaptured}) + sum(${dailyStats.formsResponded}), 0)`,
      totalMessages: sql<number>`coalesce(sum(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, clientId),
        gte(dailyStats.date, twoWeeksStr),
        lt(dailyStats.date, weekStr),
      ),
    );

  const current = currentWeekStats[0];
  const previous = prevWeekStats[0];

  const totalLeads = Number(current?.totalLeads ?? 0);
  const totalMessages = Number(current?.totalMessages ?? 0);
  const totalAppointments = Number(current?.totalAppointments ?? 0);
  const prevLeads = Number(previous?.totalLeads ?? 0);

  // Trend calculation
  let trendText = '';
  if (prevLeads > 0) {
    const change = Math.round(((totalLeads - prevLeads) / prevLeads) * 100);
    trendText = change >= 0 ? ` (${change}% up from last week)` : ` (${Math.abs(change)}% down from last week)`;
  }

  const conversionRate = totalMessages > 0
    ? ((totalAppointments / totalMessages) * 100).toFixed(1)
    : '0.0';

  // Build SMS
  const smsBody = [
    `Weekly Digest for ${client.businessName}:`,
    ``,
    `Leads: ${totalLeads}${trendText}`,
    `Messages sent: ${totalMessages}`,
    `Appointments: ${totalAppointments}`,
    `Conversion rate: ${conversionRate}%`,
  ].join('\n');

  // Check if there are action items (leads without sequences)
  const hasActionItems = totalLeads > 0 && totalAppointments === 0;
  const fullSmsBody = hasActionItems
    ? `${smsBody}\n\nYou have leads without follow-ups. Reply YES to start automated sequences.`
    : smsBody;

  // Send SMS digest
  if (client.phone) {
    if (hasActionItems) {
      await sendActionPrompt({
        clientId: client.id,
        promptType: 'start_sequences',
        message: fullSmsBody,
        actionPayload: { source: 'weekly_digest' },
        expiresInHours: 48,
      });
    } else {
      await sendAgencySMS({
        clientId: client.id,
        toPhone: client.phone,
        body: fullSmsBody,
        category: 'weekly_digest',
      });
    }
  }

  // Send email digest
  if (client.email) {
    const weekStartFormatted = weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEndFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const emailData = agencyWeeklyDigestEmail({
      ownerName: client.ownerName,
      businessName: client.businessName,
      weekStart: weekStartFormatted,
      weekEnd: weekEndFormatted,
      stats: {
        totalLeads,
        totalMessages,
        totalAppointments,
        conversionRate,
        missedCalls: Number(current?.missedCalls ?? 0),
        formsResponded: Number(current?.formsResponded ?? 0),
        estimatesFollowed: Number(current?.estimatesFollowed ?? 0),
        reviewsRequested: Number(current?.reviewsRequested ?? 0),
      },
      trend: trendText,
      hasActionItems,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com'}/dashboard`,
    });

    const result = await sendEmail({
      to: client.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    await db
      .insert(agencyMessages)
      .values({
        clientId: client.id,
        direction: 'outbound',
        channel: 'email',
        content: emailData.html,
        subject: emailData.subject,
        category: 'weekly_digest',
        delivered: result.success,
      })
      .catch(() => {});
  }

  console.log(`[Agency] Weekly digest sent for: ${client.businessName}`);
}

/** Loop over all active clients and send digest to each. */
export async function processAgencyWeeklyDigests(): Promise<number> {
  const db = getDb();
  const activeClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.status, 'active'));

  let sent = 0;
  for (const client of activeClients) {
    try {
      await sendWeeklyDigest(client.id);
      sent++;
    } catch (error) {
      console.error(`[Agency] Failed digest for client ${client.id}:`, error);
    }
  }

  console.log(`[Agency] Weekly digests sent: ${sent}/${activeClients.length}`);
  return sent;
}

// ---------------------------------------------------------------------------
// Expire prompts
// ---------------------------------------------------------------------------

/** Mark expired prompts as 'expired'. Called by cron. */
export async function expirePendingPrompts(): Promise<number> {
  const db = getDb();
  const result = await db
    .update(agencyMessages)
    .set({ actionStatus: 'expired' })
    .where(
      and(
        eq(agencyMessages.actionStatus, 'pending'),
        lt(agencyMessages.expiresAt, new Date()),
      ),
    )
    .returning({ id: agencyMessages.id });

  if (result.length > 0) {
    console.log(`[Agency] Expired ${result.length} pending prompts`);
  }
  return result.length;
}
