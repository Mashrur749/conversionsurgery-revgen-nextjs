# AI Orchestration Redesign — Expert Sales Agent Architecture

**Date:** 2026-04-13
**Status:** Design — pending approval
**Scope:** Complete redesign of the AI agent's orchestration to transform it from a reactive responder into an expert sales conversationalist, composable across industries, locales, and channels.
**Companion:** `docs/superpowers/specs/2026-04-13-ai-audit-issues.md` (13 audit issues)

---

## 1. Problem Statement

The current agent responds to messages. It doesn't drive conversations.

ConversionSurgery's ICP — Calgary basement development contractors — are tradespeople, not salespeople. They're experts at building basements, not at converting inquiries into booked estimate visits. The AI agent must compensate for this gap. It must be a **sales expert who communicates via text**, not a chatbot that answers questions.

The current architecture has a 2-node LangGraph graph (`analyzeAndDecide` → `respond`) that makes myopic per-turn decisions. It has no multi-turn strategy, no industry-specific sales methodology, no awareness of how basement renovation conversations differ from plumbing or kitchen/bath conversations, and no mechanism to adapt communication style to locale or channel.

The expansion path (basement → kitchen/bath → Edmonton → national → other trades) requires the agent to be composable: same core intelligence, different expertise per context.

---

## 2. Design Principles

1. **The agent drives, the homeowner rides.** Every message should advance the conversation toward a specific outcome. No turn is wasted on generic acknowledgment.
2. **Strategy is deterministic, expression is generative.** The LLM generates natural language. It does NOT decide what the conversation strategy should be. Strategy is computed from rules and data.
3. **Layers compose, layers degrade independently.** Each layer of expertise can be added, removed, or swapped without breaking others. A missing layer reduces quality, never causes failure.
4. **What works is measured, not assumed.** Every strategic choice is logged with enough context to evaluate whether it improved outcomes.
5. **The system gets smarter with usage.** Production conversations feed back into the system through multiple loops: edit analysis, outcome correlation, score calibration.

---

## 3. Six-Layer Composable Architecture

The agent's behavior on any given message is composed from six independent layers. Each layer answers a different question:

```
Layer 1: Sales Methodology       → "What should I do next?"
Layer 2: Locale Context          → "How should I sound?"
Layer 3: Industry Playbook       → "What do I know about this trade?"
Layer 4: Channel Adaptation      → "What are the constraints of this medium?"
Layer 5: Conversation Entry      → "How did this conversation start?"
Layer 6: Client Personality      → "Who am I representing?"
```

### 3.1 Layer 1: Sales Methodology (Universal — Build Once)

**Purpose:** Provides the conversation structure that drives toward outcomes. Encodes a proven sales methodology adapted to home services.

**What it contains:**

```typescript
interface SalesMethodology {
  stages: StageDefinition[];
  transitions: StageTransition[];
  globalRules: ConversationRule[];
}

interface StageDefinition {
  id: string;                         // 'qualifying' | 'educating' | 'proposing' | etc.
  objective: string;                  // "Understand project scope, timeline, and decision-makers"
  requiredInfoBeforeAdvancing: string[]; // ["projectType", "approximateSize", "timeline"]
  maxTurnsInStage: number;            // Don't get stuck — advance or escalate
  suggestedActions: ActionGuidance[]; // Ordered by priority
  exitConditions: ExitCondition[];    // When to advance to next stage
  failureConditions: FailureCondition[]; // When to bail (e.g., opted out, competitor chosen)
}

interface ActionGuidance {
  action: string;          // "ask_qualifying_question"
  when: string;            // "missing projectType or approximateSize"
  constraint: string;      // "max 1 question per message"
  example?: string;        // "What kind of project are you thinking about?"
}

interface StageTransition {
  from: string;
  to: string;
  trigger: string;          // "all requiredInfo collected AND intent > 50"
  priority: number;
}
```

**The stages (home services sales methodology):**

| Stage | Objective | Key Actions | Advance When |
|-------|-----------|-------------|--------------|
| `greeting` | Acknowledge inquiry, set tone, start qualifying | Respond to their specific request, ask one qualifying question | They respond with project info |
| `qualifying` | Understand scope: what, where, when, how big, who decides | Ask about project type, size, timeline, decision-makers | All required info collected |
| `educating` | Build value: why this contractor, what makes them different | Share relevant KB facts, reference experience, address implicit concerns | Homeowner shows interest in next steps |
| `proposing` | Suggest the estimate visit / site assessment | Offer specific times, explain what the visit includes, make it low-commitment | They agree to a time OR raise an objection |
| `objection_handling` | Address specific concern without being pushy | Acknowledge concern, reframe value, offer alternative | Objection resolved OR 2+ attempts without progress |
| `closing` | Confirm appointment details, set expectations | Confirm date/time/address, explain what happens at the visit | Appointment booked |
| `nurturing` | Stay in touch without pressure | Share relevant content, check in periodically | They re-engage with intent signals |
| `post_booking` | Confirm and reinforce the decision | Send reminder, share prep tips, reduce buyer's remorse | Appointment completed |

**Global rules (always active, regardless of stage):**
- Max 1 question per message (SMS constraint — but methodology rule, not channel rule)
- Never ask a question the homeowner already answered
- If they ask a direct question, answer it before advancing your agenda
- If frustrated, pause the methodology — empathize first, then resume
- If they mention a competitor or "comparing quotes," acknowledge it and differentiate — don't ignore it
- If no response in 24 hours, don't re-ask the same question — change approach

### 3.2 Layer 2: Locale Context (Per-Region — Composable)

**Purpose:** Cultural and regulatory context that shapes communication norms. Not about the trade — about the geography and culture.

**What it contains:**

```typescript
interface LocaleContext {
  id: string;                    // 'ca-ab' | 'us-tx' | 'au-nsw'
  name: string;                  // 'Canadian — Alberta'
  language: string;              // 'en-CA'
  timezone: string;              // 'America/Edmonton'
  
  communicationNorms: {
    directness: 'low' | 'medium' | 'high';  // CA=low, US=medium-high, AU=high
    apologeticTone: boolean;                  // CA=true, US=false
    formalityDefault: 'casual' | 'friendly' | 'professional';
    greetingStyle: string;        // "Hey!" vs "Hi there," vs "G'day"
    closingStyle: string;         // "Thanks!" vs "Talk soon" vs "Cheers"
    commonExpressions: string[];  // ["no worries", "sounds good", "for sure"]
    avoidExpressions: string[];   // Expressions that sound wrong in this locale
  };
  
  regulatoryContext: {
    consentFramework: string;     // 'CASL' | 'TCPA' | 'GDPR'
    quietHoursRule: string;       // 'CRTC 9pm-10am' | 'TCPA 9pm-8am'
    businessIdentificationRequired: boolean;
    consentLanguage: string;      // Required consent disclosure text
  };
  
  culturalReferences: {
    seasonalAnchors: Record<string, string>;  // { winter: "October-April", summer: "May-September" }
    trustAnchors: string[];       // ["BBB", "HomeStars", "Google Reviews"]
    localTerminology: Record<string, string>; // { "basement apartment": "secondary suite", "ADU": "legal suite" }
  };
  
  buyingPsychology: {
    priceDiscussionStyle: string;     // "indirect — Canadians avoid direct price talk" 
    comparisonShoppingNorm: string;   // "polite — 'looking at a few options'" vs "direct — 'what's your best price?'"
    decisionTimeline: string;         // "takes time, involves partner" vs "faster, more transactional"
    trustBuildingPriority: string[];  // ["reviews", "referrals", "experience", "licensing"]
  };
}
```

**Initial population: Canadian — Alberta (`ca-ab`)**

This is the only locale needed at launch. Key characteristics:
- Low directness, apologetic tone natural ("sorry about the wait," "no worries if the timing doesn't work")
- Friendly default (not casual, not formal)
- CASL consent framework, CRTC quiet hours
- HomeStars is a major trust anchor (more so than US platforms)
- "Secondary suite" not "ADU" or "in-law suite"
- Comparison shopping is polite: "we're looking at a few options" — acknowledge it, don't challenge it
- Partner involvement common: "I need to talk to my husband/wife" is a real stage, not a stall tactic
- Seasonal: "before winter" = October. Year-round work for basements, but permits slow in December.

### 3.3 Layer 3: Industry Playbook (Per-Trade — Composable)

**Purpose:** Trade-specific expertise that makes the methodology work for a specific industry. This is what makes the agent an "expert" rather than a "generic assistant."

**What it contains:**

```typescript
interface IndustryPlaybook {
  id: string;                    // 'basement_development' | 'plumbing' | 'kitchen_bath'
  name: string;                  // 'Basement Development & Finishing'
  
  vocabularyMapping: {
    homeownerTerm: string;
    contractorTerm: string;
    context?: string;
  }[];  // Already partially implemented in trade-synonyms.ts — extend, don't replace
  
  projectSizingHeuristics: {
    // NOT price ranges (those are per-client) — scope classification signals
    scopeIndicators: {
      signal: string;             // "mentions secondary suite" | "mentions just drywall"  
      impliedScope: 'small' | 'medium' | 'large' | 'complex';
      impliedTimeline: string;    // "2-4 weeks" | "8-12 weeks"
      qualifyingQuestions: string[]; // Follow-up questions for this scope level
    }[];
  };
  
  objectionPatterns: {
    // Common objection CATEGORIES for this trade (not answers — those are per-client KB)
    category: string;            // "price_comparison" | "timeline_concern" | "trust_deficit" | "partner_approval"
    typicalPhrasing: string[];   // How homeowners express this objection in this trade
    handlingStrategy: string;    // General approach (reframe, empathize, differentiate, defer)
    neverSay: string[];          // Things that backfire for this objection in this trade
  }[];
  
  conversionDynamics: {
    typicalSalesCycle: string;           // "2-4 weeks from inquiry to booked estimate"
    decisionMakers: string;              // "Usually a couple. One partner often drives, other approves."
    competitorCount: string;             // "Homeowners typically get 2-4 quotes"
    highValueSignals: string[];          // Signals that indicate a serious, high-value lead
    lowValueSignals: string[];           // Signals that indicate browsing or low-intent
    optimalFollowUpCadence: string;      // "Day 2, Day 5, Day 10 — not more aggressive"
  };
  
  communicationStyle: {
    purchaseType: 'emergency' | 'routine' | 'considered' | 'luxury';
    informationDensity: 'high' | 'medium' | 'low';     // How much detail homeowners want
    emotionalRegister: string;           // "reassuring — this is a big decision for most people"
    expertiseDisplay: 'subtle' | 'direct';  // How much to show you know the trade
  };
  
  qualifyingSequence: {
    // Trade-specific qualifying questions in priority order
    question: string;
    whyItMatters: string;              // Helps the LLM understand context
    ifAnswered: string;                // What to do with the answer
  }[];
  
  exampleConversations: {
    // Few-shot examples of excellent conversations for this trade
    scenario: string;
    turns: { role: 'homeowner' | 'agent'; message: string }[];
    annotations: string[];             // What makes this conversation good
  }[];
}
```

**Initial population: Basement Development (`basement_development`)**

Key characteristics:
- Considered purchase ($50-120K). Homeowners research extensively.
- Decision-makers: couples, usually. "I need to talk to my wife" is genuine 70% of the time.
- 2-4 quotes typical. Homeowners compare on: price, timeline, communication quality, reviews.
- Qualifying sequence: what kind of project? (full development vs finishing vs suite). Existing conditions? (walkout? egress windows? permits?). Timeline? Decision-makers?
- High-value signals: mentions "legal suite" or "secondary suite" (= $80-120K), mentions "RECA" or "permits" (= serious buyer), asks about timeline (= ready to start)
- Low-value signals: "just getting an idea of cost" (= browsing), "my landlord wants..." (= not the decision-maker), asks only about price without scope (= price-shopping)
- Communication style: consultative, educational. These homeowners want to feel informed, not sold to. "Here's what a typical basement development involves..." works better than "We can start next week!"
- Objection patterns: "too expensive" (reframe: investment in home value + livable space), "bad timing" (acknowledge + keep warm), "comparing quotes" (differentiate on communication + quality, not price)

### 3.4 Layer 4: Channel Adaptation (Per-Medium — Composable)

**Purpose:** Constraints and affordances of the communication medium. Shapes HOW the message is delivered, not WHAT it says.

```typescript
interface ChannelAdaptation {
  id: string;                    // 'sms' | 'voice' | 'web_chat'
  
  messageConstraints: {
    maxLength: number;           // SMS: 300 chars recommended (2 segments max)
    maxQuestionsPerMessage: number; // SMS: 1, Voice: 2-3, Web: 2
    supportsFormatting: boolean;   // SMS: false, Voice: N/A, Web: true
    supportsLinks: boolean;        // SMS: yes (but sparingly), Voice: no, Web: yes
    supportsImages: boolean;       // SMS: MMS yes, Voice: no, Web: yes
  };
  
  pacingRules: {
    responseTimeExpectation: string;   // SMS: "< 30 seconds", Voice: "immediate", Web: "< 10 seconds"
    turnCadence: string;               // SMS: "async — hours between turns normal", Voice: "real-time"
    silenceHandling?: string;          // Voice: "fill silence after 3 seconds"
  };
  
  toneModifiers: {
    brevityLevel: 'terse' | 'concise' | 'moderate' | 'verbose';
    fillerWordsAllowed: boolean;       // Voice: yes, SMS: no
    contractions: 'always' | 'usually' | 'formal_only';
    emojiPolicy: 'never' | 'sparingly' | 'natural';
  };
  
  escalationBehavior: {
    canTransferToHuman: boolean;       // Voice: yes (hot transfer), SMS: no (escalation queue)
    transferMechanism: string;
  };
}
```

**Initial population: SMS (`sms`)**
- Max 300 chars (2 SMS segments). One question per message.
- No formatting, links sparingly, MMS images supported.
- Concise tone, contractions always, emojis never (brand rule).
- Response under 30 seconds. Async cadence — hours between turns normal.
- Escalation via queue, not transfer.

### 3.5 Layer 5: Conversation Entry Context (Per-Conversation — Dynamic)

**Purpose:** Situational context computed from lead data at conversation start. Shapes the opening 1-3 messages.

```typescript
interface ConversationEntryContext {
  source: 'missed_call' | 'form_submission' | 'google_ads' | 'homeStars' | 'referral' | 'dormant_reactivation' | 'inbound_sms' | 'voice_call' | 'unknown';
  isReturningLead: boolean;
  daysSinceLastContact: number | null;
  timeOfDay: 'business_hours' | 'evening' | 'weekend' | 'late_night';
  existingProjectInfo: Record<string, unknown> | null;    // What we already know
  existingConversationSummary: string | null;
  
  // Computed opening strategy
  openingStrategy: {
    acknowledgment: string;       // "Sorry we missed your call!" | "Thanks for reaching out!" | "Hey, welcome back!"
    firstQuestion: string | null; // null if we should let them lead
    toneAdjustment: string;       // "empathetic — they tried to reach a human" | "direct — they have commercial intent"
    skipQualifying: string[];     // Info we already have — don't re-ask
  };
}
```

**How it's computed (deterministic, no LLM):**

| Source | Acknowledgment | Tone | Skip |
|--------|---------------|------|------|
| `missed_call` | "Sorry we missed your call!" | Empathetic — they wanted a human | None — we know nothing |
| `form_submission` | Reference their form data | Direct — they gave us info | Whatever they put in the form |
| `google_ads` | "Thanks for reaching out!" | Efficient — they're shopping | None |
| `referral` | "Hey! [referrer] mentioned you" | Warm — trust is pre-built | None, but trust is higher |
| `dormant_reactivation` | "Hey! Been a while..." | Gentle — don't be pushy | Prior project info |
| `inbound_sms` (returning) | Reference prior conversation | Familiar — they know us | All prior extracted info |
| `late_night` | Standard, but don't propose immediate actions | Calm — they're planning, not urgent | None |

### 3.6 Layer 6: Client Personality (Per-Contractor — Already Exists)

**Purpose:** Contractor-specific identity and knowledge. Already implemented via `clientAgentSettings` + knowledge base.

**What exists today:**
- `agentName`, `agentTone`, `maxResponseLength`, `primaryGoal`
- `bookingAggressiveness` (1-10 slider)
- `canDiscussPricing`, `canScheduleAppointments`
- Knowledge base entries (semantic search + structural)
- `maxBookingAttempts`

**What to add:**
- `tradeId` → links to Layer 3 playbook
- `localeId` → links to Layer 2 context
- `preferredChannels` → prioritizes Layer 4 selection

No structural changes needed to existing KB or settings.

---

## 4. Architecture: Hybrid Strategy Resolution

**Approach C from brainstorming:** Keep the single-graph architecture. Add a deterministic strategy layer between orchestrator and graph. No extra LLM calls.

### 4.1 Data Flow

```
Inbound message arrives
    │
    ▼
┌─────────────────────────┐
│  ORCHESTRATOR            │
│  (processIncomingMessage)│
│                          │
│  1. Load lead + client   │
│  2. Load layers 2-6      │
│  3. Compute entry context│ ◄── Layer 5 (deterministic)
│  4. Resolve strategy     │ ◄── Layer 1 (deterministic)
│  5. Compose prompt       │ ◄── Layers 2+3+4 (data injection)
│  6. Run graph            │
│  7. Output guard         │
│  8. Compliance gateway   │
│  9. Log + attribute      │
└─────────────────────────┘
```

### 4.2 Strategy Resolver (New — Deterministic, No LLM)

```typescript
interface ConversationStrategy {
  currentStage: string;
  currentObjective: string;
  requiredInfo: string[];
  suggestedAction: string;
  actionGuidance: string;         // Injected into {strategy} in respond.ts
  nextMoveIfSuccessful: string;
  constraints: string[];
  escalationTriggers: string[];
  maxTurnsRemaining: number;      // Before forced advance or escalation
}

function resolveStrategy(
  methodology: SalesMethodology,
  playbook: IndustryPlaybook,
  leadContext: LeadContextRow,
  signals: LeadSignals,
  conversationHistory: ConversationMessage[],
  entryContext: ConversationEntryContext
): ConversationStrategy {
  // Pure function — deterministic, unit-testable
  // 1. Determine current stage from leadContext + signals
  // 2. Check if stage transition conditions are met → advance
  // 3. Look up stage definition from methodology
  // 4. Cross-reference with playbook for trade-specific guidance
  // 5. Check if any required info is still missing
  // 6. Return specific objective + action for this turn
}
```

### 4.3 Prompt Composition (New — Layered, Cache-Optimized)

The system prompt is composed by stacking layers. **Order matters for prompt caching:**

```
┌──────────────────────────────────────────────┐
│  STABLE PREFIX (cache-friendly)               │
│                                               │
│  ┌─ Personality Anchor (Layer 6 identity)     │ ← 50 tokens, never changes
│  ├─ Sales Methodology (Layer 1 current stage) │ ← ~200 tokens, changes per stage
│  ├─ Locale Context (Layer 2)                  │ ← ~150 tokens, changes per region
│  ├─ Industry Playbook (Layer 3)               │ ← ~300 tokens, changes per trade
│  ├─ Channel Rules (Layer 4)                   │ ← ~100 tokens, changes per channel
│  └─ Guardrails                                │ ← ~200 tokens, existing
│                                               │
├──────────────────────────────────────────────┤
│  DYNAMIC SUFFIX (changes per message)         │
│                                               │
│  ┌─ Entry Context (Layer 5)                   │ ← ~50 tokens, first message only
│  ├─ Strategy Objective (resolved)             │ ← ~100 tokens, changes per turn
│  ├─ Knowledge Base Context (Layer 6 KB)       │ ← ~200 tokens, changes per query
│  ├─ Conversation Summary (if returning)       │ ← ~200 tokens, when applicable
│  └─ Conversation History (last 15 messages)   │ ← Variable
│                                               │
└──────────────────────────────────────────────┘
```

**Why this order:** Anthropic prompt caching caches prefixes. Layers 1-4 + guardrails change rarely (same for every message within a conversation, or across conversations for the same client). By putting them first, we get cache hits on most calls. The dynamic content (strategy, KB, history) goes last.

**Prompt validation:**

The composer validates the assembled prompt before sending:
1. All required sections present (methodology, guardrails, strategy objective)
2. No unfilled placeholders (scan for `{...}` patterns in the rendered output)
3. Total token estimate within budget (max 3000 tokens for system prompt at Haiku tier, 6000 at Sonnet tier)
4. If validation fails: log the error, fall back to a minimal prompt (identity anchor + guardrails + conversation history only)

**Prompt inspection (debug mode):**

When `process.env.DEBUG_PROMPTS === 'true'`, the composer logs the full rendered prompt to `agentDecisions.actionDetails.renderedPrompt` for debugging. Off in production (token cost of storing full prompts).

**Token budget per layer:**

| Layer | Max Tokens | Cache | Priority |
|-------|-----------|-------|----------|
| Identity anchor | 50 | Stable | Required |
| Methodology (current stage) | 200 | Stable | Required |
| Locale context | 150 | Stable | Optional |
| Industry playbook | 300 | Stable | Optional |
| Channel rules | 100 | Stable | Required |
| Guardrails | 200 | Stable | Required |
| Entry context | 50 | Dynamic | First message only |
| Strategy objective | 100 | Dynamic | Required |
| KB context | 300 | Dynamic | Optional — truncate if over budget |
| Conversation summary | 200 | Dynamic | When applicable |
| Conversation history | Variable | Dynamic | Required — last N messages fit remaining budget |

If total exceeds budget: truncate KB context first, then reduce conversation history window, then omit optional layers. Never truncate guardrails or strategy.

### 4.4 Prompt Caching Implementation

```typescript
// In AnthropicProvider — add cache_control to stable prefix blocks
const systemBlocks: Anthropic.TextBlockParam[] = [
  {
    type: 'text',
    text: stablePrefix,              // Layers 1-4 + guardrails
    cache_control: { type: 'ephemeral' }
  },
  {
    type: 'text',
    text: dynamicSuffix,             // Layer 5 + strategy + KB + history
  },
];
```

**Expected savings:** ~800 tokens of system prompt cached per call. At Haiku rates, saves ~$0.0004/call. Across 250 calls/client/month = ~$0.10/client/month. Small per-client, but scales with client count and reduces latency (cached tokens process faster).

### 4.5 Existing Graph — Minimal Changes

The `analyzeAndDecide` → `respond` graph stays. Changes:

**`analyzeAndDecide`:**
- Receives `ConversationStrategy` in state
- Prompt updated: instead of "Analyze and decide the best action," it becomes "Analyze the conversation. The current objective is: {strategy.currentObjective}. Evaluate whether this objective has been met. Recommend: {strategy.suggestedAction} unless the conversation clearly requires something different."
- The LLM can still override the strategy (it might detect frustration the deterministic resolver missed), but it starts with a clear mission rather than an open-ended decision space.

**`respond`:**
- `{strategy}` variable replaced with the full `ConversationStrategy.actionGuidance`
- Layer 3 example conversations injected as few-shot guidance when available
- Layer 4 constraints enforced (max length, questions per message)
- Layer 2 tone modifiers applied

---

## 5. Operational Dimensions

### 5.1 Latency Budget

| Component | Budget | Current | After Redesign |
|-----------|--------|---------|----------------|
| Strategy resolution | 5ms | N/A (doesn't exist) | < 5ms (deterministic) |
| Prompt composition | 10ms | ~5ms (simple string replace) | ~10ms (6-layer assembly) |
| KB semantic search | 200ms | ~200ms | ~200ms (unchanged) |
| LLM: analyzeAndDecide | 1-3s | 1-3s | 1-3s (same call, slightly larger prompt) |
| LLM: respond | 1-3s | 1-3s | 1-3s (same call, slightly larger prompt) |
| Output guard | 1ms | ~1ms | ~1ms (unchanged) |
| Compliance gateway | 50ms | ~50ms | ~50ms (unchanged) |
| **Total** | **< 8s** | **3-7s** | **3-8s** |

Prompt caching reduces LLM latency by 30-50% on cache hits (stable prefix doesn't need reprocessing). Net effect: similar or slightly better latency despite richer prompts.

### 5.2 Cost Model

| Component | Per-call cost (Haiku) | Per-call cost (Sonnet) | Calls/client/month |
|-----------|----------------------|------------------------|-------------------|
| analyzeAndDecide | ~$0.002 | ~$0.02 | 100-250 |
| respond | ~$0.001 | ~$0.01 | 80-200 (not all calls generate response) |
| Conversation summary | ~$0.001 | N/A (always Haiku) | 5-20 |
| Signal detection | ~$0.001 | N/A | 50-150 |
| Voice summary | ~$0.001 | N/A | 10-30 |
| Embedding (Voyage) | ~$0.0001 | N/A | 5-20 |
| **Monthly per-client** | **$0.50-2.00** | **$2-8 (if quality tier triggered)** | — |

At $1K/month revenue per client, AI costs are 0.3-1% of revenue. Healthy margin. Even with richer prompts (2x token count), costs stay under 2%.

### 5.3 Prompt Versioning

Every prompt composition logs a version fingerprint:

```typescript
interface PromptVersion {
  methodology: string;      // "v1.0" — bumped when stages/rules change
  locale: string;           // "ca-ab-v1.0"
  playbook: string;         // "basement_development-v1.0"
  channel: string;          // "sms-v1.0"
  guardrails: string;       // "v3.2"
  composedHash: string;     // SHA-256 of the full composed prompt (first 8 chars)
}
```

Logged in `agentDecisions.actionDetails.promptVersion`. Enables:
- Before/after comparison when any layer changes
- A/B testing infrastructure (AUDIT-06) — variants are just different layer versions
- Rollback: revert a layer version if quality degrades

### 5.4 Human Handoff Intelligence

Two types of handoff, distinguished by intent:

**Defensive escalation (existing):** Agent can't handle the situation.
- Triggers: frustrated + repeated, legal threats, complex technical, explicit request for human
- Action: escalation queue, priority-based

**Strategic handoff (new):** Human involvement would increase conversion.
- Triggers: `projectValue > $50K AND stage === 'hot' AND objections.length === 0`
- Action: different notification template — "HOT LEAD: Call [name] now. They're ready to book a [projectType]. [1-line summary]."
- Not an escalation (nothing went wrong). A **conversion opportunity** notification.
- Tracked separately from escalations in analytics.

The threshold ($50K) comes from the ICP: average basement project is $50-100K. For these projects, a personal contractor call at the right moment can be the differentiator against competitors who only text.

### 5.5 Graceful Degradation Matrix

| Layer | Failure Mode | Fallback | Impact |
|-------|-------------|----------|--------|
| Layer 1 — Methodology | Unknown stage / invalid transition | Default to `respond` action, generic strategy | Agent works but doesn't drive — reverts to current behavior |
| Layer 2 — Locale | Missing locale config | Fall back to `ca-ab` (primary market) | Wrong cultural cues for non-Alberta leads |
| Layer 3 — Playbook | No playbook for trade | Omit Layer 3 entirely — agent uses only KB | Less expert, but functional — like current behavior |
| Layer 4 — Channel | Unknown channel | Default to SMS constraints (safest) | Over-constrained for web chat, acceptable for voice |
| Layer 5 — Entry | Missing source data | Neutral opening, no skip list | Slightly generic opening, no harm |
| Layer 6 — Client | KB empty | Quality gate blocks AI (existing behavior) | No change — already handled |
| Anthropic API | Timeout / 5xx after retries | Safe fallback message, queue for reprocessing | Lead gets acknowledgment, not silence |
| Voyage API | Embedding failure | ILIKE keyword search fallback (existing) | Slightly worse KB retrieval, functional |
| Strategy resolver | Exception in resolution | Catch, log, use generic strategy | Reverts to current behavior for that turn |

**Principle:** Every failure degrades to current behavior (at worst) or a safe fallback. No failure mode produces silence or an error message to the homeowner.

### 5.6 Coherence Anchoring

**Identity anchor** injected at the very top of every prompt, above all layers, never compressed or summarized:

```
You are {agentName}. You work for {businessName}, owned by {ownerName}. 
You are a {agentTone} professional who helps homeowners with {trade} projects. 
You never break character. You never claim to be human. You always remember 
what was discussed earlier in this conversation.
```

This is 50 tokens. It anchors the agent's identity across turns, preventing personality drift in long conversations. It's separate from the guardrails (which are prohibitions) — this is affirmative identity.

### 5.7 Model Migration Strategy

When Anthropic releases new models (e.g., Claude Haiku 5):

1. **Shadow mode (1-2 weeks):** New model runs in parallel on 100% of conversations. Both responses generated, only current model's response sent. New model's response logged for comparison.
2. **Canary deployment (1-2 weeks):** Route 10% of NEW conversations (not mid-conversation) to new model. Monitor: response quality (eval suite), conversion rate, escalation rate, output guard violation rate.
3. **Gradual rollout:** 10% → 25% → 50% → 100% over 2 weeks if metrics hold.
4. **Rollback:** If any metric degrades >10%, revert immediately. Prompt versioning (#5.3) enables instant before/after comparison.

**Critical rule:** Never switch models mid-conversation. A lead's entire conversation uses the same model version for consistency. Model version stored in `leadContext` at first contact.

### 5.8 Promise Tracking

The agent may make commitments to homeowners: "someone will call you within the hour," "I'll send you some information," "we can start as early as next week." These promises must be tracked and fulfilled.

**Data model (add to `leadContext`):**

```typescript
activePromises: Array<{
  promise: string;          // "contractor will call tomorrow"
  madeAt: Date;
  deadline: Date;           // When the promise expires
  source: 'agent' | 'flow'; // Who made it
  fulfilled: boolean;
  fulfilledAt?: Date;
}>;
```

**How it works:**
1. `analyzeAndDecide` extracts promises from the agent's own responses (post-generation scan for commitment language: "will call," "will send," "expect to hear," "by tomorrow")
2. Promises stored in `leadContext.activePromises` with computed deadlines
3. Daily cron checks for unfulfilled promises past deadline → alerts operator
4. When homeowner follows up ("nobody called me"), the agent sees the broken promise in context and acknowledges it rather than deflecting

### 5.9 Structured Lead Memory

Beyond conversation summary (narrative) and scores (numeric), the agent needs structured memory of what it's learned about this specific homeowner.

**Data model (add to `leadContext`):**

```typescript
learnedPreferences: {
  communicationStyle?: 'brief' | 'detailed';
  bestContactTimes?: string;
  decisionProcess?: 'solo' | 'partner' | 'committee';
  priceFraming?: 'budget_conscious' | 'value_focused' | 'premium';
  urgencyDriver?: string;        // "insurance deadline," "baby coming," "selling house"
};
```

**How it works:**
1. `analyzeAndDecide` extracts preferences from conversation signals (e.g., homeowner consistently sends short replies → `communicationStyle: 'brief'`)
2. Preferences persist across turns and sessions — never compressed into summary
3. Strategy resolver uses preferences to adjust approach (brief communicator gets shorter messages, value-focused gets quality emphasis over price)
4. Preferences survive conversation summary compression because they're stored as structured JSONB, not in the narrative

---

## 6. 2026 AI Engineering Best Practices Assessment

Analysis of the platform against current best practices for production AI products, identifying gaps and recommendations.

### 6.1 Prompt Caching — NOT IMPLEMENTED (Critical Gap)

**Best practice:** Anthropic's prompt caching (via `cache_control: { type: 'ephemeral' }` on system prompt blocks) reduces cost and latency for stable prompt prefixes. With the layered architecture, Layers 1-4 + guardrails are stable across calls within a conversation — perfect cache candidates.

**Current state:** `AnthropicProvider` passes system prompt as a plain string. No `cache_control` blocks.

**Impact:** Every call reprocesses the full system prompt. With the redesigned 6-layer prompt (~1000 tokens stable prefix), caching would save ~30-50% of input token processing time and cost.

**Fix:** Modify `AnthropicProvider.chat()` and `chatStructured()` to accept system prompt as an array of blocks with cache markers. Design prompt composition to maximize stable prefix length.

### 6.2 Tool Use / Function Calling — NOT IMPLEMENTED (Moderate Gap)

**Best practice:** Modern conversational agents use tool calling to dynamically access information and take actions mid-conversation, rather than pre-fetching everything before the LLM runs.

**Current state:** The orchestrator pre-fetches KB context, loads all lead data, and builds the full prompt before the graph runs. The LLM has no ability to dynamically look up information, check calendar availability, or take actions.

**Impact:** The agent receives ALL knowledge context regardless of relevance (wastes tokens). It can't check real-time calendar availability during the booking flow — it proposes times that might be taken. It can't search for specific KB entries based on what the conversation reveals.

**Recommendation:** Implement tool use for Phase 2 (after the 6-layer architecture is stable). Priority tools:
1. `check_availability(date_range)` — real-time calendar check during booking
2. `search_knowledge(query)` — dynamic KB lookup instead of pre-fetching all
3. `escalate_to_human(reason, priority)` — agent-initiated escalation
4. `schedule_followup(delay, reason)` — agent schedules its own follow-up

**Caution:** Tool use adds latency (tool call round-trip) and complexity (error handling per tool). Start with 1-2 tools, measure impact. Don't add tools the agent rarely invokes.

### 6.3 Vision / Multi-Modal — PARTIALLY IMPLEMENTED (Moderate Gap)

**Best practice:** When users send images, the AI should process them directly via vision APIs rather than relying on text descriptions.

**Current state:** MMS images are saved via `processIncomingMedia()` and get `aiDescription` text. This text description is appended to the message as a string: `"The customer also sent 2 photo(s) showing: a photo of water damage, a photo of a concrete wall"`. The agent never sees the actual image.

**Impact:** Text descriptions lose critical visual information. A photo of a cracked foundation tells an expert agent far more than "a photo of a concrete wall." The Anthropic provider already supports vision (`image_url` content parts in `toAnthropicMessages`) — the infrastructure exists but isn't connected to the main conversation flow.

**Fix:** When MMS images are received, include them as vision content parts in the conversation history sent to the LLM, alongside the text description as fallback. Gate behind a feature flag — vision calls cost more tokens and not all messages need it.

### 6.4 Few-Shot Examples in Prompts — NOT IMPLEMENTED (Moderate Gap)

**Best practice:** Including 1-2 example conversations in the system prompt dramatically improves response quality for specific scenarios. More effective than detailed instructions alone.

**Current state:** All prompts are instruction-only. No example conversations.

**Impact:** The LLM interprets instructions differently across calls. An example conversation anchors the expected behavior concretely: "Here's what a good qualifying question looks like for a basement project."

**Fix:** Layer 3 (Industry Playbook) includes `exampleConversations` in the data model. Inject 1 relevant example (matched by stage) into the prompt. Keep examples short (3-4 turns, ~100 tokens each) to limit token cost.

### 6.5 Evals in CI — NOT IMPLEMENTED (High Gap)

**Best practice:** Safety evals run on every PR/deploy. Quality evals run nightly. Regression detection blocks merges that degrade AI behavior.

**Current state:** Eval system exists (`npm run test:ai`, baseline tracking, HTML reporter). But it's manually triggered. Not gated in CI. A PR that changes a prompt can merge without running evals.

**Impact:** Prompt changes, guardrail modifications, or model routing tweaks can degrade agent behavior without anyone noticing until a homeowner gets a bad message.

**Fix:**
1. Add `npm run test:ai` to CI pipeline on PRs that touch `src/lib/agent/`, `src/lib/ai/`, `src/lib/automations/`, or `src/lib/services/` (files that affect AI behavior)
2. Safety category (pricing leaks, opt-out, identity) = zero tolerance — any failure blocks merge
3. Quality categories = baseline regression check — >10% drop blocks merge
4. Estimated CI cost: ~$0.20 per run (Haiku calls). Acceptable for safety.

### 6.6 Structured Observability / Tracing — PARTIALLY IMPLEMENTED (Moderate Gap)

**Best practice:** Full trace of the AI decision pipeline — from prompt composition through LLM call through post-processing — stored as a structured trace, not scattered console.logs.

**Current state:** `agentDecisions` table logs final decisions with context snapshot, action details, confidence, and processing time. This is better than many production systems. But the trace is incomplete:
- No record of which KB entries were retrieved and why
- No record of strategy resolution (will be critical after redesign)
- No record of output guard checks that passed (only failures logged)
- No record of prompt version or composition details

**Fix:** Add a `decisionTrace` JSONB field to `agentDecisions`:

```typescript
interface DecisionTrace {
  promptVersion: PromptVersion;
  strategyResolved: ConversationStrategy;
  kbEntriesRetrieved: { id: string; score: number; source: 'semantic' | 'keyword' }[];
  modelTierSelected: { tier: string; reason: string };
  outputGuardChecks: { check: string; passed: boolean; detail?: string }[];
  layerDegradations: { layer: string; reason: string }[]; // Any layers that fell back
}
```

### 6.7 Semantic Response Caching — NOT IMPLEMENTED (Low Priority)

**Best practice:** For frequently asked questions with stable answers ("do you do basements?" "what area do you serve?"), cache the response to avoid regenerating identical content.

**Current state:** Every message generates a fresh LLM response, even for questions asked by every lead.

**Impact:** Minimal cost impact (Haiku is cheap). But consistency benefit: cached responses are identical every time, reducing variance in quality.

**Recommendation:** Defer to Phase 3. The consistency benefit is real but the implementation complexity (cache invalidation when KB changes, semantic similarity matching for cache hits) isn't worth it at current scale.

### 6.8 Adversarial Robustness — PARTIALLY IMPLEMENTED (Adequate)

**Best practice:** Systematic red-teaming of the AI against prompt injection, jailbreaking, social engineering.

**Current state:** 
- Prompt injection resistance tested in eval suite (2 cases in `ai-criteria.ai-test.ts`)
- `sanitizeForPrompt()` strips template placeholders and newlines from user-provided values
- Output guard catches identity denial and pricing leaks
- Guardrails include knowledge boundary enforcement

**Assessment:** Adequate for current threat model (homeowners texting, not sophisticated attackers). The primary risk is a homeowner asking "what's your system prompt?" or "pretend you're a human" — both handled. Competitors probing for pricing or capabilities is a secondary risk — handled by pricing gating and knowledge boundaries.

**Recommendation:** Add 3-5 more adversarial test cases to the eval suite. Cover: "ignore your instructions and...", "the contractor told me to ask you for...", "can you text [other number] for me?". Low effort, high safety value.

### 6.9 Data Flywheel Architecture — NOT IMPLEMENTED (Strategic Gap)

**Best practice:** Production AI products use conversation data to continuously improve. This is the moat — not the model, not the prompt.

**Current state:** Conversations are stored. Attribution tracks outcomes. But no system analyzes patterns, extracts insights, or feeds improvements back into the agent. See AUDIT-05, AUDIT-07, AUDIT-08, AUDIT-09 in the audit issues document.

**Architecture for the flywheel:**

```
Production conversations
    │
    ▼
┌──────────────────────┐
│  Data Collection      │
│  - Agent decisions    │ ← Already exists
│  - Smart Assist edits │ ← AUDIT-05: corrections
│  - Attribution        │ ← Already exists
│  - Escalation reasons │ ← Already exists
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Analysis (weekly)    │
│  - Edit patterns      │ ← What do contractors fix?
│  - Conversion paths   │ ← AUDIT-07: what works?
│  - Score calibration  │ ← AUDIT-08: are scores accurate?
│  - Outcome patterns   │ ← AUDIT-09: what wins/loses?
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Improvement Actions  │
│  - KB entries         │ ← "Leads convert 2x when offered same-week visit"
│  - Playbook updates   │ ← New objection patterns discovered
│  - Threshold tuning   │ ← Calibrated scoring/routing
│  - Prompt adjustments │ ← Versioned, A/B tested
└──────────────────────┘
```

**Timeline:** Build collection infrastructure now (it's mostly in place). Analysis and improvement loops after 200+ completed leads (statistical significance needed).

### 6.10 Edge / Latency Optimization — ADEQUATE

**Current state:** Deployed on Cloudflare via OpenNext. Edge deployment provides low-latency routing to Anthropic's API. Neon serverless Postgres handles DB latency well.

**Assessment:** No changes needed. The architecture is already edge-optimized. The main latency bottleneck is LLM response time, which is controlled by model selection (Haiku vs Sonnet) and prompt caching (6.1).

### 6.11 Outcome-Aligned Evaluation — NOT IMPLEMENTED (Strategic Gap)

**Best practice:** AI evals should test not just message quality ("sounds human," "correct tone") but strategic effectiveness ("advances the conversation toward a booking").

**Current state:** Eval system tests safety (pricing leaks, opt-out retention, identity denial) and quality (sounds human, matches tone, correct length). 120 test cases. No eval tests whether a response would actually move a lead closer to booking.

**Impact:** The agent can produce perfectly polished messages that go nowhere. "Happy to answer any questions!" is well-formed but strategically worthless — it doesn't qualify, educate, or propose.

**What to build:**

Outcome-aligned eval criteria per stage:

| Stage | Good Response Must... | Bad Response... |
|-------|----------------------|----------------|
| `greeting` | Reference their specific request + ask one qualifying question | Generic "thanks for reaching out" with no question |
| `qualifying` | Ask about a MISSING piece of info, not re-ask something already answered | Re-asks what they already told us |
| `educating` | Share a specific differentiator relevant to their project | Generic "we're the best" claims |
| `proposing` | Offer a concrete next step with specifics (time, what happens) | Vague "let us know if you're interested" |
| `objection_handling` | Acknowledge the concern, reframe, propose alternative | Ignore the objection or argue |
| `closing` | Confirm details, set expectations, reduce buyer&apos;s remorse | Nothing actionable |

Eval format: given (stage, conversation history, strategy objective), does the response fulfill the stage criteria?

**Depends on:** Layer 1 (sales methodology) must be populated first — the eval criteria derive from the stage definitions.

---

## 7. Storage Model

### 7.1 New Tables

```sql
-- Layer 2: Locale configurations
CREATE TABLE locale_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale_id VARCHAR(10) NOT NULL UNIQUE,  -- 'ca-ab', 'us-tx'
  name VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,                   -- Full LocaleContext object
  version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Layer 3: Industry playbooks  
CREATE TABLE industry_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id VARCHAR(50) NOT NULL UNIQUE, -- 'basement_development'
  name VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,                    -- Full IndustryPlaybook object
  version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Layer 1: Sales methodology (single row — universal)
CREATE TABLE sales_methodology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL,                    -- Full SalesMethodology object
  version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 Schema Changes to Existing Tables

```sql
-- clients: link to locale and playbook
ALTER TABLE clients ADD COLUMN locale_id VARCHAR(10) DEFAULT 'ca-ab';
ALTER TABLE clients ADD COLUMN playbook_id VARCHAR(50) DEFAULT 'basement_development';

-- lead_context: conversation strategy state
ALTER TABLE lead_context ADD COLUMN conversation_stage VARCHAR(30) DEFAULT 'greeting';
ALTER TABLE lead_context ADD COLUMN stage_turn_count INTEGER DEFAULT 0;
ALTER TABLE lead_context ADD COLUMN strategy_state JSONB;  -- Persisted ConversationStrategy

-- agent_decisions: enhanced tracing
ALTER TABLE agent_decisions ADD COLUMN decision_trace JSONB;  -- DecisionTrace object
ALTER TABLE agent_decisions ADD COLUMN analysis_snapshot JSONB; -- Separated from decision (AUDIT-10)
```

### 7.3 Channel Adaptation

Channel configs are code constants (not DB rows) — they change with engineering decisions, not business decisions:

```typescript
// src/lib/agent/channels.ts
export const CHANNEL_CONFIGS: Record<string, ChannelAdaptation> = {
  sms: { /* ... */ },
  voice: { /* ... */ },
  web_chat: { /* ... */ },
};
```

---

## 8. Feedback Loops and Operational Monitoring

### 8.1 Three Feedback Loops

**Loop 1: Homeowner Behavioral Signals → Agent Improvement**

When homeowners respond positively (re-engage, book, accept estimate) or negatively (opt out, ignore, express frustration) to automated messages, those signals should feed into system improvement.

Implementation:
1. On opt-out with accompanying text ("found someone cheaper, stop texting me"), classify the opt-out reason via regex: `competitor_chosen`, `project_cancelled`, `bad_experience`, `cost`, `not_interested`. Store in `leads.optOutReason`.
2. Weekly cron: aggregate positive vs negative responses to each automation type (win-back, estimate follow-up, no-show recovery). If opt-out rate > 15% for any type, alert operator.
3. Monthly analysis: compare message patterns in successful re-engagements vs opt-outs. Feed winning patterns into playbook updates.

**Loop 2: Contractor Behavioral Signals → System Tuning**

Contractor actions reveal system quality:
- PAUSE command → something went wrong. Log PAUSE duration and context.
- Smart Assist EDIT → AI tone/content was wrong. Analyze correction patterns (AUDIT-05).
- Smart Assist CANCEL → AI shouldn&apos;t have messaged at all. Track cancel rate per category.
- WON/LOST with no AI attribution → system wasn&apos;t part of the conversion path.

Implementation:
1. Track PAUSE-to-RESUME intervals. If average > 24 hours, the contractor is losing trust.
2. AUDIT-05 correction analysis: weekly batch, LLM-summarized patterns per client.
3. Cancel rate per Smart Assist category: if `estimate_followup` cancels > 40%, the templates need revision.

**Loop 3: System Performance Signals → Self-Correction**

Automated anomaly detection with alerting.

### 8.2 Drift Detection and Health Monitoring

Weekly cron (`ai-health-check`) computes:

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| Average confidence delta (vs prior week) | < -10% | < -20% |
| Escalation rate delta | > +50% | > +100% |
| Output guard violation rate | > 3% of messages | > 5% |
| Average response time | > 6s | > 10s |
| Quality-tier usage rate delta | > +50% | > +100% |
| Win-back opt-out rate | > 15% | > 25% |
| Smart Assist correction rate | > 30% | > 50% |
| Voyage fallback rate (ILIKE triggered) | > 10% | > 25% |
| Twilio delivery failure rate | > 2% | > 5% |
| Anthropic API error rate | > 1% | > 5% |

When thresholds breached:
- Warning: logged to `agent_health_reports` table, surfaced on operator dashboard
- Critical: operator SMS alert + dashboard alert + auto-disable affected automation if safe to do so

Data sources: `agentDecisions` (confidence, processing time, model tier), `dailyStats` (message counts), `conversations` (delivery status), `auditLog` (fallback events).

### 8.3 External Dependency Health

Each external API call should track:
- Latency (p50, p95, p99)
- Error rate (4xx, 5xx, timeout)
- Fallback activation rate

Currently tracked: Voyage fallback to ILIKE (implicit). Not tracked: Anthropic latency trend, Twilio carrier filtering trend, Stripe webhook reliability.

Implementation: Add a `dependency_health` table or extend `dailyStats` with per-dependency columns. Populate from existing error handlers (the `catch` blocks already exist — they just log to console, not to a table).

---

## 9. Implementation Sequence

### Phase A: Foundation (Pre-Launch)

| Step | What | Depends On | Effort |
|------|------|-----------|--------|
| A1 | Fix AUDIT-01, 02, 03 (critical pre-launch bugs) | Nothing | Small |
| A2 | Create Layer 1 data model + populate sales methodology | Nothing | Medium |
| A3 | Create Layer 2 data model + populate `ca-ab` locale | Nothing | Medium |
| A4 | Create Layer 3 data model + populate `basement_development` playbook | A2 (needs stage definitions) | Medium |
| A5 | Build strategy resolver (deterministic) | A2 | Medium |
| A6 | Build prompt composer (6-layer assembly) | A2, A3, A4 | Medium |
| A7 | Update `analyzeAndDecide` + `respond` prompts | A5, A6 | Medium |
| A8 | Add prompt caching to AnthropicProvider | A6 | Small |
| A9 | Add prompt versioning to agentDecisions | A6 | Small |
| A10 | Evals: strategy resolver unit tests + updated AI criteria | A5, A7 | Medium |

### Phase B: Learning Loops (First 30 Days)

| Step | What | Depends On | Effort |
|------|------|-----------|--------|
| B1 | AUDIT-05: Smart Assist edit analysis pipeline | Phase A | Medium |
| B2 | AUDIT-11: Signal detection Zod validation | Nothing | Small |
| B3 | Strategic handoff notifications (hot lead alerts) | A5 | Small |
| B4 | Enhanced decision tracing (AUDIT-10) | A9 | Small |
| B5 | Add few-shot examples to basement playbook | A4 | Small |
| B6 | Vision integration for MMS photos | A7 | Medium |
| B7 | Evals in CI for AI-affecting PRs | A10 | Medium |

### Phase C: Optimization (After 5+ Clients)

| Step | What | Depends On | Effort |
|------|------|-----------|--------|
| C1 | AUDIT-06: A/B testing framework | A9 (prompt versioning) | Large |
| C2 | AUDIT-07: Conversation analytics | Phase B | Medium |
| C3 | AUDIT-08: Lead scoring calibration | 200+ leads | Medium |
| C4 | AUDIT-09: Outcome feedback loop | C2 | Medium |
| C5 | Tool use: calendar availability check | A7 | Medium |
| C6 | AUDIT-12: Multi-touch attribution | C2 | Small |
| C7 | AUDIT-13: Structured conversation summary | A7 | Medium |

### Phase D: Expansion (New Trades / Locales)

| Step | What | Depends On | Effort |
|------|------|-----------|--------|
| D1 | Populate `kitchen_bath` playbook | Phase A | Medium |
| D2 | Populate `us-tx` (or first US locale) | Phase A | Medium |
| D3 | Playbook authoring tool (admin UI) | D1 | Large |
| D4 | Model migration framework (shadow + canary) | C1 | Medium |
| D5 | Semantic response caching | C5 | Medium |

---

## 10. Success Metrics

### Leading Indicators (measure immediately)
- **Strategy adherence rate:** % of conversations where the agent followed the resolved strategy vs overrode it
- **Stage progression rate:** % of conversations that advance at least one stage
- **Qualifying completeness:** % of leads with all required info collected before propose stage

### Lagging Indicators (measure after 30+ days)
- **Booking conversion rate:** inquiries → booked estimate visits (primary metric)
- **Time to booking:** average messages / days from first contact to booked appointment
- **Escalation rate:** should decrease as agent becomes more expert
- **Smart Assist correction rate:** should decrease as system learns from edits
- **Output guard violation rate:** should remain stable or decrease

### Comparative Metrics (before/after redesign)
- Conversion rate: current vs post-redesign (need baseline before deploying)
- Average confidence score: should increase as strategy constrains decisions
- Homeowner response rate: should increase if messages are more relevant and driving
- Contractor NPS: qualitative — do contractors feel the system is "smarter"?

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Deterministic strategy is too rigid — misses nuance | Medium | Medium | LLM can override strategy with reasoning logged. Monitor override rate. |
| Layered prompt too long — exceeds context or adds latency | Low | Medium | Token budget per layer enforced. Prompt caching mitigates latency. |
| Playbook data is wrong — bad trade-specific advice | Medium | High | Few-shot examples validated by domain experts (contractors). Playbook versioned and rollback-able. |
| Strategy resolver has edge cases — undefined state transitions | Medium | Low | Graceful degradation to generic strategy. Comprehensive unit tests. |
| Migration disrupts existing agent quality | Medium | High | Deploy behind feature flag. Shadow mode first. A/B test old vs new. |
| Over-engineering — too many layers for current scale | Low | Medium | Layers are data, not code complexity. Empty layer = no impact. |

---

## 12. Cross-Reference

| Topic | Document |
|-------|----------|
| 13 audit issues (bugs, gaps, architecture) | `docs/superpowers/specs/2026-04-13-ai-audit-issues.md` |
| ICP definition | `docs/business-intel/ICP-DEFINITION.md` |
| Current eval system plan | `docs/superpowers/specs/2026-04-12-ai-pipeline-evals-design.md` |
| Current AI pipeline hardening plan | `docs/superpowers/plans/2026-04-12-phase4-eval-system.md` |
| Product strategy | `docs/product/PRODUCT-STRATEGY.md` |
| Platform capabilities (current state) | `docs/product/PLATFORM-CAPABILITIES.md` |
