/**
 * Service Classification
 *
 * Matches AI-extracted projectType strings to client's defined services.
 * Used by the orchestrator after extracting info from conversation.
 */

import { getDb } from '@/db';
import { clientServices, leadContext } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export interface ClassifiedService {
  serviceId: string;
  serviceName: string;
  avgValueCents: number | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Matches a projectType string against a client's service catalog.
 * Uses fuzzy string matching — checks if service name words appear in projectType or vice versa.
 */
export async function classifyService(
  clientId: string,
  projectType: string | null | undefined
): Promise<ClassifiedService | null> {
  if (!projectType) return null;

  const db = getDb();
  const services = await db
    .select()
    .from(clientServices)
    .where(and(
      eq(clientServices.clientId, clientId),
      eq(clientServices.isActive, true)
    ));

  if (services.length === 0) return null;

  const normalized = projectType.toLowerCase().trim();
  const projectWords = normalized.split(/\s+/);

  let bestMatch: { service: typeof services[0]; score: number } | null = null;

  for (const service of services) {
    const serviceName = service.name.toLowerCase().trim();
    const serviceWords = serviceName.split(/\s+/);

    let score = 0;

    // Exact match
    if (normalized === serviceName) {
      score = 100;
    }
    // One contains the other
    else if (normalized.includes(serviceName) || serviceName.includes(normalized)) {
      score = 80;
    }
    // Word overlap scoring
    else {
      const matchingWords = serviceWords.filter(sw =>
        projectWords.some(pw => pw.includes(sw) || sw.includes(pw))
      );
      if (matchingWords.length > 0) {
        score = Math.round((matchingWords.length / serviceWords.length) * 60);
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { service, score };
    }
  }

  if (!bestMatch) return null;

  return {
    serviceId: bestMatch.service.id,
    serviceName: bestMatch.service.name,
    avgValueCents: bestMatch.service.avgValueCents,
    confidence: bestMatch.score >= 80 ? 'high' : bestMatch.score >= 40 ? 'medium' : 'low',
  };
}

/**
 * Updates a lead's matched service and estimated value after AI classification.
 * Called by the orchestrator after extracting projectType.
 */
export async function updateLeadServiceMatch(
  leadContextId: string,
  classified: ClassifiedService
): Promise<void> {
  const db = getDb();

  const updates: Record<string, unknown> = {
    matchedServiceId: classified.serviceId,
    updatedAt: new Date(),
  };

  // Only set estimatedValue from service if not already set by AI
  if (classified.avgValueCents) {
    updates.estimatedValue = classified.avgValueCents;
  }

  await db
    .update(leadContext)
    .set(updates)
    .where(eq(leadContext.id, leadContextId));
}

/**
 * Gets the average value across all active services for a client.
 * Fallback when AI can't classify the specific service.
 */
export async function getAverageServiceValue(clientId: string): Promise<number | null> {
  const db = getDb();
  const services = await db
    .select({ avgValueCents: clientServices.avgValueCents })
    .from(clientServices)
    .where(and(
      eq(clientServices.clientId, clientId),
      eq(clientServices.isActive, true)
    ));

  const withValues = services.filter(s => s.avgValueCents && s.avgValueCents > 0);
  if (withValues.length === 0) return null;

  return Math.round(
    withValues.reduce((sum, s) => sum + (s.avgValueCents || 0), 0) / withValues.length
  );
}
