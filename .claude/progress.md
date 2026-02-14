# Session 13 — Remaining Features Implementation

**Plan file**: `.claude/plan/REMAINING_FEATURES_PLAN.md`
**Baseline commit**: `986caeb` (Session 12 complete)
**Scope**: 13 items (T1 + T2 from execution plan)

## How to Resume

If picking up from a new session, read this file first, then:
1. Check which items are `[DONE]` vs `[TODO]` below
2. Continue from the first `[TODO]` item
3. After completing each item, update this file and commit
4. Run `npm run build` after each batch to verify zero TS errors

---

## Progress Tracker

### Batch 1 — Quick Wins
- [x] **Item 1: Webhook Auto-Config** — Already implemented in `twilio-provisioning.ts` (`configureWebhooks`)
- [x] **Item 2: Create Lead Manually** — POST API + CreateLeadDialog wired into leads-table
- [x] **Item 4: Export Leads CSV** — GET /api/leads/export + Export button on leads page
- [x] **Item 8: Clone Template** — POST /api/admin/flow-templates/[id]/clone + Duplicate menu item wired

### Batch 2 — Client Experience
- [x] **Item 5: Client Revenue Dashboard** — /client/revenue page + /api/client/revenue API, reuses ROIDashboard
- [x] **Item 3: Trial Reminders** — Service + cron, emails at day 7/12/14 using createdAt (no migration)
- [x] **Item 10: Conversation Notes** — Already implemented via lead notes field on LeadHeader
- [x] **Item 19: AI Settings (Client)** — /client/settings/ai + /api/client/ai-settings (tone, emojis, goals, quiet hours)
- [x] **Item 20: Feature Toggles (Client)** — /client/settings/features + /api/client/features (safe subset)

### Batch 3 — CRM Depth
- [ ] **Item 9: Per-Lead Flow Status** — Show active flows on lead detail
  - Files: `src/app/api/leads/[id]/flows/route.ts` (NEW), `src/app/(dashboard)/leads/[id]/lead-flows.tsx` (NEW), lead detail page (add section)
- [ ] **Item 12: Client Flow Management** — Toggle on/off for assigned flows
  - Files: `src/app/api/client/flows/route.ts` (NEW), `src/app/api/client/flows/[id]/route.ts` (NEW), `src/app/(client)/client/flows/page.tsx` (NEW)

### Batch 4 — Admin Tools
- [ ] **Item 6+7: Plan Management + Overage Config** — Admin CRUD for subscription plans
  - Files: `src/app/api/admin/plans/route.ts` (NEW), `src/app/api/admin/plans/[id]/route.ts` (NEW), `src/app/(dashboard)/admin/billing/plans/` (NEW)
- [ ] **Item 13: System Settings Page** — Admin UI for system_settings table
  - Files: `src/app/api/admin/settings/route.ts` (NEW), `src/app/(dashboard)/admin/settings/page.tsx` (NEW)

---

## Commits (updated as we go)

| Commit | Items | Description |
|--------|-------|-------------|
| `986caeb` | baseline | Session 12 complete |
| | Batch 1 | |
| | Batch 2 | |
| | Batch 3 | |
| | Batch 4 | |

---

## Notes

- Item 10 (Conversation Notes): leads already have a `notes` text field editable via LeadHeader. May mark as [LIVE] if sufficient.
- Item 11 (Conversation Tags) and Item 15 (Read Receipts) moved to T3 — not included in this session's 13 items.
- Items 6+7 (Plan Management + Overage) are combined since overage config is part of the plan form.
- Always run `npm run build` between batches.
