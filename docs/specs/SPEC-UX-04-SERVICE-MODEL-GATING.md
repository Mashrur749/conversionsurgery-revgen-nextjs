# SPEC-UX-04: Service Model Gating

> **Status:** Approved
> **Priority:** Phase 4
> **Estimated scope:** Schema change + ~15 files
> **Depends on:** SPEC-UX-01 (renames should be done first for consistency)
> **Blocks:** Nothing

---

## Overview

Add a `serviceModel` field to the `clients` table that controls which portal features are visible to each contractor. This implements the three-view model:

1. **Operator/Agency** — full admin access (no changes, current `/admin` behavior)
2. **Managed** — lean client portal. Operator owns configuration. Contractor sees proof-of-work + conversations + billing.
3. **Self-serve** — full client portal. Contractor manages their own setup, AI, flows, etc.

Default for all existing and new clients: `managed` (matches the current managed-service launch).

---

## Schema Change

### Add `serviceModel` enum to clients table

**Enum values:** `'managed'` | `'self_serve'`

**Default:** `'managed'`

**Files:**
- `src/db/schema/clients.ts` — add `serviceModel` column with enum
- Run `npm run db:generate` to create migration
- Review migration SQL before applying

**Migration SQL (expected):**
```sql
DO $$ BEGIN
  CREATE TYPE service_model AS ENUM ('managed', 'self_serve');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE clients ADD COLUMN service_model service_model NOT NULL DEFAULT 'managed';
```

---

## Client Portal Gating

### Navigation Filtering

**JTBD:** Managed-service contractors should see only what they need. Self-serve contractors see everything.

**Current client nav items (from layout.tsx):**
```
Overview, Leads, Conversations, Escalations, Scheduled, Analytics, Settings, Discussions
```

**Managed service nav (hide items the operator owns):**
```
Overview, Conversations, Revenue, Reports, Help
(Team — only if >1 member)
(Settings — General + Notifications tabs only)
```

**Self-serve nav (full access):**
```
All current items + Knowledge, Reviews, Flows
```

**Files:**
- `src/app/(dashboard)/layout.tsx` — filter `navItems` based on `client.serviceModel` from session
- Need to pass `serviceModel` through the client session or fetch it in layout

### Page-Level Gating

For managed-service clients, these pages should either redirect to dashboard or show a read-only view:

| Page | Managed behavior | Self-serve behavior |
|------|-----------------|-------------------|
| `/client/settings/ai` | Redirect to `/client/settings` (show read-only AI status badge on General tab) | Full access |
| `/client/settings/phone` | Redirect to `/client/settings` (show "Your business line: XXX" read-only) | Full provisioner |
| `/client/settings/features` | Redirect to `/client/settings` | Full toggles |
| `/client/knowledge` | Redirect to `/client` or show read-only KB list | Full CRUD |
| `/client/flows` | Already redirects managed clients (existing code) | Full access |
| `/client/leads/import` | Redirect to `/client` | Full CSV upload |
| `/client/reviews` | Depends on review approval policy (see below) | Full access |

**Files (one per gated page):**
- `src/app/(client)/client/settings/ai/page.tsx` — add serviceModel check
- `src/app/(client)/client/settings/phone/page.tsx` — add serviceModel check, show read-only for managed
- `src/app/(client)/client/settings/features/page.tsx` — add serviceModel check
- `src/app/(client)/client/knowledge/page.tsx` — add serviceModel check
- `src/app/(client)/client/leads/import/page.tsx` — add serviceModel check
- `src/app/(client)/client/reviews/page.tsx` — depends on policy decision

### Settings Tab Filtering

For managed clients, the Settings page should show only General + Notifications tabs:

**Files:**
- `src/app/(client)/client/settings/page.tsx` — filter visible tabs based on serviceModel

### Team Nav Conditional

Hide "Team" from nav when contractor has no team members (only the owner):

**Files:**
- Client nav rendering — check member count, conditionally include Team link

---

## Review Approval Policy

**Decision needed (confirmed in conversation):** For managed service, operator approves review responses. Contractor sees them only if the review is negative/sensitive.

**Implementation:**
- Add `reviewApprovalMode` field to clients: `'operator_managed'` (default for managed) | `'client_approves'` (default for self-serve)
- Admin review dashboard gets a "Batch Approve" action for operator
- For `operator_managed` clients: auto-post approved responses, forward to contractor only for negative reviews (rating <= 2)
- `/client/reviews` page for managed clients: show only flagged reviews that need contractor input, with read-only list of all reviews below

**Files:**
- `src/db/schema/clients.ts` — add `reviewApprovalMode` column
- `src/app/(client)/client/reviews/page.tsx` — conditional view based on mode
- `src/app/(dashboard)/admin/clients/[id]/reviews/page.tsx` — add batch approve action
- `src/lib/services/review-service.ts` — add auto-post logic for operator-managed mode

---

## Admin: Service Model Toggle

The operator needs to set/change the service model per client:

**Files:**
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — add serviceModel indicator to client header
- Client edit form or Configuration tab — add serviceModel dropdown (managed/self-serve)
- `src/app/api/admin/clients/[id]/route.ts` — add `serviceModel` to PATCH schema

---

## Acceptance Criteria

- [ ] `serviceModel` column exists on clients table with default `'managed'`
- [ ] All existing clients default to `'managed'`
- [ ] Managed-service contractor nav shows: Overview, Conversations, Revenue, Reports, Help (+ Team if >1 member, + Settings with 2 tabs)
- [ ] Self-serve contractor nav shows all current items
- [ ] Managed clients redirected from: AI settings, Phone settings, Features, Knowledge, Leads Import
- [ ] Managed clients see read-only phone number and AI status on Settings General tab
- [ ] Review approval mode works: operator batch-approves for managed, contractor approves for self-serve
- [ ] Operator can toggle serviceModel in client configuration
- [ ] `npm run quality:no-regressions` passes
- [ ] All doc updates completed

---

## Doc Sync Checklist

| Doc | What to update |
|-----|---------------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Add new section on Service Model (managed vs self-serve portal views) |
| `docs/product/PLATFORM-CAPABILITIES.md` | Update Section 5 (Client Portal) with conditional nav/page visibility |
| `docs/product/PLATFORM-CAPABILITIES.md` | Update Section 12 (Review Monitoring) with review approval modes |
| `docs/engineering/01-TESTING-GUIDE.md` | Add test steps for service model gating (managed vs self-serve portal) |
| `docs/engineering/01-TESTING-GUIDE.md` | Add test step for review approval flow |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Document managed-service portal experience for operator reference |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Add service model toggle to operator workflow |
| `docs/business-intel/OFFER-APPROVED-COPY.md` | Flag to user: review approval policy may affect "we handle everything" claims |
| `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` | Mark Phase 4 items complete |
| `docs/product/FEATURE-BACKLOG.md` | Mark service model gating as implemented |

---

## Migration Checklist

- [ ] Create migration with `npm run db:generate`
- [ ] Review SQL (should be additive — new column with default, no data loss)
- [ ] User confirms before `npm run db:migrate`
- [ ] Verify all existing clients get `serviceModel = 'managed'`
- [ ] Verify all existing clients get `reviewApprovalMode = 'operator_managed'`
