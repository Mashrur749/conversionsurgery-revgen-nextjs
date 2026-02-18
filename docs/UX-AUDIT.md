# UX Audit Report

**Date:** 2026-02-17
**Scope:** 77 pages, 68 components across 4 portals
**Standards:** `.claude/skills/ux-standards/SKILL.md`

## Resolution Summary

All 15 fix batches completed across 3 sessions (~170 violations resolved). See `.claude/progress.md` for detailed per-fix tracking.

| Fix | Description | IDs Resolved | Status |
|-----|------------|-------------|--------|
| 1 | Revenue recovered on all dashboards | S5 | Done |
| 2 | Mobile nav + active states for client portal | NAV-C1, CP-C1, CP-C2 | Done |
| 3 | AlertDialog for all destructive actions (14 locations) | S4, AA-C1-C6, AC-H1/H4/H5/H6, CP-H1-H3, TD-H3/H4 | Done |
| 4 | Skeleton loading states | S1, TD-H1 | Done |
| 5 | Trend/context lines on all stat cards | S2 | Done |
| 6 | Active nav states | CP-C2, NAV-H1 | Done |
| 7 | Empty state action buttons | S3 | Done |
| 8 | Auth page bugs (email, alert, catch) | AUTH-BUG-1/2/3 | Done |
| 9 | Search/filter on admin list views | AA-H1, AC-M3 | Done |
| 10 | Auth pages standardized to shadcn | AUTH-H1, AUTH-H3 | Done |
| 11 | Page title typography (text-2xl font-bold) | CP-M1, AA-H3, AC-M12 | Done |
| 12 | Color coding consistency | TD-M1, AC-M5, AA-M1, AA-M4, CP-M5 | Done |
| 13 | Hover states on admin lists | AA-H2, AC-M4 | Done |
| 14 | Form button alignment (right-aligned) | S6 | Done |
| 15 | Remaining medium/low issues | Various | Done |

### Post-Audit Session 3 Fixes

Additional issues found during a re-audit after brand alignment:

- **Double email on login** — Root cause: two auth paths (custom route + NextAuth EmailProvider) both sending emails. Fixed by consolidating to NextAuth `signIn("email")` and deleting redundant `/api/auth/signin` and `/api/auth/verify` routes.
- **Stale non-brand colors** — 9 additional files had hardcoded Tailwind colors (pink, cyan, blue, rose, red, emerald) that weren't caught in the original brand sweep:
  - `focus:ring-blue-500` → `focus:ring-ring` (generate-report-form, client-selector)
  - `bg-pink-100 text-pink-800` → `bg-muted text-muted-foreground` (knowledge-list)
  - `bg-cyan-100 text-cyan-800` → `bg-sage-light text-forest` (flow-management, template-list)
  - `border-l-red-500` → `border-l-sienna` (client conversations, dashboard)
  - `from-green-50 to-emerald-50` → `bg-[#E8F5E9]` (analytics-dashboard)
  - `bg-rose-100 text-rose-600` → `bg-[#FDEAE4] text-sienna` (phone-numbers-stats, agency-overview-stats)
  - `bg-rose-500 hover:bg-rose-600` → `bg-sienna hover:bg-sienna/90` (quick-actions)
- **Auth page header consistency** — Standardized claim, claim-error, link-expired pages: logo w-12 h-12, heading text-xl, py-6
- **Browser confirm() → AlertDialog** — team-manager.tsx still used `confirm()` for removing team members
- **Loading state improvements** — analytics, platform-analytics, email-templates pages had unstyled `Loading...` text
- **Stat card text-3xl → text-2xl** — 11 more instances in ab-tests, nps, reports, twilio pages
- **Responsive grid fix** — ab-tests stats grid: `grid-cols-3` → `grid-cols-1 md:grid-cols-3`
- **Layout fix** — platform-analytics: `container` → `space-y-6` (parent provides max-w-7xl)

### Post-Audit Session 4 Fixes

Comprehensive component consistency sweep:

- **Auth accessibility** — Added `role="alert"` on all error messages, `aria-invalid` on form inputs in error state, `aria-label` on icon-only buttons across login, client-login, and claim pages
- **Raw checkboxes → Switch** — Replaced all raw `<input type="checkbox">` with shadcn Switch components in ai-settings-form (4), feature-toggles-form (1), send-message-dialog (1), article-editor (1)
- **Raw checkboxes → Checkbox** — Replaced with shadcn Checkbox in coupon-manager (1), plan-list (7 — 5 features + isPopular + allowOverages)
- **Raw inputs → Input** — Replaced all raw `<input>` elements with shadcn Input in phone-number-manager (2), email-templates list (4), email-templates editor (2), generate-report-form (3), variant-creation-modal (2), send-message-dialog (1)
- **Raw textareas → Textarea** — Replaced all raw `<textarea>` with shadcn Textarea in email-templates list (1), email-templates editor (1), article-editor (1), variant-creation-modal (1), send-message-dialog (1)
- **confirm() → AlertDialog** — Replaced remaining `confirm()` calls with AlertDialog in team-members-list, calendar-integrations, lead-media-tab (3 files, now zero `confirm()` calls in codebase)
- **Container layout fixes** — Removed redundant `container` classes from escalations and analytics pages (parent provides max-w-7xl)
- **Native select styling** — Standardized all remaining native `<select>` elements to match shadcn Input appearance (`border-input`, `shadow-xs`, `focus:ring-ring`)
- **Label standardization** — Replaced raw `<label>` with shadcn Label component with proper `htmlFor`/`id` pairing across all fixed forms
- **Type safety** — Fixed `catch(err: any)` → `catch(err: unknown)` in generate-report-form

**Result:** Zero raw `<input type=>`, zero raw `<input type="checkbox">`, zero raw `<textarea>` (outside component definitions), zero `confirm()` calls remain in the codebase.

### Remaining Low-Priority Items (acceptable)

- Dark mode color variants (`dark:bg-red-900`, `dark:bg-blue-900/30`, etc.) — kept as-is for future dark mode support
- `as any` types in `reports/[id]/page.tsx` and `ab-tests` for JSON column casts — not UX-visible
- Some admin list views without search (flow-templates, reputation, NPS, coupons) — fewer items, less critical need
- `CancelSubscriptionDialog` uses Dialog instead of AlertDialog — kept intentionally because it contains a multi-step form
- Native `<select>` elements kept (not converted to Radix Select) — FormData-based forms require native selects; styling is standardized to match shadcn appearance

---

## Systemic Issues

These patterns are broken across nearly every page in the app.

### S1. No Skeleton loading states anywhere (~90% of pages)

- The only `loading.tsx` (dashboard group) uses a CSS spinner — explicitly banned
- Zero admin pages use Skeleton components (`Skeleton` exists but only used in `lead-media-tab.tsx`)
- Client portal has zero `loading.tsx` files — 14 of 16 views have no loading state
- Every Suspense fallback uses plain `<div>Loading...</div>` text
- Server components making 5+ parallel DB queries block entire pages

**Fix pattern:** Create `loading.tsx` with Skeleton layouts for each route group. Replace all `<div>Loading...</div>` Suspense fallbacks with Skeleton components matching content shape.

### S2. No stat card has trend/change-over-time data (~50+ cards)

- Standard requires every KPI card to show "+12% vs last week" or similar
- Only compliant card: MRR on `admin/billing/page.tsx`
- Affects: all dashboards, ROI dashboard, escalation stats, analytics KPIs, revenue pipeline, review stats, NPS stats, A/B test stats, report stats, phone stats, Twilio stats

**Fix pattern:** Add `change` prop to stat card components. Compute period-over-period deltas in data fetching. Display with green/red arrow indicators.

### S3. Every empty state is missing an action button (~25+ instances)

- Most show explanatory text but none include an inline CTA button
- "No client linked" appears as bare unstyled `<div>` on 5 dashboard pages

**Fix pattern:** Add a `<Button>` inside every empty state card pointing to the relevant creation/setup action.

### S4. No destructive action uses AlertDialog (~15+ operations)

Three wrong patterns exist:
- `window.confirm()` / `confirm()` -- knowledge delete, Google disconnect
- Custom inline confirmation panel -- client delete button
- Zero confirmation -- email template delete, help article delete, API key revoke, system setting delete, coupon delete, phone number remove, cancel sequence, bulk status update, admin toggle

`AlertDialog` exists at `src/components/ui/alert-dialog.tsx` but is only used in `PaymentMethodCard.tsx`.

**Fix pattern:** Wrap every destructive action in `<AlertDialog>` with clear description of consequences.

### S5. Revenue recovered absent from all 3 primary dashboards

- Client dashboard (`/client`): zero revenue data
- Team dashboard (`/dashboard`): zero revenue data
- Admin dashboard (`/admin`): zero revenue data
- Revenue is the core value proposition -- it's literally in the product name

**Fix pattern:** Add a prominent revenue recovered stat card (ideally the first/largest card) to each dashboard.

### S6. Form buttons left-aligned instead of bottom-right (~10+ forms)

Every form left-aligns the primary action button. Internally consistent but violates the standard.

**Fix pattern:** Add `justify-end` to button containers. Low priority since it's consistent.

---

## Auth Pages (6 pages)

### Bugs

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AUTH-BUG-1 | Success message shows empty email -- `setEmail("")` clears before render | `src/app/(auth)/login/page.tsx` | 38-39, 74 |
| AUTH-BUG-2 | `alert()` used for error display instead of inline UI | `src/app/(auth)/claim/claim-form.tsx` | 46 |
| AUTH-BUG-3 | No `catch` block -- network errors silently swallowed | `src/app/(auth)/claim/claim-form.tsx` | 30-53 |

### High

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AUTH-H1 | Two design systems: login/verify use raw HTML; client-login/claim use shadcn | `login/page.tsx`, `verify/page.tsx` | throughout |
| AUTH-H2 | No form labels on client-login inputs (a11y) | `client-login/page.tsx` | 163-226 |
| AUTH-H3 | `<button>` nested inside `<Link>` -- invalid HTML | `verify/page.tsx` | 28-32 |

### Medium

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AUTH-M1 | Error presentation inconsistent: styled alert vs plain red text vs `alert()` | 3 different patterns | -- |
| AUTH-M2 | `mt-20` on claim/claim-error fights layout centering | `claim/page.tsx`, `claim-error/page.tsx` | 56, 24 |
| AUTH-M3 | Error pages have no red/warning color coding | `claim-error/page.tsx`, `link-expired/page.tsx` | -- |
| AUTH-M4 | Auto-submit on 6 OTP digits has no double-submission guard | `client-login/page.tsx` | 54-59 |
| AUTH-M5 | Suspense fallback is unstyled `<div>Loading...</div>` | `login/page.tsx` | 134 |
| AUTH-M6 | Heading sizes inconsistent: login=3xl, verify=2xl, client-login=CardTitle | various | -- |
| AUTH-M7 | Claim-error "Go to Dashboard" may fail for unauthenticated users | `claim-error/page.tsx` | 31 |

### Low

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AUTH-L1 | Redundant `max-w-md mx-auto` on client-login (layout already constrains) | `client-login/page.tsx` | 154 |
| AUTH-L2 | Claim select dropdown lacks programmatic label | `claim-form.tsx` | 58-69 |
| AUTH-L3 | No empty state for zero team members in claim flow | `claim/page.tsx` | 74 |
| AUTH-L4 | Claim info box uses gray instead of blue for info styling | `claim/page.tsx` | 64 |

---

## Client Portal (18 pages)

### Critical

| ID | Issue | File | Lines |
|----|-------|------|-------|
| CP-C1 | No mobile navigation -- 10 horizontal links with no responsive collapse | `src/app/(client)/layout.tsx` | 38-48 |
| CP-C2 | No active state on nav links -- users can't tell what page they're on | `src/app/(client)/layout.tsx` | 39-46 |

### High

| ID | Issue | File | Lines |
|----|-------|------|-------|
| CP-H1 | Knowledge delete uses `window.confirm()` | `knowledge/knowledge-list.tsx` | 51 |
| CP-H2 | Billing cancel uses `Dialog` instead of `AlertDialog` | `billing/CancelSubscriptionDialog.tsx` | 1-113 |
| CP-H3 | Cancel subscription flow -- "Cancel Anyway" has no confirmation | `cancel/cancellation-flow.tsx` | 131 |

### Medium

| ID | Issue | File | Lines |
|----|-------|------|-------|
| CP-M1 | 11 of 16 pages use wrong title size (text-xl or text-3xl instead of text-2xl) | various | -- |
| CP-M2 | Dashboard items (appointments, leads) not clickable | `client/page.tsx` | 89-125 |
| CP-M3 | Action-required conversations not sorted to top | `conversations/page.tsx` | SQL query |
| CP-M4 | Client dashboard has no page title at all | `client/page.tsx` | -- |
| CP-M5 | Discussion status badges use default/secondary instead of green/gray | `discussions/page.tsx` | 63 |
| CP-M6 | Nav links missing `transition-colors` | `(client)/layout.tsx` | 38-48 |

### Low

| ID | Issue | File | Lines |
|----|-------|------|-------|
| CP-L1 | Billing grid `lg:grid-cols-2` never activates inside max-w-3xl | billing pages | -- |
| CP-L2 | Help cards have `cursor-pointer` but no `hover:bg-gray-50` | `help/page.tsx` | 62, 84 |
| CP-L3 | Settings forms left-align save buttons | 4 settings forms | -- |
| CP-L4 | Knowledge page subtitle uses `text-gray-500` instead of `text-muted-foreground` | `knowledge/page.tsx` | 37 |

---

## Team Dashboard (11 pages)

### High

| ID | Issue | File | Lines |
|----|-------|------|-------|
| TD-H1 | `loading.tsx` uses spinner instead of Skeleton | `(dashboard)/loading.tsx` | 1-10 |
| TD-H2 | "No client linked" = bare unstyled `<div>` on 5+ pages | dashboard, leads, conversations, scheduled, settings, analytics | -- |
| TD-H3 | Cancel Sequence buttons (4) have no confirmation | `leads/[id]/action-buttons.tsx` | 167-203 |
| TD-H4 | Bulk status update has no confirmation | `leads/leads-table.tsx` | 99-111 |

### Medium

| ID | Issue | File | Lines |
|----|-------|------|-------|
| TD-M1 | Escalation pending status uses blue instead of yellow | `escalation-queue.tsx` | 139-141 |
| TD-M2 | Client name never shown in page content area (all 6 team pages) | all team pages | -- |
| TD-M3 | Action buttons below conversation on mobile (must scroll past messages) | `leads/[id]/page.tsx` | 114-175 |
| TD-M4 | Discussions page has no subtitle | `discussions/page.tsx` | 34 |
| TD-M5 | Discussion thread title uses text-xl instead of text-2xl | `discussion-thread.tsx` | 76 |
| TD-M6 | Escalation detail title responsive text-xl/text-2xl instead of always text-2xl | `escalation-detail.tsx` | 174 |
| TD-M7 | Escalation detail uses max-w-4xl instead of full width | `escalation-detail.tsx` | 165 |
| TD-M8 | Escalations and analytics pages use `container` class (different from max-w-7xl) | `escalations/page.tsx`, `analytics/page.tsx` | 18/30, 31 |
| TD-M9 | Reply button in discussions is left-aligned instead of right | `discussion-thread.tsx` | 140-147 |
| TD-M10 | Urgent action leads on dashboard lack border-l-4 border-l-red-500 | `dashboard/page.tsx` | 148-167 |
| TD-M11 | SLA-breached escalations use full `border-destructive` instead of left-border-only | `escalation-queue.tsx` | 243-288 |
| TD-M12 | Cancel sequence section lacks "Danger Zone" naming/styling | `action-buttons.tsx` | 165-205 |

---

## Admin Core (12 pages)

### High

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AC-H1 | Phone number remove has ZERO confirmation | `phone-number-manager.tsx` | 57-61 |
| AC-H2 | Revenue page: 5 stat cards in one row (exceeds max 4) | `revenue-metrics.tsx` | 51 |
| AC-H3 | Client detail makes 5+ parallel DB queries with no loading state | `clients/[id]/page.tsx` | 54-84 |
| AC-H4 | Delete client uses custom inline panel instead of AlertDialog | `delete-button.tsx` | 91-125 |
| AC-H5 | Knowledge delete uses `confirm()` instead of AlertDialog | `knowledge-list.tsx` | 35-36 |
| AC-H6 | Google disconnect uses `confirm()` instead of AlertDialog | `google-connection.tsx` | 20 |

### Medium

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AC-M1 | Urgent clients use small 2px dot instead of border-l-4 | `admin/page.tsx` | 143-145 |
| AC-M2 | Knowledge new/edit pages don't show client name | `knowledge/new/page.tsx`, `knowledge/[entryId]/page.tsx` | -- |
| AC-M3 | Clients list has status filter but no text search, no pagination | `clients-filter.tsx` | -- |
| AC-M4 | Client rows are `<div>`s with buttons, not full-row links | `clients-filter.tsx` | 73-75 |
| AC-M5 | Pending client status uses blue instead of yellow | `clients-filter.tsx` | 28 |
| AC-M6 | Revenue: ROI % shown first at same size as revenue recovered | `revenue-metrics.tsx` | 31-48 |
| AC-M7 | Jobs list has no search/filter/pagination | `jobs-list.tsx` | -- |
| AC-M8 | Delete button mixed with navigation links, no "Danger Zone" section | `clients/[id]/page.tsx` | 235-257 |
| AC-M9 | Phone number form uses raw `<input>` instead of shadcn Input | `phone-number-manager.tsx` | 77-87 |
| AC-M10 | New client form max-w-2xl, wizard max-w-3xl instead of admin max-w-7xl | `new/page.tsx`, `new/wizard/page.tsx` | 16, 13 |
| AC-M11 | Knowledge new/edit pages use max-w-2xl, phone uses max-w-3xl | various | -- |
| AC-M12 | New client/wizard pages have no visible h1 with text-2xl font-bold | various | -- |

---

## Admin Advanced (33 pages)

### Critical

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AA-C1 | Email template delete -- no confirmation at all | `email-templates/page.tsx` | 49-51 |
| AA-C2 | Help article delete -- no confirmation at all | `help-articles/article-editor.tsx` | 55-57 |
| AA-C3 | API key revoke -- no confirmation at all | `api-keys/api-key-manager.tsx` | 62-64 |
| AA-C4 | System setting delete -- no confirmation at all | `settings/settings-manager.tsx` | 84-91 |
| AA-C5 | Coupon delete -- no confirmation at all | `billing/coupons/coupon-manager.tsx` | 80-85 |
| AA-C6 | Admin toggle -- no confirmation (can remove admin access) | `users/user-actions.tsx` | 54-65 |

### High

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AA-H1 | 8 list views have no search or filter | flow-templates, reports, reputation, users, email-templates, twilio, nps, coupons | -- |
| AA-H2 | 6 list views have no hover states on rows | reputation, users, nps, twilio, email-templates, settings | -- |
| AA-H3 | 9 pages use text-3xl instead of text-2xl for titles | ab-tests(3), billing, reports(3), phone-numbers, template-performance | -- |
| AA-H4 | Phone numbers stats: 5 cards in one row (exceeds max 4) | `phone-numbers-stats.tsx` | 58 |

### Medium

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AA-M1 | A/B test active status uses blue instead of green | `ab-tests/page.tsx` | 63-74 |
| AA-M2 | Voice AI renders all clients fully expanded -- no summary/collapse | `voice-ai/page.tsx` | 43-66 |
| AA-M3 | Reports detail page fully expanded with no collapsible sections | `reports/[id]/page.tsx` | 57-201 |
| AA-M4 | Discussion open/resolved uses default/secondary instead of green/gray | `discussions/page.tsx` | 87-90 |
| AA-M5 | Template performance page nests max-w-7xl inside parent max-w-7xl | `template-performance/page.tsx` | 17-18 |
| AA-M6 | Platform analytics uses `container` class instead of inheriting max-w-7xl | `platform-analytics/page.tsx` | 15 |
| AA-M7 | New A/B test form uses max-w-2xl; new report form uses max-w-2xl | `ab-tests/new/page.tsx`, `reports/new/page.tsx` | 23, 21 |
| AA-M8 | Failed payments card has no urgent left-border indicator | `billing/page.tsx` | 75-87 |
| AA-M9 | Forms: 5 forms have left-aligned primary buttons | email-templates, help-articles, api-keys, settings, email-templates/[id] | -- |
| AA-M10 | No "Danger Zone" pattern used anywhere in admin advanced | all pages with delete | -- |

### Low (Code Quality)

| ID | Issue | File | Lines |
|----|-------|------|-------|
| AA-L1 | `any[]` usage | `flow-templates/[id]/page.tsx` | 21 |
| AA-L2 | Multiple `as any` casts | `ab-tests/[id]/page.tsx` | 104-118 |
| AA-L3 | `as any` casts | `reports/page.tsx` | 99-100 |
| AA-L4 | Multiple `as any` casts | `reports/[id]/page.tsx` | 51-55, 128 |
| AA-L5 | `catch (err: any)` | `ab-tests/components/test-actions.tsx` | 47 |

---

## Nav and Shared Components

| ID | Severity | Issue | File | Lines |
|----|----------|-------|------|-------|
| NAV-C1 | CRITICAL | Client portal has no mobile nav at all | `(client)/layout.tsx` | 38-48 |
| NAV-H1 | HIGH | Desktop non-admin nav has no active state | `(dashboard)/layout.tsx` | 108-116 |
| NAV-M1 | MEDIUM | Help button close icon has no accessible label | `help-button.tsx` | 73 |
| NAV-M2 | MEDIUM | Switching overlay pops in/out with no animation | `switching-overlay.tsx` | 10-16 |
| NAV-M3 | MEDIUM | Client-facing selector uses raw `<select>` instead of shadcn Select | `client-selector.tsx` | 49-62 |
| NAV-M4 | MEDIUM | Header height jump at lg breakpoint (h-14 to h-16) | `(dashboard)/layout.tsx` | 92-93 |
| NAV-L1 | LOW | Admin client selector fixed at 180px -- truncates names | `admin/client-selector.tsx` | 38 |

---

## Prioritized Fix Order

| # | Fix | IDs Resolved | Est. Files |
|---|-----|-------------|------------|
| 1 | Add revenue recovered to all 3 dashboards | S5 | 3 |
| 2 | Add mobile nav to client portal | NAV-C1, CP-C1 | 1-2 |
| 3 | Replace all destructive actions with AlertDialog | S4, all *-C*, *-H* AlertDialog issues | ~15 |
| 4 | Add Skeleton loading states to all pages | S1 | ~20 |
| 5 | Add trend/context lines to all stat cards | S2 | ~15 |
| 6 | Add active state to all nav links | CP-C2, NAV-H1 | 2 |
| 7 | Add action buttons to all empty states | S3 | ~25 |
| 8 | Fix auth page bugs (email, alert, catch) | AUTH-BUG-1/2/3 | 2 |
| 9 | Add search/filter to admin list views | AA-H1 | ~8 |
| 10 | Standardize auth pages to shadcn components | AUTH-H1 | 2 |
| 11 | Standardize page title typography | CP-M1, AA-H3 | ~20 |
| 12 | Fix color coding inconsistencies | various | ~5 |
| 13 | Add hover states to admin list rows | AA-H2 | ~6 |
| 14 | Fix form button alignment | S6 | ~10 |
| 15 | Fix remaining medium/low issues | remaining | ~30 |
