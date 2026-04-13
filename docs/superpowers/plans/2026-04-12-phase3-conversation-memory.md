# Phase 3: Conversation Memory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the existing `conversationSummary` column in `leadContext` so returning leads don't lose context. When conversations exceed 20 messages or a lead re-engages after 24h+, older messages are summarized and stored for inclusion in AI prompts.

**Architecture:** New `conversation-summary.ts` service. Two triggers: message count threshold and time gap. Haiku generates summaries. Orchestrator checks and updates before building graph state. Respond node includes summary in prompt.

**Tech Stack:** Existing `getTrackedAI()`, existing `leadContext.conversationSummary` column (no migration needed)

**Spec:** `docs/superpowers/specs/2026-04-12-ai-pipeline-evals-design.md` — Part 1, Fix 5

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/services/conversation-summary.ts` | Create | `updateConversationSummary()`, `shouldUpdateSummary()` |
| `src/lib/services/conversation-summary.test.ts` | Create | Tests for trigger logic |
| `src/lib/agent/orchestrator.ts` | Modify | Call summary update before building graph state |
| `src/lib/agent/nodes/respond.ts` | Modify | Include summary in response prompt |
| `src/lib/agent/state.ts` | Modify | Add `conversationSummary` to state type if not present |

---

### Task 1: Summary Trigger Logic

**Files:**
- Create: `src/lib/services/conversation-summary.ts`
- Create: `src/lib/services/conversation-summary.test.ts`

- [ ] **Step 1: Write tests for trigger logic**

Create `src/lib/services/conversation-summary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldUpdateSummary } from './conversation-summary';

describe('shouldUpdateSummary', () => {
  it('returns false when message count is low', () => {
    expect(shouldUpdateSummary({
      totalMessages: 10,
      lastMessageAt: new Date(),
      existingSummary: null,
    })).toBe(false);
  });

  it('returns true when message count exceeds 20 and no summary exists', () => {
    expect(shouldUpdateSummary({
      totalMessages: 25,
      lastMessageAt: new Date(),
      existingSummary: null,
    })).toBe(true);
  });

  it('returns true on re-engagement after 24h gap', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(shouldUpdateSummary({
      totalMessages: 15,
      lastMessageAt: yesterday,
      existingSummary: null,
    })).toBe(true);
  });

  it('returns false when gap is under 24h', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000);
    expect(shouldUpdateSummary({
      totalMessages: 15,
      lastMessageAt: recent,
      existingSummary: null,
    })).toBe(false);
  });

  it('returns true when message count grew by 10+ since last summary', () => {
    expect(shouldUpdateSummary({
      totalMessages: 35,
      lastMessageAt: new Date(),
      existingSummary: 'Previous summary here',
      summaryMessageCount: 22,
    })).toBe(true);
  });

  it('returns false when summary is recent enough', () => {
    expect(shouldUpdateSummary({
      totalMessages: 25,
      lastMessageAt: new Date(),
      existingSummary: 'Previous summary here',
      summaryMessageCount: 22,
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Write the implementation**

Create `src/lib/services/conversation-summary.ts`:

```typescript
import { getDb } from '@/db';
import { conversations, leadContext } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getTrackedAI } from '@/lib/ai';

const SUMMARY_THRESHOLD = 20;
const REGAP_HOURS = 24;
const RESUMMARIZE_DELTA = 10;

interface SummaryCheck {
  totalMessages: number;
  lastMessageAt: Date;
  existingSummary: string | null;
  summaryMessageCount?: number;
}

/**
 * Determine if conversation summary needs updating.
 * Two triggers: message count threshold, and re-engagement gap.
 */
export function shouldUpdateSummary(check: SummaryCheck): boolean {
  const hoursSinceLastMessage = (Date.now() - check.lastMessageAt.getTime()) / (1000 * 60 * 60);

  // Re-engagement after 24h+ gap — always regenerate summary
  if (hoursSinceLastMessage >= REGAP_HOURS) {
    return true;
  }

  // First summary: when total exceeds threshold
  if (!check.existingSummary && check.totalMessages > SUMMARY_THRESHOLD) {
    return true;
  }

  // Re-summarize: when 10+ new messages since last summary
  if (check.existingSummary && check.summaryMessageCount) {
    if (check.totalMessages - check.summaryMessageCount >= RESUMMARIZE_DELTA) {
      return true;
    }
  }

  return false;
}

const SUMMARY_PROMPT = `Summarize this conversation between a customer and a home services business.
Include:
- What the customer needs (service type, project details)
- Any pricing discussed or quotes given
- Objections or concerns raised
- Appointments discussed or scheduled
- Current status (waiting for quote, scheduled, thinking about it, etc.)
- Key facts about the property (age, type, location mentions)

Keep it under 200 words. Facts only, no interpretation. Write in present tense ("Customer needs drain repair" not "Customer needed").`;

/**
 * Generate or update conversation summary for a lead.
 * Uses fast tier (Haiku) — cheap and fast.
 */
export async function updateConversationSummary(
  clientId: string,
  leadId: string
): Promise<string | null> {
  const db = getDb();

  // Fetch full conversation history
  const history = await db
    .select({
      direction: conversations.direction,
      content: conversations.content,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .orderBy(asc(conversations.createdAt));

  if (history.length <= 15) {
    return null; // Not enough to summarize
  }

  // Summarize everything except the last 15
  const olderMessages = history.slice(0, -15);
  const formatted = olderMessages
    .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Business'}: ${m.content}`)
    .join('\n');

  const ai = getTrackedAI({
    clientId,
    operation: 'conversation_summary',
    leadId,
  });

  const result = await ai.chat(
    [{ role: 'user', content: formatted }],
    {
      systemPrompt: SUMMARY_PROMPT,
      temperature: 0.3,
      model: 'fast',
      maxTokens: 300,
    }
  );

  const summary = result.content.trim();

  // Store in leadContext
  await db.update(leadContext)
    .set({
      conversationSummary: summary,
      updatedAt: new Date(),
    })
    .where(eq(leadContext.leadId, leadId));

  return summary;
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/services/conversation-summary.test.ts`
Expected: All `shouldUpdateSummary` tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/conversation-summary.ts src/lib/services/conversation-summary.test.ts
git commit -m "feat: add conversation summary service

Summarizes older messages (beyond last 15) into a concise paragraph
stored in leadContext.conversationSummary. Triggers on 20+ messages
or 24h+ re-engagement gap. Uses Haiku for cheap, fast summarization.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Integrate Summary into Orchestrator

**Files:**
- Modify: `src/lib/agent/orchestrator.ts`

- [ ] **Step 1: Add summary check after loading lead context**

In `src/lib/agent/orchestrator.ts`, after loading `context` (the leadContext row) and before building `initialState`, add:

```typescript
import { shouldUpdateSummary, updateConversationSummary } from '@/lib/services/conversation-summary';

// After loading context, check if summary update needed
const lastMessage = conversationHistory[conversationHistory.length - 1];
if (lastMessage && shouldUpdateSummary({
  totalMessages: context.totalMessages || 0,
  lastMessageAt: lastMessage.createdAt,
  existingSummary: context.conversationSummary,
})) {
  try {
    const summary = await updateConversationSummary(client.id, leadId);
    if (summary) {
      context.conversationSummary = summary;
    }
  } catch (err) {
    console.error('[Agent] Summary update failed:', err);
    // Non-blocking — continue without updated summary
  }
}
```

- [ ] **Step 2: Pass summary to graph state**

In the `initialState` object, add `conversationSummary`:

```typescript
const initialState: Partial<ConversationStateType> = {
  // ... existing fields ...
  conversationSummary: context.conversationSummary || undefined,
};
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (if `conversationSummary` is already in `ConversationStateType`). If not, add it in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/orchestrator.ts
git commit -m "feat: check and update conversation summary in orchestrator

Before building graph state, checks if summary needs updating based
on message count or re-engagement gap. Non-blocking on failure.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Include Summary in Response Prompt

**Files:**
- Modify: `src/lib/agent/state.ts` (if needed)
- Modify: `src/lib/agent/nodes/respond.ts`

- [ ] **Step 1: Add conversationSummary to state type (if missing)**

Check `src/lib/agent/state.ts`. If `conversationSummary` is not in the state type, add it:

```typescript
conversationSummary?: string;
```

- [ ] **Step 2: Update respond.ts to include summary**

In `src/lib/agent/nodes/respond.ts`, modify the conversation formatting section (around line 63):

```typescript
  // Format conversation with optional summary prefix
  const recentMessages = state.messages
    .slice(-15)
    .map(m => {
      const role = m._getType() === 'human' ? 'Customer' : 'Agent';
      return `${role}: ${m.content}`;
    })
    .join('\n');

  const conversationText = state.conversationSummary
    ? `## EARLIER CONVERSATION SUMMARY\n${state.conversationSummary}\n\n## RECENT MESSAGES\n${recentMessages}`
    : recentMessages;
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/state.ts src/lib/agent/nodes/respond.ts
git commit -m "feat: include conversation summary in response prompt

When a conversation summary exists, it appears as 'EARLIER CONVERSATION
SUMMARY' above the last 15 raw messages. Returning leads retain full
context from weeks-old conversations.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Update Docs + Quality Gate

- [ ] **Step 1: Update PLATFORM-CAPABILITIES.md**

In Section 4 (Communication Hub), add:

```markdown
### Conversation Memory

For conversations exceeding 20 messages, older messages are automatically summarized using AI and stored as a conversation summary. When a lead re-engages after 24+ hours, the summary is regenerated to capture "where we left off." The AI sees: summary of earlier conversation + last 15 raw messages. This ensures returning leads don't have to repeat project details, pricing discussions, or scheduling preferences from previous conversations.
```

- [ ] **Step 2: Run quality gate**

Run: `npm run quality:no-regressions`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/product/PLATFORM-CAPABILITIES.md
git commit -m "docs: document conversation memory in capabilities

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
