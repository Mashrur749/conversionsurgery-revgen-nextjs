import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateKnowledgeEntry, deleteKnowledgeEntry } from '@/lib/services/knowledge-base';
import { z } from 'zod';

const updateSchema = z.object({
  category: z.enum(['services', 'pricing', 'faq', 'policies', 'about', 'custom']).optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  keywords: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { entryId } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    await updateKnowledgeEntry(entryId, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update knowledge entry error:', error);
    return NextResponse.json(
      { error: 'Failed to update knowledge entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { entryId } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await deleteKnowledgeEntry(entryId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete knowledge entry error:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge entry' },
      { status: 500 }
    );
  }
}
