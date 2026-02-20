import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { updateKnowledgeEntry, deleteKnowledgeEntry } from '@/lib/services/knowledge-base';
import { z } from 'zod';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

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
  const { id, entryId } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    await updateKnowledgeEntry(entryId, data, id);

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
  const { id, entryId } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    await deleteKnowledgeEntry(entryId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete knowledge entry error:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge entry' },
      { status: 500 }
    );
  }
}
