# Feature Plan: UX Audit Implementation (SPEC-UX-01 through UX-03)

> **Created:** 2026-04-09
> **Status:** Planning
> **Slices:** 4

## Overview

Implement the reassessed UX audit findings from SPEC-UX-01 (Quick Wins), SPEC-UX-02 (Nav Cleanup), and SPEC-UX-03 (Client Detail Lifecycle). No schema changes. No new pages. One page merged, several reorganized.

**Critical constraint:** `layout.tsx` is touched by multiple spec items (nav renames, compliance move, template performance removal, roles/users removal). All nav changes must be in one slice.

**SPEC-UX-03 finding:** Pre-implementation verification shows that 3 of 4 client detail panels are already conditional. Only `onboardingQualityPanel` always renders and needs to be made lifecycle-aware.

## Success Criteria

1. Admin nav drops from 28 to 24 items (Variant Results removed, Roles/Users collapsed into Team)
2. Template Performance page redirects to Flow Analytics with roll-up toggle
3. Compliance appears under Reporting; Discussions renamed to Support; AI pages renamed
4. Wizard phone skip shows consequences warning; team member phone is validated
5. Reports page shows "due this week" queue instead of vanity counts
6. Phone Numbers page shows Twilio balance badge
7. Team page has 3 sub-tabs (Members, Roles, Portal Users)
8. Platform Analytics no longer duplicates Billing's MRR/churn/subscription cards
9. Voice AI uses client selector + tabs instead of per-client accordion
10. Client detail hides onboarding quality panel for autonomous-mode clients
11. System Settings collapses diagnostics by default
12. Triage links include `?from=triage`; client detail shows "Back to Triage" when appropriate
13. `npm run quality:no-regressions` passes
14. All docs updated per spec checklists

---

## Slices

### Slice 0: Nav Restructuring + Template Merge + Renames
> **Branch:** `feature/ux-audit/slice-0`
> **Dependencies:** None
> **Status:** ⬜ Not Started

**What:** All changes that touch `layout.tsx` (the nav bottleneck). Also merges Template Performance into Flow Analytics and updates page titles to match new nav labels.

**Scope:**
- `src/app/(dashboard)/layout.tsx` — nav item changes:
  - Remove `{ href: '/admin/template-performance', label: 'Variant Results' }` from Optimization
  - Move `Compliance` from Settings to Reporting, rename to `TCPA Compliance`
  - Rename `Discussions` → `Support` (Clients group, line 35)
  - Rename `AI Quality` → `AI Flagged Responses` (Clients group, line 34)
  - Rename `AI Effectiveness` → `AI Performance` (Optimization group, line 49)
  - Remove `Roles` and `Users` from Team & Access group (lines 53-54)
- `src/app/(dashboard)/admin/template-performance/page.tsx` — replace content with redirect to `/admin/analytics`
- `src/app/(dashboard)/admin/analytics/page.tsx` — add a "View all variants" toggle that renders `TemplatePerformanceDashboard` as an alternate view
- `src/app/(dashboard)/admin/discussions/page.tsx` — update `<h1>` to "Support"
- `src/app/(dashboard)/admin/ai-quality/page.tsx` — update page title to "AI Flagged Responses"
- `src/app/(dashboard)/admin/ai-effectiveness/page.tsx` — update page title to "AI Performance"

**Contract:**
- Produces: Updated nav structure (24 items), analytics page with toggle, working redirects
- Consumes: `TemplatePerformanceDashboard` component (import into analytics page)

**Done when:**
- [ ] Nav shows 24 items in correct groups
- [ ] `/admin/template-performance` redirects to `/admin/analytics`
- [ ] Flow Analytics has "By Category" / "All Variants" toggle
- [ ] Page titles match nav labels (Support, AI Flagged Responses, AI Performance)
- [ ] `npm run typecheck` passes
- [ ] `npm run quality:no-regressions` passes

**Doc updates (in this slice):**
- `docs/product/PLATFORM-CAPABILITIES.md` — Template Performance merge note, Compliance nav location, AI page renames, Team nav changes
- `docs/operations/01-OPERATIONS-GUIDE.md` — page name references

---

### Slice 1: Wizard Fixes + Reports Queue + Twilio Badge
> **Branch:** `feature/ux-audit/slice-1`
> **Dependencies:** None (can run parallel with Slice 0)
> **Status:** ⬜ Not Started

**What:** Independent page-level fixes. No file overlaps with any other slice.

**Scope:**
- `src/app/(dashboard)/admin/clients/new/wizard/steps/step-phone-number.tsx` — add inline warning near "Skip for now" button: "SMS alerts and voice calls won't work until a business line is assigned. You can assign one later from the client detail page."
- `src/app/(dashboard)/admin/clients/new/wizard/steps/step-team-members.tsx` — add phone validation using `normalizePhoneNumber()` from `@/lib/utils/phone`. Show inline error on blur for invalid format.
- `src/app/(dashboard)/admin/reports/page.tsx` — replace the 3 vanity stat cards (lines 48-64: Total Reports, Bi-Weekly, Monthly) with a "Reports Due This Week" queue. Compute which clients have bi-weekly reports due within 7 days based on last report date + 14-day cycle.
- `src/app/(dashboard)/admin/phone-numbers/page.tsx` — add Twilio balance badge in header. Fetch balance using the same Twilio API call used by `/admin/twilio` page. Display as linked badge: "Twilio Balance: $XX.XX → [View Account](/admin/twilio)".

**Contract:**
- Produces: Wizard validates phones, shows skip warning; Reports page has actionable queue; Phone Numbers shows balance
- Consumes: `normalizePhoneNumber()` from `@/lib/utils/phone`, Twilio balance API

**Done when:**
- [ ] Wizard phone skip shows warning text (not modal)
- [ ] Wizard team member phone field rejects invalid numbers with inline error
- [ ] Reports page shows "Reports Due" instead of count cards
- [ ] Phone Numbers header shows Twilio balance as linked badge
- [ ] `npm run typecheck` passes
- [ ] `npm run quality:no-regressions` passes

**Doc updates (in this slice):**
- `docs/engineering/01-TESTING-GUIDE.md` — wizard phone skip warning step, team phone validation step

---

### Slice 2: Team Sub-Tabs + Platform Analytics Dedup + Voice AI Reorganize
> **Branch:** `feature/ux-audit/slice-2`
> **Dependencies:** Slice 0 (nav must remove Roles/Users first)
> **Status:** ⬜ Not Started

**What:** Three independent page restructures. No file overlaps between them or with other slices.

**Scope:**
- `src/app/(dashboard)/admin/team/page.tsx` — restructure as tabbed layout with 3 URL-persisted tabs: "Members" (current team content), "Roles" (content from roles page), "Portal Users" (content from users page). Use `?tab=members|roles|users` pattern matching `client-detail-tabs.tsx`.
- `src/app/(dashboard)/admin/roles/page.tsx` — replace with redirect to `/admin/team?tab=roles`
- `src/app/(dashboard)/admin/users/page.tsx` — replace with redirect to `/admin/team?tab=users`
- `src/components/admin/platform-analytics.tsx` — remove MRR card, Active Clients card, and Churn Rate card (lines ~46-70). Add a link at top: "Financial metrics (MRR, churn) are on the [Billing](/admin/billing) page."
- `src/app/(dashboard)/admin/voice-ai/page.tsx` — replace per-client `<details>` accordion (lines 84-144) with: client selector dropdown at top → selected client's config below → two tabs: "Settings" (VoiceSettings, VoicePicker, VoiceComparison) and "Testing" (VoiceQaChecklist, VoicePlayground, CallHistory). Keep kill switch at very top above selector.

**Contract:**
- Produces: Team page with sub-tabs and redirects; Platform Analytics without duplicated metrics; Voice AI with client selector + tabs
- Consumes: Existing role/user page content (extracted to inline or shared components); existing voice sub-components (re-parented)

**Done when:**
- [ ] `/admin/team` has 3 tabs: Members, Roles, Portal Users
- [ ] `/admin/roles` redirects to `/admin/team?tab=roles`
- [ ] `/admin/users` redirects to `/admin/team?tab=users`
- [ ] Platform Analytics shows no MRR, Active Clients, or Churn Rate (only on Billing)
- [ ] Platform Analytics has link to Billing page
- [ ] Voice AI uses client dropdown selector (not accordion)
- [ ] Voice AI has Settings + Testing tabs per selected client
- [ ] Kill switch remains at top of Voice AI page
- [ ] `npm run typecheck` passes
- [ ] `npm run quality:no-regressions` passes

**Doc updates (in this slice):**
- `docs/engineering/02-ACCESS-MANAGEMENT.md` — Roles/Users are now tabs within Team
- `docs/product/PLATFORM-CAPABILITIES.md` — Platform Analytics dedup note, Voice AI UI structure

---

### Slice 3: Client Detail Lifecycle + Triage Back Nav + Settings Collapse
> **Branch:** `feature/ux-audit/slice-3`
> **Dependencies:** None (can run parallel with Slice 0)
> **Status:** ⬜ Not Started

**What:** Client detail lifecycle-awareness, triage-aware back navigation, and System Settings diagnostics collapse.

**Pre-implementation verification result:** 3 of 4 panels are already conditional:
- `onboardingChecklist` → already `null` when `setupComplete` is true ✅
- `dayOneActivationCard` → already `null` when active + all milestones complete ✅
- `guaranteeStatusCard` → already `null` when `guaranteeCardProps` is null ✅
- `onboardingQualityPanel` → **always renders** — needs to be made conditional ❌

**Scope:**
- `src/app/(dashboard)/admin/clients/[id]/page.tsx`:
  - Make `onboardingQualityPanel` conditional: render `null` when `client.aiAgentMode === 'autonomous'` (line 487-491)
  - Read `from` search param; if `from=triage`, render "Back to Triage" linking to `/admin/triage` instead of "Back to Clients" (line 398). Update breadcrumb similarly.
- `src/app/(dashboard)/admin/triage/page.tsx` — append `?from=triage` to all client detail `<Link>` hrefs
- `src/app/(dashboard)/admin/settings/page.tsx` — wrap `<ReliabilityDashboard />` and `<CronCatchupManager />` in a collapsible `<details>` element with summary "System Diagnostics (cron, reliability)" defaulting to closed. Keep `<SystemSettingsManager>` always visible above.

**Contract:**
- Produces: Lifecycle-aware client detail (ROI not buried for active clients); triage flow continuity; cleaner System Settings
- Consumes: `client.aiAgentMode` for conditional rendering; `searchParams` for triage back nav

**Done when:**
- [ ] Active client in autonomous mode: Overview shows Engagement Health → ROI Dashboard (no onboarding quality panel)
- [ ] New client: all panels still appear as before
- [ ] Triage links go to `/admin/clients/[id]?from=triage`
- [ ] Client detail shows "Back to Triage" with triage link when `from=triage` param present
- [ ] System Settings: diagnostics collapsed by default, expandable
- [ ] `npm run typecheck` passes
- [ ] `npm run quality:no-regressions` passes

**Doc updates (in this slice):**
- `docs/product/PLATFORM-CAPABILITIES.md` — lifecycle-aware client detail note in Section 11
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark all Phase 1-3 items complete

---

## Merge Order

```
Slice 0 (nav + template merge) → Slice 2 (team tabs + analytics dedup + voice AI)
Slice 1 (wizard + reports + phone) — parallel with Slice 0
Slice 3 (client detail + triage + settings) — parallel with Slice 0
```

Slices 1 and 3 have zero dependencies and can run in parallel with Slice 0.
Slice 2 depends on Slice 0 (Roles/Users nav removal must happen before Team redirects make sense).

```
         ┌── Slice 1 (wizard, reports, phone) ──┐
Slice 0 ─┤                                      ├── Done
         ├── Slice 3 (client detail, settings) ──┤
         └── Slice 2 (team, analytics, voice) ───┘
                      (depends on 0)
```

## Risks

- **layout.tsx merge conflicts:** If any other work touches `getAdminNavItems` between Slice 0 merge and Slice 2, there will be conflicts. Merge Slice 0 first and rebase Slice 2.
- **Team page restructure complexity:** Extracting roles/users content into tabs may require creating new shared components if the current page files have inline DB queries. The roles and users pages will need their content extracted into components that can be imported by the Team page.
- **Voice AI page size:** The Voice AI reorganization is the largest single change. The current page loads all clients + their settings. The new client selector pattern needs to either pre-load all data (current approach) or lazy-load per selection. Pre-loading is simpler and maintains server-component rendering.
- **Reports "due" logic:** Computing which reports are due requires knowing the last report date per client and the bi-weekly cycle. This may need a simple query; if the data model doesn't track "next report due date," we compute it from the last report's `createdAt` + 14 days.
