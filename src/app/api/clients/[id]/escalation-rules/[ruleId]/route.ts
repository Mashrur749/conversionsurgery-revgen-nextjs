import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, escalationRules } from '@/db';
import { eq, and } from 'drizzle-orm';

// PUT - Update rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId, ruleId } = await params;
  const db = getDb();

  try {
    const body = await request.json() as {
      name?: string;
      description?: string;
      conditions?: any;
      action?: any;
      priority?: number;
      enabled?: boolean;
    };

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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId, ruleId } = await params;
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
