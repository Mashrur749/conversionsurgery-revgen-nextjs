---
name: ux-standards
description: UX patterns and standards for ConversionSurgery — a B2B SaaS revenue recovery platform
tools: Read, Grep, Glob
---

# ConversionSurgery UX Standards

This skill defines UX standards for a B2B SaaS platform with two user types:
- **Agency admins**: power users managing multiple clients — need information density, fast navigation, bulk actions
- **Client portal users**: business owners checking leads, conversations, revenue — need clarity, quick answers, mobile access

## Core UX Principles

1. **Speed to insight** — Users open the app to answer a question ("How many leads came in today?", "Which client is underperforming?"). Every page should answer its primary question within 2 seconds of visual scanning.

2. **Progressive disclosure** — Show summary first, details on demand. KPI cards → click into detail view → drill into individual record. Never dump all data at once.

3. **Consistent mental models** — Same interaction pattern for same action type across the entire app. If one list is clickable rows with hover states, all lists are clickable rows with hover states.

4. **Reduce decisions** — Smart defaults, pre-filled values, logical ordering. The user should confirm, not construct.

## Habit Formation (actionable UI rules)

Full strategy: `.claude/plans/product-principles.md`. These are the implementation rules derived from the Hook Model:

- Every KPI card must show change over time ("+12% vs last week"), not just current state
- Revenue recovered is the most prominent number on every dashboard — it's the core value prop
- Every notification/email links directly to the relevant page, never the homepage
- Empty states always include the next action the user can take ("Create your first flow")
- After user investment (KB article, flow edit, AI settings), show immediate impact metric
- Setup completion progress shown until account is fully configured ("70% configured")
- The most important number on each page must be visible without scrolling
- Core actions take 0-1 clicks from the dashboard
- Use `border-l-4 border-l-red-500` on items needing urgent attention — make action items unmissable
- Positive trends get green arrows or upward indicators — surface wins, don't bury them

## Page Layout Standards

### Client Portal (narrow, focused)
```
Container: max-w-3xl mx-auto px-4
Section spacing: space-y-6
Purpose: answer one question per page
```
- Keep pages single-purpose — Dashboard answers "how am I doing?", Conversations answers "what needs attention?"
- Limit to 4 stat cards max per view — more than 4 KPIs means nothing stands out
- Action items (leads needing response, overdue tasks) always appear above informational content

### Admin Portal (wide, dense)
```
Container: max-w-7xl mx-auto px-3 lg:px-4
Section spacing: space-y-6
Purpose: manage and compare across clients
```
- Support scanning across rows — admin users compare clients, not read one at a time
- Always show the client name in context when viewing client-specific data
- Provide filters and search before pagination — admins need to find, not browse

## Component Patterns

### Stat Cards (KPIs)
```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">Label</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    <p className="text-xs text-muted-foreground">{context}</p>
  </CardContent>
</Card>
```
- Always include context line ("+12% vs last week", "3 pending", "since Oct 1")
- Use `grid gap-4 md:grid-cols-2` (client) or `md:grid-cols-4` (admin)
- Never show a number without explaining what it means

### Lists (clickable rows)
```tsx
<div className="divide-y">
  <Link href={...} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
    <div>{/* primary info: name, description */}</div>
    <div>{/* metadata: status badge, timestamp, count */}</div>
  </Link>
</div>
```
- Left side: identity (name, description)
- Right side: status + metadata
- Use `border-l-4 border-l-red-500` for items needing urgent attention
- Always include a timestamp or recency indicator — "2 hours ago" tells the user if this is stale

### Empty States
```tsx
<Card>
  <CardContent className="py-12 text-center">
    <p className="text-muted-foreground mb-2">No conversations yet</p>
    <p className="text-sm text-muted-foreground">Conversations will appear here when leads respond to your messages.</p>
  </CardContent>
</Card>
```
- Never show just "No data" — explain why it's empty and what would make data appear
- If there's an action the user can take, include a button ("Create your first flow")
- Use `py-12` for breathing room — empty states shouldn't feel cramped

### Forms
- Group related fields visually (personal info together, settings together)
- Put the primary action button at the bottom-right (save/submit)
- Destructive actions go in a separate "Danger Zone" card with `border-destructive` and red title
- Pre-fill with current values when editing — never make the user re-enter what already exists
- Disable submit button while saving, show inline success/error feedback

### Loading States
- Use `Skeleton` components matching the shape of the content they replace
- For tables/lists: show 3-5 skeleton rows
- For stat cards: show skeleton matching the card layout
- Never show a blank page — the user should see the page structure immediately

### Error States
- Inline errors near the field that caused them (forms)
- Toast/alert for action failures ("Failed to save settings. Please try again.")
- Never show raw error messages or stack traces to users
- Provide a recovery action when possible ("Retry", "Go back", "Contact support")

## Color Coding (brand palette only — no raw Tailwind colors)

### Brand Colors
| Name | Hex | Usage |
|------|-----|-------|
| Forest | `#1B2F26` | Primary backgrounds, nav, outbound message bubbles |
| Terracotta | `#D4754A` | Accent, hover states |
| Olive | `#6B7E54` | AI indicators, secondary accent |
| Sienna | `#C15B2E` | Warnings, errors, urgent states |
| Sage-light | `#C8D4CC` | Subtle backgrounds, AI mode badge |
| Moss-light | `#E3E9E1` | Page backgrounds, cards |

### Status Colors (use these CSS classes)
| Status | Background | Text |
|--------|-----------|------|
| Active/Success | `bg-[#E8F5E9]` | `text-[#3D7A50]` |
| Pending/Warning | `bg-[#FFF3E0]` | `text-sienna` |
| Paused/Inactive | `bg-muted` | `text-foreground` |
| Error/Cancelled | `bg-[#FDEAE4]` | `text-sienna` |

### Lead Temperature
| Temp | Icon | Background | Text |
|------|------|-----------|------|
| Hot | Flame | `bg-[#FDEAE4]` | `text-sienna` |
| Warm | Thermometer | `bg-[#FFF3E0]` | `text-sienna` |
| Cold | Snowflake | `bg-sage-light` | `text-forest` |

Use these consistently. Never use raw Tailwind colors (blue-500, red-600, etc.).

## Typography Hierarchy
| Element | Classes |
|---------|---------|
| Page title | `text-2xl font-bold` |
| Page subtitle | `text-muted-foreground` (below title) |
| Section title | `text-lg font-semibold` or `text-xl font-bold` |
| Card title | Via `CardTitle` (inherits `text-base font-semibold`) |
| Body text | `text-sm` |
| Secondary text | `text-sm text-muted-foreground` |
| Metadata/timestamps | `text-xs text-muted-foreground` |
| Big numbers (KPIs) | `text-2xl font-bold` |

## Responsive Behavior
- Client portal: `max-w-3xl` — readable on mobile, centered on desktop
- Admin portal: `max-w-7xl` — uses full width for data density
- Grids collapse to single column on mobile: `grid md:grid-cols-2` or `grid md:grid-cols-4`
- Tables: wrap in `overflow-x-auto` for horizontal scroll on mobile
- Navigation: `MobileNav` (Sheet drawer) replaces horizontal nav on mobile

## Interaction Standards
- All clickable rows use `hover:bg-gray-50 transition-colors`
- All cards use `rounded-xl shadow-sm`
- All buttons use `rounded-md`
- Destructive actions always require confirmation (AlertDialog)
- Dropdowns for secondary actions (edit, delete, duplicate) — use `DropdownMenu`
- Bulk actions appear above the list when items are selected

## Anti-Patterns (never do these)
- Don't add animations/transitions beyond hover states and page transitions — this is a work tool, not a showcase
- Don't use modals for content that could be a page — modals are for confirmations and quick edits only
- Don't show more than 4 stat cards in a row — cognitive overload
- Don't use icons without labels in navigation — icons alone are ambiguous
- Don't hide critical actions behind menus — primary actions get visible buttons
- Don't use different patterns for the same interaction type across pages
- Don't add loading spinners to server-rendered pages — use Suspense boundaries with Skeleton fallbacks
- Don't use emojis in SMS notifications, email subjects, or UI text — unprofessional
- Don't use `h-[calc(100vh-Xrem)]` for mobile layouts — use flex + min-h-0 + dvh units
- Don't use raw Tailwind color classes — use brand palette only (Learned Rule 10)

## Established UI Patterns (reuse these)

These components exist and should be reused, not reimplemented:

| Pattern | Component | Location |
|---------|-----------|----------|
| Breadcrumbs | `<Breadcrumbs items={[...]}/>` | `src/components/breadcrumbs.tsx` |
| Notification bell | `<NotificationBell portalType="client\|admin"/>` | `src/components/notification-bell.tsx` |
| SLA countdown | `<SlaCountdown deadline={date}/>` | `src/components/escalations/sla-countdown.tsx` |
| Unsaved changes | `useUnsavedChangesWarning(isDirty)` | `src/lib/hooks/use-unsaved-changes-warning.ts` |
| Tabbed layout (URL-persisted) | Use shadcn Tabs + `useSearchParams` for ?tab= | Pattern in `client-detail-tabs.tsx`, `settings-tabs.tsx` |
| Mobile card fallback | `hidden sm:block` (table) + `sm:hidden` (cards) | Pattern in `leads-table.tsx`, `InvoiceList.tsx` |
| Split-pane (list + detail) | Left pane (w-80) + right pane (flex-1) | Pattern in `conversations-shell.tsx` |
| Polling hook | `setInterval` in `useEffect` with delta fetch | Pattern in `conversations-shell.tsx` |
| Recently viewed | localStorage `cs-*` keys | Pattern in `track-recent-view.tsx`, `clients-filter.tsx` |
| Lead navigation | Previous/Next from stored list | Pattern in `lead-navigation.tsx` |

## Resilience Patterns (edge case fixes)

When fixing edge cases or adding error handling, use these established patterns:

| Pattern | How | Example |
|---------|-----|---------|
| **localStorage safe access** | Wrap in try-catch, default on failure | `notification-bell.tsx`, `conversations-shell.tsx` |
| **Polling failure recovery** | Track consecutive failures, show banner at 3+ | `conversations-shell.tsx` — "Connection lost. Retrying..." |
| **Race condition on async UI** | AbortController per fetch, cancel on new request | `conversations-shell.tsx` — `fetchAbortRef` |
| **Timeout on loading states** | setTimeout + error state after 5s | `conversations-shell.tsx` — "This conversation is no longer available" |
| **Partial data fetch failure** | `Promise.allSettled()` with typed defaults | `client/page.tsx`, `admin/clients/[id]/page.tsx` |
| **Database unique violation** | Catch Postgres error code `23505`, return user-friendly message | `appointment-booking.ts` |
| **Rate limiting (public API)** | In-memory sliding window Map, 429 response | `api/public/leads/route.ts` |
| **Input sanitization** | Strip HTML tags via regex before storage | `api/public/leads/route.ts` — `/<[^>]*>/g` |
| **Deduplication** | Check recent submissions by key fields, return idempotent success | `api/public/leads/route.ts` — phone+clientId within 60s |
| **SMS send failure** | Log + continue to next recipient, never mark "notified" if all fail | `team-escalation.ts` pattern |

### Rules for edge case fixes
1. Never crash the page — degrade gracefully with a fallback UI
2. Never lose user input — if a send fails, keep the text in the input field
3. Never show raw error messages — map to user-friendly text
4. Never mark a notification/escalation as "sent" if the actual send failed
5. Always check for null/deleted resources before using them in templates (SMS body, email subject)

## UX Implementation Process

Follow this for every UI/UX change:

### Before coding
1. Read this skill file for patterns and anti-patterns
2. Check `docs/specs/UX-AUDIT-FULL.md` — is this change tracking an open item?
3. Identify which persona is affected: homeowner (SMS), contractor (portal), operator (admin)

### During coding
4. Test at 375px width (mobile) and 1440px (desktop)
5. Reuse established patterns from the table above — don't reinvent
6. No emojis, no raw Tailwind colors, no `any` types

### After coding
7. Run `npm run typecheck` + `npm test`
8. Update `docs/specs/UX-AUDIT-FULL.md` — mark item Done in "Already Fixed" table
9. Scan CLAUDE.md Change-to-Doc mapping table — update every matching doc:

| If your change affects... | Update these docs |
|--------------------------|-------------------|
| What the platform does | `docs/product/PLATFORM-CAPABILITIES.md` |
| How to verify it works | `docs/engineering/01-TESTING-GUIDE.md` (add/update test step) |
| How operator delivers the service | `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` |
| Operator daily workflow | `docs/operations/01-OPERATIONS-GUIDE.md` |
| Client-facing claims or promises | Flag to user — `docs/business-intel/OFFER-APPROVED-COPY.md` is approved copy |
| Onboarding or first-client delivery | `docs/operations/LAUNCH-CHECKLIST.md` |

10. Run `npm run quality:no-regressions` — never mark done with a red gate
