import { google, calendar_v3 } from 'googleapis';
import { getDb, calendarIntegrations, calendarEvents, leads } from '@/db';
import { eq, and } from 'drizzle-orm';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-calendar`
);

/**
 * Get auth URL for Google Calendar OAuth
 */
export function getGoogleAuthUrl(clientId: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state: clientId,
  });
}

/**
 * Exchange code for tokens and save integration
 */
export async function handleGoogleCallback(
  code: string,
  clientId: string
): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);

  // Get user info to get calendar ID
  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarList = await calendar.calendarList.list();
  const primaryCalendar = calendarList.data.items?.find((c) => c.primary);

  const db = getDb();

  // Upsert integration
  const [existing] = await db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.provider, 'google')
      )
    )
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
        timeZone: event.timezone || 'America/Denver',
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: event.timezone || 'America/Denver',
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
          timeZone: event.timezone || 'America/Denver',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: event.timezone || 'America/Denver',
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
 * Sync events from Google Calendar (inbound)
 */
export async function syncFromGoogleCalendar(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<{ created: number; updated: number }> {
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
        await db
          .update(calendarEvents)
          .set(eventData)
          .where(eq(calendarEvents.id, existing.id));
        updated++;
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
    console.error('Google Calendar sync error:', err);
    return { created: 0, updated: 0 };
  }
}
