import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { flowTemplateVersions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const versions = await db
    .select()
    .from(flowTemplateVersions)
    .where(eq(flowTemplateVersions.templateId, id))
    .orderBy(desc(flowTemplateVersions.version));

  return NextResponse.json(versions);
}
