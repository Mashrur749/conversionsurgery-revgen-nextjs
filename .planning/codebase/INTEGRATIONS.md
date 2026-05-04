# External Integrations

**Analysis Date:** 2026-05-04

## APIs & External Services

**AI:**
- Anthropic Claude - AI conversation agent, guardrails, model routing, knowledge-gap validation
  - SDK/Client: `@anthropic-ai/sdk`
  - Auth: `ANTHROPIC_API_KEY`
  - Usage: `getTrackedAI()` for most callers; `getAIProvider()` raw in agent nodes only
  - Files: `src/lib/services/ai-response.ts`, `src/lib/services/knowledge-ai.ts`, `src/lib/services/ai-attribution.ts`

- ElevenLabs - Text-to-speech for Voice AI
  - SDK/Client: Direct REST (`https://api.elevenlabs.io/v1`)
  - Auth: `ELEVENLABS_API_KEY` (optional)
  - File: `src/lib/services/elevenlabs.ts`

**Communications:**
- Twilio - SMS, Voice, ring groups, call forwarding, number provisioning, verification
  - SDK/Client: `twilio` npm package
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - Public number: `TWILIO_PHONE_NUMBER`
  - Webhook base: `TWILIO_WEBHOOK_BASE_URL`
  - Files: `src/lib/services/twilio.ts`, `src/lib/services/twilio-provisioning.ts`, `src/lib/services/ring-group.ts`
  - All outbound messages MUST use `sendCompliantMessage()` from compliance-gateway — never call Twilio directly

- Resend - Transactional email (magic links, billing emails, onboarding notifications)
  - SDK/Client: `resend` npm package
  - Auth: `RESEND_API_KEY`
  - From address: `EMAIL_FROM` (defaults to `onboarding@resend.dev`)
  - File: `src/lib/services/resend.ts`

**Notifications:**
- Slack - Internal support notifications via incoming webhook
  - SDK/Client: Direct `fetch` to webhook URL
  - Auth: `SLACK_WEBHOOK_URL` (optional)
  - File: `src/lib/services/slack.ts`

**External Platforms:**
- Google Business Profile - Review monitoring, review responses, OAuth token refresh
  - SDK/Client: `googleapis` npm package
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (OAuth2); `GOOGLE_PLACES_API_KEY`
  - Callback: `src/app/api/auth/callback/google-business/route.ts`
  - File: `src/lib/services/google-business.ts`

- Google Calendar - Appointment/calendar sync
  - SDK/Client: `googleapis` npm package
  - Auth: Same Google OAuth credentials
  - Callback: `src/app/api/auth/callback/google-calendar/route.ts`

- Jobber - Field service management integration
  - SDK/Client: Webhook receiver
  - Webhook endpoint: `src/app/api/webhooks/jobber/route.ts`

## Data Storage

**Databases:**
- Neon Serverless Postgres - Primary datastore
  - Connection: `DATABASE_URL`
  - Client: `@neondatabase/serverless` HTTP driver (edge-compatible)
  - ORM: Drizzle ORM
  - Pattern: `getDb()` from `@/db` — creates new HTTP client per request, never cached
  - Schema: `src/db/schema/` (one file per table, re-exported from `index.ts`)
  - Migrations: `drizzle/` directory, managed via `drizzle-kit`

**File Storage:**
- Cloudflare R2 - Media uploads (images, attachments)
  - SDK/Client: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (S3-compatible API)
  - Auth: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  - Bucket: `R2_BUCKET_NAME`
  - Public URL: `R2_PUBLIC_URL`
  - File: `src/lib/services/storage.ts`

**Caching:**
- None (Neon HTTP client is stateless per request)

## Authentication & Identity

**Admin Auth Provider:**
- NextAuth v5 (beta) with Drizzle adapter
  - Implementation: Email magic links via Resend
  - Session storage: Database (`sessions` table via `@auth/drizzle-adapter`)
  - Session lookup: `src/lib/auth-session.ts` — reads `next-auth.session-token` cookie
  - Config: `src/app/api/auth/[...nextauth]/route.ts`
  - Server components: `auth()` from `@/lib/auth`

**Client Portal Auth:**
- Custom session system (separate from NextAuth)
  - Session secret: `CLIENT_SESSION_SECRET`
  - Server components: `getClientSession()` from `@/lib/client-auth`
  - API routes: `portalRoute()` wrapper from `@/lib/utils/route-handler`

**Route Protection:**
- `adminRoute()` / `adminClientRoute()` — admin API routes (`/api/admin/*`)
- `portalRoute()` — client portal API routes (`/api/client/*`)
- `verifyCronSecret()` — cron routes (`/api/cron/*`)
- Webhook signature verification — webhook routes (`/api/webhooks/*`)
- All wrappers importable from `@/lib/utils/route-handler`

## Billing

**Stripe - Subscription billing, payment links, invoices**
- SDK/Client: `stripe` npm package (API version `2026-01-28.clover`)
- Auth: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Webhook secret: `STRIPE_WEBHOOK_SECRET`
- Frontend: `@stripe/react-stripe-js`, `@stripe/stripe-js`
- Webhook endpoint: `src/app/api/webhooks/stripe/route.ts`
- Files: `src/lib/services/stripe.ts`, `src/lib/services/billing-policy.ts`, `src/lib/services/subscription-invoices.ts`, `src/lib/services/overage-billing.ts`, `src/lib/services/addon-pricing.ts`

## Monitoring & Observability

**Error Tracking:**
- Internal error log table in Postgres (no external service)
- File: `src/lib/services/internal-error-log.ts`

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout
- Quality gate blocks direct `error.message`/`error.stack` leaks in API responses (`pnpm run quality:logging-guard`)

**AI Effectiveness:**
- Custom metrics tracked in DB: `src/lib/services/ai-effectiveness-metrics.ts`, `src/lib/services/ai-attribution.ts`
- AI feedback: `src/lib/services/ai-feedback.ts`

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers (via `@opennextjs/cloudflare` adapter)
- Deploy: `pnpm run cf:deploy`

**CI Pipeline:**
- Husky pre-commit / pre-push hooks (`pnpm run quality:install-agent-hooks`)
- Quality gates: `pnpm run quality:no-regressions` (standard), `pnpm run quality:feature-sweep` (release)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/twilio/sms` — inbound SMS
- `POST /api/webhooks/twilio/agency-sms` — agency-level SMS
- `POST /api/webhooks/twilio/status` — SMS delivery status
- `POST /api/webhooks/twilio/voice` — inbound voice calls
- `POST /api/webhooks/twilio/ring-connect` — ring group connect
- `POST /api/webhooks/twilio/ring-result` — ring group result
- `POST /api/webhooks/twilio/ring-status` — ring group status
- `POST /api/webhooks/twilio/agency-voice` — agency voice
- `POST /api/webhooks/twilio/member-answered` — ring group member answered
- `POST /api/webhooks/twilio/voice/ai` — Voice AI session
- `POST /api/webhooks/twilio/voice/ai/session-end` — Voice AI session end
- `POST /api/webhooks/twilio/voice/ai/dial-complete` — Voice AI dial complete
- `POST /api/webhooks/twilio/verification-status` — number verification
- `POST /api/webhooks/stripe` — Stripe events (subscriptions, invoices, disputes)
- `POST /api/webhooks/jobber` — Jobber field service events
- `POST /api/webhooks/form` — lead capture form submissions (auth: `FORM_WEBHOOK_SECRET`)

**Outgoing:**
- Slack incoming webhook (`SLACK_WEBHOOK_URL`) — support notifications
- Webhook dispatch system: `src/lib/services/webhook-dispatch.ts`

## Cron Jobs

46 scheduled jobs at `/api/cron/*`, all protected by `CRON_SECRET`. Key jobs:
- `stripe-reconciliation` — billing sync
- `monthly-reset` — usage reset
- `biweekly-reports` — client report delivery
- `auto-review-response` — Google review auto-reply
- `ai-mode-progression` — AI autonomy level changes
- `guarantee-check` / `guarantee-alert` — money-back guarantee monitoring
- `heartbeat-check` — system health

## Automation Integration

**n8n** (`n8n-internal.conversionsurgery.io`) - Lead acquisition pipeline (external, not in this codebase)
- 6 workflows (CS 0-5): lead sourcing, AI enrichment, audit generation, Instantly.ai campaigns
- MCP access via `.mcp.json` (gitignored)
- Google Sheet: `1p4IbPtuJjftVIViUmFfz0iWuCxu5JakiTEn4F9pBm4Q`

---

*Integration audit: 2026-05-04*
