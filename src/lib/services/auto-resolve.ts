/**
 * Auto-resolve service for KB-gap escalations.
 *
 * Uses semantic search to find matching KB entries for a knowledge gap, then
 * allows an operator to approve and apply the resolution without leaving the
 * triage dashboard. Requires operator approval before any answer is sent.
 */

import { getDb } from '@/db';
import { knowledgeGaps, auditLog } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { semanticSearch, addKnowledgeEntry } from '@/lib/services/knowledge-base';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';

export interface AutoResolveSuggestion {
  found: boolean;
  reason?: string;
  source?: 'kb';
  entry?: { id: string; title: string; content: string; category: string };
  requiresContractorConfirmation?: boolean;
}

/**
 * Look up a KB-gap and suggest an answer sourced from the client&apos;s existing KB
 * via semantic search. Returns `found: false` if the flag is off, the gap is
 * missing/already resolved, or no KB match exists.
 */
export async function getAutoResolveSuggestion(
  clientId: string,
  gapId: string
): Promise<AutoResolveSuggestion> {
  // Feature-flag guard
  const enabled = await resolveFeatureFlag(clientId, 'autoResolve');
  if (!enabled) {
    return { found: false, reason: 'Auto-resolve disabled' };
  }

  // Load the gap
  const db = getDb();
  const [gap] = await db
    .select()
    .from(knowledgeGaps)
    .where(and(eq(knowledgeGaps.id, gapId), eq(knowledgeGaps.clientId, clientId)))
    .limit(1);

  if (!gap || gap.status === 'resolved') {
    return { found: false, reason: 'Gap not found or already resolved' };
  }

  // Semantic search against the client&apos;s KB
  const matches = await semanticSearch(clientId, gap.question);

  if (matches.length === 0 || (matches[0].similarity !== undefined && matches[0].similarity <= 0)) {
    return { found: false, reason: 'No matching KB entry found' };
  }

  const best = matches[0];

  // Count prior auto-resolves for this client to determine confirmation policy
  const [{ value: autoResolveCount }] = await db
    .select({ value: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.clientId, clientId),
        eq(auditLog.action, 'kb_gap_auto_resolved')
      )
    );

  return {
    found: true,
    source: 'kb',
    entry: {
      id: best.id,
      title: best.title,
      content: best.content,
      category: best.category,
    },
    requiresContractorConfirmation: Number(autoResolveCount) < 5,
  };
}

/**
 * Apply an operator-approved auto-resolve to a knowledge gap.
 *
 * If `kbEntryId` is provided the existing KB entry is linked directly.
 * Otherwise a new FAQ entry is created from the supplied answer text.
 * The gap is marked resolved and the action is written to the audit log.
 */
export async function applyAutoResolve(input: {
  clientId: string;
  gapId: string;
  answer: string;
  kbEntryId?: string;
  operatorPersonId: string;
}): Promise<{ success: boolean; kbEntryId: string }> {
  const { clientId, gapId, answer, kbEntryId: existingEntryId, operatorPersonId } = input;

  const db = getDb();

  // Load the gap to get the question text
  const [gap] = await db
    .select()
    .from(knowledgeGaps)
    .where(and(eq(knowledgeGaps.id, gapId), eq(knowledgeGaps.clientId, clientId)))
    .limit(1);

  if (!gap) {
    throw new Error(`Knowledge gap ${gapId} not found for client ${clientId}`);
  }

  // Resolve (or create) the KB entry
  let entryId: string;
  if (existingEntryId) {
    entryId = existingEntryId;
  } else {
    entryId = await addKnowledgeEntry(clientId, {
      category: 'faq',
      title: gap.question,
      content: answer,
    });
  }

  // Mark the gap resolved
  await db
    .update(knowledgeGaps)
    .set({
      status: 'resolved',
      kbEntryId: entryId,
      resolvedByPersonId: operatorPersonId,
      resolvedAt: new Date(),
      resolutionNote: 'Auto-resolved via KB match',
    })
    .where(and(eq(knowledgeGaps.id, gapId), eq(knowledgeGaps.clientId, clientId)));

  // Write audit log entry
  await db.insert(auditLog).values({
    clientId,
    personId: operatorPersonId,
    action: 'kb_gap_auto_resolved',
    resourceType: 'knowledge_gap',
    resourceId: gapId,
    metadata: { kbEntryId: entryId, answer: answer.substring(0, 200) },
  });

  return { success: true, kbEntryId: entryId };
}
