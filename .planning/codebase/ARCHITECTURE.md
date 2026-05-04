<!-- refreshed: 2026-05-04 -->
# Architecture

**Analysis Date:** 2026-05-04

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Next.js 16 App Router                               │
├───────────────────┬─────────────────────┬───────────────────────────────────┤
│  Admin Dashboard  │   Client Portal      │   Public / Webhooks               │
│  src/app/(dash.)  │  src/app/(client)    │  src/app/api/webhooks/            │
│  src/app/api/     │  src/app/api/client/ │  src/app/api/public/              │
│  admin/           │                      │  src/app/api/cron/                │
└────────┬──────────┴──────────┬───────────┴──────────────┬────────────────────┘
         │                     │                           │
         ▼                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Proxy / Edge Middleware                             │
│                src/proxy.ts  (auth guard, rate limit, sec headers)           │
└─────────────────────────────────────────────────────────────────────────────┘
         │                     │                           │
         ▼                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Route Handler Wrappers (Auth + Error)                  │
│  adminRoute() / adminClientRoute() / portalRoute()                          │
│  src/lib/utils/route-handler.ts                                              │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────┬───────────────────┬────────────────────────────────────┐
│   Services Layer   │  Automations Layer │  Agent Layer (LangGraph)           │
│  src/lib/services/ │  src/lib/automations/ │  src/lib/agent/              │
│  (150+ files)      │  (event triggers)  │  (6-layer AI pipeline)            │
└────────┬───────────┴──────────┬─────────┴────────────┬───────────────────────┘
         │                      │                        │
         ▼                      ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Compliance Gateway (outbound message broker)                │
│                  src/lib/compliance/compliance-gateway.ts                    │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Neon Serverless Postgres via Drizzle ORM                    │
│                  src/db/  (getDb() per request — no cached instance)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File/Path |
|-----------|----------------|-----------|
| Proxy (Edge Middleware) | Cookie auth guards, per-IP rate limiting, security headers | `src/proxy.ts` |
| Route Handler Wrappers | Permission checks, ZodError handling, param resolution, session extraction | `src/lib/utils/route-handler.ts` |
| Admin Dashboard | Agency-operator UI for managing clients, leads, billing, AI quality, analytics | `src/app/(dashboard)/admin/` |
| Client Portal | Contractor-facing UI: conversations, leads, appointments, reports, billing | `src/app/(client)/client/` |
| Auth Routes | Magic link + OTP login flows for admin and portal | `src/app/(auth)/` |
| Admin API | Protected CRUD + action endpoints for agency operators | `src/app/api/admin/` |
| Client Portal API | Protected endpoints scoped to authenticated contractor | `src/app/api/client/` |
| Webhook Handlers | Inbound Twilio SMS/voice, Stripe events, Jobber, form submissions | `src/app/api/webhooks/` |
| Cron Jobs | Scheduled automations (15+ jobs) triggered via Cloudflare Cron + bearer auth | `src/app/api/cron/` |
| Public API | Unauthenticated signup, ROI calculator, onboarding status | `src/app/api/public/` |
| Agent Orchestrator | Main entry point for processing inbound messages through AI pipeline | `src/lib/agent/orchestrator.ts` |
| Agent Graph | LangGraph state machine: analyzeAndDecide → route → respond/escalate/close | `src/lib/agent/graph.ts` |
| Strategy Resolver | Deterministic rule-based conversation strategy (pure function, no LLM) | `src/lib/agent/strategy-resolver.ts` |
| Sales Methodology | Stage definitions, exit conditions, turn limits (Layer 1 of 6-layer arch) | `src/lib/agent/methodology.ts` |
| Compliance Gateway | All outbound SMS broker — enforces consent, quiet hours, usage limits, kill switches | `src/lib/compliance/compliance-gateway.ts` |
| Services | Business logic: billing, AI, leads, knowledge base, embeddings, reporting, etc. | `src/lib/services/` |
| Automations | Event-triggered workflows: incoming SMS routing, follow-ups, reminders | `src/lib/automations/` |
| AI Layer | Provider abstraction (Anthropic), model routing, usage tracking | `src/lib/ai/` |
| Permissions | Agency and portal permission constants + session verification | `src/lib/permissions/` |
| DB Layer | Neon HTTP client creation, schema re-exports | `src/db/` |

## Pattern Overview

**Overall:** Layered Server-Side Rendering + Event-Driven Automation + AI Agent Pipeline

**Key Characteristics:**
- Next.js App Router with route groups: `(auth)`, `(dashboard)`, `(client)` for layout isolation
- All outbound messages route through `sendCompliantMessage()` — compliance is centralized, not per-service
- AI decision-making uses a 6-layer deterministic-first architecture: strategy is rule-based, LLM only generates language
- Route handlers use wrapper functions (`adminRoute`, `portalRoute`) that eliminate boilerplate and enforce auth + error handling uniformly
- Database clients are created per-request via `getDb()` — no module-level singletons

## Layers

**Edge Layer (Proxy):**
- Purpose: Cookie existence checks, per-IP rate limiting, security headers
- Location: `src/proxy.ts`
- Contains: Rate limit map, auth guards, security header injection
- Depends on: NextRequest/NextResponse
- Used by: Every API route (middleware matcher: `/api/:path*`)

**Route Handler Layer:**
- Purpose: Eliminate auth + error boilerplate from every API route
- Location: `src/lib/utils/route-handler.ts`
- Contains: `adminRoute()`, `adminClientRoute()`, `portalRoute()` wrappers
- Depends on: `src/lib/permissions/`, Zod, `src/lib/utils/api-errors.ts`
- Used by: All `/api/admin/*` and `/api/client/*` routes

**Permissions Layer:**
- Purpose: Session extraction and permission enforcement
- Location: `src/lib/permissions/`
- Contains: `requireAgencyPermission()`, `requirePortalPermission()`, `AGENCY_PERMISSIONS`, `PORTAL_PERMISSIONS`, `escalation-guard`
- Depends on: NextAuth (`auth()`), portal session cookies
- Used by: Route handler wrappers, server components

**Services Layer:**
- Purpose: Business logic decoupled from HTTP layer
- Location: `src/lib/services/` (150+ files)
- Contains: AI response, billing, lead scoring, knowledge base, embeddings, reporting, Twilio provisioning, Stripe, usage tracking, etc.
- Depends on: `src/db/`, `src/lib/compliance/`, `src/lib/ai/`
- Used by: API routes, automations, agent orchestrator

**Automations Layer:**
- Purpose: Event-triggered and cron-driven workflows
- Location: `src/lib/automations/` (~30 files)
- Contains: Incoming SMS routing, estimate follow-up, appointment reminders, win-back, no-show recovery, review requests, etc.
- Depends on: Services layer, compliance gateway
- Used by: Webhook handlers (`/api/webhooks/twilio/sms`), cron routes

**Agent Layer:**
- Purpose: AI conversation pipeline for inbound lead handling
- Location: `src/lib/agent/`
- Contains: LangGraph graph, orchestrator, 6-layer pipeline (methodology, playbooks, entry-context, strategy-resolver, prompt-composer, channels), guardrails, output-guard
- Depends on: Services layer, AI layer, compliance gateway, DB
- Used by: `src/lib/automations/incoming-sms.ts` → `processIncomingMessage()`

**AI Layer:**
- Purpose: Provider abstraction, model routing, usage tracking
- Location: `src/lib/ai/`
- Contains: `AnthropicProvider`, `TrackedAIProvider`, `model-routing.ts`, retry logic
- Rule: Agent nodes use `getAIProvider()` raw; all other callers use `getTrackedAI()` for usage tracking

**Compliance Layer:**
- Purpose: All outbound SMS must pass through this — consent, quiet hours, usage limits, kill switches
- Location: `src/lib/compliance/`
- Contains: `compliance-gateway.ts`, `compliance-service.ts`, `quiet-hours-policy.ts`, `dnc-service.ts`, `opt-out-handler.ts`
- Rule: **Never call Twilio directly** — always use `sendCompliantMessage()` from `compliance-gateway.ts`

**Database Layer:**
- Purpose: Neon HTTP client per request + schema definitions
- Location: `src/db/`
- Contains: `index.ts` (`getDb()`), `client.ts`, `schema/` (80+ table files), `transaction.ts`
- Rule: Call `getDb()` inside request handlers — never cache the instance

## Data Flow

### Primary: Inbound SMS → AI Response

1. Twilio POST → `src/app/api/webhooks/twilio/sms/route.ts` (signature validation, dedup check)
2. → `src/lib/automations/incoming-sms.ts` (`handleIncomingSMS`) — opt-out check, lead lookup/create, routing
3. → `src/lib/agent/orchestrator.ts` (`processIncomingMessage`) — loads lead/client/settings, builds context
4. → `src/lib/agent/graph.ts` (`conversationAgent`) — LangGraph: `analyzeAndDecide` → conditional route
5. → `analyzeAndDecide` node calls `resolveStrategy()` (deterministic) + LLM for action decision
6. → `respond` node calls `composeAgentPrompt()` + LLM for message generation + `checkOutputGuardrails()`
7. → back in orchestrator: result dispatched — `sendCompliantMessage()` for SMS, escalation queue, or flow trigger
8. → `src/lib/compliance/compliance-gateway.ts` — consent check, quiet hours, usage limits, kill switch, then `sendSMS()`
9. → DB write: conversation record, agent decision, usage tracking

### Admin API Request Path

1. Browser → `src/proxy.ts` (cookie guard, rate limit)
2. → `src/app/api/admin/[resource]/route.ts`
3. → `adminRoute()` or `adminClientRoute()` wrapper resolves session + permission
4. → Service function in `src/lib/services/`
5. → `getDb()` query via Drizzle
6. → JSON response

### Cron Job Path

1. Cloudflare Cron Trigger → `src/app/api/cron/[job]/route.ts`
2. → `verifyCronSecret()` from `src/lib/utils/cron.ts`
3. → Automation or service function
4. → Messages via `sendCompliantMessage()`, DB writes

**State Management:**
- Server-side only — no global client state store
- Client components use React Query-style polling (SWR or fetch with intervals)
- Agent conversation state is managed by LangGraph's `StateGraph` + `ConversationState` annotation

## Key Abstractions

**ConversationAgent (LangGraph):**
- Purpose: Stateful AI pipeline for a single conversation turn
- Location: `src/lib/agent/graph.ts`, `src/lib/agent/state.ts`
- Pattern: `StateGraph` with nodes: `analyzeAndDecide`, `respond`, `escalate`, `trigger_flow`, `close`, `send_payment`

**Route Handler Wrappers:**
- Purpose: Unified auth, param resolution, and error handling for API routes
- Location: `src/lib/utils/route-handler.ts`
- Pattern: Higher-order functions returning Next.js route handlers with typed context objects (`AdminContext`, `AdminClientContext`, `PortalContext`)

**Compliance Gateway:**
- Purpose: Single chokepoint for all outbound SMS
- Location: `src/lib/compliance/compliance-gateway.ts`
- Pattern: `sendCompliantMessage(params)` — checks consent basis, quiet hours (CASL/TCPA), usage limits, kill switches, DNC list, then delegates to `sendSMS()`

**getDb():**
- Purpose: Fresh Neon HTTP client per request, handles Cloudflare Workers vs. Node environments
- Location: `src/db/index.ts`
- Pattern: Call inside handler body, never at module level

**Permission Constants:**
- Purpose: Typed permission keys for agency and portal
- Location: `src/lib/permissions/constants.ts`
- Pattern: `AGENCY_PERMISSIONS.CLIENTS_VIEW` etc. — imported via `route-handler.ts` re-export

## Entry Points

**Twilio SMS Webhook:**
- Location: `src/app/api/webhooks/twilio/sms/route.ts`
- Triggers: Inbound SMS from any lead
- Responsibilities: Signature validation, dedup, logging, route to `handleIncomingSMS()`

**Twilio Voice Webhook:**
- Location: `src/app/api/webhooks/twilio/voice/route.ts`
- Triggers: Inbound phone calls
- Responsibilities: Ring group, AI voice handling

**Stripe Webhook:**
- Location: `src/app/api/webhooks/stripe/route.ts`
- Triggers: Subscription events, payment events
- Responsibilities: Billing state sync

**Admin Root:**
- Location: `src/app/(dashboard)/admin/page.tsx`
- Triggers: Authenticated admin browser navigation
- Responsibilities: Agency overview dashboard

**Client Portal Root:**
- Location: `src/app/(client)/client/page.tsx`  
- Triggers: Authenticated contractor browser navigation

**Public Signup:**
- Location: `src/app/signup/page.tsx` + `src/app/api/public/signup/route.ts`
- Triggers: Unauthenticated prospect visit

## Architectural Constraints

- **Threading:** Cloudflare Workers edge runtime — single-threaded, no `fs`, no long-running processes
- **Global state:** `rateLimitMap` in `src/proxy.ts` is per-isolate (not globally shared across workers). `conversationAgent` in `src/lib/agent/graph.ts` is a module-level singleton (compiled LangGraph instance — safe, read-only)
- **Circular imports:** None known; services depend on db layer only, agent depends on services layer only
- **DB connections:** `getDb()` must be called per-request — Neon HTTP client does not pool across requests in Workers environment
- **Compliance rule:** All outbound SMS MUST go through `sendCompliantMessage()` — direct `sendSMS()` calls from services are a violation
- **AI tracking rule:** Agent nodes use `getAIProvider()` raw; all other AI callers use `getTrackedAI()` for aggregate usage tracking

## Anti-Patterns

### Direct Twilio calls bypassing compliance

**What happens:** Calling `sendSMS()` from `src/lib/services/twilio.ts` directly from a service or automation
**Why it's wrong:** Skips consent check, quiet hours enforcement, usage limits, kill switches, and DNC check — legal and billing violation
**Do this instead:** Always use `sendCompliantMessage()` from `src/lib/compliance/compliance-gateway.ts`

### Caching getDb() at module level

**What happens:** `const db = getDb()` at the top of a service file (outside a function)
**Why it's wrong:** Neon HTTP client is request-scoped; module-level caching causes connection reuse across requests in Workers, leading to stale state or crashes
**Do this instead:** Call `getDb()` inside the handler or service function body on each invocation

### Using `any` TypeScript type

**What happens:** `as any` casts for jsonb fields or unknown shapes
**Why it's wrong:** Zero-tolerance policy project-wide; breaks type inference downstream
**Do this instead:** Use `as unknown as T` for jsonb→domain narrowing; use schema-inferred types (`Lead`, `Client`), `unknown` with type guards, or explicit interfaces

### Raw Tailwind color utilities in UI

**What happens:** `className="text-blue-500"` or `bg-red-600` in JSX
**Why it's wrong:** Bypasses brand palette — colors must use CSS custom properties or established brand tokens
**Do this instead:** Use brand CSS variables as defined in `.claude/skills/ux-standards/SKILL.md`

## Error Handling

**Strategy:** Centralized at route handler wrapper layer; services throw, handlers catch

**Patterns:**
- ZodError → 400 `{ error: 'Invalid input', details: error.issues }` (auto-handled by wrappers)
- Permission errors → 401/403 via `permissionErrorResponse()` from `src/lib/utils/api-errors.ts`
- Generic errors → `safeErrorResponse()` — logs internally, returns sanitized 500 (no `error.message` leakage)
- Webhook handlers → catch-all with internal error logging via `logInternalError()` from `src/lib/services/internal-error-log.ts`

## Cross-Cutting Concerns

**Logging:** `console.log` with structured objects (no `error.message` in responses — enforced by `quality:logging-guard` gate)
**Validation:** Zod schemas with `.strict()` on all API input; validated before any DB call
**Authentication:** Admin = NextAuth v4 magic links via Resend; Portal = OTP + `clientSessionId` cookie; Cron = bearer token secret; Webhooks = Twilio signature / Stripe signature verification
**Feature Flags:** `resolveFeatureFlag()` from `src/lib/services/feature-flags.ts` — DB-backed per-client flags
**Kill Switches:** `isOpsKillSwitchEnabled()` from `src/lib/services/ops-kill-switches.ts` — operator emergency stops

---

*Architecture analysis: 2026-05-04*
