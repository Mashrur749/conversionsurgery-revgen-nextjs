import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { clientMemberships, clients, auditLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  getClientSession,
  setClientSessionCookieWithPermissions,
} from '@/lib/client-auth';

const switchBusinessSchema = z
  .object({
    clientId: z.string().uuid(),
  })
  .strict();

/**
 * POST /api/client/auth/switch-business
 * Switch the current session to a different business.
 * Requires an existing authenticated session (personId from cookie).
 * Validates the person has an active membership for the target business.
 */
export async function POST(request: NextRequest) {
  // Get current session to extract personId
  const session = await getClientSession();
  if (!session || !('personId' in session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { personId } = session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = switchBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { clientId: newClientId } = parsed.data;

  try {
    const db = getDb();

    // Verify active membership exists for personId + new clientId
    const [membership] = await db
      .select({ id: clientMemberships.id })
      .from(clientMemberships)
      .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
      .where(
        and(
          eq(clientMemberships.personId, personId),
          eq(clientMemberships.clientId, newClientId),
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

    // Regenerate cookie with new clientId + permissions
    await setClientSessionCookieWithPermissions(personId, newClientId);

    // Audit log: auth.business_switched
    await db.insert(auditLog).values({
      personId,
      clientId: newClientId,
      action: 'auth.business_switched',
      resourceType: 'client_membership',
      resourceId: membership.id,
      metadata: { previousClientId: session.clientId },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SwitchBusiness] Error:', error);
    return NextResponse.json(
      { error: 'Failed to switch business' },
      { status: 500 }
    );
  }
}
