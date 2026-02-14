import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, and, or, ilike, sql, desc, asc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

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

  const isAdmin = session.user?.isAdmin || false;
  const sessionClientId = session?.client?.id;

  if (!isAdmin && !sessionClientId) {
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
  if (clientId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Determine which clientId to filter by — admins can query across clients
  const effectiveClientId = isAdmin ? (clientId || null) : sessionClientId;

  if (!isAdmin && !effectiveClientId) {
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
