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

## Color Coding (established conventions)

### Status Colors
| Status | Background | Text |
|--------|-----------|------|
| Active/Success | `bg-green-100` | `text-green-800` |
| Pending/Warning | `bg-yellow-100` | `text-yellow-800` |
| Paused/Inactive | `bg-gray-100` | `text-gray-800` |
| Error/Cancelled | `bg-red-100` | `text-red-800` |
| Info/AI | `bg-blue-100` | `text-blue-800` |

### Lead Temperature
| Temp | Icon | Background | Text |
|------|------|-----------|------|
| Hot | Flame | `bg-red-100` | `text-red-800` |
| Warm | Thermometer | `bg-yellow-100` | `text-yellow-800` |
| Cold | Snowflake | `bg-blue-100` | `text-blue-800` |

Use these consistently. Never invent new color mappings for the same concepts.

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
