# Technology Stack

**Analysis Date:** 2026-05-04

## Languages

**Primary:**
- TypeScript 5.7.x - All application code in `src/`
- TSX - React components throughout `src/app/` and `src/components/`

**Secondary:**
- JavaScript (`.mjs`) - Build scripts, doc sync (`scripts/docmost-sync/`)
- Shell (`.sh`) - Quality gates and CI scripts in `scripts/`

## Runtime

**Environment:**
- Node.js 20.x (inferred from `@types/node: ^20`)

**Package Manager:**
- pnpm (scripts use `pnpm exec`)
- Lockfile: present (`pnpm-lock.yaml`)

## Frameworks

**Core:**
- Next.js 16.1.5 - App Router, React Server Components, API routes
- React 19.1.5 - UI rendering
- NextAuth v5.0.0-beta.30 (next-auth) - Admin authentication via email magic links

**AI/Orchestration:**
- `@anthropic-ai/sdk` ^0.78.0 - Claude AI responses and agent behavior
- `@langchain/langgraph` ^1.1.4 - AI agent graph/state machine orchestration
- `@langchain/core` ^1.1.20 - LangChain base abstractions

**Testing:**
- Vitest ^4.0.18 - Unit test runner (`src/**/*.test.ts`)
- `vitest.config.ts` — excludes `*.ai-test.ts` (run separately)
- `vitest.ai.config.ts` — AI/scenario tests requiring live Anthropic API

**Build/Dev:**
- `@opennextjs/cloudflare` ^1.16.3 - Cloudflare Workers deployment adapter
- Wrangler ^4.63.0 - Cloudflare dev server and deploy CLI
- Drizzle Kit ^0.31.8 - DB migration generation and schema push
- TypeScript tsc - Type checking (`pnpm run typecheck`)
- ESLint 9 + `eslint-config-next` - Linting (`eslint.config.mjs`)
- Husky ^9.1.7 - Git hooks (pre-commit, pre-push)

## Key Dependencies

**Critical:**
- `drizzle-orm` ^0.45.1 - ORM layer; all DB access via `getDb()` from `@/db`
- `@neondatabase/serverless` ^1.0.2 - Neon Postgres HTTP client (edge-compatible)
- `stripe` ^20.3.1 - Billing, subscriptions, payment links, webhooks
- `twilio` ^5.12.1 - SMS, Voice, ring groups, verification
- `zod` ^4.3.6 - Runtime validation on all API inputs

**UI:**
- `radix-ui` ^1.4.3 - Headless component primitives (shadcn/ui foundation)
- `shadcn` ^3.8.4 (devDep) - Component installer CLI
- Tailwind CSS 4 + `@tailwindcss/postcss` - Utility-first CSS
- `lucide-react` ^0.563.0 - Icon set
- `recharts` ^3.7.0 - Charts for dashboards
- `sonner` ^2.0.7 - Toast notifications
- `cmdk` ^1.1.1 - Command palette

**Utilities:**
- `date-fns` ^4.1.0 + `date-fns-tz` ^3.2.0 - Date manipulation with timezone support
- `libphonenumber-js` ^1.12.36 - Phone normalization (`normalizePhoneNumber()`)
- `class-variance-authority` ^0.7.1 + `clsx` ^2.1.1 + `tailwind-merge` ^3.4.0 - Style composition
- `sharp` ^0.34.5 - Image processing for R2 uploads
- `ws` ^8.19.0 - WebSocket support

**Storage/Cloud:**
- `@aws-sdk/client-s3` ^3.985.0 + `@aws-sdk/s3-request-presigner` ^3.985.0 - Cloudflare R2 via S3 API
- `googleapis` ^171.4.0 - Google Business Profile and Google Calendar APIs

## Configuration

**Environment:**
- Required vars validated at startup via `src/lib/env.ts` using Zod schema
- Validation skipped during `next build` (`NEXT_PHASE === 'phase-production-build'`)
- Required: `DATABASE_URL`, `AUTH_SECRET`, `CLIENT_SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `CRON_SECRET`
- Optional: R2 vars, Google vars, `ELEVENLABS_API_KEY`, `SLACK_WEBHOOK_URL`, `EMAIL_FROM`, `FORM_WEBHOOK_SECRET`

**Build:**
- `next.config.ts` - Turbopack dev, security headers on non-API routes
- `open-next.config.ts` - Cloudflare Workers adapter config
- `tsconfig.json` - `strict: true`, `target: es2024`, path alias `@/*` → `src/*`
- `drizzle.config.ts` - Schema at `src/db/schema/index.ts`, migrations in `drizzle/`
- `cloudflare-env.d.ts` - Cloudflare environment bindings type definition

## Platform Requirements

**Development:**
- pnpm (required — not npm/yarn)
- Node.js 20+
- `.env.local` for local credentials (loaded by `drizzle.config.ts`)
- Wrangler for Cloudflare local simulation (`pnpm run cf:dev`)

**Production:**
- Cloudflare Workers (via OpenNext adapter)
- Deploy: `pnpm run cf:deploy` (builds then runs `wrangler deploy`)
- Build command: `pnpm run build` (standard Next.js) or `pnpm run cf:build` (Cloudflare)

---

*Stack analysis: 2026-05-04*
