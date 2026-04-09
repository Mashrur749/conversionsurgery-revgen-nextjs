# SPEC-UX-03: Client Detail Lifecycle-Aware Layout

> **Status:** Approved (pending verification)
> **Priority:** Phase 3
> **Estimated scope:** ~5 files changed
> **Depends on:** Nothing (can run in parallel with SPEC-UX-01 and SPEC-UX-02)
> **Blocks:** Nothing

---

## Overview

The client detail page (`/admin/clients/[id]`) is the operator's most-visited page (2-3x/day per client across 5-10 clients = 15-30 visits/day). The Overview tab should adapt to the client's lifecycle stage so the most relevant information is always above the fold.

---

## Pre-Implementation Verification

**Before writing any code, verify:**

Read `src/app/(dashboard)/admin/clients/[id]/page.tsx` and check whether the following props passed to `<ClientDetailTabs>` are already conditionally null for established clients:

| Prop | Question | If null for active clients → |
|------|----------|------------------------------|
| `onboardingChecklist` | Is this null when client status = active and all milestones complete? | No change needed |
| `dayOneActivationCard` | Is this null after Day 7 or when all day-one milestones are met? | No change needed |
| `onboardingQualityPanel` | Is this null when client is in autonomous mode? | No change needed |
| `guaranteeStatusCard` | Is this null after guarantee period ends (passed/failed)? | No change needed |

**If all four are already conditional → this spec is already satisfied. Mark complete, no code changes.**

**If any render content for established clients (3+ months active) → proceed with fixes below.**

---

## Changes (if needed)

### 1. Make Onboarding Panels Conditional

**JTBD for new client (0-30 days):** "Is onboarding on track?" → Onboarding panels should be prominent, above ROI.

**JTBD for active client (30+ days):** "Is this client healthy? What's their ROI?" → ROI should be first after engagement health badge.

**What:**
- `onboardingChecklist` → render only when client has incomplete onboarding milestones
- `dayOneActivationCard` → render only during first 7 days or when day-one milestones are incomplete
- `onboardingQualityPanel` → render only when client `aiAgentMode !== 'autonomous'`
- `guaranteeStatusCard` → render only when guarantee is actively pending (status = `proof_pending` or `recovery_pending`)

These conditions should be evaluated in `page.tsx` when building the props, passing `null` to `ClientDetailTabs` when the panel is not relevant.

**Files:**
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — add conditional logic around each panel's rendering

**The tab component itself (`client-detail-tabs.tsx`) needs no changes** — it already renders `{onboardingChecklist}` which is `null` when not passed.

---

### 2. Collapse System Settings Diagnostics

**JTBD:** "Change a system setting" (daily) vs "Debug cron issues" (rarely, during incidents).

**What:**
- Wrap `ReliabilityDashboard` and `CronCatchupManager` in a collapsible `<details>` element (or Radix Collapsible) with summary "System Diagnostics"
- Default to collapsed
- Keep `SystemSettingsManager` (the key-value config store) always visible — it's the primary purpose of the page

**Files:**
- `src/app/(dashboard)/admin/settings/page.tsx` — wrap diagnostic components in collapsible section

**Doc updates:**
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

## Acceptance Criteria

- [ ] Verification step completed: documented which panels are already conditional
- [ ] For active clients (3+ months, autonomous mode), Overview tab shows: Engagement Health Badge → ROI Dashboard (no onboarding/guarantee/day-one panels in the way)
- [ ] For new clients (0-30 days), onboarding panels still appear in current position
- [ ] System Settings page: diagnostics collapsed by default, expandable when needed
- [ ] `npm run quality:no-regressions` passes
- [ ] No visual regression for new-client view

---

## Doc Sync Checklist

| Doc | What to update |
|-----|---------------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Note lifecycle-aware client detail layout in Section 11 |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Update operator workflow notes if client detail usage is described |
| `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` | Mark Phase 3 items complete |
