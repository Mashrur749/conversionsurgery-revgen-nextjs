# Learning Loops & Optimization — Implementation Plan (Overview)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data flywheel — the system gets smarter with every conversation through edit analysis, outcome feedback, scoring calibration, and experimentation.

**Architecture:** Weekly cron-driven analysis pipelines that extract patterns from production data and feed them back into the agent via KB entries, playbook updates, and calibrated thresholds.

**Depends on:** Plan 2 (orchestration redesign) for prompt versioning and strategy architecture. Most tasks also need 200+ completed leads for statistical significance.

**Full specs:** `docs/superpowers/specs/2026-04-13-ai-audit-issues.md` (AUDIT-05 through 13)

---

## Task Breakdown

### Task 1: Smart Assist Edit Learning Pipeline (AUDIT-05)

**Timing:** First 30 days (correction data available from Day 1)

**Files:**
- Create: `src/lib/services/smart-assist-learning.ts`
- Create: `src/lib/services/smart-assist-learning.test.ts`
- Modify: `src/lib/services/smart-assist-lifecycle.ts` — emit correction events
- Create: cron job for weekly analysis

**Approach:**
1. In `sendSmartAssistDraftNow()`, when `content !== assistOriginalContent`, log a `smart_assist_correction` audit event with both versions
2. Weekly cron: batch corrections by client, compute correction rate, and store patterns
3. When correction rate > 30% for a client, alert operator to review AI settings
4. Phase 2: LLM analysis of correction patterns → per-client KB entries

### Task 2: Separate Analysis/Decision Logging (AUDIT-10)

**Timing:** First 30 days

**Files:**
- Modify: `src/db/schema/agent-decisions.ts` — add `analysisSnapshot` JSONB column
- Modify: `src/lib/agent/orchestrator.ts` — split logging
- Migration needed

**Approach:** When logging to `agentDecisions`, separate the analysis fields (sentiment, scores, stage, extractedInfo, keyInsights) from the decision fields (action, confidence, reasoning, alternatives). Store analysis in `analysisSnapshot`, decision stays in existing fields. Enables future evals that test analysis accuracy independently from decision quality.

### Task 3: Evals in CI (Best Practice 6.5)

**Timing:** First 30 days

**Files:**
- Modify: `.github/workflows/` or equivalent CI config
- Create: `scripts/ci/run-safety-evals.sh`

**Approach:**
1. On PRs touching `src/lib/agent/`, `src/lib/ai/`, `src/lib/automations/`, `src/lib/services/`: run safety evals
2. Safety category (pricing, opt-out, identity, injection) = zero tolerance
3. Quality categories = baseline regression check (>10% drop blocks)
4. Cost: ~$0.20 per CI run (Haiku calls)
5. Cache eval results by commit hash to avoid re-running on same code

### Task 4: Conversation Summary Structured Extraction (AUDIT-13)

**Timing:** First 30 days

**Files:**
- Modify: `src/lib/services/conversation-summary.ts` — add structured extraction alongside narrative
- Modify: `src/db/schema/lead-context.ts` — add `structuredSummary` JSONB field
- Migration needed

**Approach:** After generating narrative summary, make a second Haiku call (or extend the same call) to extract: `keyObjections[]`, `bookingAttemptsAndOutcomes[]`, `priceSensitivityLevel`, `emotionalArcSummary`. Store as JSONB. Feed structured fields into agent prompt separately from narrative.

### Task 5: A/B Testing Framework (AUDIT-06)

**Timing:** After 5+ clients

**Files:**
- Create: `src/db/schema/experiments.ts`
- Create: `src/lib/services/experimentation.ts`
- Create: `src/lib/services/experimentation.test.ts`
- Modify: `src/lib/agent/orchestrator.ts` — variant assignment + logging
- Create: admin dashboard page
- Migration needed

**Approach:**
1. `experiments` table: `id, name, variantAConfig, variantBConfig, metric, startDate, endDate, status`
2. `assignVariant(leadId, experimentId)`: deterministic hash assignment (sticky by lead)
3. Orchestrator checks active experiments, assigns variant, logs in `agentDecisions.actionDetails.experimentVariant`
4. Dashboard: conversion rate by variant, confidence interval, sample size

### Task 6: Conversation Analytics (AUDIT-07)

**Timing:** After 200+ completed leads

**Files:**
- Create: `src/lib/services/conversation-analytics.ts`
- Create: admin dashboard page

**Approach:**
1. Extract conversation sequences from `agentDecisions` (ordered actions per lead)
2. Group by outcome (won/lost/dormant)
3. Compute: average message count to booking, common action sequences in won vs lost, stage where most leads drop off
4. Dashboard: conversion funnel by stage, action sequence heatmap

### Task 7: Lead Scoring Calibration (AUDIT-08)

**Timing:** After 200+ completed leads

**Files:**
- Create: `scripts/analysis/calibrate-scores.ts`
- Modify: `src/lib/ai/model-routing.ts` — update thresholds from calibration data

**Approach:**
1. Export: all `agentDecisions` with scores + lead outcomes
2. Compute: what score ranges predicted booking? (urgency, budget, intent, composite)
3. Compare: current routing thresholds vs empirical thresholds
4. Update thresholds if significantly different
5. Re-run quarterly

### Task 8: Outcome Feedback Loop (AUDIT-09)

**Timing:** After 5+ clients with outcome data

**Files:**
- Create: `src/lib/services/agent-feedback-loop.ts`
- Create: cron job for weekly analysis

**Approach:**
1. Weekly cron: pull positive-outcome conversations (won leads)
2. Extract common patterns: what actions preceded booking? What strategy worked?
3. Pull negative-outcome conversations: where did leads disengage?
4. Generate per-client "winning playbook" insights
5. Store as KB entries tagged `source: 'feedback_loop'`
6. Phase 2: auto-update playbook data based on discovered patterns

### Task 9: Multi-Touch Attribution (AUDIT-12)

**Timing:** After conversation analytics (Task 6)

**Files:**
- Modify: `src/lib/services/ai-attribution.ts` — tag all decisions in window as `contributing`
- Modify: dashboard to show attribution chain

**Approach:** Change `attributeFunnelEvent()` to tag ALL `agentDecisions` within the 7-day window as `contributing`, not just the most recent. Add `attributionRole: 'primary' | 'contributing'` to the outcome tracking. Reporting shows the full chain of decisions that led to the outcome.

---

## Execution Order

```
Phase A (First 30 days):
  Task 1 (Smart Assist learning) — starts collecting from Day 1
  Task 2 (Analysis/decision split) — enables better debugging
  Task 3 (Evals in CI) — safety gate
  Task 4 (Structured summary) — improves long conversations

Phase B (After 5+ clients):
  Task 5 (A/B testing) — prerequisite: prompt versioning from Plan 2
  Task 8 (Outcome feedback) — needs outcome data

Phase C (After 200+ leads):
  Task 6 (Conversation analytics) — needs statistical significance
  Task 7 (Score calibration) — needs outcome data + scores
  Task 9 (Multi-touch attribution) — needs analytics infrastructure
```

**Note:** Each task needs full step-by-step detailing before execution. Phase A tasks can be planned in detail immediately after Plan 2 ships. Phase B/C tasks should be planned when their data prerequisites are met.
