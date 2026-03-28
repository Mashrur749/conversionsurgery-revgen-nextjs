import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getDb, withTransaction } from '@/db';
import { leads } from '@/db/schema/leads';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { getClientId } from '@/lib/get-client-id';
import { eq, and, inArray } from 'drizzle-orm';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const MAX_ROWS = 1000;

const rowSchema = z.object({
  name: z.string().max(255).optional(),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().max(255).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  projectType: z.string().max(255).optional(),
  notes: z.string().optional(),
});

interface ImportError {
  row: number;
  phone?: string;
  error: string;
}

/** POST /api/leads/import — Bulk import leads from parsed CSV data */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = await getClientId();
    if (!clientId) {
      return NextResponse.json({ error: 'No client selected' }, { status: 400 });
    }

    const body: { rows?: unknown[] } = await request.json();
    const rows = body.rows;

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Expected rows array' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ROWS} rows per import` },
        { status: 400 }
      );
    }

    const db = getDb();
    const errors: ImportError[] = [];
    const validRows: z.infer<typeof rowSchema>[] = [];

    // Validate all rows first
    for (let i = 0; i < rows.length; i++) {
      const result = rowSchema.safeParse(rows[i]);
      if (!result.success) {
        const firstError = result.error.issues[0];
        errors.push({
          row: i + 1,
          error: `${firstError.path.join('.')}: ${firstError.message}`,
        });
        continue;
      }
      validRows.push(result.data);
    }

    // Normalize phones and check for duplicates within the import
    const seenPhones = new Set<string>();
    const deduped: z.infer<typeof rowSchema>[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      let normalizedPhone: string;

      try {
        normalizedPhone = normalizePhoneNumber(row.phone);
      } catch {
        errors.push({
          row: i + 1,
          phone: row.phone,
          error: 'Invalid phone number format',
        });
        continue;
      }

      if (seenPhones.has(normalizedPhone)) {
        errors.push({
          row: i + 1,
          phone: row.phone,
          error: 'Duplicate phone number in import',
        });
        continue;
      }

      seenPhones.add(normalizedPhone);
      deduped.push({ ...row, phone: normalizedPhone });
    }

    // Check for existing leads with same phone numbers
    const existingPhones = new Set<string>();
    if (deduped.length > 0) {
      const phonesToCheck = deduped.map(r => r.phone);
      // Check in batches of 100 to avoid query size limits
      for (let i = 0; i < phonesToCheck.length; i += 100) {
        const batch = phonesToCheck.slice(i, i + 100);
        const existing = await db
          .select({ phone: leads.phone })
          .from(leads)
          .where(and(
            eq(leads.clientId, clientId),
            inArray(leads.phone, batch)
          ));
        for (const e of existing) {
          existingPhones.add(e.phone);
        }
      }
    }

    // Filter out existing and record as skipped
    const toInsert = deduped.filter((row) => {
      if (existingPhones.has(row.phone)) {
        errors.push({
          row: 0, // Row number lost after dedup — reported as "existing"
          phone: row.phone,
          error: 'Lead with this phone already exists',
        });
        return false;
      }
      return true;
    });

    // Insert in transaction
    let imported = 0;
    if (toInsert.length > 0) {
      await withTransaction(async (tx) => {
        // Batch insert (Drizzle supports array values)
        await tx.insert(leads).values(
          toInsert.map((row) => ({
            clientId,
            name: row.name || null,
            phone: row.phone,
            email: row.email || null,
            address: row.address || null,
            projectType: row.projectType || null,
            notes: row.notes || null,
            source: 'csv_import' as const,
            status: 'new',
          }))
        );
        imported = toInsert.length;
      });
    }

    return NextResponse.json({
      imported,
      skipped: deduped.length - toInsert.length,
      errors: errors.length > 0 ? errors : undefined,
      total: rows.length,
    });
  } catch (error) {
    return safeErrorResponse('[Leads][import]', error, 'Import failed', 500);
  }
}
