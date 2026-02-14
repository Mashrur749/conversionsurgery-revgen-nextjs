import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const leadUpdateSchema = z.object({
  status: z.string().max(50).optional(),
  temperature: z.string().max(10).optional(),
  notes: z.string().max(5000).optional(),
  projectType: z.string().max(255).optional(),
  quoteValue: z.coerce.number().optional().nullable(),
  address: z.string().max(500).optional(),
  name: z.string().max(255).optional(),
  email: z.string().email().max(255).optional().nullable(),
  actionRequired: z.boolean().optional(),
  actionRequiredReason: z.string().max(255).optional().nullable(),
  conversationMode: z.enum(['ai', 'human', 'paused']).optional(),
}).strict();

/** PATCH /api/leads/[id] - Update a lead's fields (scoped to the authenticated client). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = session?.client?.id;
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = leadUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const db = getDb();

    const updated = await db
      .update(leads)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('[LeadManagement] Update lead error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
