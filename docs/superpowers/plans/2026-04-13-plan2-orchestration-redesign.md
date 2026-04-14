# 6-Layer Architecture Foundation — Implementation Plan (Overview)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the agent from a reactive responder into an expert sales conversationalist via 6-layer composable architecture with deterministic strategy resolution.

**Architecture:** Data-driven layers (DB + code constants) compose into system prompts. Deterministic strategy resolver replaces open-ended LLM decision-making. Prompt caching reduces cost/latency.

**Tech Stack:** TypeScript, Drizzle ORM, Zod, Anthropic SDK (prompt caching), Vitest

**Depends on:** Plan 1 (critical fixes) should be complete first.

**Full spec:** `docs/superpowers/specs/2026-04-13-ai-orchestration-redesign.md`

---

## Task Breakdown

### Task 1: Schema Migration — New Tables + Lead Context Fields

**Files:**
- Create: `src/db/schema/sales-methodology.ts`
- Create: `src/db/schema/locale-contexts.ts`
- Create: `src/db/schema/industry-playbooks.ts`
- Modify: `src/db/schema/lead-context.ts` — add `conversationPlan`, `decisionMakers`, `structuredSummary`
- Modify: `src/db/schema/agent-decisions.ts` — add `analysisSnapshot`, `promptVersion`
- Modify: `src/db/schema/clients.ts` — add `localeId`, `playbookId`
- Modify: `src/db/schema/index.ts` — re-export new tables
- Run: `npm run db:generate` → review SQL → user confirms `db:migrate`

### Task 2: Layer 1 — Sales Methodology Data Model + Seed

**Files:**
- Create: `src/lib/agent/methodology.ts` — TypeScript interfaces + default methodology
- Create: `src/lib/agent/methodology.test.ts` — unit tests for stage transitions
- Seed: Insert `sales_methodology` row with the 8-stage methodology from spec section 3.1

### Task 3: Layer 2 — Locale Context Data + Seed

**Files:**
- Create: `src/lib/agent/locales/types.ts` — LocaleContext interface
- Create: `src/lib/agent/locales/ca-ab.ts` — Canadian Alberta locale data
- Seed: Insert `locale_contexts` row for `ca-ab`

### Task 4: Layer 3 — Industry Playbook Data + Seed

**Files:**
- Create: `src/lib/agent/playbooks/types.ts` — IndustryPlaybook interface
- Create: `src/lib/agent/playbooks/basement-development.ts` — basement playbook data
- Create: `src/lib/agent/playbooks/basement-development.test.ts` — validate playbook completeness
- Seed: Insert `industry_playbooks` row for `basement_development`
- Integrate: Extend existing `src/lib/data/trade-synonyms.ts` vocabulary into playbook

### Task 5: Layer 4 — Channel Adaptation Constants

**Files:**
- Create: `src/lib/agent/channels.ts` — ChannelAdaptation interface + SMS/Voice/WebChat configs
- Create: `src/lib/agent/channels.test.ts` — validate all channels have required fields

### Task 6: Layer 5 — Conversation Entry Context Resolver

**Files:**
- Create: `src/lib/agent/entry-context.ts` — resolveEntryContext() function
- Create: `src/lib/agent/entry-context.test.ts` — test each source type
- Tests cover: missed_call, form_submission, inbound_sms, dormant_reactivation, returning lead

### Task 7: Strategy Resolver (Core — Layer 1 Applied)

**Files:**
- Create: `src/lib/agent/strategy-resolver.ts` — resolveStrategy() pure function
- Create: `src/lib/agent/strategy-resolver.test.ts` — extensive unit tests
- Tests: every stage → objective + action mapping, stage transitions, maxTurns, emergency bypass (SIM-04), decision-maker awareness (SIM-03), form fast-track (SIM-05), returning lead reset (GAP-S5)

### Task 8: Prompt Composer (6-Layer Assembly)

**Files:**
- Create: `src/lib/agent/prompt-composer.ts` — composeAgentPrompt() assembling all 6 layers
- Create: `src/lib/agent/prompt-composer.test.ts` — test layer composition, degradation, token budget
- Tests: all layers present, missing layer fallback, token budget enforcement, cache-optimized ordering

### Task 9: Prompt Caching in Anthropic Provider

**Files:**
- Modify: `src/lib/ai/providers/anthropic.ts` — accept system prompt as cacheable blocks
- Modify: `src/lib/ai/types.ts` — add `systemBlocks` option to ChatOptions
- Create: tests for cache_control block generation

### Task 10: Integrate Strategy into analyzeAndDecide

**Files:**
- Modify: `src/lib/agent/state.ts` — add `conversationStrategy` to state type
- Modify: `src/lib/agent/nodes/analyze-and-decide.ts` — use strategy objective in prompt
- Modify: `src/lib/agent/nodes/analyze-and-decide.ts` — add decision-maker tracking to extractedInfo
- Update: existing tests in `src/lib/agent/scenarios.test.ts`

### Task 11: Integrate Strategy into respond

**Files:**
- Modify: `src/lib/agent/nodes/respond.ts` — replace generic strategy with `state.conversationStrategy.actionGuidance`
- Modify: `src/lib/agent/nodes/respond.ts` — inject locale, playbook context, few-shot examples
- Update: existing tests

### Task 12: Integrate into Orchestrator

**Files:**
- Modify: `src/lib/agent/orchestrator.ts` — load layers, resolve strategy, compose prompt, pass to graph
- Modify: `src/lib/agent/orchestrator.ts` — log promptVersion and decisionTrace
- Modify: `src/lib/agent/orchestrator.ts` — voice context loading (SIM-06)
- Modify: `src/lib/agent/orchestrator.ts` — strategic handoff notification

### Task 13: Pricing Objection Distinction (GAP-S3)

**Files:**
- Modify: `src/lib/agent/guardrails.ts` — three-way pricing rule
- Update: `src/lib/agent/guardrails.test.ts`

### Task 14: Escalation Acknowledgment with Strategy Context

**Files:**
- Modify: `src/lib/agent/orchestrator.ts` — use strategy-aware ack template (enhances SIM-08 from Plan 1)

### Task 15: Updated AI Evals

**Files:**
- Modify: `src/lib/agent/ai-criteria.ai-test.ts` — test strategy-driven responses
- Modify: `src/lib/agent/ai-scenarios.ai-test.ts` — add scenarios: emergency bypass, decision-maker, form fast-track
- Create: `src/lib/agent/strategy-resolver.ai-test.ts` — eval strategy quality against conversation transcripts

### Task 16: Quality Gate + Documentation

- Run: `npm run quality:no-regressions`
- Update: `docs/product/PLATFORM-CAPABILITIES.md` (Section 1: AI Conversation Agent)
- Update: `docs/engineering/01-TESTING-GUIDE.md`

---

## Estimated Effort

| Task | Size | Can Parallelize With |
|------|------|---------------------|
| 1 (Schema) | Medium | Nothing — blocks all others |
| 2 (Methodology) | Medium | Tasks 3, 4, 5, 6 |
| 3 (Locale) | Small | Tasks 2, 4, 5, 6 |
| 4 (Playbook) | Large | Tasks 2, 3, 5, 6 |
| 5 (Channel) | Small | Tasks 2, 3, 4, 6 |
| 6 (Entry) | Medium | Tasks 2, 3, 4, 5 |
| 7 (Strategy) | Large | Nothing — needs 2, 4, 6 |
| 8 (Composer) | Medium | Task 7 |
| 9 (Cache) | Medium | Tasks 7, 8 |
| 10-12 (Integration) | Large | Sequential |
| 13-16 (Polish) | Medium | After integration |

**Note:** This plan needs full step-by-step detailing before execution. Run a dedicated planning session for Tasks 1-8 with complete code blocks and test cases. Tasks 2-6 can be parallelized via subagents.
