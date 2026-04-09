# Platform UX Audit — 2026-04-09

> **Scope:** Every screen in admin (53 pages) and client portal (27 pages)
> **Perspectives:** Operator (solo founder, 5-10 clients) and ICP (contractor, mobile-first, managed service)
> **Criteria:** Bloat, JTBD flow, coherence, information hierarchy, mobile readiness

---

## Executive Summary

The platform has strong bones — the core flows (triage, onboarding wizard, client dashboard proof-of-work) are well-designed. But it suffers from **surface area bloat**: 80 pages built for a multi-agency future when the current need is a solo operator managing 5-10 clients.

**Three systemic issues:**

1. **Managed vs Self-Serve confusion** — The client portal exposes operator-owned tools (AI settings, phone provisioner, KB management, feature toggles) to contractors who bought a managed service.
2. **Admin page proliferation** — Multiple pages for the same concept (3 team pages, 2 phone pages, 4 analytics pages, 2 template performance pages). A solo operator navigates 57 nav items across 5 groups.
3. **Client detail information density** — The most-visited page (operator checks 2-3x/day per client) buries ROI metrics below onboarding panels that are irrelevant after week 3.

**Net recommendation:** Merge or remove ~15 admin pages, gate ~5 client portal pages behind service model, restructure the client detail overview tab.

---

## Part 1: Admin (Operator) Audit

### Navigation Structure (Current)

```
Clients (5 items):     Triage, Clients, Escalations, AI Quality, Discussions
Reporting (4 items):   Billing, Reports, Platform Health, Costs & Usage
Optimization (6):      Flow Templates, Flow Analytics, Variant Results, A/B Tests, Reputation, AI Effectiveness
Team & Access (4):     Team, Roles, Users, Audit Log
Settings (9):          Agency, Phone Numbers, Twilio, Voice AI, Compliance, Webhook Logs, Email Templates, API Keys, System Settings
```

**Total: 28 nav items + 25 sub-pages = 53 admin pages**

### CRITICAL — Must Fix

#### C1. Client Detail Overview: ROI Buried Below Onboarding Panels
**Pages:** `/admin/clients/[id]` (page.tsx + client-detail-tabs.tsx)
**Impact:** Operator visits this page 15-30x/day across clients. Currently must scroll past engagement badge → onboarding quality → day-one activation → guarantee status before reaching ROI dashboard.

**Fix:**
- Pin ROI dashboard as the 2nd element (after engagement health badge)
- Collapse onboarding panels to a compact badge when client status = active
- Move usage metrics from "Team & Billing" tab to Overview

#### C2. Wizard Phone Number Skip Without Consequences
**Page:** `/admin/clients/new/wizard/steps/step-phone-number.tsx`
**Impact:** Operator can skip phone assignment during onboarding call. SMS/voice features silently don't work. Review step warns but too late.

**Fix:** Remove "Skip" button OR add confirmation modal explaining that SMS/voice won't work until a number is assigned.

#### C3. Four Analytics Pages Covering Two Concepts
**Pages:**
- `/admin/analytics` — template performance by category
- `/admin/template-performance` — same data, cross-category view
- `/admin/platform-analytics` — MRR + costs (overlaps with `/admin/billing`)
- `/admin/ai-effectiveness` — AI trend metrics (overlaps with `/admin/ai-quality`)

**Fix:**
- Delete `/admin/template-performance` — add roll-up toggle to `/admin/analytics`
- Merge `/admin/platform-analytics` into `/admin/billing` as collapsible section
- Merge `/admin/ai-effectiveness` into `/admin/ai-quality` as "AI Health" with tabs (Issues + Trends)

#### C4. Three Team Pages for One Concept
**Pages:** `/admin/team` + `/admin/roles` + `/admin/users`
**Impact:** Solo operator has 1 user. Three pages for managing team members, role templates, and user access are triplication.

**Fix:** Merge into single "Team & Permissions" page. Keep Roles as an expandable section, not a separate page.

### IMPORTANT — Should Fix

#### I1. Phone Numbers + Twilio = Redundant
**Pages:** `/admin/phone-numbers` + `/admin/twilio`
Both show phone inventory with assignment status. Twilio also shows account balance.

**Fix:** Merge into one "Phone Inventory" page showing: account balance → all numbers → assignment status.

#### I2. Compliance Dashboard Misplaced in Settings
**Page:** `/admin/compliance`
This is a monitoring dashboard (compliance score, opt-out rate, quiet hours diagnostics) not a settings page.

**Fix:** Move to Reporting nav group. Rename to "TCPA Compliance Monitor."

#### I3. Voice AI Page is Three Pages in One
**Page:** `/admin/voice-ai`
Accordion per client with: VoiceSettings + VoicePicker + VoiceComparison + CallHistory + VoicePlayground + QA checklist + kill switch. Works for 5 clients, chaotic at 20+.

**Fix:** Split into: Voice Settings (per-client config), Voice Testing (playground + QA), Voice Kill Switch (move to System Settings).

#### I4. System Settings is a Kitchen Sink
**Page:** `/admin/settings`
Three unrelated systems: ReliabilityDashboard + CronCatchupManager + SystemSettingsManager.

**Fix:** Keep only critical toggles. Move cron/reliability to a hidden "Debug Panel" or Operations dashboard.

#### I5. Triage Desktop Table: Redundant "Action Needed" Column
**Page:** `/admin/triage`
8 columns including "Action Needed" which restates the numeric columns in sentence form.

**Fix:** Remove "Action Needed" on desktop (keep in mobile card layout where it's more useful).

#### I6. Client Detail: Back Button Goes to Client List, Not Triage
**Page:** `/admin/clients/[id]`
Operator follows triage → click client → back → sees full client list, not triage.

**Fix:** "Back to Clients" should detect referrer and go to `/admin/triage` when appropriate.

#### I7. Wizard Team Step: No Phone Number Validation
**Page:** `/admin/clients/new/wizard/steps/step-team-members.tsx`
Phone field accepts any string. Invalid numbers cause silent escalation failures.

**Fix:** Add `normalizePhoneNumber()` on blur with inline error.

### MINOR — Nice to Have

| # | Issue | Page | Fix |
|---|-------|------|-----|
| M1 | Reports page shows vanity stat cards (total count) | `/admin/reports` | Replace with "Pending this week" queue |
| M2 | Report detail has redundant Team Performance card | `/admin/reports/[id]` | Remove, fold data into metrics grid |
| M3 | Knowledge tabs unclear ordering | `/admin/clients/[id]/knowledge` | Reorder: Interview > Gaps > Entries |
| M4 | Revenue page title misleading | `/admin/clients/[id]/revenue` | Rename "Revenue Attribution" to "Pipeline" |
| M5 | Business hours 24h format unclear | Wizard step 4 | Add "(e.g., 09:00 = 9 AM)" helper |
| M6 | No loading overlay during wizard API calls | All wizard steps | Add spinner/overlay during saves |
| M7 | Client detail tabs could be 4 instead of 5 | `/admin/clients/[id]` | Consider merging Campaigns into Config |

### REMOVE / ARCHIVE

| Page | Reason | Action |
|------|--------|--------|
| `/admin/discussions` | Purpose unclear, empty, no workflow | Remove until use case defined |
| `/admin/webhook-logs` | Unused developer tool | Archive to debug panel |
| `/admin/nps` | Pre-launch, no data | Hide until post-launch |
| `/admin/help-articles` | No visible content, unclear owner | Remove until needed |
| `/admin/email-templates` | Full WYSIWYG editor for 3-5 fixed templates | Simplify to view-only config |

### Recommended Admin Nav (After Fixes)

```
Clients (4):        Triage, Clients, Escalations, AI Health
Reporting (4):      Billing (+ Platform Health), Reports, TCPA Compliance, Costs & Usage
Optimization (4):   Flow Templates, Flow Analytics, A/B Tests, Reputation
Team & Access (2):  Team Members, Audit Log
Settings (5):       Agency, Phone Inventory, Voice AI, API Keys, System
```

**Result: 28 → 19 nav items. 53 → ~38 pages.**

---

## Part 2: Client Portal (Contractor/ICP) Audit

### Navigation Structure (Current)

```
Overview, Leads, Conversations, Escalations, Scheduled, Analytics, Settings, Discussions
+ Sub-pages: Knowledge, Reviews, Flows, Reports, Revenue, Billing, Cancel, Team, Help, Onboarding, Welcome
```

### CRITICAL — Must Fix

#### CP1. Managed-Service Clients See Operator Tools
The portal exposes self-serve management screens to managed-service contractors:

| Page | Why it's wrong for managed service |
|------|----------------------------------|
| `/client/settings/ai` | AI tone, emoji, quiet hours = operator decisions |
| `/client/settings/phone` | Phone provisioner = operator sets up during onboarding |
| `/client/settings/features` | Feature toggles = operator controls activation pace |
| `/client/knowledge` | KB management = operator maintains during check-ins |

**Fix:** Gate behind `serviceModel`. For managed service: show read-only status views, hide configuration UI. For future self-serve: show full management tools.

#### CP2. Flows Nav Link Visible Despite Correct Code Gate
**Page:** `/client/flows` — code correctly redirects managed-service clients to dashboard. But the nav link is still visible (self-serve gating works, but link exists for all).

**Fix:** Ensure nav filtering matches page-level gating. If flows redirect managed clients, don't show the nav link.

### IMPORTANT — Should Fix

#### CPI1. Dashboard Card Density on Mobile
**Page:** `/client` (dashboard)
10+ cards stacked. Above-the-fold on 375px shows: SinceLastVisit + VoiceStatus + maybe Setup reminder. The most important card ("Jobs We Helped Win" — revenue proof) requires significant scrolling.

**Fix:** Consider collapsing Setup/Audit/Guarantee cards into a single "Onboarding Progress" card during first 30 days. After day 30, remove them entirely.

#### CPI2. Leads Import Ownership Unclear
**Page:** `/client/leads/import`
CSV upload for past leads. But managed service promise is "we handle everything." Does operator import during onboarding, or does contractor self-import?

**Fix:** Clarify ownership. If operator imports: gate for managed service. If contractor: keep, but add helper explaining why ("Upload your past quotes so we can start following up for you").

#### CPI3. Reviews Approval Policy Unclear
**Page:** `/client/reviews`
Shows pending AI-drafted review responses for contractor approval. But if managed service auto-posts: this page has no purpose.

**Fix:** Clarify: does operator auto-post reviews, or does contractor approve them? Gate accordingly.

#### CPI4. Team Page Noise for Solo Contractors
**Page:** `/client/team`
Most ICP contractors are solo operators or tiny crews. A "Team" nav item for 1 person is noise.

**Fix:** Hide "Team" from nav when only the owner exists. Unhide when a team member is added.

### MINOR

| # | Issue | Page | Fix |
|---|-------|------|-----|
| CPM1 | "Discussions" page title should say "Support" | `/client/discussions` | Rename for clarity |
| CPM2 | Revenue vs Reports nav could be clearer | Both pages | Consider tooltips: "Live metrics" vs "Historical reports" |
| CPM3 | Settings has 5 tabs when managed needs 2 | `/client/settings` | Filter tabs: managed = General + Notifications only |

### Client Portal Summary

The portal is well-structured with proof-first design (dashboard shows system activity, won jobs, ROI). The welcome page is excellent. The core issue is **managed-service clients see self-serve tools**, creating confusion about who owns what.

**Recommended client nav for managed service:**
```
Dashboard, Conversations, Revenue, Reports, Help
(Team — show only if >1 member)
(Settings — General + Notifications only)
```

**For future self-serve:**
```
Dashboard, Conversations, Leads, Revenue, Reports, Flows, Knowledge, Reviews, Team, Settings (all tabs), Help
```

---

## Part 3: Cross-Cutting Issues

### Coherence

| Pattern | Consistent? | Issue |
|---------|------------|-------|
| Breadcrumbs | Mostly yes | Reviews page missing client name in breadcrumb |
| Empty states | Yes | All include explanation + next action |
| Mobile card fallback | Yes | Tables use `hidden sm:block` / `sm:hidden` pattern |
| Color coding | Yes | Brand palette used consistently |
| Loading states | Partial | Wizard lacks loading overlay during API calls |
| Back navigation | Yes | Client detail uses `?from=triage` for triage-aware back navigation (fixed 2026-04-09) |

### Mobile Readiness

| Area | Score | Issue |
|------|-------|-------|
| Admin triage | 9/10 | Card layout is excellent |
| Admin client detail | 7/10 | Tab scrolling works but is cramped |
| Admin wizard | 8/10 | Inputs are full-width, buttons stack properly |
| Client dashboard | 7/10 | Too many cards, key info requires scrolling |
| Client conversations | 9/10 | Split-pane works well on mobile |
| Client settings | 8/10 | Tab interface is clean |

---

## Implementation Specs

> **Reassessed 2026-04-09.** Original audit over-optimized for page count reduction. Reassessment focuses on JTBD: does each change make the user's task easier, or just reduce nav items? Several merges were dropped; renames and deduplication replaced them.

### Decisions Revised During Reassessment

| Original Recommendation | Revised Decision | Reason |
|---|---|---|
| Merge Team + Roles + Users | Keep separate, move Roles/Users to tabs within Team | Different JTBDs; mega-page adds complexity |
| Merge Phone Numbers + Twilio | Keep both, add Twilio balance badge to Phone Numbers | Different JTBDs (client-centric vs infrastructure) |
| Merge Platform Analytics + Billing | Deduplicate overlapping MRR/churn cards instead | Different JTBDs (macro health vs payment ops) |
| Merge AI Quality + AI Effectiveness | Rename for clarity instead of merging | Different frequencies (daily reactive vs weekly trends) |
| Remove triage Action Needed column | KEEP — it translates data into decisions | Most actionable column on triage page |
| Split Voice AI into 3 pages | Reorganize in place (client selector + tabs) | Splitting adds more nav sprawl |
| Remove 5 "unused" pages | KEEP all 5 (Discussions, Help Articles, Email Templates, NPS, Webhook Logs) | All are real features with schemas, APIs, and clear purpose |

### Spec Files

| Spec | Phase | Scope | Status |
|------|-------|-------|--------|
| [SPEC-UX-01](SPEC-UX-01-QUICK-WINS.md) | Phase 1 | Template merge, renames, Compliance move, wizard fixes, reports queue, Twilio badge | **Complete** (2026-04-09) |
| [SPEC-UX-02](SPEC-UX-02-NAV-CLEANUP.md) | Phase 2 | Team sub-tabs, Platform Analytics dedup, triage-aware back nav, Voice AI reorganize | **Complete** (2026-04-09) |
| [SPEC-UX-03](SPEC-UX-03-CLIENT-DETAIL-LIFECYCLE.md) | Phase 3 | Client detail lifecycle-aware layout, System Settings collapse diagnostics | **Complete** (2026-04-09) &mdash; 3 of 4 panels were already conditional; only onboardingQualityPanel needed fixing |
| [SPEC-UX-04](SPEC-UX-04-SERVICE-MODEL-GATING.md) | Phase 4 | serviceModel schema, portal gating, review approval modes, nav filtering | **Complete** (2026-04-09) |
| [SPEC-UX-05](SPEC-UX-05-REVIEW-APPROVAL-MODE.md) | Phase 5 | reviewApprovalMode, auto-post positive, hold negative, operator batch-approve, forward-to-client | **Complete** (2026-04-09) |

### Execution Order

```
SPEC-UX-01 (quick wins) → SPEC-UX-02 (nav cleanup) → SPEC-UX-04 (service model)
                           SPEC-UX-03 (lifecycle) can run in parallel with 01 or 02
```
