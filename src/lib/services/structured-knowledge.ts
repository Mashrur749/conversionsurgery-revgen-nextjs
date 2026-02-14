/**
 * Structured Knowledge Service
 *
 * Converts structured interview form data into knowledge base entries.
 * Used during onboarding and for knowledge management.
 */

import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface StructuredKnowledgeData {
  // Section 1: Services & Boundaries
  services: Array<{
    name: string;
    priceRangeMin: number;
    priceRangeMax: number;
    canDiscussPrice: 'yes_range' | 'defer' | 'never';
  }>;
  dontDo: string[];

  // Section 2: Service Area
  coveredAreas: string[];
  areaExclusions: string[];

  // Section 3: Pricing Guidance
  offersEstimates: boolean;
  estimateConditions: string;
  offersExactQuotes: boolean;
  pricingNotes: string;

  // Section 4: Process & Logistics
  afterBooking: string;
  paymentTerms: string;
  warranty: string;

  // Section 5: Common Questions
  faqs: Array<{ question: string; answer: string }>;

  // Section 6: Things AI Must Never Say
  neverSay: string[];
}

/**
 * Save structured knowledge by converting form data to KB entries.
 * Replaces existing structured entries for the client (tagged with source='structured').
 */
export async function saveStructuredKnowledge(
  clientId: string,
  data: StructuredKnowledgeData
): Promise<{ entriesCreated: number }> {
  const db = getDb();

  // Delete existing structured entries (to allow re-saving without duplicates)
  await db
    .delete(knowledgeBase)
    .where(and(
      eq(knowledgeBase.clientId, clientId),
      eq(knowledgeBase.keywords, 'structured-knowledge')
    ));

  const entries: Array<typeof knowledgeBase.$inferInsert> = [];
  const tag = 'structured-knowledge'; // Used to identify entries from this form

  // ---- Services ----
  if (data.services.length > 0) {
    const serviceList = data.services
      .map(s => {
        const priceInfo = s.canDiscussPrice === 'yes_range'
          ? ` ($${s.priceRangeMin}–$${s.priceRangeMax})`
          : s.canDiscussPrice === 'defer'
            ? ' (pricing available with estimate)'
            : '';
        return `• ${s.name}${priceInfo}`;
      })
      .join('\n');

    entries.push({
      clientId,
      category: 'services',
      title: 'Services We Offer',
      content: serviceList,
      keywords: tag,
      priority: 10,
      isActive: true,
    });

    // Individual service entries for better search matching
    for (const service of data.services) {
      if (service.canDiscussPrice === 'yes_range') {
        entries.push({
          clientId,
          category: 'pricing',
          title: `${service.name} Pricing`,
          content: `${service.name} typically ranges from $${service.priceRangeMin} to $${service.priceRangeMax}. This is an estimate — final pricing depends on the specific job.`,
          keywords: tag,
          priority: 8,
          isActive: true,
        });
      }
    }
  }

  // ---- Boundaries (what we don't do) ----
  if (data.dontDo.length > 0) {
    entries.push({
      clientId,
      category: 'policies',
      title: 'Services We Do NOT Offer',
      content: `We do not provide the following services:\n${data.dontDo.map(d => `• ${d}`).join('\n')}\n\nIf someone asks about these, politely let them know we don't cover this and suggest they look for a specialist.`,
      keywords: tag,
      priority: 10,
      isActive: true,
    });
  }

  // ---- Service Area ----
  if (data.coveredAreas.length > 0) {
    let areaContent = `We serve: ${data.coveredAreas.join(', ')}.`;
    if (data.areaExclusions.length > 0) {
      areaContent += `\n\nWe do NOT service: ${data.areaExclusions.join(', ')}.`;
    }
    entries.push({
      clientId,
      category: 'about',
      title: 'Service Area',
      content: areaContent,
      keywords: tag,
      priority: 9,
      isActive: true,
    });
  }

  // ---- Pricing Guidance ----
  const pricingParts: string[] = [];
  if (data.offersEstimates) {
    pricingParts.push(data.estimateConditions
      ? `We offer free estimates. ${data.estimateConditions}`
      : 'We offer free estimates.');
  } else {
    pricingParts.push('Estimates are provided after an initial assessment.');
  }
  if (!data.offersExactQuotes) {
    pricingParts.push('We do not give exact quotes over text — pricing depends on the specific job and needs an in-person assessment.');
  }
  if (data.pricingNotes) {
    pricingParts.push(data.pricingNotes);
  }

  entries.push({
    clientId,
    category: 'pricing',
    title: 'Pricing & Estimates',
    content: pricingParts.join('\n'),
    keywords: tag,
    priority: 9,
    isActive: true,
  });

  // ---- Process & Logistics ----
  if (data.afterBooking) {
    entries.push({
      clientId,
      category: 'policies',
      title: 'After You Book',
      content: data.afterBooking,
      keywords: tag,
      priority: 7,
      isActive: true,
    });
  }

  if (data.paymentTerms) {
    entries.push({
      clientId,
      category: 'policies',
      title: 'Payment Terms',
      content: data.paymentTerms,
      keywords: tag,
      priority: 7,
      isActive: true,
    });
  }

  if (data.warranty) {
    entries.push({
      clientId,
      category: 'policies',
      title: 'Warranty',
      content: data.warranty,
      keywords: tag,
      priority: 7,
      isActive: true,
    });
  }

  // ---- FAQs ----
  for (const faq of data.faqs) {
    if (faq.question && faq.answer) {
      entries.push({
        clientId,
        category: 'faq',
        title: faq.question,
        content: faq.answer,
        keywords: tag,
        priority: 6,
        isActive: true,
      });
    }
  }

  // ---- Things AI Must Never Say ----
  if (data.neverSay.length > 0) {
    entries.push({
      clientId,
      category: 'policies',
      title: 'AI Restrictions — NEVER Do These',
      content: `The AI assistant must NEVER:\n${data.neverSay.map(n => `• ${n}`).join('\n')}`,
      keywords: tag,
      priority: 10,
      isActive: true,
    });
  }

  // ---- Bulk insert ----
  if (entries.length > 0) {
    await db.insert(knowledgeBase).values(entries);
  }

  return { entriesCreated: entries.length };
}

/**
 * Load existing structured knowledge for a client.
 * Reconstructs the form data from KB entries.
 */
export async function loadStructuredKnowledge(
  clientId: string
): Promise<StructuredKnowledgeData | null> {
  const db = getDb();

  const entries = await db
    .select()
    .from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.clientId, clientId),
      eq(knowledgeBase.keywords, 'structured-knowledge')
    ));

  if (entries.length === 0) return null;

  // Reconstruct form data from entries
  const data: StructuredKnowledgeData = {
    services: [],
    dontDo: [],
    coveredAreas: [],
    areaExclusions: [],
    offersEstimates: false,
    estimateConditions: '',
    offersExactQuotes: false,
    pricingNotes: '',
    afterBooking: '',
    paymentTerms: '',
    warranty: '',
    faqs: [],
    neverSay: [],
  };

  for (const entry of entries) {
    switch (entry.title) {
      case 'Services We Offer': {
        // Parse services from bullet list
        const lines = entry.content.split('\n').filter(l => l.startsWith('•'));
        data.services = lines.map(line => {
          const clean = line.replace('• ', '');
          const priceMatch = clean.match(/\(?\$(\d+)[–-]\$(\d+)\)?/);
          const name = clean.replace(/\s*\(.*\)\s*$/, '').trim();
          return {
            name,
            priceRangeMin: priceMatch ? parseInt(priceMatch[1]) : 0,
            priceRangeMax: priceMatch ? parseInt(priceMatch[2]) : 0,
            canDiscussPrice: priceMatch ? 'yes_range' as const : 'defer' as const,
          };
        });
        break;
      }
      case 'Services We Do NOT Offer': {
        const lines = entry.content.split('\n').filter(l => l.startsWith('•'));
        data.dontDo = lines.map(l => l.replace('• ', '').trim());
        break;
      }
      case 'Service Area': {
        const serveMatch = entry.content.match(/We serve: (.+?)\./);
        if (serveMatch) {
          data.coveredAreas = serveMatch[1].split(',').map(s => s.trim());
        }
        const noServiceMatch = entry.content.match(/We do NOT service: (.+?)\./);
        if (noServiceMatch) {
          data.areaExclusions = noServiceMatch[1].split(',').map(s => s.trim());
        }
        break;
      }
      case 'Pricing & Estimates': {
        data.offersEstimates = entry.content.includes('free estimates');
        data.offersExactQuotes = !entry.content.includes('do not give exact quotes');
        break;
      }
      case 'After You Book':
        data.afterBooking = entry.content;
        break;
      case 'Payment Terms':
        data.paymentTerms = entry.content;
        break;
      case 'Warranty':
        data.warranty = entry.content;
        break;
      case 'AI Restrictions — NEVER Do These': {
        const lines = entry.content.split('\n').filter(l => l.startsWith('•'));
        data.neverSay = lines.map(l => l.replace('• ', '').trim());
        break;
      }
      default:
        // FAQ entries
        if (entry.category === 'faq') {
          data.faqs.push({ question: entry.title, answer: entry.content });
        }
        break;
    }
  }

  return data;
}
