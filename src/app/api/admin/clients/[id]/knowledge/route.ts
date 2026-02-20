import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import {
  getClientKnowledge,
  addKnowledgeEntry,
  initializeClientKnowledge,
} from '@/lib/services/knowledge-base';
import { z } from 'zod';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    await initializeClientKnowledge(id);
    const entries = await getClientKnowledge(id);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Get knowledge error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge entries' },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  category: z.enum(['services', 'pricing', 'faq', 'policies', 'about', 'custom']),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  keywords: z.string().optional(),
  priority: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const entryId = await addKnowledgeEntry(id, data);

    return NextResponse.json({ id: entryId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create knowledge entry error:', error);
    return NextResponse.json(
      { error: 'Failed to create knowledge entry' },
      { status: 500 }
    );
  }
}
