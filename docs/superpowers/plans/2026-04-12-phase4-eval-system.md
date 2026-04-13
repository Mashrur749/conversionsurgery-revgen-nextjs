# Phase 4: AI Eval System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive eval system covering all 13 AI features with 6 eval categories (retrieval, grounding, safety, quality, accuracy, coherence), unified HTML reports, and baseline regression tracking.

**Architecture:** Shared assertions library + LLM-as-judge helpers + JSON datasets + per-feature `.ai-test.ts` files + unified runner script. Extends existing vitest AI config. Existing `ai-criteria.ai-test.ts` and `ai-scenarios.ai-test.ts` stay unchanged — new tests add coverage for untested features.

**Tech Stack:** Vitest, existing AIProvider, JSON datasets, HTML report generation

**Spec:** `docs/superpowers/specs/2026-04-12-ai-pipeline-evals-design.md` — Part 2

**Prerequisites:** Phases 1-3 completed (testing the fixed pipeline)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/evals/types.ts` | Create | Eval result types, assertion function types |
| `src/lib/evals/assertions.ts` | Create | Shared deterministic assertion helpers |
| `src/lib/evals/judge.ts` | Create | LLM-as-judge async assertion helpers |
| `src/lib/evals/baseline.ts` | Create | Save/load/compare eval baselines |
| `src/lib/evals/reporter.ts` | Create | Unified HTML report generator |
| `src/lib/evals/datasets/*.json` | Create | 8 dataset files with 120 total test cases |
| `src/lib/evals/retrieval.ai-test.ts` | Create | Retrieval accuracy evals |
| `src/lib/evals/grounding.ai-test.ts` | Create | KB grounding evals |
| `src/lib/evals/coherence.ai-test.ts` | Create | Output coherence evals |
| `src/lib/automations/win-back.ai-test.ts` | Create | Win-back quality evals |
| `src/lib/automations/no-show-recovery.ai-test.ts` | Create | No-show quality evals |
| `src/lib/services/review-response.ai-test.ts` | Create | Review response evals |
| `src/lib/services/signal-detection.ai-test.ts` | Create | Signal accuracy evals |
| `src/lib/services/voice-summary.ai-test.ts` | Create | Voice summary evals |
| `src/lib/services/booking-conversation.ai-test.ts` | Create | Booking extraction evals |
| `scripts/test/run-full-evals.ts` | Create | Unified runner with HTML report |
| `package.json` | Modify | Add `test:ai:full` script |

---

### Task 1: Eval Types + Shared Assertions

**Files:**
- Create: `src/lib/evals/types.ts`
- Create: `src/lib/evals/assertions.ts`

- [ ] **Step 1: Create types**

Create `src/lib/evals/types.ts`:

```typescript
export type AssertFn = (response: string, context?: Record<string, unknown>) => void;
export type AsyncAssertFn = (response: string, context?: Record<string, unknown>) => Promise<void>;

export interface EvalResult {
  category: string;
  testId: string;
  description: string;
  passed: boolean;
  score?: number;
  error?: string;
  response?: string;
  durationMs: number;
}

export interface CategoryResult {
  name: string;
  passed: number;
  total: number;
  rate: number;
  results: EvalResult[];
}

export interface EvalRunResult {
  timestamp: string;
  commit: string;
  categories: Record<string, { passed: number; total: number; rate: number }>;
  totalCost: number;
  durationMs: number;
}
```

- [ ] **Step 2: Create assertions library**

Create `src/lib/evals/assertions.ts` with all deterministic assertion helpers:

- `mentions(...patterns)` — response mentions at least one pattern
- `doesNotMention(...patterns)` — response does NOT mention any pattern
- `maxLength(limit)` — response within character limit
- `maxQuestions(n)` — at most N question marks
- `noRepetition(minLength)` — no 4+ word phrases repeated from prior responses
- `endsWithCompleteSentence()` — response ends with `.!?)` not `...`
- `noBrokenFormatting()` — no role prefixes, markdown, code blocks
- `lengthBetween(min, max)` — response length in range
- `referencesContext(context, minKeywords)` — response references KB context words

Each function returns `AssertFn` — takes `(response, context?)`, throws `Error` on failure.

Move the pattern from existing `ai-scenarios.ai-test.ts` helpers — same signatures, consolidated into one importable module.

- [ ] **Step 3: Commit**

```bash
git add src/lib/evals/types.ts src/lib/evals/assertions.ts
git commit -m "feat: add eval types and shared assertion library

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: LLM-as-Judge Helpers

**Files:**
- Create: `src/lib/evals/judge.ts`

- [ ] **Step 1: Create judge helpers**

Create `src/lib/evals/judge.ts` with:

- `llmJudge(ai, response, criterion, context?)` — generic judge, returns `{score: 1-5, passed: boolean, reason: string}`
- `matchesTone(ai, expectedTone)` — asserts tone matches (professional/friendly/casual)
- `sentimentIs(ai, expected)` — asserts sentiment (empathetic/neutral/apologetic)
- `soundsHuman(ai)` — asserts message sounds like a real person texting
- `doesNotHallucinate(ai, kbContext)` — asserts no invented facts beyond KB

Each returns `AsyncAssertFn`. Uses Haiku (fast tier), temperature 0, maxTokens 100. Asks the model to return JSON with score/passed/reason. Parses response, throws on failure.

Cost: ~$0.001 per judgment call.

- [ ] **Step 2: Commit**

```bash
git add src/lib/evals/judge.ts
git commit -m "feat: add LLM-as-judge eval helpers

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Eval Datasets

**Files:**
- Create: 8 JSON files in `src/lib/evals/datasets/`

- [ ] **Step 1: Create all dataset files**

| File | Entries | Content per entry |
|------|---------|-------------------|
| `retrieval-inputs.json` | 20 | query, kbEntries[], expectedMatches[], expectedNonMatches[] |
| `knowledge-grounding-inputs.json` | 15 | kbContext, customerMessage, mustContain[], mustNotContain[] |
| `signal-detection-inputs.json` | 20 | messages[], expectedSignals{} |
| `win-back-inputs.json` | 10 | conversationHistory[], leadName, businessName, ownerName, projectType, attempt |
| `no-show-inputs.json` | 10 | leadName, appointmentDate, appointmentTime, businessName, ownerName, conversationHistory[], attempt |
| `review-inputs.json` | 15 | reviewText, rating, authorName, tone, maxLength (5 negative/5 neutral/5 positive) |
| `voice-summary-inputs.json` | 10 | transcript, expectedPoints[] (intent, details, nextSteps) |
| `booking-inputs.json` | 10 | customerMessage, availableSlots[], expectedDate, expectedTime |

Entries use realistic home services contractor scenarios (plumbing, HVAC, electrical, roofing). Edge cases included: ambiguous messages, multilingual names, multi-service inquiries.

- [ ] **Step 2: Commit**

```bash
git add src/lib/evals/datasets/
git commit -m "feat: add eval datasets (120 test cases across 8 files)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Per-Feature AI Test Files

**Files:**
- Create: 9 new `.ai-test.ts` files

- [ ] **Step 1: Create all eval test files**

Each file follows the same pattern established by existing `ai-criteria.ai-test.ts`:

1. Skip gate: `describe.skipIf(!process.env.ANTHROPIC_API_KEY)`
2. Load dataset from `src/lib/evals/datasets/`
3. Loop through test cases
4. Build the same prompt production code uses (same system prompt, same params)
5. Assert using shared assertions + judge helpers
6. Per-test-case `describe` block with individual `it` assertions

**Files and what they test:**

| File | Category | Key Assertions |
|------|----------|---------------|
| `win-back.ai-test.ts` | Quality + Safety | maxLength(160), soundsHuman, doesNotMention("just checking in"), no urgency |
| `no-show-recovery.ai-test.ts` | Quality + Safety | sentimentIs("empathetic"), doesNotMention("missed", "forgot"), maxLength(200) |
| `review-response.ai-test.ts` | Quality | matchesTone(tone), rating-based length limits, referencesContext(reviewText) |
| `signal-detection.ai-test.ts` | Accuracy | JSON schema valid, per-signal true/false matches expected |
| `voice-summary.ai-test.ts` | Quality | 2-3 sentences, mentions(expectedPoints), maxLength(500) |
| `booking-conversation.ai-test.ts` | Accuracy | JSON output matches expected date/time or null |
| `grounding.ai-test.ts` | Grounding | mentions(mustContain), doesNotMention(mustNotContain), doesNotHallucinate |
| `coherence.ai-test.ts` | Coherence | endsWithCompleteSentence, noBrokenFormatting, lengthBetween (deterministic, no API) |
| `retrieval.ai-test.ts` | Retrieval | Expected entry in top 3, similarity > 0.6 (needs DB + Voyage API) |

- [ ] **Step 2: Verify all tests discovered by vitest**

Run: `npm run test:ai -- --list`
Expected: All new `.ai-test.ts` files listed

- [ ] **Step 3: Run initial eval baseline**

Run: `npm run test:ai`
Expected: Tests run. Some failures expected — this establishes the initial baseline.

- [ ] **Step 4: Commit**

```bash
git add src/lib/automations/*.ai-test.ts src/lib/services/*.ai-test.ts src/lib/evals/*.ai-test.ts
git commit -m "feat: add eval tests for all AI features (13/13 coverage)

Win-back, no-show, review, signal detection, voice summary,
booking, grounding, coherence, retrieval evals. 120 test cases
across 6 eval categories.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Baseline Manager + HTML Reporter + Unified Runner

**Files:**
- Create: `src/lib/evals/baseline.ts`
- Create: `src/lib/evals/reporter.ts`
- Create: `scripts/test/run-full-evals.ts`
- Modify: `package.json`

- [ ] **Step 1: Create baseline manager**

Create `src/lib/evals/baseline.ts` with:
- `loadHistory()` — reads `.scratch/eval-history.json`, returns `EvalRunResult[]`
- `saveRun(run)` — appends to history, keeps last 50 runs
- `checkRegression(current, baseline?)` — compares categories. Safety: zero tolerance. Others: 10pp drop = regression.

- [ ] **Step 2: Create HTML reporter**

Create `src/lib/evals/reporter.ts` with:
- `generateEvalReport(categories, durationMs, costEstimate)` — returns full HTML string
- Brand colors (forest header, terracotta for failures, sage for pass)
- Sections: summary header, per-category bars, failed assertion details
- Output: `.scratch/eval-report.html`

Follow the pattern from existing `scripts/test/run-ai-scenarios.ts` report generation.

- [ ] **Step 3: Create unified runner**

Create `scripts/test/run-full-evals.ts`:
- Runs `npx vitest run --config vitest.ai.config.ts --reporter=json --outputFile=.scratch/eval-results.json`
- Parses JSON results, categorizes by test file path
- Builds `CategoryResult[]`, generates HTML report
- Saves baseline, checks for regressions
- Prints summary to terminal
- Exits with code 1 if safety regression detected

Uses `execFileSync` from `child_process` (not `exec`) for safe subprocess invocation.

- [ ] **Step 4: Add npm script**

In `package.json` scripts, add:
```json
"test:ai:full": "npx tsx scripts/test/run-full-evals.ts"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/evals/baseline.ts src/lib/evals/reporter.ts scripts/test/run-full-evals.ts package.json
git commit -m "feat: add eval baseline tracking, HTML reporter, and unified runner

npm run test:ai:full runs all AI evals, generates HTML report,
saves scores to eval-history.json, checks for regressions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Update Docs + Quality Gate

- [ ] **Step 1: Update docs/engineering/01-TESTING-GUIDE.md**

Add eval system section with commands, categories, run cadence, and threshold definitions.

- [ ] **Step 2: Update docs/product/PLATFORM-CAPABILITIES.md**

Add eval coverage to Section 11 (Observability).

- [ ] **Step 3: Run quality gate**

Run: `npm run quality:no-regressions`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: document eval system, categories, and run cadence

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
