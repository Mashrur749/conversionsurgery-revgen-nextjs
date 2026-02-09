import { getDb, calendarEvents, calendarIntegrations } from '@/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as googleCalendar from './google-calendar';

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
  const db = getDb();

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
  const db = getDb();

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
  const db = getDb();

  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);

  if (!event) throw new Error('Event not found');

  // Delete from external calendar
  if (event.provider === 'google' && event.externalEventId) {
    await googleCalendar.deleteGoogleEvent(
      event.clientId!,
      event.externalEventId
    );
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
  const db = getDb();

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
    if (integration.syncDirection === 'inbound') continue;

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
  const db = getDb();

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
export async function getLeadEvents(
  leadId: string
): Promise<(typeof calendarEvents.$inferSelect)[]> {
  const db = getDb();

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
  const db = getDb();

  const results = {
    inbound: { created: 0, updated: 0 },
    outbound: { synced: 0, failed: 0 },
  };

  // Sync from external calendars (last 30 days to next 90 days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 90);

  const inbound = await googleCalendar.syncFromGoogleCalendar(
    clientId,
    startDate,
    endDate
  );
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
