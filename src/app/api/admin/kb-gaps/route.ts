import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { clients, knowledgeGaps } from '@/db/schema';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

type GapStatus = 'new' | 'in_progress' | 'blocked' | 'resolved' | 'verified';

const OPEN_STATUSES: GapStatus[] = ['new', 'in_progress', 'blocked'];

interface CrossClientGapRow {
  id: string;
  clientId: string;
  clientName: string;
  question: string;
  category: string | null;
  occurrences: number;
  confidenceLevel: string;
  status: GapStatus;
  priorityScore: number;
  isStale: boolean;
  ageDays: number;
  firstSeenAt: string;
}

interface CrossClientGapGroup {
  clientId: string;
  clientName: string;
  gapCount: number;
  gaps: CrossClientGapRow[];
}

interface CrossClientGapResponse {
  groups: CrossClientGapGroup[];
  totalOpen: number;
  duplicateQuestions: string[];
}

function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
}

function isStale(dueAt: Date | null, status: string, now: Date): boolean {
  if (!dueAt) return false;
  if (!OPEN_STATUSES.includes(status as GapStatus)) return false;
  return dueAt.getTime() < now.getTime();
}

function ageDays(firstSeenAt: Date, now: Date): number {
  const diffMs = Math.max(0, now.getTime() - firstSeenAt.getTime());
  return Number((diffMs / (1000 * 60 * 60 * 24)).toFixed(1));
}

/** GET /api/admin/kb-gaps — cross-client open knowledge gap queue */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT },
  async () => {
    const db = getDb();
    const now = new Date();

    // Load all active clients
    const activeClients = await db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(eq(clients.status, 'active'))
      .orderBy(clients.businessName);

    if (activeClients.length === 0) {
      const response: CrossClientGapResponse = {
        groups: [],
        totalOpen: 0,
        duplicateQuestions: [],
      };
      return NextResponse.json(response);
    }

    const clientIds = activeClients.map((c) => c.id);
    const clientMap = new Map(activeClients.map((c) => [c.id, c.businessName]));

    // Fetch all open gaps across all clients, sorted by priority desc
    const rows = await db
      .select()
      .from(knowledgeGaps)
      .where(
        and(
          inArray(knowledgeGaps.clientId, clientIds),
          or(
            eq(knowledgeGaps.status, 'new'),
            eq(knowledgeGaps.status, 'in_progress'),
            eq(knowledgeGaps.status, 'blocked')
          )
        )
      )
      .orderBy(desc(knowledgeGaps.priorityScore), desc(knowledgeGaps.lastSeenAt));

    // Group by client
    const byClient = new Map<string, CrossClientGapRow[]>();
    for (const row of rows) {
      const existing = byClient.get(row.clientId) ?? [];
      existing.push({
        id: row.id,
        clientId: row.clientId,
        clientName: clientMap.get(row.clientId) ?? 'Unknown',
        question: row.question,
        category: row.category,
        occurrences: row.occurrences,
        confidenceLevel: row.confidenceLevel,
        status: row.status as GapStatus,
        priorityScore: row.priorityScore,
        isStale: isStale(row.dueAt, row.status, now),
        ageDays: ageDays(row.firstSeenAt, now),
        firstSeenAt: row.firstSeenAt.toISOString(),
      });
      byClient.set(row.clientId, existing);
    }

    // Detect duplicate questions (same normalized prefix across 2+ clients)
    const questionClientCount = new Map<string, Set<string>>();
    for (const row of rows) {
      const key = normalizeQuestion(row.question);
      const clientSet = questionClientCount.get(key) ?? new Set();
      clientSet.add(row.clientId);
      questionClientCount.set(key, clientSet);
    }
    const duplicateQuestions = [...questionClientCount.entries()]
      .filter(([, clientSet]) => clientSet.size >= 2)
      .map(([key]) => key);

    // Build ordered groups (clients with most gaps first)
    const groups: CrossClientGapGroup[] = [...byClient.entries()]
      .map(([clientId, gaps]) => ({
        clientId,
        clientName: clientMap.get(clientId) ?? 'Unknown',
        gapCount: gaps.length,
        gaps,
      }))
      .sort((a, b) => b.gapCount - a.gapCount);

    const response: CrossClientGapResponse = {
      groups,
      totalOpen: rows.length,
      duplicateQuestions,
    };

    return NextResponse.json(response);
  }
);
