import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb, clientServices } from '@/db';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

const createServiceSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  avgValueCents: z.number().int().min(0).optional(),
  priceRangeMinCents: z.number().int().min(0).optional(),
  priceRangeMaxCents: z.number().int().min(0).optional(),
  canDiscussPrice: z.enum(['yes_range', 'defer', 'never']).default('defer'),
  sortOrder: z.number().int().default(0),
});

const bulkSyncSchema = z.object({
  services: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    category: z.string().max(100).optional(),
    avgValueCents: z.number().int().min(0).optional(),
    priceRangeMinCents: z.number().int().min(0).optional(),
    priceRangeMaxCents: z.number().int().min(0).optional(),
    canDiscussPrice: z.enum(['yes_range', 'defer', 'never']).default('defer'),
    sortOrder: z.number().int().default(0),
  })),
});

/** GET - List all services for a client */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CLIENTS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const db = getDb();

  const services = await db
    .select()
    .from(clientServices)
    .where(and(
      eq(clientServices.clientId, id),
      eq(clientServices.isActive, true)
    ))
    .orderBy(asc(clientServices.sortOrder), asc(clientServices.name));

  return NextResponse.json({ services });
}

/** POST - Create a single service or bulk sync all services */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    await requireAgencyClientPermission(clientId, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }
  const body: Record<string, unknown> = await request.json();
  const db = getDb();

  // Bulk sync mode: replaces all services for the client
  if (body.services) {
    const parsed = bulkSyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Soft-delete existing services
    await db
      .update(clientServices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(clientServices.clientId, clientId));

    // Insert new services
    if (parsed.data.services.length > 0) {
      const values = parsed.data.services.map((s, i) => ({
        clientId,
        name: s.name,
        category: s.category,
        avgValueCents: s.avgValueCents ?? (s.priceRangeMinCents && s.priceRangeMaxCents
          ? Math.round((s.priceRangeMinCents + s.priceRangeMaxCents) / 2)
          : undefined),
        priceRangeMinCents: s.priceRangeMinCents,
        priceRangeMaxCents: s.priceRangeMaxCents,
        canDiscussPrice: s.canDiscussPrice,
        sortOrder: s.sortOrder ?? i,
        isActive: true,
      }));

      await db.insert(clientServices).values(values);
    }

    return NextResponse.json({
      success: true,
      count: parsed.data.services.length,
    });
  }

  // Single create mode
  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const [service] = await db
    .insert(clientServices)
    .values({
      clientId,
      ...parsed.data,
      avgValueCents: parsed.data.avgValueCents ?? (parsed.data.priceRangeMinCents && parsed.data.priceRangeMaxCents
        ? Math.round((parsed.data.priceRangeMinCents + parsed.data.priceRangeMaxCents) / 2)
        : undefined),
    })
    .returning();

  return NextResponse.json({ service }, { status: 201 });
}
