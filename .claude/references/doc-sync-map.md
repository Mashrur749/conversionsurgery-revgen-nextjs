# Documentation Sync Map

Use this map after code changes. Keep `CLAUDE.md` lean; load this file only when deciding which docs need updates.

## Change To Doc Mapping

| What changed | Check / update |
| --- | --- |
| Any automation (estimate, payment, review, win-back, no-show, appointment) | `docs/product/PLATFORM-CAPABILITIES.md` (Section 2: Follow-Up Automation) |
| Any automation schedule or touch count | `docs/engineering/01-TESTING-GUIDE.md` (matching test step) |
| Voice AI flow, modes, or transfer logic | `docs/product/PLATFORM-CAPABILITIES.md` (Section 3: Voice AI) |
| Voice AI webhooks or kill switch | `docs/engineering/01-TESTING-GUIDE.md` (Step 16) |
| Lead pipeline stages, scoring, or context fields | `docs/product/PLATFORM-CAPABILITIES.md` (Section 4: Communication Hub) |
| Client portal pages, permissions, or nav | `docs/product/PLATFORM-CAPABILITIES.md` (Section 5: Client Portal) |
| Compliance rules, consent types, quiet hours, or gateway logic | `docs/product/PLATFORM-CAPABILITIES.md` (Section 6: Compliance) |
| Compliance behavior | `docs/business-intel/OFFER-APPROVED-COPY.md` (Sections 6-7: Quiet Hours + Compliance) |
| Reporting metrics, Without Us model, or delivery | `docs/product/PLATFORM-CAPABILITIES.md` (Section 7: Reporting) |
| Billing, plans, add-ons, guarantee, or cancellation | `docs/product/PLATFORM-CAPABILITIES.md` (Section 8: Billing) |
| Billing terms or pricing | `docs/business-intel/OFFER-APPROVED-COPY.md` (Sections 4-5: Pricing + Terms) |
| Onboarding milestones, quality gates, or progressive activation | `docs/product/PLATFORM-CAPABILITIES.md` (Section 9: Onboarding) |
| Quarterly campaign types or planner logic | `docs/product/PLATFORM-CAPABILITIES.md` (Section 10: Quarterly Growth Blitz) |
| AI agent behavior, guardrails, model routing, or decision pipeline | `docs/product/PLATFORM-CAPABILITIES.md` (Section 1: AI Conversation Agent + Section 11: Observability) |
| AI agent tests or evaluation criteria | `docs/engineering/01-TESTING-GUIDE.md` (Steps 32-35: model routing, scenarios, AI criteria, effectiveness) |
| AI effectiveness metrics, attribution, or dashboard | `docs/product/PLATFORM-CAPABILITIES.md` (Section 11: Observability), `docs/operations/01-OPERATIONS-GUIDE.md` (items 28-30) |
| Admin tools, kill switches, cron jobs, or observability | `docs/product/PLATFORM-CAPABILITIES.md` (Section 11: Agency Operations) |
| New cron job added or removed | `docs/engineering/01-TESTING-GUIDE.md` (Section 3: Useful Commands, cron list) |
| Review monitoring, auto-response, or Google integration | `docs/product/PLATFORM-CAPABILITIES.md` (Section 12: Review Monitoring) |
| New API route or webhook | `docs/engineering/01-TESTING-GUIDE.md` (add test step if user-facing) |
| Schema migration (new table, dropped column, FK change) | `docs/engineering/01-TESTING-GUIDE.md` (preflight, `db:migrate` step) |
| Permission changes (new permission, route guard change) | `docs/engineering/02-ACCESS-MANAGEMENT.md` |
| Feature added, removed, or substantially changed | `docs/product/PLATFORM-CAPABILITIES.md` (relevant section) |
| Feature removed that was in the offer | `docs/product/02-OFFER-PARITY-GAPS.md` |
| Feature backlog item implemented | `docs/product/FEATURE-BACKLOG.md` (mark resolved or remove) |
| Client portal page layout, nav, or UX change | `docs/product/PLATFORM-CAPABILITIES.md` (Section 5: Client Portal), `docs/specs/UX-AUDIT-FULL.md` (mark item Done if tracked) |
| Admin dashboard layout, nav, or UX change | `docs/product/PLATFORM-CAPABILITIES.md` (Section 11: Agency Operations), `docs/specs/UX-AUDIT-FULL.md` (mark item Done if tracked) |
| New UI component used across pages | `docs/product/PLATFORM-CAPABILITIES.md` (relevant section) |
| SMS/notification copy or tone change | `docs/product/PLATFORM-CAPABILITIES.md` (relevant automation section), review `docs/business-intel/OFFER-APPROVED-COPY.md` for consistency |
| Onboarding wizard, self-serve signup, or day-one flow change | `docs/product/PLATFORM-CAPABILITIES.md` (Section 9: Onboarding), `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (Section 10: Onboarding Call) |
| Change that affects managed-service delivery | `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (relevant section), `docs/operations/01-OPERATIONS-GUIDE.md` |
| Change that affects contractor day-to-day portal use | `docs/operations/LAUNCH-CHECKLIST.md` (Phase 3: First Client Delivery, if onboarding steps change) |

## Key Docs

| Doc | Purpose |
| --- | --- |
| `docs/product/PLATFORM-CAPABILITIES.md` | Built feature inventory |
| `docs/business-intel/OFFER-APPROVED-COPY.md` | Approved client-facing claims |
| `docs/engineering/01-TESTING-GUIDE.md` | Runnable manual and automated verification |
| `docs/product/02-OFFER-PARITY-GAPS.md` | Promised-vs-built gap register |
| `docs/product/FEATURE-BACKLOG.md` | Planned future work |
| `docs/engineering/02-ACCESS-MANAGEMENT.md` | Permissions and routes |
| `docs/operations/01-OPERATIONS-GUIDE.md` | Operator playbook |
| `docs/specs/UX-AUDIT-FULL.md` | UX issue tracker |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Managed-service delivery playbook |
| `docs/operations/LAUNCH-CHECKLIST.md` | Go-to-market checklist |
