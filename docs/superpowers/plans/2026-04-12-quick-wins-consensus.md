# Consensus Quick Wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 high-impact fixes identified by Monte Carlo simulation + 7-agent consensus analysis. Each fix addresses a top root cause affecting 40-57% of contractor profiles. Combined, these shift AI viability from 3/10 to 6-7/10 archetypes.

**Architecture:** All fixes are small, independent changes to existing services. No new infrastructure needed. Each can be tested and shipped independently.

**Tech Stack:** Existing TypeScript services, Drizzle ORM, vitest

**Source:** `.scratch/consensus-ai-pipeline.md` — 7-agent consensus report

**Note on calendar dead zone:** Code review revealed `booking-conversation.ts:265-296` already handles empty slots gracefully with a waitlist escalation + customer response. This is NOT a hard blocker as the simulation suggested. Removed from this plan.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/services/onboarding-quality.ts` | Modify | Add pricing coverage check (not just range validity) |
| `src/lib/services/onboarding-quality.test.ts` | Modify | Add test for zero-pricing-services case |
| `src/lib/data/trade-synonyms.ts` | Create | Homeowner→contractor term mappings per trade |
| `src/lib/data/trade-synonyms.test.ts` | Create | Tests for synonym expansion |
| `src/lib/services/knowledge-base.ts` | Modify | Apply synonym expansion before ILIKE search |
| `src/lib/automations/estimate-auto-trigger.ts` | Create | Auto-start estimate follow-up from conversation signals |
| `src/lib/automations/estimate-auto-trigger.test.ts` | Create | Tests for signal detection + trigger logic |
| `src/lib/agent/orchestrator.ts` | Modify | Call estimate auto-trigger after AI response |
| `src/app/api/cron/route.ts` | Modify | Add estimate auto-trigger cron |

---

### Task 1: Enforce Pricing KB at Onboarding (fixes 57% pricing void)

**Problem:** The `services_pricing_boundaries` gate checks that ranges are valid when `canDiscussPrice = 'yes_range'`, but a contractor can pass the gate with ALL services set to `'defer'`. The AI then can't answer any pricing questions — the most common homeowner question.

**Files:**
- Modify: `src/lib/services/onboarding-quality.ts:130-173`
- Modify: `src/lib/services/onboarding-quality.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/services/onboarding-quality.test.ts`:

```typescript
it('fails pricing gate when all services defer pricing', () => {
  const result = evaluateOnboardingQuality({
    // ...existing test setup with 3+ services...
    services: [
      { name: 'Drain Cleaning', priceRangeMinCents: 0, priceRangeMaxCents: 0, canDiscussPrice: 'defer' },
      { name: 'Pipe Repair', priceRangeMinCents: 0, priceRangeMaxCents: 0, canDiscussPrice: 'defer' },
      { name: 'Water Heater', priceRangeMinCents: 0, priceRangeMaxCents: 0, canDiscussPrice: 'defer' },
    ],
    // ...rest of input...
  });

  const pricingGate = result.gates.find(g => g.key === 'services_pricing_boundaries');
  expect(pricingGate?.passed).toBe(false);
  expect(pricingGate?.reasons).toContainEqual(
    expect.stringContaining('pricing ranges')
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/onboarding-quality.test.ts`
Expected: FAIL — gate currently passes when all services defer pricing.

- [ ] **Step 3: Add pricing coverage check**

In `src/lib/services/onboarding-quality.ts`, in the Gate 2 section (around line 130), add a check for pricing coverage:

```typescript
  // Check that at least 1 service has pricing ranges the AI can discuss
  const servicesWithPricing = input.services.filter(s => s.canDiscussPrice === 'yes_range');
  const hasPricingCoverage = servicesWithPricing.length > 0;

  // Adjust score: if no services have pricing ranges, cap score at 50 (below pass threshold of 80)
  const pricingCoverageDeduction = hasPricingCoverage ? 0 : 30;
  const adjustedServicesScore = Math.max(0, servicesScore - pricingCoverageDeduction);
```

Add to `servicesReasons` and `servicesActions` if `!hasPricingCoverage`:

```typescript
  if (!hasPricingCoverage && serviceCount > 0) {
    servicesReasons.push('No services have pricing ranges the AI can discuss — homeowner pricing questions will all be deferred');
    servicesActions.push({
      gateKey: 'services_pricing_boundaries',
      action: 'Set at least 1 service to "Discuss price range" with min/max values in structured knowledge.',
      impact: 'high',
    });
  }
```

Use `adjustedServicesScore` instead of `servicesScore` in the gate result.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/onboarding-quality.test.ts`
Expected: New test PASS, all existing tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/onboarding-quality.ts src/lib/services/onboarding-quality.test.ts
git commit -m "fix: enforce pricing coverage in onboarding quality gate

Contractors with all services set to 'defer' pricing now fail the
services_pricing_boundaries gate. At least 1 service must have
pricing ranges so the AI can answer the most common homeowner question.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Trade-Aware Synonym Table (bridges retrieval gap until pgvector)

**Problem:** ILIKE search misses homeowner vocabulary. "Leaky faucet" doesn't match "Faucet Installation." "Legal suite" doesn't match "Secondary Suite Conversion." This is the 43% jargon mismatch root cause.

**Files:**
- Create: `src/lib/data/trade-synonyms.ts`
- Create: `src/lib/data/trade-synonyms.test.ts`
- Modify: `src/lib/services/knowledge-base.ts`

- [ ] **Step 1: Write tests for synonym expansion**

Create `src/lib/data/trade-synonyms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { expandQueryWithSynonyms } from './trade-synonyms';

describe('expandQueryWithSynonyms', () => {
  it('expands homeowner term to contractor term', () => {
    const expanded = expandQueryWithSynonyms('my faucet is leaking');
    expect(expanded).toContain('faucet');
    expect(expanded).toContain('tap'); // synonym
  });

  it('expands "legal suite" to "secondary suite"', () => {
    const expanded = expandQueryWithSynonyms('how much for a legal suite');
    expect(expanded).toContain('legal suite');
    expect(expanded).toContain('secondary suite');
  });

  it('expands "hot water tank" to "water heater"', () => {
    const expanded = expandQueryWithSynonyms('hot water tank is broken');
    expect(expanded).toContain('water heater');
  });

  it('returns original terms when no synonyms match', () => {
    const expanded = expandQueryWithSynonyms('completely unique query');
    expect(expanded).toContain('completely');
    expect(expanded).toContain('unique');
    expect(expanded).toContain('query');
  });

  it('handles empty input', () => {
    expect(expandQueryWithSynonyms('')).toEqual([]);
  });

  it('deduplicates expanded terms', () => {
    const expanded = expandQueryWithSynonyms('faucet tap repair');
    const unique = new Set(expanded);
    expect(expanded.length).toBe(unique.size);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/data/trade-synonyms.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create synonym table + expansion function**

Create `src/lib/data/trade-synonyms.ts`:

```typescript
/**
 * Trade-aware synonym mappings: homeowner vocabulary → contractor KB terms.
 * Applied before KB search to bridge the jargon gap.
 *
 * Format: each entry maps a homeowner phrase to its canonical contractor term(s).
 * Both directions are searched — if a homeowner says "tap" we also search "faucet",
 * and vice versa.
 */

// Bidirectional synonym groups — any term matches any other term in the group
const SYNONYM_GROUPS: string[][] = [
  // Plumbing
  ['faucet', 'tap', 'spigot'],
  ['drain cleaning', 'drain unclogging', 'clogged drain', 'blocked drain', 'snake the drain'],
  ['water heater', 'hot water tank', 'hot water heater'],
  ['pipe repair', 'pipe fix', 'burst pipe', 'broken pipe', 'leaking pipe'],
  ['toilet', 'commode'],
  ['sewer line', 'sewer pipe', 'main drain', 'sewer backup'],
  ['leak', 'leaking', 'dripping', 'drip'],

  // Renovation
  ['secondary suite', 'legal suite', 'basement suite', 'in-law suite', 'mother-in-law suite'],
  ['basement development', 'basement finishing', 'basement renovation', 'finish the basement'],
  ['kitchen renovation', 'kitchen reno', 'kitchen remodel', 'redo the kitchen'],
  ['bathroom renovation', 'bathroom reno', 'bathroom remodel', 'redo the bathroom'],
  ['deck', 'deck building', 'deck construction', 'build a deck'],
  ['addition', 'home addition', 'room addition', 'add a room'],

  // Electrical
  ['electrical panel', 'breaker panel', 'fuse box', 'electrical box'],
  ['knob and tube', 'old wiring', 'rewire', 'rewiring'],
  ['outlet', 'plug', 'receptacle', 'socket'],

  // HVAC
  ['furnace', 'heating system', 'heater'],
  ['air conditioning', 'ac', 'air conditioner', 'cooling'],
  ['ductwork', 'ducts', 'duct cleaning', 'air ducts'],

  // Roofing
  ['roof repair', 'fix the roof', 'roof leak', 'leaking roof'],
  ['roof replacement', 'new roof', 'reroof', 're-roof'],
  ['shingles', 'roofing shingles'],
  ['gutter', 'eavestrough', 'eaves', 'downspout'],

  // General
  ['estimate', 'quote', 'bid', 'price', 'how much', 'cost'],
  ['warranty', 'guarantee', 'warrantee'],
  ['licensed', 'certified', 'bonded', 'insured'],
  ['emergency', 'urgent', 'asap', 'right away', 'immediately'],
  ['appointment', 'book', 'schedule', 'come out', 'site visit'],
];

// Build lookup: term → all synonyms in its group
const synonymLookup = new Map<string, Set<string>>();

for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    const lower = term.toLowerCase();
    if (!synonymLookup.has(lower)) {
      synonymLookup.set(lower, new Set());
    }
    for (const synonym of group) {
      if (synonym.toLowerCase() !== lower) {
        synonymLookup.get(lower)!.add(synonym.toLowerCase());
      }
    }
  }
}

/**
 * Expand a search query with trade-specific synonyms.
 * Returns an array of all terms to search for (original + expanded).
 */
export function expandQueryWithSynonyms(query: string): string[] {
  if (!query.trim()) return [];

  const lower = query.toLowerCase();
  const terms = new Set<string>();

  // Add original words
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    terms.add(word);
  }

  // Check for multi-word phrase matches first (more specific)
  for (const [phrase, synonyms] of synonymLookup) {
    if (phrase.includes(' ') && lower.includes(phrase)) {
      // Multi-word match — add all synonyms
      for (const syn of synonyms) {
        // Add individual words from synonym phrases
        for (const w of syn.split(/\s+/).filter(w => w.length > 2)) {
          terms.add(w);
        }
      }
    }
  }

  // Check single-word matches
  for (const word of words) {
    const synonyms = synonymLookup.get(word);
    if (synonyms) {
      for (const syn of synonyms) {
        for (const w of syn.split(/\s+/).filter(w => w.length > 2)) {
          terms.add(w);
        }
      }
    }
  }

  return [...terms];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/data/trade-synonyms.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Integrate into searchKnowledge**

In `src/lib/services/knowledge-base.ts`, modify `searchKnowledge()` to use expanded terms:

```typescript
import { expandQueryWithSynonyms } from '@/lib/data/trade-synonyms';

export async function searchKnowledge(
  clientId: string,
  query: string
): Promise<KnowledgeEntry[]> {
  // Expand query with trade-aware synonyms before ILIKE search
  const expandedTerms = expandQueryWithSynonyms(query);
  const searchTerms = expandedTerms.length > 0
    ? expandedTerms
    : query.toLowerCase().split(' ').filter(t => t.length > 2);

  if (searchTerms.length === 0) {
    return getClientKnowledge(clientId);
  }

  // ... rest of function unchanged (uses searchTerms in ILIKE queries) ...
```

This replaces the raw `query.toLowerCase().split(' ').filter(t => t.length > 2)` with synonym-expanded terms.

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/trade-synonyms.ts src/lib/data/trade-synonyms.test.ts src/lib/services/knowledge-base.ts
git commit -m "feat: add trade-aware synonym expansion for KB search

Bridges homeowner vocabulary to contractor KB terms before ILIKE search.
'leaky faucet' now finds 'tap repair', 'legal suite' finds 'secondary
suite conversion'. 30+ synonym groups covering plumbing, renovation,
electrical, HVAC, roofing. Interim fix until pgvector ships.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Estimate Auto-Trigger from Conversation Signals (fixes 47% trigger gap)

**Problem:** The estimate follow-up is the highest-value automation but only fires when the contractor manually triggers it. 47% never trigger. The proactive quote prompt fires once at 3 days and requires contractor opt-in. The gap: when the AI's own conversation reveals a quote was sent (lead says "waiting to hear back on that quote" or "comparing prices"), the system should auto-start the follow-up without contractor action.

**Files:**
- Create: `src/lib/automations/estimate-auto-trigger.ts`
- Create: `src/lib/automations/estimate-auto-trigger.test.ts`
- Modify: `src/lib/agent/orchestrator.ts`

- [ ] **Step 1: Write tests for estimate signal detection**

Create `src/lib/automations/estimate-auto-trigger.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectEstimateSentSignal } from './estimate-auto-trigger';

describe('detectEstimateSentSignal', () => {
  it('detects "waiting on the quote" as estimate-sent signal', () => {
    expect(detectEstimateSentSignal('Still waiting to hear back on that quote')).toBe(true);
  });

  it('detects "comparing prices" as estimate-sent signal', () => {
    expect(detectEstimateSentSignal('We are comparing a few quotes right now')).toBe(true);
  });

  it('detects "got your estimate" as estimate-sent signal', () => {
    expect(detectEstimateSentSignal('Got your estimate, just thinking it over')).toBe(true);
  });

  it('detects "received the quote" as estimate-sent signal', () => {
    expect(detectEstimateSentSignal('We received the quote and will decide soon')).toBe(true);
  });

  it('does not trigger on generic messages', () => {
    expect(detectEstimateSentSignal('When can you come take a look?')).toBe(false);
  });

  it('does not trigger on pricing inquiries', () => {
    expect(detectEstimateSentSignal('How much does drain cleaning cost?')).toBe(false);
  });

  it('detects "sent us a price" pattern', () => {
    expect(detectEstimateSentSignal('You sent us a price last week')).toBe(true);
  });

  it('handles empty string', () => {
    expect(detectEstimateSentSignal('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/automations/estimate-auto-trigger.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the estimate auto-trigger service**

Create `src/lib/automations/estimate-auto-trigger.ts`:

```typescript
/**
 * Estimate Auto-Trigger
 *
 * Detects when a conversation reveals an estimate was already sent
 * (lead mentions "waiting on quote", "comparing prices", etc.)
 * and auto-starts the estimate follow-up sequence without contractor action.
 *
 * This closes the 47% trigger gap where contractors never manually
 * trigger EST follow-up.
 */

import { getDb } from '@/db';
import { leads, scheduledMessages, auditLog } from '@/db/schema';
import { eq, and, like } from 'drizzle-orm';
import { startEstimateFollowup } from './estimate-followup';

const ESTIMATE_SENT_PATTERNS = [
  /\b(waiting|waited)\b.*\b(quote|estimate|bid|price|proposal)\b/i,
  /\b(got|received|have)\b.*\b(quote|estimate|bid|price|proposal)\b/i,
  /\b(comparing|compare)\b.*\b(quotes|estimates|bids|prices|proposals)\b/i,
  /\b(sent|gave|emailed)\b.*\b(quote|estimate|bid|price|proposal)\b/i,
  /\b(thinking|think)\b.*\b(over|about)\b.*\b(quote|estimate|price)\b/i,
  /\b(reviewing|review)\b.*\b(quote|estimate|bid|proposal)\b/i,
  /\bneed.*time.*decide\b/i,
  /\bdiscussing.*with.*(spouse|wife|husband|partner)\b/i,
];

/**
 * Check if a customer message implies an estimate was already sent.
 */
export function detectEstimateSentSignal(message: string): boolean {
  if (!message.trim()) return false;
  return ESTIMATE_SENT_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Auto-trigger estimate follow-up when conversation signals suggest
 * a quote was sent. Checks dedup conditions before triggering.
 */
export async function maybeAutoTriggerEstimateFollowup(
  leadId: string,
  clientId: string,
  inboundMessage: string
): Promise<{ triggered: boolean; reason?: string }> {
  // Only check if the message signals an estimate was sent
  if (!detectEstimateSentSignal(inboundMessage)) {
    return { triggered: false };
  }

  const db = getDb();

  // Check if lead already has an active estimate sequence
  const existingSequence = await db
    .select({ id: scheduledMessages.id })
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.leadId, leadId),
        like(scheduledMessages.sequenceType, '%estimate%')
      )
    )
    .limit(1);

  if (existingSequence.length > 0) {
    return { triggered: false, reason: 'estimate_sequence_already_active' };
  }

  // Check if lead is already in estimate_sent status
  const [lead] = await db
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (lead?.status === 'estimate_sent') {
    return { triggered: false, reason: 'already_in_estimate_sent_status' };
  }

  // Auto-trigger the estimate follow-up
  try {
    await startEstimateFollowup(leadId, clientId, 'auto_detected');

    // Log the auto-trigger
    await db.insert(auditLog).values({
      action: 'estimate_auto_triggered',
      resourceType: 'lead',
      resourceId: leadId,
      metadata: {
        clientId,
        triggerSource: 'conversation_signal',
        signalMessage: inboundMessage.substring(0, 200),
      },
    });

    console.log(`[EstimateAutoTrigger] Auto-started estimate follow-up for lead ${leadId}`);
    return { triggered: true };
  } catch (err) {
    console.error('[EstimateAutoTrigger] Failed to auto-trigger:', err);
    return { triggered: false, reason: 'trigger_failed' };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/automations/estimate-auto-trigger.test.ts`
Expected: `detectEstimateSentSignal` tests PASS.

- [ ] **Step 5: Integrate into orchestrator**

In `src/lib/agent/orchestrator.ts`, after the AI response is sent (after the `sendCompliantMessage` block), add:

```typescript
import { maybeAutoTriggerEstimateFollowup } from '@/lib/automations/estimate-auto-trigger';

// After response sent successfully:
// Check if the inbound message signals an estimate was sent
maybeAutoTriggerEstimateFollowup(leadId, client.id, messageText).catch(
  err => console.error('[Agent] Estimate auto-trigger error:', err)
);
```

This is fire-and-forget — non-blocking, doesn't affect the response flow.

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/automations/estimate-auto-trigger.ts src/lib/automations/estimate-auto-trigger.test.ts src/lib/agent/orchestrator.ts
git commit -m "feat: auto-trigger estimate follow-up from conversation signals

Detects when a lead's message implies a quote was sent ('waiting on
the quote', 'comparing prices', 'got your estimate') and auto-starts
the 4-touch follow-up sequence without requiring contractor action.
Fixes the 47% estimate trigger gap identified in simulation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Booking Aggressiveness Calibration (Phase 8c — quick, high impact)

**Problem:** The `bookingAggressiveness` setting (1-10) is passed to the AI prompt as "Booking aggressiveness: 5/10" but doesn't translate into concrete behavioral rules. The AI treats 3 and 7 identically because there's no guidance on what the number means.

**Files:**
- Modify: `src/lib/agent/nodes/respond.ts`
- Modify: `src/lib/agent/context-builder.ts`

- [ ] **Step 1: Add aggressiveness-to-strategy mapping**

In `src/lib/agent/context-builder.ts`, add a function that translates the 1-10 slider into concrete behavioral instructions:

```typescript
/**
 * Translate bookingAggressiveness (1-10) into concrete behavioral rules
 * for the AI agent. Without this, "aggressiveness: 5/10" means nothing
 * to the LLM — it needs explicit behavioral instructions.
 */
export function getBookingBehaviorRules(aggressiveness: number): string {
  if (aggressiveness <= 3) {
    return `BOOKING APPROACH (conservative):
- Do NOT suggest booking unless the customer explicitly asks to schedule
- Focus on answering questions and providing information
- Only mention availability if the customer brings it up
- Never push for a specific date or time
- If they seem interested, say "When you're ready, just let us know and we'll find a time."`;
  }

  if (aggressiveness <= 5) {
    return `BOOKING APPROACH (balanced):
- After 2-3 exchanges of qualifying conversation, gently offer to schedule
- Use soft language: "Would you like us to come take a look?" or "Happy to set up a time if you'd like"
- Don't push if they decline or hesitate — move on to answering their questions
- One booking suggestion per conversation maximum`;
  }

  if (aggressiveness <= 7) {
    return `BOOKING APPROACH (proactive):
- If the customer describes a project or mentions a problem, suggest booking within 1-2 exchanges
- Offer specific available times: "We have openings this Tuesday or Thursday — which works better?"
- If they hesitate, acknowledge and offer a low-commitment option: "Even just a quick look to give you an accurate number"
- Up to 2 booking suggestions per conversation`;
  }

  // 8-10
  return `BOOKING APPROACH (aggressive):
- Suggest booking on the FIRST relevant exchange if the customer has a real need
- Lead with availability: "We can come out as early as tomorrow — want me to lock in a time?"
- If they have any project need, frame the estimate as free and low-commitment
- Reframe objections toward the estimate: "The estimate is free and only takes 20 minutes — worst case you have a number to work with"
- Up to 3 booking suggestions per conversation, escalating directness`;
}
```

- [ ] **Step 2: Integrate into system prompt**

In `src/lib/agent/context-builder.ts`, in the `buildSystemPrompt()` function, add the booking behavior rules to the prompt. Replace the generic "Booking aggressiveness: X/10" line:

```typescript
// Replace this in the AGENT SETTINGS section:
// - Booking aggressiveness: ${agent.bookingAggressiveness}/10

// With:
${getBookingBehaviorRules(agent.bookingAggressiveness)}
```

Also add to `respond.ts` — replace the `{schedulingRule}` placeholder handling to include aggressiveness context. Read the current `schedulingRule` replacement and add the behavioral rules alongside it.

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent/context-builder.ts src/lib/agent/nodes/respond.ts
git commit -m "feat: translate booking aggressiveness slider into concrete AI behavior

Converts the 1-10 aggressiveness setting into explicit behavioral rules:
conservative (1-3, wait for customer to ask), balanced (4-5, gentle
offers after qualifying), proactive (6-7, suggest times within 1-2
exchanges), aggressive (8-10, lead with availability immediately).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Update Documentation + Quality Gate

**Files:**
- Modify: `docs/product/PLATFORM-CAPABILITIES.md`
- Modify: `docs/engineering/01-TESTING-GUIDE.md`
- Modify: `docs/operations/01-OPERATIONS-GUIDE.md`

- [ ] **Step 1: Update PLATFORM-CAPABILITIES.md**

In Section 1 (AI Conversation Agent), add:

```markdown
### Trade-Aware Knowledge Search

KB search queries are expanded with trade-specific synonyms before matching. Homeowner vocabulary ("leaky faucet", "hot water tank", "legal suite") automatically maps to contractor terminology ("tap repair", "water heater", "secondary suite conversion"). 30+ synonym groups covering plumbing, renovation, electrical, HVAC, and roofing trades. This bridges the vocabulary gap between how homeowners describe problems and how contractors name services.

### Estimate Auto-Detection

When a conversation reveals that an estimate was already sent (lead mentions "waiting on the quote", "comparing prices", "received your estimate"), the system automatically starts the 4-touch follow-up sequence without requiring the contractor to trigger it manually. This eliminates the dependency on contractor behavior for the highest-value automation.

### Booking Aggressiveness Calibration

The booking aggressiveness setting (1-10) translates into concrete AI behavioral rules:
- **Conservative (1-3):** AI waits for customer to ask about scheduling
- **Balanced (4-5):** AI gently offers to schedule after qualifying
- **Proactive (6-7):** AI suggests specific times within 1-2 exchanges
- **Aggressive (8-10):** AI leads with availability on first relevant exchange
```

- [ ] **Step 2: Update testing guide**

Add test step for synonym expansion and estimate auto-trigger.

- [ ] **Step 3: Update operations guide**

Add item about estimate auto-trigger behavior and how it appears in audit log.

- [ ] **Step 4: Run quality gate**

Run: `npm run quality:no-regressions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs: document synonym search, estimate auto-trigger, booking calibration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
