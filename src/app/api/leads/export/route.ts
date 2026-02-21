import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, and, or, ilike, gte, lte } from 'drizzle-orm';

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** GET /api/leads/export - Export filtered leads as CSV. */
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

  const sp = request.nextUrl.searchParams;
  const search = sp.get('search') || undefined;
  const status = sp.get('status') || undefined;
  const source = sp.get('source') || undefined;
  const clientId = sp.get('clientId') || undefined;
  const temperature = sp.get('temperature') || undefined;
  const dateFrom = sp.get('dateFrom') || undefined;
  const dateTo = sp.get('dateTo') || undefined;

  if (clientId && !isAgency) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const effectiveClientId = isAgency ? (clientId || null) : sessionClientId;

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

  if (status) conditions.push(eq(leads.status, status));
  if (source) conditions.push(eq(leads.source, source));
  if (temperature) conditions.push(eq(leads.temperature, temperature));
  if (dateFrom) conditions.push(gte(leads.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(leads.createdAt, new Date(dateTo)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(leads)
    .where(whereClause)
    .orderBy(leads.createdAt)
    .limit(10000);

  const headers = ['Name', 'Phone', 'Email', 'Status', 'Temperature', 'Source', 'Project Type', 'Score', 'Notes', 'Created At', 'Updated At'];
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    csvLines.push([
      escapeCsv(row.name),
      escapeCsv(row.phone),
      escapeCsv(row.email),
      escapeCsv(row.status),
      escapeCsv(row.temperature),
      escapeCsv(row.source),
      escapeCsv(row.projectType),
      escapeCsv(String(row.score ?? '')),
      escapeCsv(row.notes),
      escapeCsv(row.createdAt?.toISOString()),
      escapeCsv(row.updatedAt?.toISOString()),
    ].join(','));
  }

  const csv = csvLines.join('\n');
  const date = new Date().toISOString().split('T')[0];

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
    },
  });
}
