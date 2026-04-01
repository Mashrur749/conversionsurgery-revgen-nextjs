# Full UX Audit — ConversionSurgery Platform

Date: 2026-04-01
Scope: Complete ICP (contractor portal) + Operator (admin dashboard) + Onboarding flows
Method: File-by-file code review of every page and component

---

## Already Fixed (this session)

Items identified in initial UX pass, code changes shipped and verified:

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| F1 | Emojis in SMS notifications (escalation, claim, re-notify, email) | Replaced with professional text: URGENT:, Claimed:, removed | Done |
| F2 | Booking calendar conflict error exposed internal jargon ("calendar conflict") to homeowner | Changed to natural language: "This time slot was just booked" | Done |
| F3 | Booking slot conflict dead-ends conversation (no alternatives offered) | Auto-suggests 3 alternative slots on conflict | Done |
| F4 | No admin UI for embed widget (API-only, operator needs curl) | Added EmbedWidgetCard to client detail page — generate + copy in one click | Done |
| F5 | Escalation re-notification SMS missing lead name | Now includes lead name + phone fallback | Done |
| F6 | Widget phone field has no format hint | Placeholder changed to "(403) 555-1234" | Done |
| F7 | Conversation send failure is silent (no error feedback) | Inline error: "Failed to send. Please try again." in sienna | Done |
| F8 | AI vs human messages visually identical in contractor portal | AI messages now olive background + "AI Response" label; human messages stay forest green | Done |
| F9 | "Needs Response" badge not visible enough on conversation list | Added visible sienna badge alongside existing border accent | Done |
| F10 | Notification settings save has no feedback | Success/error message appears for 3 seconds near save button | Done |
| F11 | Dashboard stat cards break on mobile (2-column too tight) | Changed to single column on mobile, 2 columns on sm+ | Done |
| F12 | Conversation view is page-based, not split-pane (1.1) | WhatsApp-style split-pane: 280px left pane (list + search + unread/mode badges), right pane (message thread). Mobile: single pane with back arrow. Files: conversations-shell.tsx, conversations/page.tsx, [id]/page.tsx | Done |
| F13 | No real-time message updates (1.2) | Messages poll every 5s (delta-only via ?after= param). Conversation list polls every 15s. "New messages" indicator when scrolled up. Auto-scroll only if at bottom. New API endpoints for delta polling | Done |
| F14 | Conversation viewport trap on mobile (1.3) | Replaced h-[calc(100vh-8rem)] with flex layout + 100dvh + min-h-0 + overflow-auto. Added pb-safe for notched devices | Done |
| F15 | No unread/new message indicators (1.4) | localStorage-based per-lead last-read timestamps. Unread count badge on each conversation. Bold names for unread. Cleared when conversation opened | Done |
| F16 | Admin cannot see or toggle AI/human mode (1.5) | New badge on lead header showing AI/Human/Paused mode with icons. Toggle button to take over / hand back. New API: POST /api/admin/leads/[id]/conversation-mode | Done |
| F17 | Client detail page is 15+ scrolls deep (1.6) | 4-tab layout: Overview, Configuration, Team and Billing, Activity. Feature toggles first in Configuration tab. Tab persisted in URL ?tab= param. Client header stays above tabs | Done |
| F18 | No in-app notification center (2.1) | Bell icon in both portal headers with unread badge count. Popover shows last 20 notifications derived from existing data (no new tables). Polls every 30s. Client portal: new leads, pending escalations, smart assist drafts, appointments, payments. Admin: active escalations, SLA breaches, flagged AI messages, report delivery failures, knowledge gaps, errors. | Done |
| F19 | Billing tables unreadable on mobile (2.3) | Card-based layout on mobile (< 640px) instead of squished table columns. Each card shows invoice number, status badge, amount (large), date, due date, and action buttons. | Done |
| F20 | Settings hub-and-spoke pattern (2.4) | Single tabbed page with 5 tabs: General, Notifications, AI Assistant, Phone, Features. Vertical tabs on desktop, horizontal on mobile. Tab persisted in URL ?tab= param. Old sub-pages redirect to main settings with correct tab. | Done |
| F21 | Client list not searchable/filterable (2.6) | Search input at top of admin client list (debounced, searches business name + owner name). Recently Viewed section shows last 5 accessed clients as horizontal pills. Status filter pills (All, Active, Pending, Paused, Cancelled) with counts. Recent clients tracked in localStorage. | Done |
| F22 | No lead-to-lead navigation in admin (2.7) | Previous/Next arrow buttons on admin lead detail header. Position indicator ("3 of 25"). Lead order read from localStorage (stored by leads table). Arrows hidden on direct URL access. | Done |
| F23 | Leads table not responsive (2.8) | Mobile card layout (< 640px) replacing table. Each card shows lead name/phone, status badge, temperature badge, source, score, last updated. Checkbox selection preserved for bulk actions. Desktop table headers now sticky. | Done |
| F24 | AI quality flags cannot be resolved (2.9) | Resolve button on each flagged message card. Resolve All with confirmation dialog. Open/Resolved tab toggle. Resolved tab shows who resolved and when. New schema columns: flagResolvedAt, flagResolvedBy on conversations table. New API: POST /api/admin/ai-quality. | Done |
| F25 | No breadcrumbs on deep pages (3.1) | Reusable Breadcrumbs component added to 6 client portal pages: billing, revenue, knowledge base, team, help, discussions. Shows "Dashboard > Page Name" with links. | Done |
| F26 | No inline help/tooltips on settings (3.2) | Info icon tooltips added next to: Quiet Hours, Smart Assist Auto-Send, AI Tone, Auto-send delay. Uses shadcn Tooltip component. | Done |
| F27 | Phone provisioning has no progress indicator (3.4) | 3-step progress indicator: "Choose location" > "Search numbers" > "Select your number". Numbered circles with brand colors. | Done |
| F28 | Escalation SLA deadline has no countdown (3.5) | Live countdown component on escalation queue cards. Updates every 60s. Color-coded: green (>1h), sienna (30-60m), red (<30m), "SLA breached" when past deadline. | Done |
| F29 | Reports table lacks filtering (3.6) | Client dropdown + date range presets (7d/30d/90d/All) above reports table. Client-side filtering with count indicator. | Done |
| F30 | Knowledge base empty state has no CTA (3.7) | Empty state shows heading, description, and "Add Knowledge Entry" button that opens the form. | Done |
| F31 | No "unsaved changes" warning on settings (3.8) | Browser beforeunload dialog when settings forms have unsaved changes. Reusable useUnsavedChangesWarning hook applied to notification, AI, and feature toggle forms. | Done |
| F32 | Day-one audit section is visually dense (3.9) | Revenue Leak Audit section collapsed by default with summary line. Expand to see full form. | Done |
| F33 | Cancellation page leads with ROI card (3.10) | ROI card moved into collapsed accordion. Cancel form is now primary content visible immediately. Neutral heading. | Done |

---

## Open Issues

## Tier 1: Dealbreakers — Done

All Tier 1 items (1.1 through 1.6) have been implemented. See the "Already Fixed" table above for details.

---

## Tier 2: High Friction (daily annoyance, slows operator down)

### 2.1 No in-app notification center
**Who:** Both contractor and operator
**Where:** Layout headers (both portals)
**Problem:** All notifications are SMS/email only. If SMS delivery fails or phone is silenced, escalations are missed entirely. No bell icon, no badge count, no notification drawer.
**Fix:** Notification bell in header with badge count. Show: new escalations, flagged AI messages, due reports, overdue SLA items.
**Status:** Done (P1). See F18 in the Already Fixed table.

### 2.2 Mobile conversation header cramped
**Who:** Contractor (client portal)
**Where:** `conversation-view.tsx:132-156`
**Problem:** Back arrow + lead name + phone + mode badge + "Take Over"/"Hand Back" buttons all on one line. On 375px screen, buttons squeeze into tiny tap targets.
**Fix:** Stack on mobile: lead info row + action buttons row. Minimum 44x44px tap targets.
**Status:** Resolved by P0 split-pane rewrite (F12). The new conversation shell handles mobile layout with proper stacking and tap targets.

### 2.3 Billing tables unreadable on mobile
**Who:** Contractor (client portal)
**Where:** `/client/billing/billing-client.tsx`
**Problem:** Invoice table columns (ID, Number, Status, Amount, Date, Due, Actions) squish to unreadable widths on mobile. No horizontal scroll, no card-view fallback.
**Fix:** Card-based layout on mobile (< 640px). Each invoice as a card with stacked fields.
**Status:** Done (P1). See F19 in the Already Fixed table.

### 2.4 Settings hub-and-spoke pattern
**Who:** Contractor (client portal)
**Where:** `/client/settings/` (6 sub-pages)
**Problem:** Changing AI tone then quiet hours requires: Settings → AI → change → Back → Settings → Notifications → change → Back. Six clicks for two settings.
**Fix:** Single settings page with collapsible sections, or tabbed layout within settings.
**Status:** Done (P1). See F20 in the Already Fixed table.

### 2.5 No conversation search
**Who:** Contractor (client portal) + Operator (admin)
**Where:** `/client/conversations` and `/leads`
**Problem:** Cannot find a past conversation by name, phone, or keyword. Must scroll the list.
**Fix:** Search input at top of conversation list. Debounced, searches name + phone + message content.
**Status:** Resolved by P0 split-pane rewrite (F12). The new conversations shell includes a search input in the left pane.

### 2.6 Client list not searchable/filterable
**Who:** Operator (admin dashboard)
**Where:** `/admin` client list
**Problem:** With 50+ clients, operator must scroll and visually scan. No search, no "starred" or "recently viewed" list.
**Fix:** Search input + status filter + "recent" section showing last 3-5 accessed clients.
**Status:** Done (P2). See F21 in the Already Fixed table.

### 2.7 No lead-to-lead navigation in admin
**Who:** Operator (admin dashboard)
**Where:** `/leads/[id]`
**Problem:** Viewing one lead, operator must go back to table → find next lead → click. No "next" / "previous" buttons.
**Fix:** Previous/Next navigation arrows on lead detail page, following current sort/filter.
**Status:** Done (P2). See F22 in the Already Fixed table.

### 2.8 Leads table not responsive
**Who:** Operator (admin dashboard)
**Where:** `/leads/leads-table.tsx`
**Problem:** Table columns don't collapse on mobile. Horizontal scroll required, column headers not sticky.
**Fix:** Card-based responsive view on mobile. Sticky column headers on desktop.
**Status:** Done (P2). See F23 in the Already Fixed table.

### 2.9 AI quality flags cannot be resolved
**Who:** Operator (admin dashboard)
**Where:** `/admin/ai-quality`
**Problem:** Once operator fixes the KB, flags stay in the list forever. No "resolved" state, no batch clear.
**Fix:** Add "Mark Resolved" button per flag and "Resolve All" for batch. Resolved flags move to separate tab.
**Status:** Done (P2). See F24 in the Already Fixed table.

### 2.10 Feature toggles buried at bottom of client page
**Who:** Operator (admin dashboard)
**Where:** `/admin/clients/[id]/page.tsx`
**Problem:** The most frequently modified section (18+ toggles) is the last thing on a 13-section page.
**Fix:** Move to top-level tab or dedicated page accessible from client list row actions.
**Status:** Resolved by 1.6 (client detail tabs) — feature toggles are now first in the Configuration tab.

---

## Tier 3: Moderate Friction (noticeable, worth fixing)

### 3.1 No breadcrumbs on deep pages
**Who:** Both
**Where:** All deep pages (conversations/[id], settings sub-pages, leads/[id])
**Problem:** On mobile, the only navigation context is the hamburger menu. User loses orientation.
**Fix:** Lightweight breadcrumb bar: Dashboard > Conversations > Lead Name.
**Status:** Done (P3). See F25 in the Already Fixed table.

### 3.2 No inline help/tooltips on settings
**Who:** Contractor (client portal)
**Where:** Settings pages (quiet hours, smart assist, AI tone)
**Problem:** "Quiet Hours" and "Smart Assist Auto-Send" have no explanation of what they do. Contractor has to guess.
**Fix:** Info icon next to each setting with tooltip or expandable help text.
**Status:** Done (P3). See F26 in the Already Fixed table.

### 3.3 Self-serve onboarding checklist lacks direction
**Who:** Contractor (self-serve signup)
**Where:** `/signup/next-steps/onboarding-checklist.tsx`
**Problem:** Checklist is read-only. Tutorials are listed as text (not clickable links). Quality gates section uses technical language. No clear "do this next" CTA.
**Fix:** Make checklist items actionable (link to the relevant page). Hide quality gates from contractor view. Add "Start Here" button.
**Status:** Open. Deferred to a future session.

### 3.4 Phone provisioning has no progress indicator
**Who:** Contractor (client portal)
**Where:** `/client/settings/phone/phone-provisioner.tsx`
**Problem:** 4-step form (country → region → city → select number) with no visual progress. User doesn't know what comes next.
**Fix:** Step indicator (1 of 4) or progressive disclosure with clear labels.
**Status:** Done (P3). See F27 in the Already Fixed table.

### 3.5 Escalation SLA deadline has no countdown
**Who:** Operator (admin dashboard)
**Where:** `/escalations/` queue
**Problem:** SLA deadline exists in the data but only shows breach status. No countdown timer showing "2h 15m remaining."
**Fix:** Countdown timer on each escalation card. Red when < 1 hour remaining.
**Status:** Done (P3). See F28 in the Already Fixed table.

### 3.6 Reports table lacks filtering
**Who:** Operator (admin dashboard)
**Where:** `/admin/reports`
**Problem:** With 50+ reports across clients, no way to filter by client, date, or type.
**Fix:** Client filter dropdown + date range picker.
**Status:** Done (P3). See F29 in the Already Fixed table.

### 3.7 Knowledge base empty state has no CTA
**Who:** Contractor (client portal)
**Where:** `/client/knowledge`
**Problem:** If KB is empty, there's no "Add your first entry" button or guidance.
**Fix:** Empty state card with explanation + "Add Knowledge" button.
**Status:** Done (P3). See F30 in the Already Fixed table.

### 3.8 No "unsaved changes" warning on settings
**Who:** Contractor (client portal)
**Where:** All settings pages
**Problem:** If contractor changes AI tone then navigates away without saving, changes are lost silently.
**Fix:** `beforeunload` warning when form is dirty.
**Status:** Done (P3). See F31 in the Already Fixed table.

### 3.9 Day-one audit section is visually dense
**Who:** Operator (admin dashboard)
**Where:** `/admin/clients/[id]/day-one-activation-card.tsx`
**Problem:** Findings array + impact inputs + artifact URL + multiple textareas on one card. On mobile, 3-column impact inputs wrap awkwardly.
**Fix:** Progressive disclosure — collapse findings section until "Add Finding" is clicked. Stack impact inputs vertically on mobile.
**Status:** Done (P3). See F32 in the Already Fixed table.

### 3.10 Cancellation page leads with ROI card
**Who:** Contractor (client portal)
**Where:** `/client/cancel`
**Problem:** Large green "Your Results So Far" card dominates the page before the cancel form. Feels like a dark pattern / retention wall.
**Fix:** Move results to a collapsible "Review your results before cancelling" accordion. Lead with the cancel form.
**Status:** Done (P3). See F33 in the Already Fixed table.

---

## Tier 4: Polish (not blocking, improves perceived quality)

### 4.1 No keyboard shortcuts or command palette
**Who:** Operator (admin dashboard)
**Where:** Global
**Fix:** Cmd+K command palette for quick navigation (jump to client, lead, settings).

### 4.2 Billing skeleton doesn't match content
**Who:** Contractor (client portal)
**Where:** `/client/billing/page.tsx`
**Fix:** Match skeleton to actual card layout (3 skeletons shown, actual page has 5+ sections).

### 4.3 Dashboard has no sticky header
**Who:** Contractor (client portal)
**Where:** `/client/page.tsx`
**Fix:** Sticky page title + stat summary while scrolling.

### 4.4 Wizard step titles hidden on mobile
**Who:** Operator (admin dashboard)
**Where:** `/admin/clients/new/wizard/setup-wizard.tsx:171`
**Fix:** Show abbreviated step titles (or icons) on mobile instead of hiding completely.

### 4.5 No "recently viewed" clients shortcut
**Who:** Operator (admin dashboard)
**Where:** Client selector dropdown
**Fix:** Show 3 most recently accessed clients at top of dropdown with separator.

### 4.6 Discussion page has no "new ticket" CTA from failure states
**Who:** Contractor (client portal)
**Where:** `/client/discussions`
**Fix:** Add "Contact Support" button on error states throughout the portal.

### 4.7 Escalation queue has no auto-refresh
**Who:** Operator (admin dashboard)
**Where:** `/escalations`
**Fix:** 30-second polling for new escalations. "New escalation" toast.

---

## Implementation Priority Matrix

| Priority | Items | Estimated Effort | Impact |
|----------|-------|------------------|--------|
| **P0 (before first client)** | ~~1.1 (split-pane), 1.2 (polling), 1.3 (viewport fix), 1.4 (unread badges), 1.5 (admin mode toggle), 1.6 (client detail tabs)~~ | Done | All shipped |
| **P1 (first 2 weeks)** | ~~2.1 (notifications), 2.3 (billing mobile), 2.4 (settings tabs)~~ + 2.2 (mobile header) and 2.5 (search) resolved by P0 split-pane rewrite | Done | All shipped |
| **P2 (first month)** | ~~2.6 (client search), 2.7 (lead nav), 2.8 (leads responsive), 2.9 (flag resolution)~~ | Done | All shipped |
| **P3 (ongoing)** | ~~Tier 3~~ (9 of 10 done: 3.1, 3.2, 3.4-3.10; 3.3 deferred) + Tier 4 items | Mostly done | Tier 3 shipped, Tier 4 remaining |

---

## Summary

**Total issues found: 33**
- Tier 1 (Dealbreakers): 6 — all fixed (F12-F17)
- Tier 2 (High Friction): 10 — all fixed (F18-F20 + 3 resolved by P0, F21-F24)
- Tier 3 (Moderate Friction): 10 — 9 fixed (F25-F33), 1 open (3.3 self-serve onboarding checklist, deferred)
- Tier 4 (Polish): 7

**Fixed: 33 of 34** (P0: 17, P1: 3, P2: 4, P3: 9). One remaining: 3.3 (self-serve onboarding checklist).

Note: original audit found 33 issues. With the F1-F11 pre-audit fixes included in the table, the total tracked items are 34 (33 audit + the 11 pre-audit fixes counted in F1-F24 + F25-F33). The unfixed item count is 1 audit issue (3.3) + 7 Tier 4 items = 8 open.

**Biggest single improvement:** Split-pane conversation view with real-time polling (1.1 + 1.2). This is the product's daily driver screen.

**Biggest operator improvement:** Client detail page tabs (1.6). Operator visits this page for every client, every day.
