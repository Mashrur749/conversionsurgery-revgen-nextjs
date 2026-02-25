import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb, escalationRules } from '@/db';
import { type NewEscalationRule } from '@/db/schema/escalation-rules';
import { eq, asc } from 'drizzle-orm';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

// GET - List all rules for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    await requireAgencyClientPermission(clientId, AGENCY_PERMISSIONS.CLIENTS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const db = getDb();

  try {
    const rules = await db
      .select()
      .from(escalationRules)
      .where(eq(escalationRules.clientId, clientId))
      .orderBy(asc(escalationRules.priority));

    return NextResponse.json(rules);
  } catch (error) {
    return safeErrorResponse('[EscalationRules][list]', error, 'Failed to fetch rules');
  }
}

// POST - Create new rule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    await requireAgencyClientPermission(clientId, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const db = getDb();

  try {
    const body = await request.json() as Pick<
      NewEscalationRule,
      'name' | 'description' | 'conditions' | 'action' | 'priority' | 'enabled'
    >;

    if (!body.name || !body.conditions || !body.action) {
      return NextResponse.json({ error: 'name, conditions, and action are required' }, { status: 400 });
    }

    const [rule] = await db.insert(escalationRules).values({
      clientId,
      name: body.name,
      description: body.description,
      conditions: body.conditions,
      action: body.action,
      priority: body.priority || 100,
      enabled: body.enabled ?? true,
    }).returning();

    return NextResponse.json(rule);
  } catch (error) {
    return safeErrorResponse('[EscalationRules][create]', error, 'Failed to create rule');
  }
}
