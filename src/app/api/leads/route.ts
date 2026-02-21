import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, and, or, ilike, sql, desc, asc, gte, lte, count } from 'drizzle-orm';
import { z } from 'zod';
import { normalizePhoneNumber } from '@/lib/utils/phone';

const querySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  clientId: z.string().uuid().optional(),
  temperature: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'updatedAt', 'score']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

/** GET /api/leads - List leads with search, filter, sort, and pagination. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAgency = session.user?.isAgency || false;
  const sessionClientId = session?.client?.id;

  if (!isAgency && !sessionClientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { search, status, source, clientId, temperature, dateFrom, dateTo, page, limit, sortBy, sortDir } = parsed.data;

  // Non-admins cannot query other clients
  if (clientId && !isAgency) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Determine which clientId to filter by — admins can query across clients
  const effectiveClientId = isAgency ? (clientId || null) : sessionClientId;

  if (!isAgency && !effectiveClientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const db = getDb();
  const conditions = [];

  if (effectiveClientId) {
    conditions.push(eq(leads.clientId, effectiveClientId));
  }

  if (search) {
    conditions.push(
      or(
        ilike(leads.name, `%${search}%`),
        ilike(leads.phone, `%${search}%`),
        ilike(leads.email, `%${search}%`)
      )!
    );
  }

  if (status) {
    conditions.push(eq(leads.status, status));
  }

  if (source) {
    conditions.push(eq(leads.source, source));
  }

  if (temperature) {
    conditions.push(eq(leads.temperature, temperature));
  }

  if (dateFrom) {
    conditions.push(gte(leads.createdAt, new Date(dateFrom)));
  }

  if (dateTo) {
    conditions.push(lte(leads.createdAt, new Date(dateTo)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = sortBy === 'score' ? leads.score
    : sortBy === 'createdAt' ? leads.createdAt
    : leads.updatedAt;
  const orderFn = sortDir === 'asc' ? asc : desc;

  const offset = (page - 1) * limit;

  const [leadsResult, countResult] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count || 0);

  return NextResponse.json({
    leads: leadsResult,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  clientId: z.string().uuid().optional(),
  notes: z.string().optional(),
  projectType: z.string().optional(),
  address: z.string().optional(),
}).strict();

/** POST /api/leads - Create a lead manually. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAgency = session.user?.isAgency || false;
  const sessionClientId = session?.client?.id;

  if (!isAgency && !sessionClientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Non-admins cannot create leads for other clients
  if (data.clientId && !isAgency) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const effectiveClientId = isAgency ? (data.clientId || sessionClientId) : sessionClientId;

  if (!effectiveClientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  // Check usage limit (skip for admins creating leads on behalf of clients)
  if (!isAgency) {
    const { checkUsageLimit } = await import('@/lib/services/subscription');
    const leadCount = await getDb()
      .select({ count: count() })
      .from(leads)
      .where(eq(leads.clientId, effectiveClientId));
    const usageCheck = await checkUsageLimit(effectiveClientId, 'leads', leadCount[0]?.count ?? 0);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: `Lead limit reached (${usageCheck.current}/${usageCheck.limit}). Upgrade your plan for more capacity.` },
        { status: 403 }
      );
    }
  }

  const db = getDb();
  const normalizedPhone = normalizePhoneNumber(data.phone);

  const [newLead] = await db
    .insert(leads)
    .values({
      clientId: effectiveClientId,
      name: data.name,
      phone: normalizedPhone,
      email: data.email || null,
      notes: data.notes || null,
      projectType: data.projectType || null,
      address: data.address || null,
      source: 'manual',
      status: 'new',
      temperature: 'warm',
    })
    .returning();

  return NextResponse.json({ lead: newLead }, { status: 201 });
}
