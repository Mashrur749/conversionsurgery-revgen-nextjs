# Codebase Structure

**Analysis Date:** 2026-05-04

## Directory Layout

```
conversionsurgery-revgen-nextjs/
├── src/
│   ├── app/                    # Next.js App Router — pages + API routes
│   │   ├── (auth)/             # Login/magic link/OTP pages (no layout chrome)
│   │   ├── (client)/           # Contractor portal layout + pages
│   │   ├── (dashboard)/        # Admin dashboard layout + pages
│   │   ├── api/                # All API route handlers
│   │   │   ├── admin/          # Agency-operator REST endpoints
│   │   │   ├── client/         # Contractor portal endpoints
│   │   │   ├── cron/           # Scheduled job endpoints
│   │   │   ├── webhooks/       # Twilio, Stripe, Jobber, form webhooks
│   │   │   ├── public/         # Unauthenticated endpoints
│   │   │   ├── sequences/      # Automation sequence triggers
│   │   │   ├── escalations/    # Escalation management
│   │   │   ├── leads/          # Lead management (portal-scoped)
│   │   │   └── webhooks/       # External service webhooks
│   │   ├── d/[token]/          # Short-link redirect page
│   │   ├── payment/            # Public payment page
│   │   ├── signup/             # Self-serve signup flow
│   │   └── terms/              # Terms of service page
│   ├── components/             # Shared React components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── admin/              # Admin-only components
│   │   ├── billing/            # Billing UI components
│   │   ├── compliance/         # Compliance UI components
│   │   ├── leads/              # Lead management components
│   │   ├── flows/              # Automation flow components
│   │   ├── calendar/           # Calendar UI components
│   │   ├── analytics/          # Analytics chart components
│   │   ├── escalations/        # Escalation management components
│   │   ├── media/              # Media/attachment components
│   │   └── payments/           # Payment UI components
│   ├── db/                     # Database layer
│   │   ├── index.ts            # getDb() factory + re-exports
│   │   ├── client.ts           # Neon HTTP client creation
│   │   ├── schema/             # One file per table (~80 files)
│   │   │   ├── index.ts        # Re-exports all tables
│   │   │   └── relations.ts    # Drizzle relation definitions
│   │   ├── transaction.ts      # withTransaction() helper
│   │   ├── types.ts            # Shared DB types
│   │   └── seeds/              # Seed data scripts
│   ├── lib/                    # All business logic
│   │   ├── agent/              # AI conversation agent (LangGraph)
│   │   │   ├── orchestrator.ts # Main entry: processIncomingMessage()
│   │   │   ├── graph.ts        # LangGraph state machine
│   │   │   ├── state.ts        # ConversationState annotation
│   │   │   ├── strategy-resolver.ts  # Deterministic strategy (pure fn)
│   │   │   ├── methodology.ts  # Sales stages + exit conditions
│   │   │   ├── prompt-composer.ts    # Final prompt assembly
│   │   │   ├── context-builder.ts    # Knowledge context loading
│   │   │   ├── entry-context.ts      # Conversation entry state
│   │   │   ├── guardrails.ts         # Input guardrails
│   │   │   ├── output-guard.ts       # Output validation
│   │   │   ├── channels.ts           # Channel config
│   │   │   ├── nodes/                # LangGraph node implementations
│   │   │   │   ├── analyze-and-decide.ts
│   │   │   │   └── respond.ts
│   │   │   ├── playbooks/            # Industry playbooks
│   │   │   └── locales/              # Locale-specific rules
│   │   ├── ai/                 # AI provider abstraction
│   │   │   ├── index.ts        # getAIProvider(), getTrackedAI()
│   │   │   ├── providers/      # AnthropicProvider
│   │   │   ├── tracked.ts      # TrackedAIProvider (usage tracking)
│   │   │   ├── model-routing.ts # selectModelTier()
│   │   │   └── types.ts        # AIProvider interface
│   │   ├── automations/        # Event-triggered workflows (~30 files)
│   │   │   ├── incoming-sms.ts # SMS webhook router (main dispatcher)
│   │   │   ├── estimate-followup.ts
│   │   │   ├── appointment-reminder.ts
│   │   │   ├── win-back.ts
│   │   │   └── ...             # All other automation files
│   │   ├── billing/            # Billing queries + actions
│   │   │   ├── queries.ts
│   │   │   └── actions.ts
│   │   ├── clients/            # Client management utilities
│   │   ├── compliance/         # Compliance enforcement
│   │   │   ├── compliance-gateway.ts   # sendCompliantMessage() — required chokepoint
│   │   │   ├── compliance-service.ts
│   │   │   ├── quiet-hours-policy.ts
│   │   │   ├── dnc-service.ts
│   │   │   └── opt-out-handler.ts
│   │   ├── config/             # Static config (API costs, etc.)
│   │   ├── constants/          # App-wide constants
│   │   ├── features/           # Feature flag resolution
│   │   ├── hooks/              # Custom React hooks
│   │   ├── permissions/        # Auth + permission enforcement
│   │   │   ├── constants.ts    # AGENCY_PERMISSIONS, PORTAL_PERMISSIONS
│   │   │   ├── require-agency-permission.ts
│   │   │   ├── require-portal-permission.ts
│   │   │   └── escalation-guard.ts
│   │   ├── services/           # Core business logic (~150+ files)
│   │   ├── types/              # Shared TypeScript types
│   │   └── utils/              # Pure utility functions
│   │       ├── route-handler.ts  # adminRoute(), portalRoute() wrappers
│   │       ├── api-errors.ts
│   │       ├── phone.ts          # normalizePhoneNumber()
│   │       ├── text.ts
│   │       ├── cron.ts           # verifyCronSecret()
│   │       └── webhook-url.ts
│   ├── auth.ts                 # NextAuth v4 config (admin)
│   ├── proxy.ts                # Edge middleware (rate limit, auth guard, headers)
│   ├── hooks/                  # App-level React hooks
│   ├── scripts/                # Build/maintenance scripts
│   └── types/                  # Global TypeScript declarations
├── .planning/codebase/         # Codebase map documents (this dir)
├── .claude/                    # Claude agent config, skills, hooks
├── .agents/                    # Agent skill definitions
├── docs/                       # Product, engineering, ops documentation
├── drizzle/                    # Generated Drizzle migration files
├── public/                     # Static assets
├── next.config.ts              # Next.js configuration
├── open-next.config.ts         # Cloudflare deployment config
├── drizzle.config.ts           # Drizzle ORM config
├── tailwind.config.ts          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
└── vitest.config.ts            # Vitest test config
```

## Directory Purposes

**`src/app/(auth)/`:**
- Purpose: Authentication pages — magic link login, OTP verify, claim link, error states
- Contains: Page components only, no business logic
- Key files: `login/page.tsx`, `verify/page.tsx`, `client-login/page.tsx`, `claim/page.tsx`

**`src/app/(dashboard)/admin/`:**
- Purpose: Agency operator dashboard — all admin UI pages
- Contains: Page and layout components, `_components/` subdirs for page-local components
- Key files: `admin/page.tsx` (overview), `admin/clients/[id]/` (per-client management)

**`src/app/(client)/client/`:**
- Purpose: Contractor-facing portal — conversations, leads, reports, billing, settings
- Contains: Page components + page-local components
- Key files: `conversations/page.tsx`, `leads/page.tsx`, `billing/page.tsx`, `onboarding/page.tsx`

**`src/app/api/admin/`:**
- Purpose: All agency-operator REST endpoints
- Contains: `route.ts` files using `adminRoute()` or `adminClientRoute()` wrappers
- Pattern: `/api/admin/clients/[id]/[resource]/route.ts` for client-scoped resources

**`src/app/api/webhooks/`:**
- Purpose: Inbound events from external services
- Contains: Twilio SMS/voice/status, Stripe, Jobber, form submission handlers
- Pattern: Each handler validates signature before processing

**`src/app/api/cron/`:**
- Purpose: Scheduled automation endpoints called by Cloudflare Cron
- Contains: 15+ cron handlers; all call `verifyCronSecret()` before executing
- Key files: `weekly-summary/`, `win-back/`, `trial-reminders/`, `stripe-reconciliation/`, `send-nps/`

**`src/db/schema/`:**
- Purpose: One Drizzle table definition per file
- Contains: ~80 table files + `index.ts` re-export + `relations.ts`
- Pattern: Each file exports `typeof table.$inferSelect` as `TableName` and `typeof table.$inferInsert` as `NewTableName`

**`src/lib/agent/`:**
- Purpose: 6-layer AI conversation pipeline
- Layer 1 - `methodology.ts`: Sales stage definitions (pure config)
- Layer 2 - `playbooks/`: Industry-specific playbook config
- Layer 3 - `entry-context.ts`: Conversation entry state resolution
- Layer 4 - `strategy-resolver.ts`: Deterministic strategy (pure function)
- Layer 5 - `prompt-composer.ts`: Final LLM prompt assembly
- Layer 6 - `channels.ts`: Channel-specific message constraints

**`src/lib/services/`:**
- Purpose: All business logic — largest directory in codebase
- Contains: One service concern per file; 150+ files covering AI response, billing, knowledge base, lead scoring, reporting, Twilio provisioning, Stripe, etc.
- Pattern: Functions exported directly (no class instances); DB via `getDb()` inside each function

**`src/lib/automations/`:**
- Purpose: Event-triggered and scheduled automation workflows
- Contains: ~30 automation files; each exports a trigger function
- Key files: `incoming-sms.ts` (main SMS router), `estimate-followup.ts`, `win-back.ts`, `appointment-reminder.ts`

**`src/components/ui/`:**
- Purpose: shadcn/ui primitive components
- Contains: Button, Card, Dialog, Select, Input, Badge, etc.
- Rule: Install new ones with `pnpm dlx shadcn@latest add <component>`

## Key File Locations

**Entry Points:**
- `src/proxy.ts`: Edge middleware — first code to run on every API request
- `src/auth.ts`: NextAuth v4 configuration for admin auth
- `src/lib/agent/orchestrator.ts`: `processIncomingMessage()` — AI pipeline entry
- `src/app/api/webhooks/twilio/sms/route.ts`: SMS inbound entry
- `src/lib/automations/incoming-sms.ts`: `handleIncomingSMS()` — automation dispatcher

**Configuration:**
- `next.config.ts`: Next.js config
- `open-next.config.ts`: Cloudflare Workers deployment config
- `drizzle.config.ts`: DB connection + migrations config
- `vitest.config.ts`: Test runner config

**Core Logic:**
- `src/lib/utils/route-handler.ts`: `adminRoute()`, `adminClientRoute()`, `portalRoute()`
- `src/lib/compliance/compliance-gateway.ts`: `sendCompliantMessage()` — required for all outbound SMS
- `src/db/index.ts`: `getDb()` — required DB access pattern
- `src/lib/permissions/constants.ts`: `AGENCY_PERMISSIONS`, `PORTAL_PERMISSIONS`
- `src/lib/ai/index.ts`: `getAIProvider()`, `getTrackedAI()`

**Testing:**
- `vitest.config.ts`: Test config
- `src/lib/agent/*.test.ts`: Agent unit tests (co-located)
- `src/lib/services/*.test.ts`: Service unit tests (co-located)
- `src/lib/agent/*.ai-test.ts`: AI scenario tests (excluded from `pnpm test`, run via `pnpm run test:ai`)

## Naming Conventions

**Files:**
- kebab-case for all source files: `lead-scoring.ts`, `route-handler.ts`
- `*.test.ts` for Vitest unit tests (co-located with source)
- `*.ai-test.ts` for AI/LLM scenario tests (co-located, excluded from default test run)
- `route.ts` for Next.js App Router route handlers

**Directories:**
- kebab-case: `compliance-gateway`, `lead-context`, `quarterly-campaigns`
- Route groups with parens: `(auth)`, `(dashboard)`, `(client)`
- Dynamic segments with brackets: `[id]`, `[token]`
- Page-local component dirs: `_components/` (prefixed underscore)

**Database Schema:**
- Table files: `src/db/schema/[table-name].ts` (plural, kebab-case)
- Exported types: `PascalCase` singular for select type, `NewPascalCase` for insert type
- Example: `leads.ts` exports `Lead` and `NewLead`

**Components:**
- PascalCase filenames for components: `NotificationBell.tsx` → actually kebab: `notification-bell.tsx`
- All component files are kebab-case matching shadcn convention

## Where to Add New Code

**New API Route (admin):**
- Create: `src/app/api/admin/[resource]/route.ts`
- Use: `adminRoute()` or `adminClientRoute()` from `src/lib/utils/route-handler.ts`
- Validate: Zod schema with `.strict()`

**New API Route (client portal):**
- Create: `src/app/api/client/[resource]/route.ts`
- Use: `portalRoute()` from `src/lib/utils/route-handler.ts`

**New Business Logic Service:**
- Create: `src/lib/services/[feature-name].ts`
- Export functions directly (no class instances)
- Call `getDb()` inside each function

**New Automation:**
- Create: `src/lib/automations/[trigger-name].ts`
- Export a trigger function
- Route to it from `src/lib/automations/incoming-sms.ts` or relevant cron handler

**New Cron Job:**
- Create: `src/app/api/cron/[job-name]/route.ts`
- Call `verifyCronSecret()` from `src/lib/utils/cron.ts` first
- Register in Cloudflare Cron config

**New DB Table:**
- Create: `src/db/schema/[table-name].ts`
- Re-export from: `src/db/schema/index.ts`
- Run: `pnpm run db:generate` → review SQL → ask user before `db:push`

**New UI Page (admin):**
- Create: `src/app/(dashboard)/admin/[feature]/page.tsx`
- Max width: `max-w-7xl`
- Add breadcrumbs via `src/components/breadcrumbs.tsx`

**New UI Page (client portal):**
- Create: `src/app/(client)/client/[feature]/page.tsx`
- Max width: `max-w-3xl`

**New Shared Component:**
- Create: `src/components/[feature]/[component-name].tsx`
- UI primitives: `src/components/ui/` (shadcn only)

**Unit Tests:**
- Co-locate: `src/lib/[layer]/[filename].test.ts`
- AI scenario tests: `src/lib/[layer]/[filename].ai-test.ts`

## Special Directories

**`.planning/codebase/`:**
- Purpose: Codebase map documents for agent/planner consumption
- Generated: Yes (by gsd-map-codebase)
- Committed: Yes

**`.claude/`:**
- Purpose: Claude agent configuration, skills, hooks, scripts, plans
- Generated: No (manually maintained)
- Committed: Yes

**`.agents/`:**
- Purpose: Agent skill definitions (mirrors `.claude/skills/`)
- Generated: No
- Committed: Yes

**`drizzle/`:**
- Purpose: Generated Drizzle migration SQL files
- Generated: Yes (by `pnpm run db:generate`)
- Committed: Yes

**`.next/` and `.open-next/`:**
- Purpose: Build output
- Generated: Yes
- Committed: No

**`graphify-out/`:**
- Purpose: Knowledge graph of codebase (AST-based)
- Generated: Yes (by `graphify update .`)
- Committed: No (gitignored)

---

*Structure analysis: 2026-05-04*
