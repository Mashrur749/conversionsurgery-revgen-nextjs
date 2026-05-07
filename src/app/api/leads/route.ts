import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, and, or, ilike, sql, desc, asc, gte, lte, count } from 'drizzle-orm';
import { z } from 'zod';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { canAccessClient, getAgencySession } from '@/lib/permissions';
import { getClientId } from '@/lib/get-client-id';
import { ComplianceService } from '@/lib/compliance/compliance-service';

// CASL §10(1): implied consent from inquiry expires after 6 calendar months.
// Inquiries older than this require documented express consent to contact.
const CASL_IMPLIED_CONSENT_DAYS = 180;
// CASL §10(10)(a): existing-customer relationship grants implied consent for
// 24 months from the date of the most recent paid transaction.
const CASL_EXISTING_CUSTOMER_DAYS = 730;
const MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH = 10;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

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

  let effectiveClientId = isAgency ? clientId || null : sessionClientId;

  if (isAgency) {
    const agencySession = await getAgencySession();
    if (!agencySession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!effectiveClientId) {
      effectiveClientId = await getClientId();
    }

    // Assigned-scope users must stay inside their assigned clients.
    if (effectiveClientId && !canAccessClient(agencySession, effectiveClientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!effectiveClientId && agencySession.clientScope === 'assigned') {
      return NextResponse.json(
        { error: 'Select a client to view leads' },
        { status: 400 }
      );
    }
  }

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

// Shared lead identity fields for all three intake modes.
const baseLeadFields = {
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  clientId: z.string().uuid().optional(),
  notes: z.string().optional(),
  projectType: z.string().optional(),
  address: z.string().optional(),
} as const;

// CASL three-mode intake:
//   - inquiry:           recent (≤180d) inquiry → implied consent (6mo clock from inquiry)
//   - express_consent:   any age + evidence → express_written consent
//   - existing_customer: paid customer (≤730d) → implied consent (24mo clock from txn)
const createLeadSchema = z.discriminatedUnion('consentMode', [
  z.object({
    ...baseLeadFields,
    consentMode: z.literal('inquiry'),
    inquiryDate: z.string().min(1, 'inquiryDate is required'),
  }).strict(),
  z.object({
    ...baseLeadFields,
    consentMode: z.literal('express_consent'),
    inquiryDate: z.string().min(1, 'inquiryDate is required'),
    expressConsentEvidence: z
      .string()
      .min(
        MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH,
        `expressConsentEvidence must be at least ${MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH} characters`
      ),
  }).strict(),
  z.object({
    ...baseLeadFields,
    consentMode: z.literal('existing_customer'),
    transactionDate: z.string().min(1, 'transactionDate is required'),
    customerNotes: z.string().optional(),
  }).strict(),
]);

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

  let effectiveClientId = isAgency ? (data.clientId || null) : sessionClientId;

  if (!effectiveClientId) {
    if (isAgency) {
      effectiveClientId = await getClientId();
    }
  }

  if (!effectiveClientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  if (isAgency) {
    const agencySession = await getAgencySession();
    if (!agencySession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canAccessClient(agencySession, effectiveClientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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

  // Resolve the lead's effective inquiry_date per mode.
  // For existing_customer, transaction_date drives both inquiry_date (so dormant
  // re-engagement keeps working) AND the 24-month implied-consent clock.
  let effectiveInquiryDate: Date;
  if (data.consentMode === 'existing_customer') {
    const txn = new Date(data.transactionDate);
    if (Number.isNaN(txn.getTime())) {
      return NextResponse.json(
        { error: 'transactionDate: invalid date format' },
        { status: 400 }
      );
    }
    const ageDays = daysBetween(txn, new Date());
    if (ageDays < 0) {
      return NextResponse.json(
        { error: 'transactionDate cannot be in the future' },
        { status: 400 }
      );
    }
    if (ageDays > CASL_EXISTING_CUSTOMER_DAYS) {
      return NextResponse.json(
        {
          error: `transactionDate must be within last 24 months (${CASL_EXISTING_CUSTOMER_DAYS} days). Found ${ageDays} days.`,
        },
        { status: 400 }
      );
    }
    effectiveInquiryDate = txn;
  } else {
    const inquiryDate = new Date(data.inquiryDate);
    if (Number.isNaN(inquiryDate.getTime())) {
      return NextResponse.json(
        { error: 'inquiryDate: invalid date format' },
        { status: 400 }
      );
    }
    if (data.consentMode === 'inquiry') {
      const ageDays = daysBetween(inquiryDate, new Date());
      if (ageDays >= CASL_IMPLIED_CONSENT_DAYS) {
        return NextResponse.json(
          {
            error: `Inquiries older than ${CASL_IMPLIED_CONSENT_DAYS} days require consentMode='express_consent' with expressConsentEvidence.`,
          },
          { status: 400 }
        );
      }
    }
    effectiveInquiryDate = inquiryDate;
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
      inquiryDate: effectiveInquiryDate,
    })
    .returning();

  // Record CASL consent record matched to the chosen intake mode.
  if (data.consentMode === 'express_consent') {
    const evidence = data.expressConsentEvidence.trim();
    await ComplianceService.recordConsent(effectiveClientId, normalizedPhone, {
      type: 'express_written',
      source: 'manual_entry',
      scope: {
        marketing: true,
        transactional: true,
        promotional: true,
        reminders: true,
      },
      language: evidence,
      consentEvidence: evidence,
    });
  } else if (data.consentMode === 'existing_customer') {
    const trimmedNotes = data.customerNotes?.trim();
    await ComplianceService.recordConsent(effectiveClientId, normalizedPhone, {
      type: 'implied',
      source: 'existing_customer',
      scope: {
        marketing: true,
        transactional: true,
        promotional: true,
        reminders: true,
      },
      language:
        'Existing customer (paid relationship)' +
        (trimmedNotes ? ': ' + trimmedNotes : ''),
      consentTimestamp: effectiveInquiryDate,
    });
  } else {
    await ComplianceService.recordConsent(effectiveClientId, normalizedPhone, {
      type: 'implied',
      source: 'manual_entry',
      scope: {
        marketing: true,
        transactional: true,
        promotional: true,
        reminders: true,
      },
      language: 'Implied consent from inquiry',
      consentTimestamp: effectiveInquiryDate,
    });
  }

  return NextResponse.json({ lead: newLead }, { status: 201 });
}
