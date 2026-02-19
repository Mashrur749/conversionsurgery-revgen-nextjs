import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';

/** GET /api/admin/system-settings - List all system settings. */
export async function GET() {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const db = getDb();
  const settings = await db
    .select()
    .from(systemSettings)
    .orderBy(asc(systemSettings.key));

  return NextResponse.json({ settings });
}

const upsertSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  description: z.string().optional(),
}).strict();

/** POST /api/admin/system-settings - Create or update a system setting. */
export async function POST(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const db = getDb();
  const { key, value, description } = parsed.data;

  // Upsert: try update first, insert if not found
  const [existing] = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(systemSettings)
      .set({ value, description, updatedAt: new Date() })
      .where(eq(systemSettings.key, key))
      .returning();
    return NextResponse.json({ setting: updated });
  }

  const [created] = await db
    .insert(systemSettings)
    .values({ key, value, description })
    .returning();

  return NextResponse.json({ setting: created }, { status: 201 });
}
