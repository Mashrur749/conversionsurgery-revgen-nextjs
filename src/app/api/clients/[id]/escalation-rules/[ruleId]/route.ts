import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb, escalationRules } from '@/db';
import { type NewEscalationRule } from '@/db/schema/escalation-rules';
import { eq, and } from 'drizzle-orm';

// PUT - Update rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const { id: clientId, ruleId } = await params;

  try {
    await requireAgencyClientPermission(clientId, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const db = getDb();

  try {
    const body = await request.json() as Partial<Pick<
      NewEscalationRule,
      'name' | 'description' | 'conditions' | 'action' | 'priority' | 'enabled'
    >>;

    const [rule] = await db
      .update(escalationRules)
      .set({
        name: body.name,
        description: body.description,
        conditions: body.conditions,
        action: body.action,
        priority: body.priority,
        enabled: body.enabled,
        updatedAt: new Date(),
      })
      .where(and(
        eq(escalationRules.id, ruleId),
        eq(escalationRules.clientId, clientId)
      ))
      .returning();

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('[Escalation Rules API] Error updating:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

// DELETE - Delete rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const { id: clientId, ruleId } = await params;

  try {
    await requireAgencyClientPermission(clientId, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const db = getDb();

  try {
    await db
      .delete(escalationRules)
      .where(and(
        eq(escalationRules.id, ruleId),
        eq(escalationRules.clientId, clientId)
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Escalation Rules API] Error deleting:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
