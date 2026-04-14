import { google, calendar_v3 } from 'googleapis';
import { getDb, calendarIntegrations, calendarEvents, leads, clients } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-calendar`
);

/**
 * Format a Date in the given IANA timezone for display in SMS messages.
 * Returns strings like "Tuesday, Apr 15 at 10:00 AM".
 */
function formatEventDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

interface NotifyHomeownerParams {
  clientId: string;
  leadId: string;
  isCancellation: boolean;
  oldStartTime: Date;
  newStartTime: Date | null;
  timezone: string;
}

/**
 * Send an SMS to the homeowner when their appointment is cancelled or rescheduled
 * via an external Google Calendar action.
 * Fires through sendCompliantMessage so compliance rules (opt-out, quiet hours) apply.
 */
async function notifyHomeownerOfEventChange(params: NotifyHomeownerParams): Promise<void> {
  const { clientId, leadId, isCancellation, oldStartTime, newStartTime, timezone } = params;

  const db = getDb();

  // Fetch lead for phone and name
  const [lead] = await db
    .select({ name: leads.name, phone: leads.phone })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead?.phone) return;

  // Fetch client for twilio number and business name
  const [client] = await db
    .select({
      twilioNumber: clients.twilioNumber,
      businessName: clients.businessName,
      phone: clients.phone,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.twilioNumber) return;

  const oldFormatted = formatEventDateTime(oldStartTime, timezone);
  const businessName = client.businessName || 'your contractor';
  const contactPhone = client.phone || 'us';

  let body: string;
  if (isCancellation) {
    body =
      `Hi ${lead.name || 'there'}, your appointment with ${businessName} scheduled for ` +
      `${oldFormatted} has been cancelled. Please contact ${businessName} at ${contactPhone} to reschedule.`;
  } else {
    const newFormatted = newStartTime ? formatEventDateTime(newStartTime, timezone) : 'a new time';
    body =
      `Hi ${lead.name || 'there'}, your appointment with ${businessName} has been rescheduled to ` +
      `${newFormatted}. Reply STOP to opt out.`;
  }

  try {
    await sendCompliantMessage({
      clientId,
      to: lead.phone,
      from: client.twilioNumber,
      body,
      leadId,
      messageClassification: 'inbound_reply',
      messageCategory: 'transactional',
      consentBasis: { type: 'existing_customer' },
      metadata: {
        source: 'calendar_event_change_notification',
        isCancellation,
      },
    });
  } catch (err) {
    logSanitizedConsoleError(
      '[Calendar][notifyHomeownerOfEventChange] SMS notification failed',
      err,
      { clientId, leadId, isCancellation }
    );
    // Never throw — notification failure must not block the sync loop
  }
}

/**
 * Get auth URL for Google Calendar OAuth
 * @param origin - 'admin' or 'portal' to redirect back to the correct UI after OAuth
 */
export function getGoogleAuthUrl(clientId: string, origin: 'admin' | 'portal' = 'admin'): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state: `${clientId}:${origin}`,
  });
}

/**
 * Parse the OAuth state parameter into clientId and origin
 */
export function parseOAuthState(state: string): { clientId: string; origin: 'admin' | 'portal' } {
  const separatorIndex = state.lastIndexOf(':');
  if (separatorIndex === -1 || !['admin', 'portal'].includes(state.slice(separatorIndex + 1))) {
    // Backwards-compatible: state is just the clientId (legacy admin flow)
    return { clientId: state, origin: 'admin' };
  }
  return {
    clientId: state.slice(0, separatorIndex),
    origin: state.slice(separatorIndex + 1) as 'admin' | 'portal',
  };
}

/**
 * Exchange code for tokens and save integration.
 *
 * @param membershipId - Optional. When provided, the integration is scoped to
 *   that team member (per-member calendar). When omitted, the integration is a
 *   client-level (shared) calendar connection.
 */
export async function handleGoogleCallback(
  code: string,
  clientId: string,
  membershipId?: string
): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);

  // Get user info to get calendar ID
  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarList = await calendar.calendarList.list();
  const primaryCalendar = calendarList.data.items?.find((c) => c.primary);

  const db = getDb();

  // Upsert integration — lookup key includes membershipId so each member can
  // have their own integration alongside the client-level one.
  const lookupConditions = membershipId
    ? and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google'),
        eq(calendarIntegrations.membershipId, membershipId)
      )
    : and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google'),
        isNull(calendarIntegrations.membershipId)
      );

  const [existing] = await db
    .select()
    .from(calendarIntegrations)
    .where(lookupConditions)
    .limit(1);

  const integrationData = {
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    calendarId: primaryCalendar?.id || 'primary',
    isActive: true,
    lastError: null,
    consecutiveErrors: 0,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(calendarIntegrations)
      .set(integrationData)
      .where(eq(calendarIntegrations.id, existing.id));
  } else {
    await db.insert(calendarIntegrations).values({
      clientId,
      provider: 'google',
      membershipId: membershipId ?? null,
      ...integrationData,
    });
  }
}

/**
 * Get authenticated calendar client
 */
async function getCalendarClient(
  integration: typeof calendarIntegrations.$inferSelect
) {
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.tokenExpiresAt?.getTime(),
  });

  // Check if token needs refresh
  if (
    integration.tokenExpiresAt &&
    new Date() > integration.tokenExpiresAt
  ) {
    const { credentials } = await oauth2Client.refreshAccessToken();

    const db = getDb();
    await db
      .update(calendarIntegrations)
      .set({
        accessToken: credentials.access_token ?? null,
        tokenExpiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, integration.id));

    oauth2Client.setCredentials(credentials);
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Create event in Google Calendar
 */
export async function createGoogleEvent(
  clientId: string,
  event: typeof calendarEvents.$inferSelect
): Promise<string | null> {
  const db = getDb();

  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google'),
        eq(calendarIntegrations.isActive, true)
      )
    )
    .limit(1);

  if (!integration) return null;

  try {
    const calendar = await getCalendarClient(integration);

    // Get lead details for description
    let leadInfo = '';
    if (event.leadId) {
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, event.leadId))
        .limit(1);

      if (lead) {
        leadInfo = `\n\nCustomer: ${lead.name}\nPhone: ${lead.phone}`;
      }
    }

    const googleEvent: calendar_v3.Schema$Event = {
      summary: event.title,
      description: (event.description || '') + leadInfo,
      location: event.location || undefined,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: event.timezone || 'America/Edmonton',
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone || 'America/Edmonton',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: integration.calendarId || 'primary',
      requestBody: googleEvent,
    });

    // Update local event with Google ID
    await db
      .update(calendarEvents)
      .set({
        externalEventId: response.data.id,
        provider: 'google',
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
      })
      .where(eq(calendarEvents.id, event.id));

    // Clear error state
    await db
      .update(calendarIntegrations)
      .set({
        lastError: null,
        consecutiveErrors: 0,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, integration.id));

    return response.data.id || null;
  } catch (err) {
    console.error('Google Calendar create error:', err);

    await db
      .update(calendarIntegrations)
      .set({
        lastError: err instanceof Error ? err.message : 'Unknown error',
        consecutiveErrors: (integration.consecutiveErrors || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, integration.id));

    return null;
  }
}

/**
 * Update event in Google Calendar
 */
export async function updateGoogleEvent(
  clientId: string,
  event: typeof calendarEvents.$inferSelect
): Promise<boolean> {
  if (!event.externalEventId) return false;

  const db = getDb();

  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google'),
        eq(calendarIntegrations.isActive, true)
      )
    )
    .limit(1);

  if (!integration) return false;

  try {
    const calendar = await getCalendarClient(integration);

    await calendar.events.update({
      calendarId: integration.calendarId || 'primary',
      eventId: event.externalEventId,
      requestBody: {
        summary: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: event.timezone || 'America/Edmonton',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: event.timezone || 'America/Edmonton',
        },
      },
    });

    await db
      .update(calendarEvents)
      .set({ syncStatus: 'synced', lastSyncedAt: new Date() })
      .where(eq(calendarEvents.id, event.id));

    return true;
  } catch (err) {
    console.error('Google Calendar update error:', err);
    return false;
  }
}

/**
 * Delete event from Google Calendar
 */
export async function deleteGoogleEvent(
  clientId: string,
  externalEventId: string
): Promise<boolean> {
  const db = getDb();

  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google'),
        eq(calendarIntegrations.isActive, true)
      )
    )
    .limit(1);

  if (!integration) return false;

  try {
    const calendar = await getCalendarClient(integration);

    await calendar.events.delete({
      calendarId: integration.calendarId || 'primary',
      eventId: externalEventId,
    });

    return true;
  } catch (err) {
    console.error('Google Calendar delete error:', err);
    return false;
  }
}

/**
 * Sync events from Google Calendar (inbound).
 *
 * @param membershipId - Optional. When provided, only that member&apos;s calendar
 *   integration is used. When omitted, the client-level (shared) integration is used.
 */
export async function syncFromGoogleCalendar(
  clientId: string,
  startDate: Date,
  endDate: Date,
  membershipId?: string
): Promise<{ created: number; updated: number }> {
  const db = getDb();

  const integrationConditions = membershipId
    ? and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google'),
        eq(calendarIntegrations.isActive, true),
        eq(calendarIntegrations.membershipId, membershipId)
      )
    : and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google'),
        eq(calendarIntegrations.isActive, true),
        isNull(calendarIntegrations.membershipId)
      );

  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(integrationConditions)
    .limit(1);

  if (!integration) return { created: 0, updated: 0 };

  try {
    const calendar = await getCalendarClient(integration);

    const response = await calendar.events.list({
      calendarId: integration.calendarId || 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    let created = 0;
    let updated = 0;

    for (const googleEvent of response.data.items || []) {
      if (!googleEvent.id || !googleEvent.start?.dateTime) continue;

      // Check if event exists locally
      const [existing] = await db
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.clientId, clientId),
            eq(calendarEvents.provider, 'google'),
            eq(calendarEvents.externalEventId, googleEvent.id)
          )
        )
        .limit(1);

      const eventData = {
        title: googleEvent.summary || 'Untitled',
        description: googleEvent.description ?? null,
        location: googleEvent.location ?? null,
        startTime: new Date(googleEvent.start.dateTime),
        endTime: new Date(
          googleEvent.end?.dateTime || googleEvent.start.dateTime
        ),
        isAllDay: !!googleEvent.start.date,
        status:
          googleEvent.status === 'cancelled' ? 'cancelled' : 'scheduled',
        lastSyncedAt: new Date(),
        syncStatus: 'synced' as const,
      };

      if (existing) {
        // Detect changes that require homeowner notification BEFORE updating the local record
        const isCancellation =
          googleEvent.status === 'cancelled' && existing.status !== 'cancelled';
        const isReschedule =
          !isCancellation &&
          googleEvent.start?.dateTime &&
          new Date(googleEvent.start.dateTime).toISOString() !== existing.startTime.toISOString();

        // Update local record first
        await db
          .update(calendarEvents)
          .set(eventData)
          .where(eq(calendarEvents.id, existing.id));
        updated++;

        // Notify homeowner if there is a lead attached and something changed
        if ((isCancellation || isReschedule) && existing.leadId) {
          await notifyHomeownerOfEventChange({
            clientId,
            leadId: existing.leadId,
            isCancellation,
            oldStartTime: existing.startTime,
            newStartTime: googleEvent.start?.dateTime
              ? new Date(googleEvent.start.dateTime)
              : null,
            timezone: existing.timezone || 'America/Edmonton',
          });
        }
      } else {
        await db.insert(calendarEvents).values({
          clientId,
          provider: 'google',
          externalEventId: googleEvent.id,
          ...eventData,
        });
        created++;
      }
    }

    await db
      .update(calendarIntegrations)
      .set({
        lastSyncAt: new Date(),
        lastError: null,
        consecutiveErrors: 0,
      })
      .where(eq(calendarIntegrations.id, integration.id));

    return { created, updated };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Increment error counter on the integration so the admin UI and operator alerts work
    await db
      .update(calendarIntegrations)
      .set({
        lastError: errorMessage,
        consecutiveErrors: (integration.consecutiveErrors ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, integration.id));

    logSanitizedConsoleError(
      '[Calendar][syncFromGoogleCalendar] Inbound sync failed',
      err,
      { clientId, integrationId: integration.id }
    );

    return { created: 0, updated: 0 };
  }
}
