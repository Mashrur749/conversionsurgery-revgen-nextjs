# UI Gap Audit — Operator Dashboard + Client Portal

**Date:** 2026-04-14
**Context:** All backend systems built (Plans 1-9, Plan 4A). This audit identifies UI gaps where backend data exists but no frontend surfaces it.

---

## Critical for Operator (before first client)

### GAP-UI-01: Conversation Stage on Lead Detail

**Current:** Lead detail page shows `status` (pipeline) and `temperature` (hot/warm/cold) but NOT `conversationStage` (greeting/qualifying/proposing/etc.)
**Backend:** `leadContext.conversationStage` populated on every message
**Fix:** Add a stage badge to the lead detail header. Use existing badge component pattern.
**Files:** `src/app/(dashboard)/leads/[id]/page.tsx` or the lead header component
**Effort:** Small — render existing data

### GAP-UI-02: Lead Scores on Detail Page

**Current:** `LeadScoreBadge` component exists at `src/components/leads/lead-score-badge.tsx` and renders urgency/budget/intent/engagement. But it's only used in the leads LIST table, not on the lead DETAIL page.
**Fix:** Add `LeadScoreBadge` to the lead detail page header/sidebar.
**Files:** `src/app/(dashboard)/leads/[id]/page.tsx`
**Effort:** Trivial — component exists, just needs rendering

### GAP-UI-03: Decision-Maker Info on Lead Detail

**Current:** `leadContext.decisionMakers` populated by AI when partner mentions detected. Not visible anywhere.
**Fix:** Add a small section to lead detail showing partner name and approval status.
**Files:** `src/app/(dashboard)/leads/[id]/page.tsx`, need API route to serve decisionMakers
**Effort:** Small

---

## Important for Operator (first 30 days)

### GAP-UI-04: AI Health Reports Dashboard

**Current:** `ai_health_reports` table populated weekly by cron. No page to view results.
**Fix:** New page at `/admin/ai-health` showing health trends, alert history, metric charts.
**Files:** Create `src/app/(dashboard)/admin/ai-health/page.tsx`, API route
**Effort:** Medium — new page with charts

### GAP-UI-05: Smart Assist Correction Rate

**Current:** Corrections logged to `audit_log` with action `smart_assist_correction`. `getSmartAssistCorrectionRate()` function exists. No UI.
**Fix:** Add correction rate card to existing Smart Assist area on client detail, or to AI effectiveness dashboard.
**Files:** `src/app/(dashboard)/admin/clients/[id]/smart-assist-card.tsx` or `admin/ai-effectiveness`
**Effort:** Medium — new card with trend chart

### GAP-UI-06: Opt-Out Reason Analytics

**Current:** `leads.optOutReason` populated with 6 categories. No breakdown visible.
**Fix:** Add pie/bar chart to compliance dashboard showing opt-out reason distribution.
**Files:** `src/app/(dashboard)/admin/compliance/page.tsx`, API route
**Effort:** Small — add chart to existing page

### GAP-UI-07: Analysis Snapshot Viewer

**Current:** `agentDecisions.analysisSnapshot` stores AI reasoning per decision. Not viewable.
**Fix:** Add expandable row in AI quality/effectiveness page showing the full analysis for each decision.
**Files:** `src/app/(dashboard)/admin/ai-effectiveness/page.tsx` or `admin/ai-quality`
**Effort:** Medium — expandable detail component

### GAP-UI-08: Escalation Reassignment Controls

**Current:** Escalation queue shows escalations. Reassignment happens automatically on member removal. No manual reassignment UI.
**Fix:** Add dropdown/button on each escalation row to reassign to a different team member.
**Files:** `src/app/(dashboard)/admin/escalations/page.tsx`
**Effort:** Small — dropdown with member list + API call

---

## Nice to Have (post-launch)

### GAP-UI-09: Strategy State Display

**Current:** `leadContext.strategyState` populated per turn. Not visible.
**Fix:** Show current objective and suggested action on lead detail sidebar.
**Files:** Lead detail page
**Effort:** Small

### GAP-UI-10: Prompt Version in AI Quality

**Current:** `agentDecisions.actionDetails.promptVersion` logged. Not visible.
**Fix:** Add version column to AI effectiveness table.
**Files:** AI effectiveness page
**Effort:** Small

### GAP-UI-11: CASL Consent Badge on Leads

**Current:** `leads.caslConsentAttested` populated on import. Not visible in lead list/detail.
**Fix:** Add consent badge to lead rows.
**Effort:** Trivial

### GAP-UI-12: Booking Aggressiveness Slider

**Current:** `clientAgentSettings.bookingAggressiveness` exists (1-10). Client portal AI settings page has tone/goal but no aggressiveness control.
**Fix:** Add slider to `/client/settings/ai` page.
**Effort:** Small

---

## Client Portal — No Critical Gaps

The contractor portal is comprehensive: dashboard, conversations, appointments, reviews, KB wizard, team management, billing, help center, settings, lead import, flows, reporting, cancellation. All functional. No missing pages.

---

## Status (Updated 2026-04-15)

All 8 critical and first-30-day gaps verified as already implemented:

| Gap | Status | Implementation |
|-----|--------|---------------|
| GAP-UI-01 | **Done** | `lead-header.tsx:113-120` — stage badge with per-stage styling |
| GAP-UI-02 | **Done** | `lead-header.tsx:121-136` — LeadScoreBadge compact with factors |
| GAP-UI-03 | **Done** | `lead-header.tsx:137-148` — partner info with consulted status |
| GAP-UI-04 | **Done** | `admin/ai-health/page.tsx` — full health reports dashboard |
| GAP-UI-05 | **Done** | `smart-assist-card.tsx:240` — CorrectionRateIndicator |
| GAP-UI-06 | **Done** | `compliance-dashboard-client.tsx:26` — optOutReasonBreakdown |
| GAP-UI-07 | **Done** | `ai-effectiveness-dashboard.tsx:412` — expandable analysis snapshot |
| GAP-UI-08 | **Done** | `escalation-assign-select.tsx` — team member reassignment dropdown |

Post-launch (deferred):
  GAP-UI-09 through GAP-UI-12
