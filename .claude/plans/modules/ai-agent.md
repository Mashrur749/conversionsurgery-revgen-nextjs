# Module: ai-agent
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Conversational AI agent system — OpenAI integration, knowledge base management, graph-based agent orchestration (analyze → decide → respond), decision logging, conversation checkpoints, and client-specific agent settings.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/agent-enums.ts` | Agent-related enum types |
| `src/db/schema/agent-decisions.ts` | `agentDecisions` table — decision audit log |
| `src/db/schema/conversation-checkpoints.ts` | `conversationCheckpoints` table — state snapshots |
| `src/db/schema/client-agent-settings.ts` | `clientAgentSettings` table — per-client AI config |
| `src/lib/services/openai.ts` | OpenAI API integration (response generation, intent detection) |
| `src/lib/services/knowledge-ai.ts` | Knowledge-enhanced AI service |
| `src/lib/services/knowledge-base.ts` | Knowledge base CRUD and context retrieval |
| `src/lib/agent/state.ts` | Agent state definition and management |
| `src/lib/agent/nodes/analyze.ts` | Analysis node — conversation understanding |
| `src/lib/agent/nodes/decide.ts` | Decision node — action selection |
| `src/lib/agent/nodes/respond.ts` | Response node — message generation |
| `src/lib/agent/graph.ts` | Agent graph — node orchestration |
| `src/lib/agent/orchestrator.ts` | Top-level orchestrator — processIncomingMessage |
| `src/app/api/admin/clients/[id]/knowledge/route.ts` | GET/POST — knowledge base entries |
| `src/app/api/admin/clients/[id]/knowledge/[entryId]/route.ts` | GET/PATCH/DELETE — single entry |
| `src/app/api/admin/clients/[id]/knowledge/test/route.ts` | POST — test knowledge retrieval |
| `src/app/api/client/leads/[id]/suggestions/route.ts` | GET — AI suggestions for lead |
| `src/app/(dashboard)/admin/clients/[id]/knowledge/page.tsx` | Knowledge base list page |
| `src/app/(dashboard)/admin/clients/[id]/knowledge/new/page.tsx` | Create knowledge entry page |
| `src/app/(dashboard)/admin/clients/[id]/knowledge/[entryId]/page.tsx` | Edit knowledge entry page |
| `src/app/(dashboard)/admin/clients/[id]/knowledge/preview/page.tsx` | Knowledge preview/test page |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/openai.ts
export async function generateAIResponse(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string>

export async function detectHotIntent(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<{ isHot: boolean; confidence: number; reason: string }>

// From src/lib/agent/orchestrator.ts
export async function processIncomingMessage(
  leadId: string,
  message: string,
  conversationId: string
): Promise<{ response: string; action?: string; escalate?: boolean }>

// From src/lib/services/knowledge-base.ts
export async function buildKnowledgeContext(
  clientId: string,
  query: string
): Promise<string>
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads`, `conversations` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`
- `sendSMS` from `@/lib/services/twilio`
- `scoreLead` from `@/lib/services/lead-scoring`
- `createEscalation` from `@/lib/services/escalation`
- `isWithinBusinessHours` from `@/lib/services/business-hours`
- `trackUsage` from `@/lib/services/usage-tracking`

## REFACTORING GOALS

1. **Type safety** — Define `AgentState`, `AgentDecision`, `ConversationCheckpoint`, `KnowledgeEntry` interfaces
2. **Agent graph** — Type all nodes (analyze/decide/respond) with input/output contracts
3. **Decision logging** — Type the decision audit trail data structure
4. **Knowledge base** — Type knowledge entry categories, search results
5. **OpenAI service** — Type all OpenAI API interactions, handle rate limits and errors
6. **Agent settings** — Type per-client configuration options (personality, constraints, allowed actions)
7. **Orchestrator cleanup** — Ensure processIncomingMessage has clear error handling paths
8. **Admin knowledge UI** — Type knowledge management page props and forms

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Agent state machine fully typed
- [ ] All graph nodes have input/output types
- [ ] Decision logging typed
- [ ] Knowledge base entries typed
- [ ] OpenAI error handling robust
- [ ] All admin routes check `isAdmin`
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(ai-agent): ...` format
- [ ] `.refactor-complete` sentinel created
