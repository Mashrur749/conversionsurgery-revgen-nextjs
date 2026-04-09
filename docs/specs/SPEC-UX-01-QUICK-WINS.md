# SPEC-UX-01: UX Audit Quick Wins

> **Status:** Approved
> **Priority:** Phase 1
> **Estimated scope:** ~10 files changed, 0 new pages, 1 page merged
> **Depends on:** Nothing
> **Blocks:** SPEC-UX-02 (nav cleanup references these renames)

---

## Overview

Low-risk changes from the 2026-04-09 platform UX audit. Each item is independently deployable. No schema changes, no new routes, no architectural decisions.

---

## Changes

### 1. Merge Template Performance into Flow Analytics

**JTBD:** "Which message variants are winning?" — both pages answer this with the same data, different grouping.

**What:**
- Add a "View by category / View all variants" toggle to the Flow Analytics page
- Inline the `TemplatePerformanceDashboard` component (or its logic) into the analytics page as a second view mode
- Remove `/admin/template-performance` from the nav
- Keep the route alive (redirect to `/admin/analytics`) to avoid broken bookmarks

**Files:**
- `src/app/(dashboard)/admin/analytics/page.tsx` — add toggle + all-variants view
- `src/app/(dashboard)/admin/template-performance/page.tsx` — replace with redirect to `/admin/analytics`
- `src/app/(dashboard)/layout.tsx` — remove "Variant Results" from `getAdminNavItems` Optimization group (line ~47)

**Doc updates:**
- `docs/product/PLATFORM-CAPABILITIES.md` — update any references to "Template Performance" page
- `docs/engineering/01-TESTING-GUIDE.md` — update test steps if template performance page is referenced
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark this item complete

---

### 2. Move Compliance from Settings to Reporting Nav Group

**JTBD:** "Am I compliant?" is a reporting question, not a settings question.

**What:**
- Move the `{ href: '/admin/compliance', label: 'Compliance' }` entry from Settings group to Reporting group
- Rename label to "TCPA Compliance" for clarity

**Files:**
- `src/app/(dashboard)/layout.tsx` — move nav item between groups (lines ~57-67)
- `src/components/mobile-nav.tsx` — no changes needed (reads from same groups prop)

**Doc updates:**
- `docs/product/PLATFORM-CAPABILITIES.md` — update Section 6 (Compliance) to note nav location change
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

### 3. Rename Nav Items for Clarity

**JTBD:** Names should make the page's purpose obvious without clicking.

| Current | New | Reason |
|---------|-----|--------|
| "Discussions" (Clients group) | "Support" | JTBD is "handle contractor support questions" |
| "AI Quality" (Clients group) | "AI Flagged Responses" | Makes clear it's an error log, not a dashboard |
| "AI Effectiveness" (Optimization group) | "AI Performance" | Cleaner, distinguishes from the error log |

**Files:**
- `src/app/(dashboard)/layout.tsx` — update labels in `getAdminNavItems` (lines ~31, 34, 49)
- `src/components/mobile-nav.tsx` — reads from same prop, no changes
- `src/app/(dashboard)/admin/discussions/page.tsx` — update `<h1>` from "Support Discussions" to "Support" (line 51)
- `src/app/(dashboard)/admin/ai-quality/page.tsx` — update page title if it says "AI Quality"
- `src/app/(dashboard)/admin/ai-effectiveness/page.tsx` — update page title if it says "AI Effectiveness"

**Doc updates:**
- `docs/product/PLATFORM-CAPABILITIES.md` — update Section 11 (Observability) for AI page name changes
- `docs/operations/01-OPERATIONS-GUIDE.md` — update any references to these page names
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

### 4. Wizard Phone Skip: Add Warning

**JTBD:** Complete onboarding in 30 minutes. Skip is necessary for async scenarios (porting, buying later) but consequences must be clear.

**What:**
- When operator clicks "Skip for now" on the phone number step, show inline warning text (not a blocking modal): "SMS alerts and voice calls won't work until a business line is assigned. You can assign one later from the client detail page."
- Keep the skip functionality — don't remove it

**Files:**
- `src/app/(dashboard)/admin/clients/new/wizard/steps/step-phone-number.tsx` — add warning text near the skip button (around line 493)

**Doc updates:**
- `docs/engineering/01-TESTING-GUIDE.md` — update wizard test step to verify warning appears on skip

---

### 5. Wizard Team Member Phone Validation

**JTBD:** "Add a team member who will receive escalation alerts." Invalid phone = silent escalation failure.

**What:**
- Add `normalizePhoneNumber()` validation on the team member phone field
- Show inline error on blur if format is invalid: "Enter a 10-digit phone number including area code"
- Prevent adding team member with invalid phone

**Files:**
- `src/app/(dashboard)/admin/clients/new/wizard/steps/step-team-members.tsx` — add validation logic to phone input (around line 140)
- Import `normalizePhoneNumber` from `@/lib/utils/phone`

**Doc updates:**
- `docs/engineering/01-TESTING-GUIDE.md` — update wizard test step to verify phone validation

---

### 6. Reports Page: Replace Vanity Stat Cards with Actionable Queue

**JTBD:** "Which reports are due this week?" not "How many reports have I ever generated?"

**What:**
- Remove the 3 stat cards (total reports, bi-weekly count, monthly count)
- Replace with a "Reports Due" queue showing clients whose next bi-weekly report is due within 7 days, or a simple "All reports up to date" message
- Keep the existing report list table below

**Files:**
- `src/app/(dashboard)/admin/reports/page.tsx` — replace stat cards section (around lines 48-64) with due-reports logic

**Doc updates:**
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

### 7. Add Twilio Balance Badge to Phone Numbers Page

**JTBD:** "Do I have credit to buy a number for this new client?" — answered without navigating to Twilio page.

**What:**
- Fetch Twilio account balance on the Phone Numbers page
- Display as a small badge in the page header: "Twilio Balance: $XX.XX"
- Link it to `/admin/twilio` for full account details

**Files:**
- `src/app/(dashboard)/admin/phone-numbers/page.tsx` — add balance fetch + badge in header area
- May need to import or call the same balance-fetch logic used by `/admin/twilio`

**Doc updates:**
- `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` — mark complete

---

## Acceptance Criteria

- [ ] `/admin/template-performance` redirects to `/admin/analytics` with roll-up toggle visible
- [ ] "Variant Results" removed from nav; "TCPA Compliance" appears under Reporting
- [ ] Nav labels updated: Support, AI Flagged Responses, AI Performance
- [ ] Page titles on those 3 pages match their new nav labels
- [ ] Wizard phone skip shows warning text
- [ ] Wizard team member rejects invalid phone numbers with inline error
- [ ] Reports page shows "due this week" queue instead of count cards
- [ ] Phone Numbers page shows Twilio balance badge
- [ ] `npm run quality:no-regressions` passes
- [ ] All doc updates listed above are completed in the same commit or immediately after

---

## Doc Sync Checklist

| Doc | What to update |
|-----|---------------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Template Performance merge note, Compliance nav location, AI page renames |
| `docs/engineering/01-TESTING-GUIDE.md` | Wizard phone skip warning step, team phone validation step |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Page name references (Support, AI Flagged Responses, AI Performance) |
| `docs/specs/UX-PLATFORM-AUDIT-2026-04-09.md` | Mark Phase 1 items complete |
| `docs/specs/UX-AUDIT-FULL.md` | Add entries if any of these map to existing audit items |
