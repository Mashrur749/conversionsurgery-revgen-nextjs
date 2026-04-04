# Spec: Service Model (Managed vs Self-Serve Portal)

> **Created:** 2026-04-04
> **Status:** Complete

## Problem

The platform serves two tiers:
- **Managed service** ($1,000/mo) — operator runs everything, contractor just uses the service
- **Self-serve** (future, lower price) — contractor configures and manages everything themselves

Currently the portal shows the same UI to both. A managed contractor sees flow toggles, smart assist delay config, and plan pickers they should never touch. This contradicts the managed promise ("you don't manage anything") and creates unnecessary support surface.

## Design Principle

**Managed = scoreboard + inbox. Self-serve = scoreboard + inbox + control panel.**

Both tiers see the same data. The difference is who controls the machinery.

## Schema Change

Add one field to `clients` table:

```sql
service_model VARCHAR(20) DEFAULT 'managed' NOT NULL
-- values: 'managed' | 'self_serve'
```

Set during client creation. Operator can change via admin panel.

## Portal Behavior by Service Model

### Navigation

| Nav Item | Managed | Self-Serve | Notes |
|----------|:-------:|:----------:|-------|
| Dashboard | Yes | Yes | |
| Conversations | Yes | Yes | |
| Revenue | Yes | Yes | |
| Knowledge Base | Yes | Yes | |
| Flows | **No** | Yes | Operator manages automations |
| Team | Yes | Yes | |
| Billing | Yes | Yes | Different billing page behavior |
| Settings | Yes | Yes | Different settings tabs shown |
| Help | Yes | Yes | |
| Discussions | Yes | Yes | |
| Reviews | Yes | Yes | |

### Pages: Managed vs Self-Serve

#### Dashboard (`/client`)

**Both tiers identical.** Voice status card, activity stats, setup banners, revenue cards.

No changes needed.

#### Conversations (`/client/conversations`)

**Both tiers identical.** Lead list, message history, takeover/handback, status actions (mark estimate sent, won, lost).

No changes needed.

#### Escalations

Currently escalations are only on the admin/dashboard side (`/escalations`). The client portal doesn't have an escalations page — escalations are surfaced via SMS notifications and the `actionRequired` flag on conversations.

**Both tiers:** No change. Escalations come to the contractor via SMS + action-required badges in conversations.

#### Revenue (`/client/revenue`)

**Both tiers identical.** ROI dashboard, pipeline, speed-to-lead.

No changes needed.

#### Knowledge Base (`/client/knowledge`)

**Both tiers identical.** The contractor is the only person who knows their business. Both tiers add/edit KB entries.

No changes needed.

#### Onboarding Wizard (`/client/onboarding`)

**Both tiers identical.** KB setup is always contractor-driven.

No changes needed.

#### Lead Import (`/client/leads/import`)

**Both tiers identical.** Contractor imports their own leads/quotes.

No changes needed.

#### Flows (`/client/flows`)

**Managed: Hidden from nav. Page returns redirect to `/client`.**
Operator manages all automation sequences from the admin panel.

**Self-serve: Shown.** Contractor can enable/disable flows.

#### Team (`/client/team`)

**Both tiers identical.** Contractor manages their own team members and hot transfer routing.

No changes needed.

#### Reviews (`/client/reviews`)

**Both tiers identical.** Contractor approves AI-drafted Google review responses.

No changes needed.

#### Billing (`/client/billing`)

**Managed:**
- Shows: current plan (read-only), invoices, payment method, guarantee status, usage
- Hides: "Change Plan" / "Upgrade" button, plan picker
- Payment setup: via operator-sent payment link (not self-serve checkout)
- Can still: update payment method, retry failed payments, view/download invoices

**Self-serve:**
- Shows: everything — plan picker, upgrade, self-checkout
- Full self-service billing management

**Sub-pages:**
- `/client/billing/upgrade` — Managed: redirect to `/client/billing`. Self-serve: shown.
- `/client/billing/success` — Both: shown (after payment link or self-checkout).

#### Settings (`/client/settings`)

**Both tiers see these tabs:**

| Tab | Managed | Self-Serve |
|-----|:-------:|:----------:|
| General (weekly summary) | Yes | Yes |
| Notifications | Yes | Yes |
| AI (tone, goals, quiet hours) | Yes | Yes |
| Phone | Yes | Yes |
| Features (toggles, smart assist, calendar) | **No** | Yes |

**Managed removes the Features tab entirely.** Those toggles are operator-controlled via the admin panel. The contractor shouldn't be flipping AI on/off, changing smart assist delays, or toggling photo requests.

**Both tiers keep AI settings tab** — tone and primary goal are contractor preferences (only they know if they want "casual" or "professional").

**Both tiers keep Notifications tab** — notification preferences are personal.

#### Help (`/client/help`)

**Both tiers identical.**

No changes needed.

#### Discussions (`/client/discussions`)

**Both tiers identical.**

No changes needed.

#### Cancel (`/client/cancel`)

**Both tiers identical.** Both can initiate cancellation.

No changes needed.

## Operator Admin Changes

### Client Detail Page

Add a `serviceModel` badge + toggle on the client detail page:
- Badge showing "Managed" or "Self-Serve" on the client header
- Dropdown to change service model (operator can switch a client between tiers)

### Operator Payment Link (Managed Only)

New feature on the client detail page:
- "Send Payment Link" button
- Creates a Stripe Checkout Session with the plan pre-selected by the operator
- Sends the link via SMS + email to the contractor
- Contractor clicks → Stripe page → enters card → done
- No plan comparison, no portal navigation needed

## Implementation Plan

### Slice 0: Schema + Service Model Flag

**Files:**
- `src/db/schema/clients.ts` — add `serviceModel` column
- `src/db/schema/index.ts` — re-export (already exported)
- Migration via `npm run db:generate`

### Slice 1: Portal Nav Filtering

**Files:**
- `src/components/client-nav.tsx` — add `serviceModel` prop, filter nav items
- `src/app/(client)/layout.tsx` — pass `serviceModel` from client data to nav
- `src/app/(client)/client/flows/page.tsx` — redirect managed clients to `/client`
- `src/app/(client)/client/billing/upgrade/page.tsx` — redirect managed clients to `/client/billing`

### Slice 2: Settings Tab Filtering

**Files:**
- `src/app/(client)/client/settings/page.tsx` — pass `serviceModel` to `SettingsTabs`
- `src/app/(client)/client/settings/settings-tabs.tsx` — hide "Features" tab for managed
- `src/app/(client)/client/billing/billing-client.tsx` — hide "Change Plan" button for managed

### Slice 3: Operator Payment Link

**Files:**
- `src/app/(dashboard)/admin/clients/[id]/send-payment-link.tsx` — new client component (dialog)
- `src/app/api/admin/clients/[id]/payment-link/route.ts` — new API route (creates Stripe checkout + sends SMS)
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — add service model badge + payment link button

### Slice 4: Docs

**Files:**
- `docs/product/PLATFORM-CAPABILITIES.md` — document service model behavior
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` — add payment link workflow
- `docs/engineering/02-ACCESS-MANAGEMENT.md` — document service model field

## What Each ICP Sees

### Homeowner (Caller/Texter)

No change. They interact via SMS and voice calls. They never see the portal.

### Contractor — Managed Service

**Portal nav:** Dashboard, Conversations, Revenue, Knowledge Base, Team, Billing, Settings, Help, Discussions, Reviews (10 items)

**Settings tabs:** General, Notifications, AI, Phone (4 tabs — no Features)

**Billing:** Invoices + payment method only (no plan picker, no upgrade button)

**First experience:** Operator sends payment link during onboarding call → contractor clicks → enters card → done. Portal is just the scoreboard from day one.

### Contractor — Self-Serve

**Portal nav:** Dashboard, Conversations, Revenue, Knowledge Base, Flows, Team, Billing, Settings, Help, Discussions, Reviews (11 items — adds Flows)

**Settings tabs:** General, Notifications, AI, Phone, Features (5 tabs — includes Features)

**Billing:** Full self-service — plan picker, upgrade, checkout, change plan

**First experience:** Sign up → choose plan → checkout → set up phone → KB wizard → dashboard. Full self-serve onboarding.

### Operator (Agency Admin)

**No change to admin panel.** Operator sees everything regardless of service model. They can:
- View and configure all settings for any client
- Send payment links to managed clients
- Toggle service model per client
- See which clients are managed vs self-serve
