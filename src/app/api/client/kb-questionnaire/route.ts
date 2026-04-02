import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

const questionnaireSchema = z
  .object({
    mainServices: z.string(),
    servicesNotOffered: z.string(),
    priceRanges: z.string(),
    serviceArea: z.string(),
    projectTimeline: z.string(),
    warranty: z.string(),
    licensedAndInsured: z.string(),
    yearsInBusiness: z.string(),
    differentiators: z.string(),
    businessHours: z.string(),
    pricingHandling: z.enum(['never_give_prices', 'give_general_ranges', 'refer_to_website']),
    bookingProcess: z.string(),
  })
  .strict();

type QuestionnaireInput = z.infer<typeof questionnaireSchema>;

interface KbEntrySpec {
  category: 'services' | 'pricing' | 'faq' | 'policies' | 'about' | 'custom';
  title: string;
  content: string;
  keywords: string;
  priority: number;
}

const PRICING_HANDLING_LABELS: Record<string, string> = {
  never_give_prices: 'Never give prices — book an estimate',
  give_general_ranges: 'Give general ranges',
  refer_to_website: 'Refer to website',
};

function buildEntries(clientId: string, data: QuestionnaireInput): KbEntrySpec[] {
  // clientId used for future extensibility; suppress unused warning
  void clientId;

  const entries: KbEntrySpec[] = [];

  if (data.mainServices.trim()) {
    entries.push({
      category: 'services',
      title: 'Main Services Offered',
      content: data.mainServices.trim(),
      keywords: 'services, what do you do, offerings',
      priority: 10,
    });
  }

  if (data.servicesNotOffered.trim()) {
    entries.push({
      category: 'services',
      title: 'Services Not Offered',
      content: data.servicesNotOffered.trim(),
      keywords: 'not available, do not offer, excluded services',
      priority: 8,
    });
  }

  if (data.priceRanges.trim()) {
    entries.push({
      category: 'pricing',
      title: 'Typical Price Ranges',
      content: data.priceRanges.trim(),
      keywords: 'price, cost, how much, estimate, quote',
      priority: 9,
    });
  }

  if (data.serviceArea.trim()) {
    entries.push({
      category: 'services',
      title: 'Service Area',
      content: data.serviceArea.trim(),
      keywords: 'service area, location, coverage, where do you work',
      priority: 8,
    });
  }

  if (data.projectTimeline.trim()) {
    entries.push({
      category: 'faq',
      title: 'Typical Project Timelines',
      content: data.projectTimeline.trim(),
      keywords: 'timeline, how long, duration, project length',
      priority: 7,
    });
  }

  if (data.warranty.trim()) {
    entries.push({
      category: 'policies',
      title: 'Warranty Policy',
      content: data.warranty.trim(),
      keywords: 'warranty, guarantee, defects, after work',
      priority: 7,
    });
  }

  if (data.licensedAndInsured.trim()) {
    entries.push({
      category: 'about',
      title: 'Licensing and Insurance',
      content: data.licensedAndInsured.trim(),
      keywords: 'licensed, insured, certification, liability',
      priority: 8,
    });
  }

  if (data.yearsInBusiness.trim()) {
    entries.push({
      category: 'about',
      title: 'Years in Business',
      content: data.yearsInBusiness.trim(),
      keywords: 'experience, years in business, established, history',
      priority: 5,
    });
  }

  if (data.differentiators.trim()) {
    entries.push({
      category: 'about',
      title: 'What Makes Us Different',
      content: data.differentiators.trim(),
      keywords: 'why choose us, different, unique, better than competitors',
      priority: 6,
    });
  }

  if (data.businessHours.trim()) {
    entries.push({
      category: 'faq',
      title: 'Business Hours',
      content: data.businessHours.trim(),
      keywords: 'hours, open, available, when can I call',
      priority: 6,
    });
  }

  // Always create the pricing handling instruction — it's a critical AI behaviour rule
  const pricingLabel = PRICING_HANDLING_LABELS[data.pricingHandling] ?? data.pricingHandling;
  entries.push({
    category: 'pricing',
    title: 'Pricing Question Handling Policy',
    content: `When homeowners ask about pricing: ${pricingLabel}.`,
    keywords: 'pricing policy, how to handle prices, cost questions',
    priority: 10,
  });

  if (data.bookingProcess.trim()) {
    entries.push({
      category: 'faq',
      title: 'Preferred Booking Process',
      content: data.bookingProcess.trim(),
      keywords: 'book, schedule, appointment, how to get started, estimate',
      priority: 9,
    });
  }

  return entries;
}

export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.KNOWLEDGE_EDIT },
  async ({ request, session }) => {
    const body: unknown = await request.json();
    const data = questionnaireSchema.parse(body);

    const entries = buildEntries(session.clientId, data);

    if (entries.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const db = getDb();
    await db.insert(knowledgeBase).values(
      entries.map((e) => ({
        clientId: session.clientId,
        category: e.category,
        title: e.title,
        content: e.content,
        keywords: e.keywords,
        priority: e.priority,
        isActive: true,
      }))
    );

    return NextResponse.json({ created: entries.length });
  }
);
