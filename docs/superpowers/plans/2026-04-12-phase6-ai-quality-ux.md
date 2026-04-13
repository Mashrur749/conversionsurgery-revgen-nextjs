# Phase 6: AI Quality UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI quality visible and actionable for operators. Add per-client AI health scores to triage, merge AI dashboards into unified "AI Quality" page with drill-down, add improvement suggestions, and add AI Readiness card to client overview.

**Architecture:** New `client-ai-health.ts` service computes health metrics from existing `agentDecisions` + `knowledgeGaps` tables. Triage page gains AI Quality column. AI Effectiveness + AI Flagged Responses merge into tabbed "AI Quality" page. Client overview gets AI Readiness card.

**Tech Stack:** Drizzle ORM aggregation queries, existing shadcn/ui components, React Server Components

**Spec:** `docs/superpowers/specs/2026-04-12-ai-pipeline-evals-design.md` — Part 5 (Flows 1, 4, 5), Gap 7

**Prerequisites:** Phase 4 (eval infrastructure for health scoring context)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/services/client-ai-health.ts` | Create | Per-client AI health score computation |
| `src/lib/services/client-ai-health.test.ts` | Create | Tests for health threshold logic |
| `src/app/api/admin/ai-health/route.ts` | Create | API: per-client health scores for all clients |
| `src/app/api/admin/clients/[id]/ai-health/route.ts` | Create | API: single client health + improvement suggestions |
| `src/app/(dashboard)/admin/triage/page.tsx` | Modify | Add AI Quality column |
| `src/app/(dashboard)/admin/ai-quality/page.tsx` | Create | Unified AI Quality page (tabs: Performance, Flagged, Per-Client) |
| `src/app/(dashboard)/admin/clients/[id]/components/ai-readiness-card.tsx` | Create | AI Readiness progress card for overview tab |
| `src/app/(dashboard)/admin/clients/[id]/page.tsx` | Modify | Add AI Readiness card to overview |
| `src/app/(dashboard)/layout.tsx` | Modify | Rename nav item, merge AI pages |

---

### Task 1: Client AI Health Service

**Files:**
- Create: `src/lib/services/client-ai-health.ts`
- Create: `src/lib/services/client-ai-health.test.ts`

- [ ] **Step 1: Write health threshold tests**

Create `src/lib/services/client-ai-health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeHealthStatus, type ClientAIMetrics } from './client-ai-health';

describe('computeHealthStatus', () => {
  it('returns green for healthy metrics', () => {
    expect(computeHealthStatus({
      avgConfidence: 75,
      positiveOutcomeRate: 0.45,
      deferralRate: 0.20,
      knowledgeGapCount: 3,
    })).toBe('green');
  });

  it('returns red when confidence is very low', () => {
    expect(computeHealthStatus({
      avgConfidence: 40,
      positiveOutcomeRate: 0.30,
      deferralRate: 0.25,
      knowledgeGapCount: 3,
    })).toBe('red');
  });

  it('returns red when deferral rate is too high', () => {
    expect(computeHealthStatus({
      avgConfidence: 70,
      positiveOutcomeRate: 0.35,
      deferralRate: 0.55,
      knowledgeGapCount: 3,
    })).toBe('red');
  });

  it('returns yellow when gaps are elevated', () => {
    expect(computeHealthStatus({
      avgConfidence: 70,
      positiveOutcomeRate: 0.35,
      deferralRate: 0.25,
      knowledgeGapCount: 8,
    })).toBe('yellow');
  });

  it('returns red when positive outcome rate is very low', () => {
    expect(computeHealthStatus({
      avgConfidence: 70,
      positiveOutcomeRate: 0.15,
      deferralRate: 0.25,
      knowledgeGapCount: 3,
    })).toBe('red');
  });
});
```

- [ ] **Step 2: Write the health service**

Create `src/lib/services/client-ai-health.ts`:

```typescript
import { getDb } from '@/db';
import { agentDecisions, knowledgeGaps } from '@/db/schema';
import { eq, and, gte, sql, count } from 'drizzle-orm';

export interface ClientAIMetrics {
  avgConfidence: number;
  positiveOutcomeRate: number;
  deferralRate: number;
  knowledgeGapCount: number;
}

export interface ClientAIHealth {
  clientId: string;
  clientName: string;
  metrics: ClientAIMetrics;
  health: 'green' | 'yellow' | 'red';
  topSuggestion?: string;
}

export function computeHealthStatus(metrics: ClientAIMetrics): 'green' | 'yellow' | 'red' {
  // Red: any critical threshold breached
  if (metrics.avgConfidence < 50) return 'red';
  if (metrics.positiveOutcomeRate < 0.20) return 'red';
  if (metrics.deferralRate > 0.50) return 'red';
  if (metrics.knowledgeGapCount > 15) return 'red';

  // Yellow: warning zone
  if (metrics.avgConfidence < 70) return 'yellow';
  if (metrics.positiveOutcomeRate < 0.40) return 'yellow';
  if (metrics.deferralRate > 0.30) return 'yellow';
  if (metrics.knowledgeGapCount > 5) return 'yellow';

  return 'green';
}

export function generateSuggestion(metrics: ClientAIMetrics, topGapQuestion?: string): string | undefined {
  if (metrics.deferralRate > 0.40 && topGapQuestion) {
    return `AI deferred frequently — top unanswered question: "${topGapQuestion}"`;
  }
  if (metrics.knowledgeGapCount > 10) {
    return `${metrics.knowledgeGapCount} knowledge gaps need attention — review the gap queue`;
  }
  if (metrics.avgConfidence < 60) {
    return `Low AI confidence (${Math.round(metrics.avgConfidence)}%) — KB may need more detail`;
  }
  if (metrics.positiveOutcomeRate < 0.30) {
    return `Only ${Math.round(metrics.positiveOutcomeRate * 100)}% positive outcomes — review recent AI conversations`;
  }
  return undefined;
}

export async function getClientAIHealth(clientId: string, days: number = 14): Promise<ClientAIMetrics> {
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Aggregate from agentDecisions
  const [stats] = await db.execute(sql`
    SELECT
      COALESCE(AVG(confidence), 50) as avg_confidence,
      COALESCE(
        SUM(CASE WHEN outcome = 'positive' THEN 1 ELSE 0 END)::float /
        NULLIF(SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END), 0),
        0
      ) as positive_outcome_rate,
      COALESCE(
        SUM(CASE WHEN action = 'escalate' THEN 1 ELSE 0 END)::float /
        NULLIF(COUNT(*), 0),
        0
      ) as deferral_rate
    FROM agent_decisions
    WHERE client_id = ${clientId}
      AND created_at >= ${since.toISOString()}
  `);

  // Count open knowledge gaps
  const [gapCount] = await db
    .select({ count: count() })
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, clientId),
      eq(knowledgeGaps.status, 'new')
    ));

  const row = stats.rows?.[0] as Record<string, unknown> || {};

  return {
    avgConfidence: Number(row.avg_confidence) || 50,
    positiveOutcomeRate: Number(row.positive_outcome_rate) || 0,
    deferralRate: Number(row.deferral_rate) || 0,
    knowledgeGapCount: Number(gapCount?.count) || 0,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/services/client-ai-health.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/client-ai-health.ts src/lib/services/client-ai-health.test.ts
git commit -m "feat: add per-client AI health scoring service

Computes avgConfidence, positiveOutcomeRate, deferralRate,
knowledgeGapCount from agentDecisions + knowledgeGaps tables.
Green/yellow/red thresholds. Auto-generated improvement suggestions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Triage AI Quality Column

**Files:**
- Modify: `src/app/(dashboard)/admin/triage/page.tsx`
- Modify: `src/app/api/admin/triage/route.ts` (if data comes from API)

- [ ] **Step 1: Add AI health data to triage query**

In the triage data fetching function, call `getClientAIHealth()` for each client and include the health status + metrics in the triage row data.

- [ ] **Step 2: Add AI Quality column to triage table**

Add column between Health and Escalations:

```tsx
<td>
  <Badge className={healthConfig[aiHealth].badgeClass}>
    {Math.round(metrics.positiveOutcomeRate * 100)}%
  </Badge>
</td>
```

Mobile card layout: add AI Quality badge below health status.

Color coding: green badge for green health, terracotta badge for yellow, sienna badge for red.

Click on AI Quality badge → navigates to `/admin/clients/[id]?tab=knowledge` (fix KB is the action).

- [ ] **Step 3: Test at 375px**

Verify mobile card includes AI Quality without breaking layout.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/triage/ src/app/api/admin/triage/
git commit -m "feat: add AI Quality column to triage dashboard

Per-client AI health badge (green/yellow/red) with positive outcome
rate. Click navigates to client KB for remediation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Unified AI Quality Page

**Files:**
- Create: `src/app/(dashboard)/admin/ai-quality/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create unified AI Quality page**

Three tabs:
1. **Performance** — existing AI Effectiveness dashboard (move component)
2. **Flagged** — existing AI Flagged Responses (move component)
3. **Per-Client** — new table with per-client health breakdown, drill-down, suggestions

Per-Client tab shows a table:
- Client name, Decisions count, Positive Rate, Avg Confidence, Deferral Rate, Gaps, Health badge, Top Suggestion
- Click row → client's Knowledge tab
- Sorted: red first, then yellow, then green

- [ ] **Step 2: Update sidebar nav**

In `src/app/(dashboard)/layout.tsx`:
- Remove "AI Flagged Responses" nav item
- Rename "AI Performance" to "AI Quality"
- Point to `/admin/ai-quality`

Add redirect from old paths (`/admin/ai-effectiveness`, `/admin/ai-quality-flags`) to new unified page.

- [ ] **Step 3: Test navigation**

Start dev server, verify:
- Sidebar shows "AI Quality" in Optimization group
- All three tabs render with data
- Old URLs redirect

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/ai-quality/ src/app/(dashboard)/layout.tsx
git commit -m "feat: unified AI Quality page with Performance, Flagged, Per-Client tabs

Merges AI Effectiveness + AI Flagged Responses into single page.
Adds Per-Client tab with health breakdown and improvement suggestions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: AI Readiness Card on Client Overview

**Files:**
- Create: `src/app/(dashboard)/admin/clients/[id]/components/ai-readiness-card.tsx`
- Modify: `src/app/(dashboard)/admin/clients/[id]/page.tsx`

- [ ] **Step 1: Create AI Readiness card**

Shows progress toward AI activation:
- Phone assigned (check/x)
- Leads imported (check/x with count)
- Knowledge Base completeness (% with progress bar)
- AI Sandbox tested (X of 5 test conversations — new quality gate)
- Current AI mode (off/assist/autonomous)
- Days until auto-activation (if applicable)
- "NOT READY" / "READY" status with remaining items

Uses existing `evaluateOnboardingQualityForClient()` for most checks. Add sandbox test count from a new counter (store in client settings or derive from sandbox-chat API call count).

- [ ] **Step 2: Add to client overview tab**

Insert AI Readiness card in the Overview tab, below Onboarding Checklist.

- [ ] **Step 3: Test**

Run dev server, navigate to a client's overview tab. Verify card renders with correct data.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/clients/[id]/components/ai-readiness-card.tsx src/app/(dashboard)/admin/clients/[id]/page.tsx
git commit -m "feat: add AI Readiness card to client overview

Shows progress toward AI activation: phone, leads, KB completeness,
sandbox tests. Clear next-action guidance for operators.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Update Docs + Quality Gate

- [ ] **Step 1: Update docs**

- `docs/product/PLATFORM-CAPABILITIES.md` Section 11: per-client AI health, unified AI Quality page
- `docs/operations/01-OPERATIONS-GUIDE.md`: triage now includes AI quality
- `docs/specs/UX-AUDIT-FULL.md`: mark relevant items done

- [ ] **Step 2: Run quality gate**

Run: `npm run quality:no-regressions`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: document AI quality UX, triage integration, readiness card

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
