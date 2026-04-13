# Phase 7: Contractor Value Indicators — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface AI value to contractors in their portal: KB accuracy indicator ("92% of questions answered") and gap notifications ("a customer asked about warranty, can you provide details?"). Reinforces platform value and drives KB improvement from the contractor side.

**Architecture:** New API endpoint computes KB accuracy from agentDecisions (deferral rate inverse). Gap notifications added to existing notification system. Contractor portal KB page gets accuracy card. Notification triggers on new high-priority knowledge gaps.

**Tech Stack:** Existing portal auth (`portalRoute`), existing notification system, existing KB gap schema

**Spec:** `docs/superpowers/specs/2026-04-12-ai-pipeline-evals-design.md` — Part 5 (Contractor Portal Touchpoints)

**Prerequisites:** Phase 6 (needs health metrics)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/api/client/knowledge/accuracy/route.ts` | Create | KB accuracy metric for portal |
| `src/app/(client-portal)/portal/knowledge/components/accuracy-card.tsx` | Create | Accuracy indicator component |
| `src/app/(client-portal)/portal/knowledge/page.tsx` | Modify | Add accuracy card |
| `src/lib/services/knowledge-gap-notifications.ts` | Create | Gap notification trigger for contractors |
| `src/app/api/cron/route.ts` | Modify | Add gap notification cron job |

---

### Task 1: KB Accuracy API for Portal

**Files:**
- Create: `src/app/api/client/knowledge/accuracy/route.ts`

- [ ] **Step 1: Create accuracy endpoint**

```typescript
import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getClientAIHealth } from '@/lib/services/client-ai-health';

export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.KNOWLEDGE_VIEW },
  async ({ session }) => {
    const clientId = session.clientId;
    const metrics = await getClientAIHealth(clientId, 30);

    // KB accuracy = inverse of deferral rate
    // "X% of questions answered from your knowledge base"
    const accuracyPct = Math.round((1 - metrics.deferralRate) * 100);

    return NextResponse.json({
      accuracyPct,
      totalDecisions: 0, // TODO: return from health query
      gapsOpen: metrics.knowledgeGapCount,
      health: accuracyPct >= 80 ? 'green' : accuracyPct >= 60 ? 'yellow' : 'red',
    });
  }
);
```

Actually, `getClientAIHealth` already computes deferral rate. Extend it to also return total decision count:

Update `getClientAIHealth` in `src/lib/services/client-ai-health.ts` to also return `totalDecisions` from the aggregation query.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/client/knowledge/accuracy/route.ts src/lib/services/client-ai-health.ts
git commit -m "feat: add KB accuracy API for contractor portal

Returns accuracy percentage (inverse of AI deferral rate), open gap
count, and health status. Powers the portal accuracy indicator.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Accuracy Card Component

**Files:**
- Create: `src/app/(client-portal)/portal/knowledge/components/accuracy-card.tsx`
- Modify: `src/app/(client-portal)/portal/knowledge/page.tsx`

- [ ] **Step 1: Create accuracy card**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AccuracyData {
  accuracyPct: number;
  gapsOpen: number;
  health: 'green' | 'yellow' | 'red';
}

const healthColors = {
  green: 'bg-[#E8F5E9] text-[#3D7A50]',
  yellow: 'bg-[#FFF3E0] text-[#D4754A]',
  red: 'bg-[#FDEAE4] text-[#C15B2E]',
};

export function AccuracyCard() {
  const [data, setData] = useState<AccuracyData | null>(null);

  useEffect(() => {
    fetch('/api/client/knowledge/accuracy')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          AI Knowledge Accuracy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{data.accuracyPct}%</span>
          <Badge className={healthColors[data.health]}>
            {data.health === 'green' ? 'Excellent' : data.health === 'yellow' ? 'Good' : 'Needs Attention'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          of customer questions answered from your knowledge base
        </p>
        {data.gapsOpen > 0 && (
          <p className="text-sm text-[#D4754A] mt-2">
            {data.gapsOpen} unanswered question{data.gapsOpen > 1 ? 's' : ''} need your input
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add to portal knowledge page**

In `src/app/(client-portal)/portal/knowledge/page.tsx`, add `<AccuracyCard />` at the top of the page, above the KB entries list.

- [ ] **Step 3: Test in dev server**

Start dev server, log into contractor portal, navigate to Knowledge page. Verify accuracy card renders.

- [ ] **Step 4: Commit**

```bash
git add src/app/(client-portal)/portal/knowledge/
git commit -m "feat: add KB accuracy indicator to contractor portal

Shows 'X% of questions answered from your knowledge base' with
health badge and open gap count. Reinforces platform value.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Gap Notifications to Contractors

**Files:**
- Create: `src/lib/services/knowledge-gap-notifications.ts`
- Modify: `src/app/api/cron/route.ts`

- [ ] **Step 1: Create gap notification service**

Create `src/lib/services/knowledge-gap-notifications.ts`:

```typescript
import { getDb } from '@/db';
import { knowledgeGaps, clients, clientMemberships, people } from '@/db/schema';
import { eq, and, isNull, gte } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';

/**
 * Notify contractors about new knowledge gaps that need their input.
 * Runs daily. Only notifies about gaps created in the last 24h that haven't
 * been notified about yet.
 */
export async function notifyContractorsOfGaps(): Promise<{ notified: number }> {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find new gaps from the last 24h
  const newGaps = await db
    .select({
      gapId: knowledgeGaps.id,
      clientId: knowledgeGaps.clientId,
      question: knowledgeGaps.question,
      category: knowledgeGaps.category,
      occurrences: knowledgeGaps.occurrences,
    })
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.status, 'new'),
      gte(knowledgeGaps.createdAt, since)
    ));

  if (newGaps.length === 0) return { notified: 0 };

  // Group by client
  const byClient = new Map<string, typeof newGaps>();
  for (const gap of newGaps) {
    const existing = byClient.get(gap.clientId) || [];
    existing.push(gap);
    byClient.set(gap.clientId, existing);
  }

  let notified = 0;

  for (const [clientId, gaps] of byClient) {
    // Get client info + primary contact
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client || !client.twilioNumber) continue;

    // Find primary team member to notify
    const [membership] = await db
      .select({ phone: people.phone, name: people.name })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .where(and(
        eq(clientMemberships.clientId, clientId),
        eq(clientMemberships.isActive, true)
      ))
      .limit(1);

    if (!membership?.phone) continue;

    // Build notification message
    const topQuestion = gaps[0].question.substring(0, 80);
    const message = gaps.length === 1
      ? `A customer asked: "${topQuestion}" and we didn&apos;t have an answer in your knowledge base. Can you provide details? Reply to this message or update your KB in the portal.`
      : `${gaps.length} new customer questions we couldn&apos;t fully answer. Top question: "${topQuestion}". Check your knowledge base in the portal to add answers.`;

    await sendCompliantMessage({
      clientId,
      to: membership.phone,
      from: client.twilioNumber,
      body: message,
      messageClassification: 'system_notification',
      messageCategory: 'transactional',
      consentBasis: { type: 'service_relationship' },
      queueOnQuietHours: true,
      metadata: { source: 'knowledge_gap_notification', gapCount: gaps.length },
    });

    notified++;
  }

  return { notified };
}
```

- [ ] **Step 2: Add to cron orchestrator**

In `src/app/api/cron/route.ts`, register `notifyContractorsOfGaps` as a daily job (10am).

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/knowledge-gap-notifications.ts src/app/api/cron/route.ts
git commit -m "feat: notify contractors about knowledge gaps via SMS

Daily cron sends SMS to primary contact when new KB gaps appear.
'A customer asked X and we didn't have an answer — can you help?'

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Update Docs + Quality Gate

- [ ] **Step 1: Update docs**

- `docs/product/PLATFORM-CAPABILITIES.md` Section 5 (Client Portal): accuracy indicator
- `docs/product/PLATFORM-CAPABILITIES.md` Section 4 (Communication Hub): gap notifications
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md`: contractor self-service KB improvements

- [ ] **Step 2: Run quality gate**

Run: `npm run quality:no-regressions`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: document contractor KB accuracy indicator and gap notifications

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
