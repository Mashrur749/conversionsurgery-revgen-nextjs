import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
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
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const data = await loadStructuredKnowledge(clientId);
    return NextResponse.json({ data });
  }
);

/** PUT - Save structured knowledge (replaces existing) */
export const PUT = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const parsed = structuredKnowledgeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await saveStructuredKnowledge(clientId, parsed.data);

    return NextResponse.json({
      success: true,
      entriesCreated: result.entriesCreated,
    });
  }
);
