# SPEC-UX-02: Admin Nav Cleanup & Page Refinements

> **Status:** Approved
> **Priority:** Phase 2
> **Estimated scope:** ~12 files changed, 0 new pages, 0 pages removed
> **Depends on:** SPEC-UX-01 (renames and Compliance move must be done first)
> **Blocks:** Nothing

---

## Overview

Reduce admin nav weight and improve in-page organization. No pages are deleted — items are reorganized for better discoverability. Each change is independently deployable.

---

## Changes

### 1. Move Roles and Users into Team Page (Sub-Tabs)

**JTBD:**
- "I hired someone — give them access" → Team (monthly)
- "What can this role do?" → Roles (rarely)
- "Which contractors have portal access?" → Users (weekly)

Three separate nav items for a solo operator is heavy. But merging into one mega-page loses clarity. Solution: Team becomes the nav entry point with sub-tabs.

**What:**
- Add tabs to the Team page: "Members" (current team content), "Roles" (current roles content), "Portal Users" (current users content)
- Use URL-persisted tabs (`?tab=members|roles|users`) matching the pattern in `client-detail-tabs.tsx`
- Remove "Roles" and "Users" from the "Team & Access" nav group
- Keep `/admin/roles` and `/admin/users` routes alive as redirects to `/admin/team?tab=roles` and `/admin/team?tab=users` (bookmarks, deep links)

**Files:**
- `src/app/(dashboard)/admin/team/page.tsx` — restructure as tabbed layout, import role and user content
- `src/app/(dashboard)/admin/roles/page.tsx` — replace with redirect to `/admin/team?tab=roles`
- `src/app/(dashboard)/admin/users/page.tsx` — replace with redirect to `/admin/team?tab=users`
- `src/app/(dashboard)/layout.tsx` — remove Roles and Users from `getAdminNavItems` Team & Access group (lines ~52-54)
- May need to extract role/user content into shared components if they're currently inline in their page files

**Nav result:**
```
Team & Access (before): Team, Roles, Users, Audit Log  (4 items)
Team & Access (after):  Team, Audit Log                 (2 items)
```

**Doc updates:**
- `docs/engineering/02-ACCESS-MANAGEMENT.md` — update references to Roles and Users pages (now tabs within Team)
- `docs/product/PLATFORM-CAPABILITIES.md` — update Section 11 (Agency Operations) if team/roles UI is mentioned
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

### 2. Deduplicate MRR/Churn Between Platform Analytics and Billing

**JTBD:**
- Billing: "Any payment failures? Who's paying?" (operational, owns financial metrics)
- Platform Analytics: "How's my business growing?" (macro health — costs, lead funnel, satisfaction)

Both currently show MRR, Active Subscriptions, and Churn Rate. This is confusing — operator sees the same number in two places and wonders which is authoritative.

**What:**
- **Billing keeps** all financial metrics: MRR, Active Subscriptions, Churn Rate, Failed Payments, Revenue Chart, Subscription Table, Export SLA Queue
- **Platform Analytics removes** MRR, Active Clients (subscription count), and Churn Rate cards
- **Platform Analytics keeps** (unique content): New/Churned This Month counts, API Costs, Usage Today, Avg Cost/Client, Gross Margin, Client Satisfaction, Lead Funnel Waterfall
- Add a link at the top of Platform Analytics: "Financial metrics (MRR, churn) are on the [Billing](/admin/billing) page"

**Files:**
- `src/components/admin/platform-analytics.tsx` — remove MRR, Active Clients, and Churn Rate cards (lines ~46-70ish), add billing link
- No changes to Billing page

**Doc updates:**
- `docs/product/PLATFORM-CAPABILITIES.md` — update Section 11 if Platform Analytics content is listed
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

### 3. Client Detail: Triage-Aware Back Navigation

**JTBD:** "Go back to my priority queue." Operator follows: Triage → click client → finish → back. Currently "Back" always goes to `/admin/clients` (full list), not `/admin/triage`.

**What:**
- On the client detail page, check the `Referer` header or use a `?from=triage` query param
- If the operator came from triage, the "Back to Clients" link should say "Back to Triage" and link to `/admin/triage`
- Default behavior (no referrer or from client list) stays as-is: "Back to Clients" → `/admin/clients`

**Implementation approach:** Use query param `?from=triage` appended by the triage page links. This is more reliable than Referer headers.

**Files:**
- `src/app/(dashboard)/admin/triage/page.tsx` — add `?from=triage` to client detail links
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — read `from` param, conditionally render "Back to Triage" vs "Back to Clients"

**Doc updates:**
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

### 4. Voice AI: Client Filter + Tabbed Layout (Replace Accordion)

**JTBD:** "Configure voice for client X" and "Test voice output quality." Currently one accordion per client — works for 5, unwieldy at 20.

**What:**
- Replace the per-client accordion with a client selector dropdown at the top (reuse `ClientSelector` pattern or a simple `<select>`)
- Below the selector, show the selected client's voice config
- Add two tabs: "Settings" (VoiceSettings, VoicePicker) and "Testing" (VoicePlayground, QA checklist, CallHistory)
- Keep the global kill switch at the very top (above client selector)

**Files:**
- `src/app/(dashboard)/admin/voice-ai/page.tsx` — restructure from accordion to selector + tabs
- Voice sub-components (`voice-playground.tsx`, `voice-qa-checklist.tsx`, `voice-comparison.tsx`, `voice-simulator.tsx`) — no changes needed, just re-parented

**Doc updates:**
- `docs/product/PLATFORM-CAPABILITIES.md` — update Section 3 (Voice AI) if admin UI is described
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

## Acceptance Criteria

- [ ] "Team & Access" nav group shows only Team + Audit Log
- [ ] `/admin/team` has 3 tabs: Members, Roles, Portal Users
- [ ] `/admin/roles` and `/admin/users` redirect to `/admin/team?tab=...`
- [ ] Platform Analytics no longer shows MRR, Active Clients, or Churn Rate (these are on Billing only)
- [ ] Platform Analytics shows link to Billing for financial metrics
- [ ] Triage page links include `?from=triage`
- [ ] Client detail shows "Back to Triage" when `from=triage` param is present
- [ ] Voice AI page uses client selector instead of accordion
- [ ] Voice AI has Settings + Testing tabs
- [ ] Kill switch remains at top of Voice AI page
- [ ] `npm run quality:no-regressions` passes
- [ ] All doc updates completed

---

## Nav Structure After Phase 1 + 2

```
Clients (4):        Triage, Clients, Escalations, Support
Reporting (5):      Billing, Reports, Platform Health, Costs & Usage, TCPA Compliance
Optimization (5):   Flow Templates, Flow Analytics, A/B Tests, Reputation, AI Performance
Team & Access (2):  Team, Audit Log
Settings (8):       Agency, Phone Numbers, Twilio, Voice AI, Webhook Logs, Email Templates, API Keys, System Settings
AI (1):             AI Flagged Responses
```

Wait — AI Flagged Responses should stay in Clients group (it's client-level quality). Let me correct:

```
Clients (4):        Triage, Clients, Escalations, AI Flagged Responses
Reporting (5):      Billing, Reports, Platform Health, Costs & Usage, TCPA Compliance
Optimization (5):   Flow Templates, Flow Analytics, A/B Tests, Reputation, AI Performance
Team & Access (2):  Team, Audit Log
Settings (8):       Agency, Phone Numbers, Twilio, Voice AI, Webhook Logs, Email Templates, API Keys, System Settings
```

**Total: 24 nav items (down from 28)**

---

## Doc Sync Checklist

| Doc | What to update |
|-----|---------------|
| `docs/engineering/02-ACCESS-MANAGEMENT.md` | Roles/Users are now tabs within Team page |
| `docs/product/PLATFORM-CAPABILITIES.md` | Platform Analytics deduplication, Voice AI UI restructure |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Updated nav structure for operator reference |
| `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` | Mark Phase 2 items complete |
