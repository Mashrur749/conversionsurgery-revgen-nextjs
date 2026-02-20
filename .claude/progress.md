# UX Audit Fix Progress

**Started:** 2026-02-17
**Audit doc:** `docs/UX-AUDIT.md`
**Standards:** `.claude/skills/ux-standards/SKILL.md`

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Fix 1: Add revenue recovered to all 3 dashboards
- [x] Client dashboard (`src/app/(client)/client/page.tsx`)
- [x] Team dashboard (`src/app/(dashboard)/dashboard/page.tsx`)
- [x] Admin dashboard (`src/app/(dashboard)/admin/page.tsx`)
- IDs: S5

## Fix 2: Add mobile nav to client portal
- [x] Create client MobileNav (`src/components/client-nav.tsx`) with active states
- [x] Replace server nav in `src/app/(client)/layout.tsx` with ClientNav component
- IDs: NAV-C1, CP-C1, CP-C2, NAV-H1

## Fix 3: Replace all destructive actions with AlertDialog
- [x] Email template delete (`admin/email-templates/page.tsx`)
- [x] Help article delete (`admin/help-articles/article-editor.tsx`)
- [x] API key revoke (`admin/api-keys/api-key-manager.tsx`)
- [x] System setting delete (`admin/settings/settings-manager.tsx`)
- [x] Coupon delete (`admin/billing/coupons/coupon-manager.tsx`)
- [x] Admin toggle (`admin/users/user-actions.tsx`)
- [x] Phone number remove (`admin/clients/[id]/phone/phone-number-manager.tsx`)
- [x] Client delete/reactivate (`admin/clients/[id]/delete-button.tsx`)
- [x] Knowledge delete — admin (`admin/clients/[id]/knowledge/knowledge-list.tsx`)
- [x] Knowledge delete — client portal (`client/knowledge/knowledge-list.tsx`)
- [x] Google disconnect (`admin/clients/[id]/reviews/google-connection.tsx`)
- [x] Cancel sequence buttons (`leads/[id]/action-buttons.tsx`)
- [x] Bulk status update (`leads/leads-table.tsx`)
- [x] Client cancel subscription (`client/cancel/cancellation-flow.tsx`)
- [x] CancelSubscriptionDialog — kept as Dialog (has form content, AlertDialog inappropriate)
- IDs: S4, AA-C1-C6, AC-H1/H4/H5/H6, CP-H1/H2/H3, TD-H3/H4

## Fix 4: Add Skeleton loading states to all pages
- [x] Replace `(dashboard)/loading.tsx` spinner with Skeleton layout (stat cards + list rows)
- [x] Add `loading.tsx` to client portal route group (stat cards + content rows)
- [x] Add Skeleton fallback to auth login Suspense
- [x] Replace plain text loading in phone-number-manager with Skeleton cards
- [x] Replace plain text loading in api-key-manager with Skeleton cards
- [x] Replace plain text loading in leads-table with Skeleton rows
- IDs: S1, TD-H1

## Fix 5: Add trend/context lines to all stat cards
- [x] Client dashboard stat cards — already had context from Fix 1
- [x] Team dashboard stat cards — already had context from Fix 1
- [x] Admin dashboard stat cards — added calls/forms breakdown, across all clients, across N clients
- [x] Platform analytics cards — MRR, active clients, new, churned
- [x] A/B test stat cards — active/paused/completed context
- [x] Report stat cards — all time, bi-weekly, monthly
- [x] Reputation stat cards — platform-wide avg, across all clients, responded of total, reviews with responses
- [x] Twilio stat cards — current balance context
- [x] Revenue metrics pipeline cards — total in pipeline, quote total, won value, lost %, avg job
- [x] ROI dashboard activity cards — auto-responded, via sequences, cold leads revived
- [x] Review dashboard stat cards — across all sources, all time, new this month, awaiting response
- NPS already compliant (has "out of 10" and "responses" context)
- Billing already compliant (reference pattern)
- IDs: S2

## Fix 6: Add active state to all nav links
- [x] Client portal nav — done in Fix 2 via ClientNav component
- [x] Dashboard desktop nav — created DashboardNavLinks component with usePathname()
- IDs: CP-C2, NAV-H1

## Fix 7: Add action buttons to all empty states
- [x] "No client linked" on team dashboard — improved with heading + explanation
- [x] Dashboard "No actions needed" — added explanatory context
- [x] Dashboard conversations "No conversations yet" — added explanation
- [x] Client conversations "No conversations yet" — added explanation
- [x] Client dashboard "No leads yet" — added explanation
- [x] Client dashboard "No upcoming appointments" — added explanation
- [x] Admin home "No clients yet" — added Create Client button
- [x] NPS "No responses yet" — added survey explanation
- [x] Email templates — added Create First Template button
- Already good: A/B tests, flow templates, coupons (have buttons), reviews (has Sync guidance)
- Knowledge list, phone numbers, API keys, settings — already have Add buttons in header
- IDs: S3

## Fix 8: Fix auth page bugs
- [x] Login: save email to submittedEmail before clearing, show in success message
- [x] Claim: replaced `alert()` with inline error state
- [x] Claim: added `catch` block for network errors
- IDs: AUTH-BUG-1/2/3

## Fix 9: Add search/filter to admin list views
- [x] Users — created UserList client component with search by name/email/client
- [x] Email templates — added search input with filtering by name/slug/subject
- Already has search: leads table, client knowledge list, admin clients filter
- Lower priority: flow templates, reports, reputation, twilio, NPS, coupons (fewer items, less need)
- IDs: AA-H1, AC-M3

## Fix 10: Standardize auth pages to shadcn components
- [x] Login page: replaced raw div/input/button with Card/CardHeader/Input/Button/Label
- [x] Verify page: replaced raw div/button with Card/Button, fixed Link+button nesting with `asChild`
- IDs: AUTH-H1, AUTH-H3

## Fix 11: Standardize page title typography
- [x] Client portal: changed text-xl to text-2xl on 8 pages (revenue, conversations, flows, settings x4, discussions)
- [x] Client portal: changed text-3xl to text-2xl on billing pages (billing-client, upgrade)
- [x] Client portal: added h1 "Dashboard" to client dashboard
- [x] Admin: changed text-3xl to text-2xl on 9 pages (reports x3, billing, phone-numbers, template-performance, ab-tests x3)
- [x] Knowledge new: added proper h1 "Add Knowledge Entry" above card
- [x] Discussion threads: fixed text-xl to text-2xl on admin + team discussion detail pages
- Wizard: SetupWizard component manages its own h1 internally
- IDs: CP-M1, AA-H3, AC-M12

## Fix 12: Fix color coding inconsistencies
- [x] Escalation pending: variant="outline" -> bg-yellow-100 text-yellow-800
- [x] Client pending filter: bg-blue-100 -> bg-yellow-100 text-yellow-800
- [x] A/B test active: bg-blue-100 -> bg-green-100 text-green-800
- [x] Discussion open/resolved: variant default/secondary -> bg-green-100/bg-gray-100 (6 locations)
- IDs: TD-M1, AC-M5, AA-M1, AA-M4, CP-M5

## Fix 13: Add hover states to admin list rows
- [x] Reputation client cards — added hover:bg-gray-50 to Card
- [x] User rows — already had hover in UserList (done in Fix 9)
- [x] NPS response rows — added hover:bg-gray-50 transition-colors
- [x] Twilio phone rows — added hover:bg-gray-50 transition-colors
- [x] Email template cards — added hover:bg-gray-50 to Card
- [x] Settings rows — added hover:bg-gray-50 transition-colors
- [x] Client rows — made client name a clickable Link, removed redundant View button
- IDs: AA-H2, AC-M4

## Fix 14: Fix form button alignment
- [x] Summary settings (client) — wrapped in flex justify-end
- [x] AI settings (client) — added justify-end, moved Saved indicator before button
- [x] Feature toggles (client) — added justify-end, moved Saved indicator before button
- [x] Notification settings (client) — replaced w-full with flex justify-end
- [x] Create client form — added justify-end, reordered Cancel before Create
- [x] Edit client form — replaced w-full with flex justify-end
- [x] Knowledge entry form — added justify-end, reordered Cancel before Submit
- [x] Team manager — wrapped add button in flex justify-end
- [x] Email template editor — added justify-end, reordered Preview before Save
- [x] Email template create — added justify-end, reordered Cancel before Create
- [x] Help article editor — added justify-end with mr-auto on Published checkbox
- [x] API key create — added justify-end, reordered Cancel before Create
- [x] Generate report form — added justify-end
- IDs: S6

## Fix 15: Remaining medium/low issues
- [x] Client-login: add form labels (AUTH-H2)
- [x] Claim/claim-error: remove mt-20 (AUTH-M2)
- [x] Claim-error: add red/warning color coding (AUTH-M3)
- [x] Claim-error: link to login not dashboard (AUTH-M7)
- [x] Revenue page: 5 cards -> 4 per row (AC-H2, AA-H4)
- [x] Client dashboard items: made recent leads clickable Links (CP-M2)
- [x] Conversations: sort action-required to top with desc(actionRequired) (CP-M3)
- [x] Lead detail: action buttons above conversation on mobile via CSS order (TD-M3)
- [x] Urgent items: added border-l-4 border-l-red-500 to dashboard action items (TD-M10)
- [x] Help button: added aria-label to close button (NAV-M1)
- [x] Knowledge pages: already shows client name (AC-M2) — was already done
- [x] Client selector: already uses shadcn Select component (NAV-M3) — no change needed
- [x] Client-login: double-submission guard already present via disabled={loading} (AUTH-M4)
- [x] Switching overlay: added fade-in + slide animation via animate-in (NAV-M2)
- [x] Voice AI: collapsible client sections via native details/summary with chevron (AA-M2)
- [x] Fix `any` types: defined ReportMetrics/RoiSummary/TeamPerformance/TestResult/DailyStats/ABTestVariant interfaces (AA-L1-L5)
- [x] Danger Zone: client detail page (DeleteButton in own red-bordered card), action-buttons (red Danger Zone label) (AC-M8, TD-M12, AA-M10)
- [x] Revenue page: pipeline stats reduced from text-3xl to text-2xl, win rate + avg job split to summary row (AC-M6)

## Session 3: Re-Audit + Brand Color Cleanup + Login Bug Fix

### Double Email Fix
- [x] Root cause: custom `/api/auth/signin` route + NextAuth EmailProvider both sent emails
- [x] Fixed login page to use `signIn("email", ...)` from next-auth/react
- [x] Deleted redundant `/api/auth/signin/route.ts`
- [x] Deleted redundant `/api/auth/verify/route.ts`

### Post-Brand-Alignment Stale Color Fixes
- [x] `focus:ring-blue-500` -> `focus:ring-ring` in generate-report-form.tsx (5 instances)
- [x] `bg-pink-100 text-pink-800` -> `bg-muted text-muted-foreground` in knowledge-list.tsx
- [x] `bg-cyan-100 text-cyan-800` -> `bg-sage-light text-forest` in flow-management.tsx, template-list.tsx
- [x] `border-l-red-500` -> `border-l-sienna` in client conversations/page.tsx, dashboard/page.tsx
- [x] `from-green-50 to-emerald-50` -> `bg-[#E8F5E9]` in analytics-dashboard.tsx
- [x] `bg-rose-100 text-rose-600` -> `bg-[#FDEAE4] text-sienna` in phone-numbers-stats.tsx, agency-overview-stats.tsx
- [x] `bg-rose-500 hover:bg-rose-600` -> `bg-sienna hover:bg-sienna/90` in quick-actions.tsx
- [x] `focus:ring-blue-500` -> `focus:ring-ring` in client-selector.tsx

### Additional UX Fixes from Re-Audit
- [x] Auth header consistency: claim, claim-error, link-expired standardized (w-12 h-12, text-xl, py-6)
- [x] team-manager.tsx: browser confirm() replaced with AlertDialog + Skeleton loading
- [x] Loading states: analytics, platform-analytics, email-templates styled
- [x] Stat card text-3xl -> text-2xl: 11 instances in ab-tests(3), nps(3), reports(3), twilio(2)
- [x] Responsive grid: ab-tests stats grid-cols-3 -> grid-cols-1 md:grid-cols-3
- [x] Layout: platform-analytics container -> space-y-6

### Documentation
- [x] Updated docs/UX-AUDIT.md with resolution summary and session 3 fixes
- [x] Updated .claude/progress.md with session 3 work

## Session 4: Component Consistency Sweep

### Auth Accessibility
- [x] login/page.tsx: `role="alert"` on error divs, `aria-invalid` on email input
- [x] client-login/page.tsx: `aria-invalid` on phone/email inputs, `role="alert"` on error messages, `aria-label` on back button
- [x] claim/claim-form.tsx: `role="alert"` on error div

### Raw Checkboxes → shadcn Switch/Checkbox
- [x] ai-settings-form.tsx: 4 checkboxes → Switch (useEmojis, signMessages, canSchedule, quietHours)
- [x] feature-toggles-form.tsx: 1 custom switch → shadcn Switch
- [x] send-message-dialog.tsx: 1 checkbox → Switch (isUrgent)
- [x] article-editor.tsx: 1 checkbox → Switch (isPublished)
- [x] coupon-manager.tsx: 1 checkbox → Checkbox (firstTimeOnly)
- [x] plan-list.tsx: 7 checkboxes → Checkbox (5 features + isPopular + allowOverages)

### Raw Inputs → shadcn Input
- [x] phone-number-manager.tsx: 2 raw inputs → Input
- [x] email-templates/page.tsx: 4 raw inputs → Input
- [x] email-templates/[id]/page.tsx: 2 raw inputs → Input
- [x] generate-report-form.tsx: 3 raw inputs → Input (2 date, 1 text)
- [x] variant-creation-modal.tsx: 2 raw inputs → Input
- [x] send-message-dialog.tsx: 1 raw input → Input (number)

### Raw Textareas → shadcn Textarea
- [x] email-templates/page.tsx: 1 raw textarea → Textarea
- [x] email-templates/[id]/page.tsx: 1 raw textarea → Textarea
- [x] article-editor.tsx: 1 raw textarea → Textarea
- [x] variant-creation-modal.tsx: 1 raw textarea → Textarea
- [x] send-message-dialog.tsx: 1 raw textarea → Textarea

### confirm() → AlertDialog
- [x] team-members-list.tsx: confirm() → AlertDialog (from session 3 carry-over)
- [x] calendar-integrations.tsx: confirm() → AlertDialog
- [x] lead-media-tab.tsx: confirm() → AlertDialog

### Layout & Styling Fixes
- [x] escalations/page.tsx: `container py-6` → `space-y-6`
- [x] analytics/page.tsx: `container py-6` → `space-y-6`, styled Suspense fallback
- [x] ab-tests/[id]/page.tsx: `grid-cols-4` → responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- [x] Native select styling standardized to match shadcn Input across coupon-manager, plan-list, generate-report-form, variant-creation-modal, send-message-dialog
- [x] Label standardization: raw `<label>` → shadcn Label with htmlFor/id pairing

### Type Safety
- [x] generate-report-form.tsx: `catch(err: any)` → `catch(err: unknown)` with instanceof guard

### Verification
- [x] Zero raw `<input type=>` in codebase
- [x] Zero raw `<input type="checkbox">` in codebase
- [x] Zero raw `<textarea>` in codebase (outside component definition)
- [x] Zero `confirm()` calls in codebase
- [x] TypeScript typecheck: clean
- [x] Production build: clean

### Documentation
- [x] Updated docs/UX-AUDIT.md with session 4 fixes
- [x] Updated .claude/progress.md with session 4 work

---

# System Blockers — Phase 1 Execution

**Started:** 2026-02-19
**Source:** `docs/SYSTEM-BLOCKERS.md`
**Scope:** Phase 1 Critical fixes (10 items)

## Execution Order & Status

### Quick wins (2h each)
- [ ] D2 — Atomic coupon redemption
- [ ] D3 — Atomic escalation claim
- [ ] D4 — Atomic OTP verification
- [ ] S2 — Startup env validation
- [ ] B1 — Plan deactivation guard

### Medium (4h each)
- [ ] E1 — Stripe idempotency keys
- [ ] E3 — SMS retry logic
- [ ] S1 — Batch automations

### Large
- [ ] D1 — Transaction boundaries
- [ ] E2 — Stripe reconciliation cron

## Commits
(updated as work proceeds)

## Docs Updated
(updated as docs change)
