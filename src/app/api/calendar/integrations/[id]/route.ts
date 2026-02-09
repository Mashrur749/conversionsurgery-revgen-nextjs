import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, calendarIntegrations } from '@/db';
import { eq } from 'drizzle-orm';

// DELETE - Disconnect integration
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getDb();

    await db
      .update(calendarIntegrations)
      .set({
        isActive: false,
        syncEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(calendarIntegrations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Calendar integration DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}
