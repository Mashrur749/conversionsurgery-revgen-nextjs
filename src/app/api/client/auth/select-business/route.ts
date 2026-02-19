import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { clientMemberships, clients, people, auditLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { setClientSessionCookieWithPermissions } from '@/lib/client-auth';

const selectBusinessSchema = z
  .object({
    personId: z.string().uuid(),
    clientId: z.string().uuid(),
  })
  .strict();

/**
 * POST /api/client/auth/select-business
 * Called after OTP verification when a person has multiple businesses.
 * Validates membership, sets cookie with permissions, and redirects to dashboard.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = selectBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { personId, clientId } = parsed.data;

  try {
    const db = getDb();

    // Verify active membership exists
    const [membership] = await db
      .select({ id: clientMemberships.id })
      .from(clientMemberships)
      .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
      .where(
        and(
          eq(clientMemberships.personId, personId),
          eq(clientMemberships.clientId, clientId),
          eq(clientMemberships.isActive, true),
          eq(clients.status, 'active')
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'No active membership found for this business.' },
        { status: 403 }
      );
    }

    // Set cookie with full permissions
    await setClientSessionCookieWithPermissions(personId, clientId);

    // Update lastLoginAt
    await db
      .update(people)
      .set({ lastLoginAt: new Date() })
      .where(eq(people.id, personId));

    // Audit log
    await db.insert(auditLog).values({
      personId,
      clientId,
      action: 'auth.login',
      resourceType: 'client_membership',
      resourceId: membership.id,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SelectBusiness] Error:', error);
    return NextResponse.json(
      { error: 'Failed to select business' },
      { status: 500 }
    );
  }
}
