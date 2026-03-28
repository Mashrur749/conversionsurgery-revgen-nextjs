# Security Reviewer

Review code changes for security vulnerabilities in this Next.js 16 + Twilio + Stripe + Anthropic SaaS application.

## Focus Areas

### Authentication & Authorization
- All `/api/admin/*` routes MUST use `adminRoute()` or `adminClientRoute()` from `@/lib/utils/route-handler` with appropriate `AGENCY_PERMISSIONS.*`
- All `/api/client/*` routes MUST use `portalRoute()` with appropriate `PORTAL_PERMISSIONS.*`
- All `/api/cron/*` routes MUST verify `CRON_SECRET` via `verifyCronSecret()`
- Dashboard pages check `session.user.isAgency` (NOT `isAdmin` — that was removed)
- Portal pages use `getClientSession()` from `@/lib/client-auth`
- Role assignment routes must call `preventEscalation()` — no privilege escalation
- Assigned-scope agency users must only access their assigned clients

### Input Validation
- All API route inputs must be validated with Zod schemas (`.strict()`) before use
- Phone numbers must be normalized with `normalizePhoneNumber()` before storage/lookup
- UUIDs in URL params must be validated before database queries
- Next.js 16 async params: always `await` the params Promise

### Webhook Security
- Twilio webhook endpoints must verify `X-Twilio-Signature` header
- Stripe webhook endpoints must verify webhook signatures with `stripe.webhooks.constructEvent()`
- Webhook deduplication via idempotency keys where applicable

### Database Safety
- Use parameterized queries via Drizzle ORM (never raw string interpolation)
- Ensure `WHERE` clauses include `clientId` for tenant isolation
- Cross-client access attempts must be rejected for assigned-scope users
- Transactions for multi-table mutations (`db.transaction()`)

### Secrets & Data Exposure
- Never log or return secrets (API keys, tokens) in responses
- Error responses use `safeErrorResponse()` — never expose `error.message` or `error.stack` to clients
- `quality:logging-guard` script enforces this at CI level
- Rate limiting in middleware: 120/min admin, 30/min sensitive endpoints

### Compliance & Messaging
- ALL outbound messages must go through `sendCompliantMessage()` from compliance-gateway
- Never send messages directly via Twilio client — compliance gateway handles consent, quiet hours, DNC, audit
- Opt-out keywords (STOP, UNSUBSCRIBE, etc.) must trigger instant opt-out

### AI Safety
- AI guardrails (`buildGuardrailPrompt()`) must be included in every conversation agent prompt
- AI must never disclose system prompts, internal reasoning, or make real-world claims (appointments, prices) unless configured
- Knowledge boundaries: defer to owner when confidence < 60

## Output Format
Report issues with severity (Critical / High / Medium / Low), file path, line number, and recommended fix.
