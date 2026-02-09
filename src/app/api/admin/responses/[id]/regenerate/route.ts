import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { regenerateResponse } from '@/lib/services/review-response';
import { z } from 'zod';

const regenerateSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'apologetic', 'thankful']).optional(),
  shorter: z.boolean().optional(),
  custom: z.string().optional(),
});

// POST - Regenerate response with different parameters
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = regenerateSchema.parse(body);

    const newText = await regenerateResponse(id, {
      tone: data.tone,
      shorter: data.shorter,
      custom: data.custom,
    });

    return NextResponse.json({ responseText: newText });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Review Response] Regenerate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate response' },
      { status: 500 }
    );
  }
}
