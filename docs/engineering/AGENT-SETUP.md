# Agent Environment Setup

One-command recovery guide for the ConversionSurgery Revenue Recovery agent environment.

> **Goal:** Go from a blank machine to a working agent session in under 10 minutes.

---

## Prerequisites

| Tool | Version | Install Command |
|------|---------|-----------------|
| Node.js | 20.x | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| pnpm | 9.x+ | `npm install -g pnpm` |
| git | 2.40+ | `brew install git` (macOS) or `apt install git` (Linux) |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Kimi CLI | latest | See [kimi-cli docs](https://github.com/moonshot-ai/Kimi-CLI) |

Verify everything is available:

```bash
node --version && pnpm --version && git --version && uv --version && kimi --version
```

---

## Quick Start

```bash
# 1. Clone
git clone git@github.com:conversionsurgery/revgen-nextjs.git && cd revgen-nextjs

# 2. Install dependencies
pnpm install

# 3. Copy environment template
cp .env.example .env.local

# 4. Verify setup
pnpm run agent:start
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. Below are the **required** variables; see `.env.example` for the full list including optional integrations.

| Variable | Source / How to Get | Purpose |
|----------|---------------------|---------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev | Base URL for the app |
| `DATABASE_URL` | [Neon Console](https://console.neon.tech) → Connection Details | Postgres connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` | NextAuth session signing secret |
| `CLIENT_SESSION_SECRET` | `openssl rand -base64 32` | Client portal session secret |
| `NEXTAUTH_URL` | Same as `NEXT_PUBLIC_APP_URL` | Must match app URL for auth callbacks |
| `RESEND_API_KEY` | [Resend Dashboard](https://resend.com/api-keys) | Email sending (magic links) |
| `EMAIL_FROM` | Verified domain in Resend, or `onboarding@resend.dev` for testing | Sender address |
| `ADMIN_EMAIL` | Your email | Admin notification recipient |
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com) → Account Info | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | [Twilio Console](https://console.twilio.com) → Account Info | Twilio API token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number in E.164 format (e.g. `+15551234567`) | Default outbound number |
| `TWILIO_WEBHOOK_BASE_URL` | ngrok URL or local tunnel for webhooks | Twilio callback base URL |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | AI responses |
| `CRON_SECRET` | `openssl rand -hex 32` | Cron job authentication |
| `FORM_WEBHOOK_SECRET` | `openssl rand -hex 32` | Form webhook authentication |

**Recommended but optional:**

| Variable | Source | Purpose |
|----------|--------|---------|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) | Billing / subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard webhook endpoint | Stripe webhook verification |
| `STRIPE_PRICE_*` | Stripe Dashboard → Products | Subscription price IDs |

---

## MCP Setup

MCP servers extend the agent with external capabilities. For the full reference, see [`AGENT-ENVIRONMENT.md`](./AGENT-ENVIRONMENT.md).

**Add the pinned servers:**

```bash
kimi mcp add context7 npx -y @upstash/context7-mcp@2.2.4
kimi mcp add playwright npx -y @playwright/mcp@0.0.73
```

**Verify:**

```bash
kimi mcp list
```

You should see `context7` and `playwright` with the pinned versions above.

### Rules

- Never use `@latest` — always pin to the version documented above.
- If a server opens a popup or dashboard on startup, remove it immediately (`kimi mcp remove <name>`).
- Keep the set minimal — only enable servers the codebase actually uses.

---

## First Session

Start every session with the agent pre-flight script:

```bash
pnpm run agent:start
```

**Expected output:**

```
========================================
  [agent-session] Starting session
  Branch: main
  Time:   2026-05-05T16:34:07Z
========================================

[info] Checking required tools...
[ok] All required tools available (pnpm, node, git)
[ok] .agent/progress.md found
[info] Checking git state...
[ok] Working tree is clean
[ok] Work-tracker: 0 item(s) in_progress

----------------------------------------
  SESSION SUMMARY
----------------------------------------
  Branch:           main
  Last Commit:      abc1234 — Last commit message
  Uncommitted:      0 file(s)
  Work-Tracker:     0 in_progress
----------------------------------------

[ok] Session pre-flight complete. Safe to proceed.
```

If the script exits non-zero, stop and resolve the issue before coding. Common causes:

- Missing tool (pnpm, node, or git not in PATH)
- Uncommitted files not documented in `.agent/progress.md`
- `.agent/progress.md` missing (the script auto-creates it from template)

---

## Verification

After setup, run the full verification stack:

```bash
# 1. Agent state check (warns if progress.md is stale, typecheck fails, etc.)
pnpm run agent:check

# 2. No-regressions gate (build + tests + smoke)
pnpm run quality:no-regressions
```

Both should exit 0. If either fails, fix the root cause before starting work.

---

## Troubleshooting

### Missing tools

```bash
# pnpm not found
npm install -g pnpm

# uv not found
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Stale or missing `progress.md`

If `agent:check` warns that `progress.md` is stale (>4 hours old):

```bash
# Update the timestamp by editing the file, or regenerate it:
pnpm run agent:start
```

If `progress.md` is missing, `agent:start` creates it from template automatically.

### Uncommitted changes from a previous session

```bash
# Inspect what changed
git status
git diff

# If the changes are valid work-in-progress, document them in .agent/progress.md
# under "Uncommitted Files" and "Uncommitted Note", then re-run agent:check.

# If the changes are leftover cruft, discard them:
git restore .
git clean -fd
```

### Typecheck fails after fresh install

```bash
# Ensure all build-time env vars are set in .env.local
# The no-regressions script sets CI fallbacks, but local dev needs real values
# for integrations (Stripe, Twilio, etc.).
cat .env.local | grep -E '^(DATABASE_URL|AUTH_SECRET|NEXTAUTH_URL)='
```

### MCP server errors

```bash
# List servers and check for errors
kimi mcp list

# Remove a broken server
kimi mcp remove <name>

# Re-add with pinned version
kimi mcp add context7 npx -y @upstash/context7-mcp@2.2.4
```

---

## Updating

### Update pnpm dependencies

```bash
# Pull latest lockfile
git pull origin main

# Install updated dependencies
pnpm install

# Verify nothing broke
pnpm run typecheck
pnpm test
```

### Update MCP server versions

1. Check the current pinned versions in [`AGENT-ENVIRONMENT.md`](./AGENT-ENVIRONMENT.md).
2. Verify the new version works standalone:
   ```bash
   npx -y @upstash/context7-mcp@<new-version> --help
   ```
3. Update the server:
   ```bash
   kimi mcp remove context7
   kimi mcp add context7 npx -y @upstash/context7-mcp@<new-version>
   ```
4. Update the version table in `AGENT-ENVIRONMENT.md`.
5. Restart Kimi CLI and run `kimi mcp list` to confirm.

---

## Recovery Reference

For the full session recovery protocol (resuming after interruption, deciding whether to restart or resume, emergency overrides), see `.agent/workflows/session-recovery.md`.
