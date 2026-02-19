import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';
import {
  saveStructuredKnowledge,
  loadStructuredKnowledge,
} from '@/lib/services/structured-knowledge';

const serviceSchema = z.object({
  name: z.string().min(1),
  priceRangeMin: z.number().min(0),
  priceRangeMax: z.number().min(0),
  canDiscussPrice: z.enum(['yes_range', 'defer', 'never']),
});

const faqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

const structuredKnowledgeSchema = z.object({
  services: z.array(serviceSchema).default([]),
  dontDo: z.array(z.string()).default([]),
  coveredAreas: z.array(z.string()).default([]),
  areaExclusions: z.array(z.string()).default([]),
  offersEstimates: z.boolean().default(false),
  estimateConditions: z.string().default(''),
  offersExactQuotes: z.boolean().default(false),
  pricingNotes: z.string().default(''),
  afterBooking: z.string().default(''),
  paymentTerms: z.string().default(''),
  warranty: z.string().default(''),
  faqs: z.array(faqSchema).default([]),
  neverSay: z.array(z.string()).default([]),
});

/** GET - Load existing structured knowledge for a client */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const data = await loadStructuredKnowledge(id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[Knowledge] Failed to load structured knowledge:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

/** PUT - Save structured knowledge (replaces existing) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = structuredKnowledgeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await saveStructuredKnowledge(id, parsed.data);

    return NextResponse.json({
      success: true,
      entriesCreated: result.entriesCreated,
    });
  } catch (error) {
    console.error('[Knowledge] Failed to save structured knowledge:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
