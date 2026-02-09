import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { postResponseToGoogle } from '@/lib/services/google-business';

// POST - Post response to Google Business Profile
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
    const result = await postResponseToGoogle(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Review Response] Post to Google error:', error);
    return NextResponse.json(
      { error: 'Failed to post response to Google' },
      { status: 500 }
    );
  }
}
