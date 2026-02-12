# ConversionSurgery Revenue Recovery - Complete Project Guide

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack Deep Dive](#3-tech-stack-deep-dive)
4. [Getting Started](#4-getting-started)
5. [Project Structure](#5-project-structure)
6. [Database Schema Guide](#6-database-schema-guide)
7. [Authentication System](#7-authentication-system)
8. [API Routes Reference](#8-api-routes-reference)
9. [The Automation Engine](#9-the-automation-engine)
10. [AI Agent System](#10-ai-agent-system)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Business Logic Flows](#12-business-logic-flows)
13. [Service Layer](#13-service-layer)
14. [Deployment & Infrastructure](#14-deployment--infrastructure)
15. [Development Workflows](#15-development-workflows)
16. [Key Patterns & Conventions](#16-key-patterns--conventions)
17. [Common Tasks Cookbook](#17-common-tasks-cookbook)

---

## 1. What Is This Project?

ConversionSurgery is a **B2B SaaS platform for home service contractors** (roofers, plumbers, HVAC, electricians, etc.) that automates revenue recovery through AI-powered SMS conversations.

### The Problem It Solves

Contractors lose 40-60% of potential revenue because they:

- Miss phone calls while on job sites
- Don't follow up on estimates
- Forget to send appointment reminders
- Never request reviews after completing work
- Lose track of outstanding invoices

### How It Works

```
Customer calls contractor → Gets voicemail → Twilio detects missed call
  → ConversionSurgery instantly texts: "Sorry we missed your call!"
  → Customer replies with their need
  → AI agent qualifies the lead, books appointments, sends estimates
  → Automated follow-up sequences nurture the lead
  → Contractor gets notified only when action is needed
```

### Business Model

**Managed service at $997/month** — the ConversionSurgery team manages everything for the contractor:

- Onboards clients via setup wizard
- Runs A/B tests on message templates across 20+ clients
- Generates bi-weekly performance reports
- Optimizes flows based on aggregate data
- Provides "tested across 50,000 messages" competitive advantage

### Three User Types

| Role                        | What They See                                  | How They Log In                           |
| --------------------------- | ---------------------------------------------- | ----------------------------------------- |
| **Admin** (you, the agency) | All clients, A/B tests, reports, analytics     | Magic link to admin@conversionsurgery.com |
| **Team Member**             | Dashboard scoped to their client               | Magic link to their email                 |
| **Client** (contractor)     | Self-service portal for conversations, billing | Magic link SMS → /client/\* pages         |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                        │
│  Twilio (SMS/Voice)  │  Stripe (Billing)  │  OpenAI (AI)    │
│  Resend (Email)      │  Google Calendar    │  Google Places   │
└──────────┬───────────┴──────────┬──────────┴────────────────┘
           │ Webhooks             │ API calls
┌──────────▼──────────────────────▼────────────────────────────┐
│                    Next.js 16 App Router                      │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  (auth)  │  │ (dashboard)  │  │      (client)          │ │
│  │ /login   │  │ /admin/*     │  │ /client/*              │ │
│  │ /verify  │  │ /leads       │  │ /client/conversations  │ │
│  │ /claim   │  │ /analytics   │  │ /client/billing        │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    API Layer                              ││
│  │  /api/webhooks/twilio/*    → Automation handlers         ││
│  │  /api/admin/*              → Admin CRUD (auth required)  ││
│  │  /api/client/*             → Client-scoped operations    ││
│  │  /api/cron/*               → Background jobs             ││
│  │  /api/escalations/*        → Team escalation             ││
│  │  /api/leads/*              → Lead management             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │               Service Layer (41 modules)                  ││
│  │  openai.ts │ twilio.ts │ stripe.ts │ resend.ts           ││
│  │  lead-scoring.ts │ flow-execution.ts │ team-escalation.ts││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Automation Layer (7 handlers)                ││
│  │  missed-call.ts │ incoming-sms.ts │ form-response.ts     ││
│  │  estimate-followup.ts │ appointment-reminder.ts           ││
│  │  review-request.ts │ payment-reminder.ts                  ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│         Drizzle ORM → Neon Serverless Postgres               │
│         78+ tables │ HTTP driver │ Per-request instances      │
└──────────────────────────────────────────────────────────────┘
```

### Request Flow (Missed Call Example)

```
1. Customer calls contractor → voicemail
2. Twilio detects missed call → POST /api/webhooks/twilio/sms
3. API route finds client by Twilio number
4. handleMissedCall() automation runs:
   a. Checks if number is blocked
   b. Creates or finds existing lead
   c. Renders "Sorry we missed your call!" template
   d. Sends SMS via Twilio
   e. Logs conversation to database
   f. Updates daily stats counter
   g. Schedules follow-up sequence (1hr, 24hr)
   h. Notifies contractor via SMS/email
5. Dashboard shows new lead with "Action Required" badge
```

---

## 3. Tech Stack Deep Dive

### Frontend

| Technology       | Version | Purpose                         |
| ---------------- | ------- | ------------------------------- |
| **Next.js**      | 16.1.5  | App Router, SSR, API routes     |
| **React**        | 19.1.5  | UI rendering                    |
| **TypeScript**   | 5.7.4   | Type safety                     |
| **Tailwind CSS** | 4       | Utility-first styling           |
| **shadcn/ui**    | Latest  | Pre-built accessible components |
| **Radix UI**     | 1.4.3   | Headless accessible primitives  |
| **Recharts**     | 3.7.0   | Analytics charts                |
| **Lucide React** | 0.563.0 | Icons                           |
| **Sonner**       | 2.0.7   | Toast notifications             |

### Backend

| Technology          | Version | Purpose                  |
| ------------------- | ------- | ------------------------ |
| **Drizzle ORM**     | 0.45.1  | Type-safe SQL queries    |
| **Neon Serverless** | 1.0.2   | PostgreSQL over HTTP     |
| **NextAuth**        | 4.24.13 | Email magic link auth    |
| **Zod**             | 4.3.6   | Runtime input validation |

### Integrations

| Service                 | Purpose                              | Key Files                                  |
| ----------------------- | ------------------------------------ | ------------------------------------------ |
| **Twilio**              | SMS sending, voice calls, webhooks   | `twilio.ts`, `twilio-provisioning.ts`      |
| **OpenAI**              | AI response generation, lead scoring | `openai.ts`, `knowledge-ai.ts`             |
| **LangChain/LangGraph** | Multi-step AI agent                  | `src/lib/agent/`                           |
| **Stripe**              | Subscription billing, payments       | `stripe.ts`, `subscription.ts`             |
| **Resend**              | Transactional emails                 | `resend.ts`                                |
| **Google APIs**         | Calendar sync, review monitoring     | `google-calendar.ts`, `google-business.ts` |
| **AWS S3**              | Media storage (MMS photos)           | `storage.ts`                               |

### Deployment

| Technology             | Purpose                               |
| ---------------------- | ------------------------------------- |
| **Cloudflare Workers** | Edge runtime (via OpenNext)           |
| **Wrangler**           | Cloudflare CLI                        |
| **R2**                 | Cloudflare object storage (ISR cache) |

---

## 4. Getting Started

### Prerequisites

- Node.js 20+
- A Neon PostgreSQL database
- Twilio account (for SMS)
- OpenAI API key
- Resend account (for email)

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd conversionsurgery-revgen-nextjs

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your actual values:
#   DATABASE_URL=postgresql://...@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
#   AUTH_SECRET=$(openssl rand -base64 32)
#   TWILIO_ACCOUNT_SID=AC...
#   TWILIO_AUTH_TOKEN=...
#   OPENAI_API_KEY=sk-...
#   RESEND_API_KEY=re_...

# 4. Run database migrations
npm run db:migrate

# 5. Seed the database with demo data
npm run db:seed

# 6. Start development server
npm run dev
# → Open http://localhost:3000

# 7. Log in as admin
# Enter admin@conversionsurgery.com on the login page
# Check your terminal for the magic link (logged in dev mode)
```

### Verify Everything Works

```bash
# Build must pass with 0 TypeScript errors
npm run build

# Run ESLint
npm run lint

# Browse database visually
npm run db:studio
```

### Key Commands Reference

| Command               | What It Does                                    |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Start dev server (port 3000)                    |
| `npm run build`       | Production build (must have 0 TS errors)        |
| `npm run lint`        | ESLint check                                    |
| `npm run db:generate` | Generate Drizzle migration after schema changes |
| `npm run db:migrate`  | Apply pending migrations                        |
| `npm run db:push`     | Push schema directly (use with caution)         |
| `npm run db:studio`   | Visual database browser                         |
| `npm run db:seed`     | Seed database with demo data                    |
| `npm run db:setup`    | Migrate + seed in one command                   |
| `npm run cf:deploy`   | Build + deploy to Cloudflare                    |

---

## 5. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, verify, claim)
│   │   ├── login/page.tsx
│   │   ├── verify/page.tsx
│   │   └── claim/page.tsx
│   ├── (dashboard)/              # Admin + team member pages
│   │   ├── layout.tsx            # Sidebar nav, client selector
│   │   ├── admin/                # Admin-only pages
│   │   │   ├── page.tsx          # Agency dashboard
│   │   │   ├── clients/          # Client management
│   │   │   ├── analytics/        # Analytics dashboard
│   │   │   ├── reports/          # Report generation
│   │   │   ├── template-performance/ # A/B testing
│   │   │   ├── phone-numbers/    # Phone management
│   │   │   ├── ab-tests/         # A/B test management
│   │   │   └── ...               # More admin sections
│   │   ├── dashboard/page.tsx    # Client dashboard (team view)
│   │   ├── leads/                # Lead management
│   │   ├── conversations/        # Conversation threads
│   │   ├── escalations/          # Escalation queue
│   │   └── scheduled/            # Scheduled messages
│   ├── (client)/                 # Client self-service portal
│   │   ├── layout.tsx            # Minimal header
│   │   └── client/               # Client pages
│   │       ├── conversations/
│   │       ├── team/
│   │       ├── billing/
│   │       └── settings/
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin endpoints (auth required)
│   │   ├── client/               # Client-scoped endpoints
│   │   ├── webhooks/             # Twilio/Stripe webhooks
│   │   ├── cron/                 # Background jobs
│   │   ├── leads/                # Lead CRUD
│   │   ├── escalations/          # Escalation management
│   │   └── ...
│   ├── layout.tsx                # Root layout (providers, fonts)
│   └── globals.css               # Tailwind + shadcn theme
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components (21)
│   ├── admin/                    # Admin-specific components
│   ├── analytics/                # Charts, KPI cards
│   ├── billing/                  # Subscription, payment
│   ├── flows/                    # Flow template editor
│   ├── escalations/              # Escalation queue/detail
│   ├── leads/                    # Lead score, media
│   ├── reviews/                  # Review dashboard
│   └── providers.tsx             # SessionProvider + AdminProvider
├── db/                           # Database layer
│   ├── index.ts                  # getDb() factory
│   ├── client.ts                 # Neon HTTP client
│   └── schema/                   # 78+ schema files (1 per table)
│       ├── clients.ts
│       ├── leads.ts
│       ├── conversations.ts
│       ├── index.ts              # Re-exports all schemas
│       └── ...
├── lib/                          # Business logic
│   ├── auth.ts                   # NextAuth config
│   ├── auth-options.ts           # Auth providers + callbacks
│   ├── agent/                    # LangGraph AI agent
│   │   ├── orchestrator.ts       # Message processing entry point
│   │   ├── graph.ts              # Agent state graph
│   │   └── state.ts              # Agent state type
│   ├── automations/              # Event handlers (7 files)
│   │   ├── missed-call.ts        # Missed call automation
│   │   ├── incoming-sms.ts       # Inbound SMS handler (most complex)
│   │   ├── form-response.ts      # Form submission handler
│   │   ├── estimate-followup.ts  # Post-estimate sequence
│   │   ├── appointment-reminder.ts
│   │   ├── review-request.ts
│   │   └── payment-reminder.ts
│   ├── services/                 # Service modules (41 files)
│   │   ├── twilio.ts             # SMS sending
│   │   ├── twilio-provisioning.ts # Phone number management
│   │   ├── openai.ts             # AI responses
│   │   ├── stripe.ts             # Payment processing
│   │   ├── resend.ts             # Email sending
│   │   ├── lead-scoring.ts       # AI lead qualification
│   │   ├── flow-execution.ts     # Automation sequences
│   │   ├── team-escalation.ts    # Team routing
│   │   └── ...
│   ├── utils/                    # Utilities
│   │   ├── phone.ts              # Phone normalization (libphonenumber)
│   │   ├── templates.ts          # Message template rendering
│   │   └── tokens.ts             # Secure token generation
│   └── types/                    # TypeScript types
├── scripts/
│   └── seed.ts                   # Database seeding
└── drizzle/                      # Migration files
    ├── 0000_friendly_agent_brand.sql  # Initial schema
    ├── ...
    └── meta/_journal.json        # Migration journal
```

---

## 6. Database Schema Guide

The database has **78+ tables** organized into logical groups. Every table uses UUIDs as primary keys with `uuid_generate_v4()`.

### Core CRM Tables

```
clients (THE central table — everything references this)
├── leads (customers/prospects)
│   ├── conversations (SMS thread messages)
│   ├── appointments (scheduled visits)
│   ├── scheduled_messages (queued follow-ups)
│   └── lead_context (AI's understanding)
├── team_members (who receives escalations)
├── business_hours (Mon-Sat operating schedule)
├── daily_stats (aggregated metrics per day)
└── blocked_numbers (opt-outs, spam)
```

### Key Tables Explained

**`clients`** — The contractor businesses. Each has:

- Business info (name, owner, email, phone)
- Twilio number assignment
- Feature flags (AI agent, flows, voice, reviews, etc.)
- Agent mode: `off`, `assist`, or `autonomous`
- Monthly message limits and counters

**`leads`** — People who contact the contractor:

- Source: `missed_call`, `form`, `manual`, `sms`
- Status journey: `new → contacted → estimate_sent → won/lost/opted_out`
- Score: 0-100 AI-calculated quality score
- Conversation mode: `ai` (default), `human` (takeover), `paused`
- Action required flag for dashboard alerts

**`conversations`** — Every SMS message (inbound and outbound):

- Direction: `inbound` or `outbound`
- Message type: `sms`, `ai_response`, `contractor_response`, `system`
- AI confidence score on outbound messages

**`daily_stats`** — One row per client per day:

- Missed calls captured, forms responded, messages sent
- Appointments reminded, estimates followed up
- Reviews requested, payments reminded

### Schema File Convention

One table per file in `src/db/schema/`. Every file:

1. Defines the table with `pgTable()`
2. Exports `Select` and `Insert` types
3. Gets re-exported from `src/db/schema/index.ts`

```typescript
// src/db/schema/leads.ts
export const leads = pgTable(
  "leads",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // ... columns
  },
  (table) => [index("idx_leads_client_id").on(table.clientId)],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
```

### Modifying the Schema

```bash
# 1. Edit/create schema file
# 2. Export from src/db/schema/index.ts
# 3. Generate migration
npm run db:generate
# 4. Review the SQL in drizzle/
# 5. Apply (with confirmation)
npm run db:migrate
```

---

## 7. Authentication System

### How Auth Works

NextAuth v4 with **email magic links** via Resend:

```
User enters email → Magic link email sent → User clicks link → Session created
```

No passwords. The admin user in `adminUsers` table is a separate legacy system. The main auth uses the `users` table.

### Key Files

- `src/lib/auth.ts` — `auth()` helper for server components
- `src/lib/auth-options.ts` — NextAuth config (providers, callbacks, adapter)
- `src/db/schema/auth.ts` — Users, accounts, sessions, verification tokens

### Session Enrichment

The session callback fetches the user from the database and enriches the session:

```typescript
// In auth-options.ts session callback:
session.user.id = dbUser.id;
session.user.isAdmin = dbUser.isAdmin;
session.user.client = { id, businessName, ownerName }; // if has clientId
```

### Auth Patterns in Code

```typescript
// Server component (admin page)
import { auth } from "@/lib/auth";
const session = await auth();
if (!(session as any).user?.isAdmin) redirect("/dashboard");

// API route
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
const session = await getServerSession(authOptions);
if (!(session as any).user?.isAdmin) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

// Client component
import { useSession } from "next-auth/react";
const { data: session } = useSession();
```

### Sign-In Flow

1. Non-admin users must have a matching `clients.email` record
2. On first sign-in, the callback auto-links the user to their client
3. Admins can always sign in regardless of client association

---

## 8. API Routes Reference

### Route Organization

All API routes follow RESTful conventions. Admin routes require `isAdmin` check.

### Admin Routes (/api/admin/\*)

```
Clients
  GET/POST    /api/admin/clients              List all / Create new
  GET/PATCH   /api/admin/clients/[id]         Get / Update client
  DELETE      /api/admin/clients/[id]         Soft delete (status='cancelled')
  GET         /api/admin/clients/[id]/stats   Client analytics

Twilio
  GET         /api/admin/twilio/search        Search available numbers
  POST        /api/admin/twilio/purchase      Buy a number
  POST        /api/admin/twilio/configure     Set up webhooks
  POST        /api/admin/twilio/release       Release a number
  GET         /api/admin/twilio/account       Balance & stats

Templates & A/B Tests
  GET/POST    /api/admin/templates/variants   Template variant CRUD
  GET         /api/admin/templates/performance Aggregate performance
  POST        /api/admin/templates/assign     Assign variant to clients
  GET/POST    /api/admin/ab-tests             A/B test CRUD
  GET         /api/admin/ab-tests/[id]/results Test results

Reports
  GET/POST    /api/admin/reports              List / Generate report
  GET         /api/admin/reports/[id]         Report detail

Flow Templates
  GET/POST    /api/admin/flow-templates       Template CRUD
  POST        /api/admin/flow-templates/[id]/push   Push to all clients
```

### Webhook Routes (/api/webhooks/\*)

```
Twilio SMS
  POST    /api/webhooks/twilio/sms          Inbound SMS (triggers automations)

Twilio Voice
  POST    /api/webhooks/twilio/voice        Incoming call
  POST    /api/webhooks/twilio/voice/ai     AI voice agent
  POST    /api/webhooks/twilio/ring-connect Ring group connection

Stripe
  POST    /api/webhooks/stripe              Payment events

Forms
  POST    /api/webhooks/form                Website form submissions
```

### Cron Routes (/api/cron/\*)

```
  POST    /api/cron/process-scheduled       Send queued messages
  POST    /api/cron/check-missed-calls      Poll Twilio for missed calls
  POST    /api/cron/daily                   Aggregate daily stats
  POST    /api/cron/weekly-summary          Email weekly digests
  POST    /api/cron/calendar-sync           Sync Google Calendar
  POST    /api/cron/agent-check             AI agent heartbeat
```

### API Route Pattern

```typescript
// src/app/api/admin/clients/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!(session as any).user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await props.params; // Must await in Next.js 16!
  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(client);
}
```

---

## 9. The Automation Engine

### Overview

Seven automation handlers in `src/lib/automations/` process events and trigger SMS sequences:

### 1. Missed Call Handler (`missed-call.ts`)

```
Trigger: Twilio missed call webhook
Flow:
  1. Find client by Twilio number
  2. Check if number is blocked
  3. Create or update lead (source: 'missed_call')
  4. Render missed_call template
  5. Send SMS via Twilio
  6. Log conversation record
  7. Update daily stats
  8. Schedule follow-up sequence
```

### 2. Incoming SMS Handler (`incoming-sms.ts`) — THE MOST COMPLEX

This is the heart of the system. When someone texts back:

```
1.  Find client by Twilio number
2.  Handle special commands (DASHBOARD → magic link, STOP → opt-out)
3.  Check for flow approval responses (owner approving AI suggestions)
4.  Check blocked numbers
5.  Create or find existing lead
6.  Log inbound message + process any MMS media
7.  Update lead score (quick sync + async AI scoring)
8.  Check if human has taken over conversation → skip AI
9.  Pause any active follow-up sequences
10. Detect hot intent → trigger ring group for urgent leads
11. Run LangGraph agent (if autonomous mode enabled)
12. Get conversation history for context
13. Generate AI response (with knowledge base context)
14. Check if escalation needed → notify team
15. Send AI response via Twilio
16. Check for applicable automation flows
17. Notify contractor of activity
```

### 3-7. Other Automations

| Handler                   | Trigger                | Action                                 |
| ------------------------- | ---------------------- | -------------------------------------- |
| `form-response.ts`        | Website form webhook   | Create lead + send acknowledgment      |
| `estimate-followup.ts`    | After estimate sent    | Multi-step follow-up (day 1, 3, 7, 14) |
| `appointment-reminder.ts` | Day before appointment | Send reminders                         |
| `review-request.ts`       | Job completed          | Request Google review                  |
| `payment-reminder.ts`     | Invoice overdue        | Escalating payment reminders           |

### Flow Execution

Flows are multi-step SMS sequences with configurable delays and skip conditions:

```
Flow Template → Steps (with delays)
  Step 1: Immediate text (0 min delay)
  Step 2: Follow-up (60 min delay, skip if replied)
  Step 3: Final follow-up (1440 min delay, skip if replied)
```

Each step runs through `flow-execution.ts` which:

- Checks skip conditions (ifReplied, ifPaid, etc.)
- Renders the message template with lead/client variables
- Schedules the SMS in `scheduled_messages` table
- Records execution metrics

---

## 10. AI Agent System

### LangGraph Architecture

The AI agent uses LangChain's LangGraph framework for multi-step decision-making:

```
src/lib/agent/
├── orchestrator.ts  — Entry point (processIncomingMessage)
├── graph.ts         — State machine definition
└── state.ts         — Conversation state type
```

### How the Agent Decides

```
Input: lead context + conversation history + client settings
  ↓
LangGraph processes through nodes:
  1. Analyze message intent
  2. Check lead stage (new → qualifying → nurturing → hot → booked)
  3. Detect signals (urgency, budget, objections, competitors)
  4. Choose action:
     - RESPOND: Generate contextual reply
     - ESCALATE: Send to team (high urgency or low confidence)
     - TRIGGER_FLOW: Start automation sequence
     - WAIT: No action needed
     - BOOK: Attempt to schedule appointment
  ↓
Output: response text + action + updated lead context
```

### Lead Context Tracking (`lead_context` table)

The AI maintains per-lead understanding:

- **Stage**: new → qualifying → nurturing → hot → objection → escalated → booked/lost
- **Scores** (0-100): urgency, budget, intent
- **Sentiment**: positive, neutral, negative, frustrated
- **Extracted info**: project type, size, estimated value, preferred timeframe
- **Objections**: tracked with raised/addressed timestamps
- **Competitor mentions**: captured for analysis
- **Conversation summary**: AI-updated running summary

### Decision Logging (`agent_decisions` table)

Every AI decision is recorded for debugging and learning:

- What triggered the decision
- State snapshot at decision time
- The action chosen + reasoning
- Alternative actions considered
- Outcome (filled in later)
- Processing time in milliseconds

---

## 11. Frontend Architecture

### Route Groups

Next.js route groups separate the three user experiences:

```
(auth)      → Dark gradient background, centered card
(dashboard) → Full sidebar nav, max-w-7xl
(client)    → Minimal header, max-w-3xl
```

### Layout Hierarchy

```
RootLayout (providers, fonts, toaster)
├── AuthLayout (centered, dark bg)
├── DashboardLayout (sidebar, client selector, admin nav)
└── ClientLayout (minimal header, business name)
```

### Admin Navigation Structure

```
Management:
  All Clients, Client Detail, Billing, Discussions

Optimization:
  Flow Templates, Analytics, Platform Analytics,
  Template Performance, Reports, Reputation, Usage

Configuration:
  Phone Numbers, Twilio Settings, Voice AI, Compliance
```

### Page Pattern (Server Component)

```tsx
export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const session = await auth();
  if (!(session as any).user?.isAdmin) redirect("/dashboard");

  const db = getDb();
  const allClients = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">All Clients</h1>
        <Button asChild>
          <Link href="/admin/clients/new/wizard">Add Client</Link>
        </Button>
      </div>
      <ClientsList clients={allClients} />
    </div>
  );
}
```

### shadcn/ui Components Installed

Alert, AlertDialog, Badge, Button, Card, Checkbox, Collapsible,
Dialog, DropdownMenu, Input, Label, Progress, RadioGroup, Select,
Skeleton, Switch, Table, Tabs, Textarea, Tooltip

### Adding New shadcn Components

```bash
npx shadcn@latest add <component-name>
# Example: npx shadcn@latest add calendar
```

---

## 12. Business Logic Flows

### Lead Lifecycle

```
                    ┌─── form submission
NEW ←───────────────┤
  │                 └─── missed call
  ▼
CONTACTED ──────────── AI responds, conversation begins
  │
  ├──► ESTIMATE_SENT ── estimate given, follow-up sequence starts
  │       │
  │       ├──► WON ──── job booked, review request triggered
  │       └──► LOST ─── no response after 14 days
  │
  ├──► ACTION_REQUIRED ── needs human attention
  │       │
  │       └──► ESCALATED ── sent to team member
  │
  └──► OPTED_OUT ──── customer texted STOP
```

### Escalation Flow

```
AI detects complex situation (low confidence, frustrated customer, urgent need)
  ↓
1. Create escalation in escalation_queue
2. Notify team members via SMS (ordered by priority)
3. Team member claims the escalation
4. Human takes over conversation (mode: 'human')
5. When resolved, hand back to AI (mode: 'ai')
```

### Hot Transfer Flow

```
AI detects high-intent signal ("I need this done TODAY")
  ↓
1. Check if within business hours
2. If YES → Initiate ring group (call all team members)
   - First person to answer gets connected to the lead
3. If NO → Create escalation for next business day
```

### Billing Flow

```
Stripe Webhook → /api/webhooks/stripe
  ↓
subscription.created  → Activate client
payment_succeeded     → Update invoice status
payment_failed        → Send notification, start grace period
subscription.canceled → Soft delete client (status: 'cancelled')
```

---

## 13. Service Layer

### Core Services

| Service                 | File                     | Key Functions                                                             |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------- |
| **Twilio**              | `twilio.ts`              | `sendSMS()`, `validateTwilioWebhook()`                                    |
| **Twilio Provisioning** | `twilio-provisioning.ts` | `searchPhoneNumbers()`, `purchasePhoneNumber()`, `configurePhoneNumber()` |
| **OpenAI**              | `openai.ts`              | `generateAIResponse()`, `detectHotIntent()`, `scoreMessage()`             |
| **Email**               | `resend.ts`              | `sendEmail()`, email templates                                            |
| **Stripe**              | `stripe.ts`              | Payment processing                                                        |
| **Flow Execution**      | `flow-execution.ts`      | `executeFlow()`, `executeStep()`                                          |
| **Lead Scoring**        | `lead-scoring.ts`        | `scoreLead()`, `quickScore()`                                             |
| **Team Escalation**     | `team-escalation.ts`     | `notifyTeamForEscalation()`, `initiateRingGroup()`                        |
| **Business Hours**      | `business-hours.ts`      | `isWithinBusinessHours()`                                                 |
| **Knowledge Base**      | `knowledge-base.ts`      | FAQ lookup for AI context                                                 |
| **Usage Tracking**      | `usage-tracking.ts`      | Track SMS/API consumption                                                 |
| **Weekly Summary**      | `weekly-summary.ts`      | Generate email digests                                                    |

### Service Pattern

```typescript
// Services are pure functions, no class instances
// They always get a fresh db instance

import { getDb } from "@/db";
import { sendSMS } from "@/lib/services/twilio";

export async function notifyTeamForEscalation(params: {
  leadId: string;
  clientId: string;
  twilioNumber: string;
  reason: string;
  lastMessage: string;
}) {
  const db = getDb();
  // ... query team members, send SMS to each
}
```

---

## 14. Deployment & Infrastructure

### Cloudflare Workers Deployment

The app deploys to Cloudflare Workers via OpenNext:

```bash
# Build and deploy
npm run cf:deploy

# Or separately:
npm run cf:build    # Creates .open-next/
npx wrangler deploy # Deploys to Workers
```

### Why Cloudflare + Neon?

- **Cloudflare Workers**: Edge runtime, globally distributed, no cold starts
- **Neon HTTP**: Works over fetch (no TCP sockets needed in edge runtime)
- **Per-request DB instances**: Matches stateless edge computing model

### Database Connection

```typescript
// src/db/client.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export function createNeonClient(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

// src/db/index.ts
export function getDb() {
  // Tries Cloudflare context first, then process.env
  const url = getDatabaseUrl();
  return createNeonClient(url);
}
```

### Environment Variables Required

```
DATABASE_URL          # Neon connection string
AUTH_SECRET           # NextAuth secret (openssl rand -base64 32)
TWILIO_ACCOUNT_SID    # Twilio credentials
TWILIO_AUTH_TOKEN
OPENAI_API_KEY        # OpenAI API key
RESEND_API_KEY        # Email service
EMAIL_FROM            # Sender email address
NEXT_PUBLIC_APP_URL   # Your domain
CRON_SECRET           # For cron job authentication
```

---

## 15. Development Workflows

### Adding a New Schema Table

```bash
# 1. Create the schema file
# src/db/schema/my-new-table.ts

# 2. Export from index
# Add to src/db/schema/index.ts:
export * from './my-new-table';

# 3. Generate migration
npm run db:generate

# 4. Review the SQL
# Check drizzle/XXXX_*.sql

# 5. Apply migration
npm run db:migrate
```

### Adding a New API Route

```bash
# 1. Create route file
# src/app/api/admin/my-feature/route.ts

# 2. Follow the pattern:
#    - Import getServerSession + authOptions
#    - Check isAdmin
#    - Use Zod for validation
#    - Use getDb() for database
#    - Return NextResponse.json()

# 3. Test with curl or the UI
```

### Adding a New Admin Page

```bash
# 1. Create page file
# src/app/(dashboard)/admin/my-feature/page.tsx

# 2. Follow the pattern:
#    - export const dynamic = 'force-dynamic'
#    - Check auth with auth()
#    - Redirect if not admin
#    - Fetch data with getDb()
#    - Return JSX

# 3. Add to navigation
# Edit src/app/(dashboard)/layout.tsx adminNavItems
```

### Adding a shadcn Component

```bash
npx shadcn@latest add <component>
# Installs to src/components/ui/
```

---

## 16. Key Patterns & Conventions

### Database Access

```typescript
// ALWAYS per-request. NEVER cache.
const db = getDb();
```

### Admin Auth Check

```typescript
// API routes
if (!(session as any).user?.isAdmin) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

// Server components
if (!(session as any).user?.isAdmin) redirect("/dashboard");
```

### Async Params (Next.js 16)

```typescript
// API routes — params is a Promise, MUST await
export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
}
```

### Phone Normalization

```typescript
import { normalizePhoneNumber } from "@/lib/utils/phone";
const phone = normalizePhoneNumber("+1 (403) 555-1234"); // → +14035551234
```

### Input Validation

```typescript
import { z } from "zod";

const schema = z.object({
  businessName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
});

const body = await request.json();
const result = schema.safeParse(body);
if (!result.success) {
  return NextResponse.json({ error: result.error.issues }, { status: 400 });
}
```

### Upsert Pattern

```typescript
await db
  .insert(dailyStats)
  .values({ clientId, date, messagesSent: 1 })
  .onConflictDoUpdate({
    target: [dailyStats.clientId, dailyStats.date],
    set: { messagesSent: sql`${dailyStats.messagesSent} + 1` },
  });
```

### Template Rendering

```typescript
import { renderTemplate } from "@/lib/utils/templates";
const message = renderTemplate("missed_call", {
  ownerName: client.ownerName,
  businessName: client.businessName,
});
```

---

## 17. Common Tasks Cookbook

### "I need to add a new automation type"

1. Create handler in `src/lib/automations/my-automation.ts`
2. Add webhook or cron trigger in `src/app/api/`
3. Create flow template in seed data
4. Add to daily stats tracking if needed

### "I need to add a feature flag to clients"

1. Add boolean column to `src/db/schema/clients.ts`
2. Run `npm run db:generate` and `npm run db:migrate`
3. Check the flag in relevant automation/API code
4. Add toggle to admin client settings page

### "I need to add a new admin page"

1. Create `src/app/(dashboard)/admin/my-page/page.tsx`
2. Add nav item to `src/app/(dashboard)/layout.tsx`
3. Create any needed API routes
4. Build components in `src/components/`

### "I need to test locally without Twilio"

The Twilio provisioning service has mock fallback:

- `generateMockNumbers()` returns fake numbers in development
- `isMockPhoneNumber()` detects mock numbers and skips Twilio API calls
- Enable by having `NODE_ENV=development`

### "I need to understand why the AI said something"

Check the `agent_decisions` table:

```sql
SELECT action, reasoning, confidence, alternatives_considered
FROM agent_decisions
WHERE lead_id = 'xxx'
ORDER BY created_at DESC;
```

### "I need to see what messages are queued"

```sql
SELECT * FROM scheduled_messages
WHERE sent = false AND cancelled = false
ORDER BY send_at ASC;
```

---

## Quick Reference Card

| Need                 | Command/File                                      |
| -------------------- | ------------------------------------------------- |
| Start dev server     | `npm run dev`                                     |
| Build for production | `npm run build`                                   |
| Generate migration   | `npm run db:generate`                             |
| Apply migrations     | `npm run db:migrate`                              |
| Seed database        | `npm run db:seed`                                 |
| Browse database      | `npm run db:studio`                               |
| Deploy to Cloudflare | `npm run cf:deploy`                               |
| Admin login          | `admin@conversionsurgery.com` (magic link)        |
| Database connection  | `getDb()` from `@/db`                             |
| Auth check           | `(session as any).user?.isAdmin`                  |
| Phone normalize      | `normalizePhoneNumber()` from `@/lib/utils/phone` |
| Add UI component     | `npx shadcn@latest add <name>`                    |
| Schema files         | `src/db/schema/*.ts`                              |
| API routes           | `src/app/api/`                                    |
| Automations          | `src/lib/automations/`                            |
| Services             | `src/lib/services/`                               |
