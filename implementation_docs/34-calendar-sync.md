# Phase 21: Calendar Sync Integration

## Prerequisites
- Phase 03 (Core Automations) complete
- Appointment scheduling working
- OAuth infrastructure ready

## Goal
Two-way sync with Google Calendar, Jobber, ServiceTitan, and Housecall Pro to automatically update appointments.

---

## Step 1: Add Calendar Integration Tables

**MODIFY** `src/lib/db/schema.ts`:

```typescript
// ============================================
// CALENDAR INTEGRATIONS
// ============================================
export const calendarProviderEnum = pgEnum('calendar_provider', [
  'google',
  'jobber',
  'servicetitan',
  'housecall_pro',
  'outlook',
]);

export const calendarIntegrations = pgTable('calendar_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Provider info
  provider: calendarProviderEnum('provider').notNull(),
  isActive: boolean('is_active').default(true),
  
  // OAuth tokens
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  
  // Provider-specific IDs
  externalAccountId: varchar('external_account_id', { length: 255 }),
  calendarId: varchar('calendar_id', { length: 255 }), // For Google: specific calendar
  
  // Sync settings
  syncEnabled: boolean('sync_enabled').default(true),
  lastSyncAt: timestamp('last_sync_at'),
  syncDirection: varchar('sync_direction', { length: 20 }).default('both'), // inbound, outbound, both
  
  // Error tracking
  lastError: text('last_error'),
  consecutiveErrors: integer('consecutive_errors').default(0),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  
  // Event details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  location: text('location'),
  
  // Timing
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  isAllDay: boolean('is_all_day').default(false),
  timezone: varchar('timezone', { length: 50 }).default('America/Denver'),
  
  // Status
  status: varchar('status', { length: 20 }).default('scheduled'), // scheduled, confirmed, completed, cancelled, no_show
  
  // External sync
  provider: calendarProviderEnum('provider'),
  externalEventId: varchar('external_event_id', { length: 255 }),
  lastSyncedAt: timestamp('last_synced_at'),
  syncStatus: varchar('sync_status', { length: 20 }).default('pending'), // pending, synced, error
  
  // Assignment
  assignedTeamMemberId: uuid('assigned_team_member_id').references(() => teamMembers.id),
  
  // Metadata
  eventType: varchar('event_type', { length: 50 }), // estimate, job, follow_up, consultation
  jobId: uuid('job_id').references(() => jobs.id),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Indexes
export const calendarEventsClientIdx = index('calendar_events_client_idx').on(calendarEvents.clientId);
export const calendarEventsTimeIdx = index('calendar_events_time_idx').on(calendarEvents.startTime);
export const calendarEventsExternalIdx = index('calendar_events_external_idx').on(
  calendarEvents.provider,
  calendarEvents.externalEventId
);
```

Run migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 2: Create Google Calendar Service

**CREATE** `src/lib/services/calendar/google-calendar.ts`:

```typescript
import { google, calendar_v3 } from 'googleapis';
import { db } from '@/lib/db';
import { calendarIntegrations, calendarEvents, leads, clients } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

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
  const primaryCalendar = calendarList.data.items?.find(c => c.primary);
  
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
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
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
async function getCalendarClient(integration: typeof calendarIntegrations.$inferSelect) {
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.tokenExpiresAt?.getTime(),
  });
  
  // Check if token needs refresh
  if (integration.tokenExpiresAt && new Date() > integration.tokenExpiresAt) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    await db
      .update(calendarIntegrations)
      .set({
        accessToken: credentials.access_token,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
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
      .set({ lastError: null, consecutiveErrors: 0, updatedAt: new Date() })
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
        description: googleEvent.description,
        location: googleEvent.location,
        startTime: new Date(googleEvent.start.dateTime),
        endTime: new Date(googleEvent.end?.dateTime || googleEvent.start.dateTime),
        isAllDay: !!googleEvent.start.date,
        status: googleEvent.status === 'cancelled' ? 'cancelled' : 'scheduled',
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
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
      .set({ lastSyncAt: new Date(), lastError: null, consecutiveErrors: 0 })
      .where(eq(calendarIntegrations.id, integration.id));
    
    return { created, updated };
  } catch (err) {
    console.error('Google Calendar sync error:', err);
    return { created: 0, updated: 0 };
  }
}
```

---

## Step 3: Create Calendar Service Facade

**CREATE** `src/lib/services/calendar/index.ts`:

```typescript
import { db } from '@/lib/db';
import { calendarEvents, calendarIntegrations, leads } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import * as googleCalendar from './google-calendar';

type Provider = 'google' | 'jobber' | 'servicetitan' | 'housecall_pro' | 'outlook';

interface CreateEventInput {
  clientId: string;
  leadId?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  eventType?: string;
  assignedTeamMemberId?: string;
}

/**
 * Create a new calendar event and sync to connected calendars
 */
export async function createEvent(input: CreateEventInput): Promise<string> {
  // Create local event
  const [event] = await db
    .insert(calendarEvents)
    .values({
      clientId: input.clientId,
      leadId: input.leadId,
      title: input.title,
      description: input.description,
      location: input.location,
      startTime: input.startTime,
      endTime: input.endTime,
      eventType: input.eventType,
      assignedTeamMemberId: input.assignedTeamMemberId,
      status: 'scheduled',
      syncStatus: 'pending',
    })
    .returning();
  
  // Sync to connected calendars
  await syncEventToProviders(input.clientId, event);
  
  return event.id;
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<CreateEventInput>
): Promise<void> {
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);
  
  if (!event) throw new Error('Event not found');
  
  await db
    .update(calendarEvents)
    .set({
      ...updates,
      updatedAt: new Date(),
      syncStatus: 'pending',
    })
    .where(eq(calendarEvents.id, eventId));
  
  // Fetch updated event
  const [updated] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);
  
  // Sync updates to providers
  if (updated.externalEventId) {
    await syncEventToProviders(updated.clientId!, updated);
  }
}

/**
 * Cancel/delete an event
 */
export async function cancelEvent(eventId: string): Promise<void> {
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);
  
  if (!event) throw new Error('Event not found');
  
  // Delete from external calendar
  if (event.provider === 'google' && event.externalEventId) {
    await googleCalendar.deleteGoogleEvent(event.clientId!, event.externalEventId);
  }
  
  // Update status locally
  await db
    .update(calendarEvents)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(calendarEvents.id, eventId));
}

/**
 * Sync event to all connected providers
 */
async function syncEventToProviders(
  clientId: string,
  event: typeof calendarEvents.$inferSelect
): Promise<void> {
  // Get all active integrations
  const integrations = await db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.clientId, clientId),
        eq(calendarIntegrations.isActive, true),
        eq(calendarIntegrations.syncEnabled, true)
      )
    );
  
  for (const integration of integrations) {
    if (integration.syncDirection === 'inbound') continue; // Skip if outbound disabled
    
    try {
      if (integration.provider === 'google') {
        if (event.externalEventId) {
          await googleCalendar.updateGoogleEvent(clientId, event);
        } else {
          await googleCalendar.createGoogleEvent(clientId, event);
        }
      }
      // Add other providers here
    } catch (err) {
      console.error(`Sync to ${integration.provider} failed:`, err);
    }
  }
}

/**
 * Get events for a date range
 */
export async function getEvents(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<(typeof calendarEvents.$inferSelect)[]> {
  return db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.clientId, clientId),
        gte(calendarEvents.startTime, startDate),
        lte(calendarEvents.startTime, endDate)
      )
    )
    .orderBy(calendarEvents.startTime);
}

/**
 * Get upcoming events for a lead
 */
export async function getLeadEvents(leadId: string): Promise<(typeof calendarEvents.$inferSelect)[]> {
  return db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.leadId, leadId),
        gte(calendarEvents.startTime, new Date())
      )
    )
    .orderBy(calendarEvents.startTime)
    .limit(10);
}

/**
 * Run full sync for a client (both directions)
 */
export async function fullSync(clientId: string): Promise<{
  inbound: { created: number; updated: number };
  outbound: { synced: number; failed: number };
}> {
  const results = {
    inbound: { created: 0, updated: 0 },
    outbound: { synced: 0, failed: 0 },
  };
  
  // Sync from external calendars (last 30 days to next 90 days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 90);
  
  const inbound = await googleCalendar.syncFromGoogleCalendar(clientId, startDate, endDate);
  results.inbound = inbound;
  
  // Sync pending local events to external calendars
  const pendingEvents = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.clientId, clientId),
        eq(calendarEvents.syncStatus, 'pending')
      )
    );
  
  for (const event of pendingEvents) {
    try {
      await syncEventToProviders(clientId, event);
      results.outbound.synced++;
    } catch {
      results.outbound.failed++;
    }
  }
  
  return results;
}

// Re-export provider functions
export { getGoogleAuthUrl, handleGoogleCallback } from './google-calendar';
```

---

## Step 4: Create Calendar API Routes

**CREATE** `src/app/api/calendar/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createEvent, getEvents } from '@/lib/services/calendar';

// GET - List events
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const startDate = start ? new Date(start) : new Date();
  const endDate = end ? new Date(end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const events = await getEvents(clientId, startDate, endDate);

  return NextResponse.json(events);
}

// POST - Create event
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    clientId,
    leadId,
    title,
    description,
    location,
    startTime,
    endTime,
    eventType,
  } = body;

  if (!clientId || !title || !startTime || !endTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const eventId = await createEvent({
    clientId,
    leadId,
    title,
    description,
    location,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    eventType,
  });

  return NextResponse.json({ eventId });
}
```

**CREATE** `src/app/api/calendar/integrations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { calendarIntegrations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getGoogleAuthUrl } from '@/lib/services/calendar';

// GET - List integrations
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const integrations = await db
    .select({
      id: calendarIntegrations.id,
      provider: calendarIntegrations.provider,
      isActive: calendarIntegrations.isActive,
      syncEnabled: calendarIntegrations.syncEnabled,
      lastSyncAt: calendarIntegrations.lastSyncAt,
      lastError: calendarIntegrations.lastError,
    })
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.clientId, clientId));

  return NextResponse.json(integrations);
}

// POST - Start OAuth flow
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { clientId, provider } = body;

  if (!clientId || !provider) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let authUrl: string;

  switch (provider) {
    case 'google':
      authUrl = getGoogleAuthUrl(clientId);
      break;
    default:
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  return NextResponse.json({ authUrl });
}
```

**CREATE** `src/app/api/auth/callback/google-calendar/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { handleGoogleCallback } from '@/lib/services/calendar';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // clientId
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/clients/${state}/settings?error=google_denied`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/clients/${state}/settings?error=invalid_callback`
    );
  }

  try {
    await handleGoogleCallback(code, state);
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/clients/${state}/settings?success=google_connected`
    );
  } catch (err) {
    console.error('Google Calendar callback error:', err);
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/clients/${state}/settings?error=google_failed`
    );
  }
}
```

---

## Step 5: Create Calendar Integration UI

**CREATE** `src/components/calendar/calendar-integrations.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Integration {
  id: string;
  provider: string;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

const PROVIDERS = [
  { id: 'google', name: 'Google Calendar', icon: '📅' },
  { id: 'jobber', name: 'Jobber', icon: '🔧', comingSoon: true },
  { id: 'servicetitan', name: 'ServiceTitan', icon: '⚙️', comingSoon: true },
  { id: 'housecall_pro', name: 'Housecall Pro', icon: '🏠', comingSoon: true },
];

interface CalendarIntegrationsProps {
  clientId: string;
}

export function CalendarIntegrations({ clientId }: CalendarIntegrationsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [clientId]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/integrations?clientId=${clientId}`);
      const data = await res.json();
      setIntegrations(data);
    } finally {
      setLoading(false);
    }
  };

  const connect = async (provider: string) => {
    try {
      const res = await fetch('/api/calendar/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, provider }),
      });
      const data = await res.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      toast.error('Failed to start connection');
    }
  };

  const disconnect = async (integrationId: string) => {
    if (!confirm('Disconnect this calendar? Events will stop syncing.')) return;
    
    try {
      await fetch(`/api/calendar/integrations/${integrationId}`, {
        method: 'DELETE',
      });
      await fetchIntegrations();
      toast.success('Calendar disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const sync = async (provider: string) => {
    setSyncing(provider);
    try {
      await fetch(`/api/calendar/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      await fetchIntegrations();
      toast.success('Calendar synced!');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const getIntegration = (provider: string) => 
    integrations.find(i => i.provider === provider);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading integrations...
          </div>
        ) : (
          PROVIDERS.map((provider) => {
            const integration = getIntegration(provider.id);
            const isConnected = integration?.isActive;
            
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    {isConnected ? (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">Connected</span>
                        {integration.lastSyncAt && (
                          <span className="text-muted-foreground">
                            · Synced {formatDistanceToNow(new Date(integration.lastSyncAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    ) : provider.comingSoon ? (
                      <Badge variant="secondary">Coming Soon</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not connected
                      </span>
                    )}
                    {integration?.lastError && (
                      <p className="text-xs text-red-500 mt-1">
                        Error: {integration.lastError}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sync(provider.id)}
                        disabled={syncing === provider.id}
                      >
                        {syncing === provider.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnect(integration.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : !provider.comingSoon ? (
                    <Button onClick={() => connect(provider.id)}>
                      Connect
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Step 6: Create Calendar Sync Cron

**CREATE** `src/app/api/cron/calendar-sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calendarIntegrations, clients } from '@/lib/db/schema';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { fullSync } from '@/lib/services/calendar';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get integrations that need sync (not synced in last 15 minutes)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  const needsSync = await db
    .select({
      clientId: calendarIntegrations.clientId,
    })
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.isActive, true),
        eq(calendarIntegrations.syncEnabled, true),
        or(
          isNull(calendarIntegrations.lastSyncAt),
          lt(calendarIntegrations.lastSyncAt, fifteenMinutesAgo)
        )
      )
    )
    .groupBy(calendarIntegrations.clientId);

  let synced = 0;
  let errors = 0;

  for (const { clientId } of needsSync) {
    if (!clientId) continue;
    
    try {
      await fullSync(clientId);
      synced++;
    } catch (err) {
      console.error(`Calendar sync failed for client ${clientId}:`, err);
      errors++;
    }
  }

  return NextResponse.json({
    synced,
    errors,
    timestamp: new Date().toISOString(),
  });
}
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add calendar tables |
| `src/lib/services/calendar/google-calendar.ts` | Created |
| `src/lib/services/calendar/index.ts` | Created |
| `src/app/api/calendar/events/route.ts` | Created |
| `src/app/api/calendar/integrations/route.ts` | Created |
| `src/app/api/auth/callback/google-calendar/route.ts` | Created |
| `src/components/calendar/calendar-integrations.tsx` | Created |
| `src/app/api/cron/calendar-sync/route.ts` | Created |

---

## Dependencies

```bash
npm install googleapis
```

---

## Environment Variables

```env
# Google Calendar (same as Phase 19b or separate)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

Enable Google Calendar API in Google Cloud Console.

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Connect Google Calendar
# Go to client settings and click "Connect" for Google Calendar
# Complete OAuth flow

# 3. Create event via API
curl -X POST http://localhost:3000/api/calendar/events \
  -H "Content-Type: application/json" \
  -d '{"clientId": "...", "title": "Roof Estimate", "startTime": "2024-12-20T10:00:00Z", "endTime": "2024-12-20T11:00:00Z"}'

# 4. Verify event appears in Google Calendar

# 5. Create event in Google Calendar, run sync
curl -X POST http://localhost:3000/api/calendar/sync \
  -d '{"clientId": "..."}'

# 6. Verify event appears locally
```

## Success Criteria
- [ ] Google Calendar OAuth works
- [ ] Events created locally sync to Google
- [ ] Events created in Google sync back
- [ ] Event updates sync both ways
- [ ] Cancelled events handled properly
- [ ] Cron job syncs regularly
