# AI Pipeline Audit — Issue Register

**Date:** 2026-04-13
**Author:** AI Product Engineering audit
**Status:** Open — all issues pending resolution

---

## Overview

Full audit of every AI domain in the ConversionSurgery RevGen platform. 13 issues identified across three severity tiers: critical (compliance/safety risk), strategic (missing systems that block product-market fit), and architectural (wrong approach for the business goals).

Each issue includes: what's wrong, why it matters for the JTBD, what to do, and which files are affected.

---

## Critical Issues (Pre-Launch)

### AUDIT-01: No Freshness Gate for `__AI_GENERATE__` Scheduled Messages

**Severity:** Critical — compliance risk
**Status:** Open

**Problem:** `no-show-recovery.ts` and `win-back.ts` schedule messages with `content: '__AI_GENERATE__'`. When the cron fires (`process-scheduled/route.ts`), it generates content at send time. Between scheduling and sending (20-30 days for win-back), the lead's situation may have changed entirely.

The cron checks opt-out and blocked numbers, but does NOT check:
- Recent inbound conversation activity (lead replied yesterday — win-back is bizarre)
- Active flow executions (another sequence already running for this lead)
- Lead stage changes (lead is now `won`, `booked`, or `lost`)

**Impact:** Sending a "haven't heard from you" message to a lead who replied 2 days ago is confusing and unprofessional. Sending a re-engagement to a lead who already booked is worse.

**Files affected:**
- `src/app/api/cron/process-scheduled/route.ts` (lines 152-168)
- `src/lib/automations/no-show-recovery.ts`
- `src/lib/automations/win-back.ts`

**Fix:** Add a freshness gate before AI generation in the scheduled message processor:
1. Check `leadContext.stage` — cancel if `booked`, `won`, `lost`, `opted_out`
2. Check for recent inbound activity (< 7 days) — cancel if found
3. Check for active flow executions on the same lead — cancel if found
4. Log cancellation reason for observability

---

### AUDIT-02: Timezone Bug in Win-Back and Dormant Re-engagement Send Windows

**Severity:** Critical — compliance risk
**Status:** Open

**Problem:** `win-back.ts` and `dormant-reengagement.ts` use `new Date().getHours()` for send window checks. This evaluates server UTC time, not recipient timezone. A 10am-2pm UTC window fires at 4am-8am Mountain Time for Calgary leads.

Meanwhile, `appointment-reminder.ts` correctly uses `Intl.DateTimeFormat` for timezone-aware scheduling, and the compliance gateway correctly evaluates quiet hours in recipient timezone. This is an inconsistency — some automations are timezone-aware, others aren't.

**Impact:** Messages may be generated (though not necessarily delivered — the compliance gateway's quiet-hours check is a safety net) at inappropriate hours. The gateway will queue them, but the AI generation context may be stale by delivery time.

**Files affected:**
- `src/lib/automations/win-back.ts` — `isWithinSendWindow()` function
- `src/lib/automations/dormant-reengagement.ts` — `isWithinSendWindow()` function
- Reference implementation: `src/lib/automations/appointment-reminder.ts`

**Fix:** Replace `new Date().getHours()` with timezone-aware evaluation using `Intl.DateTimeFormat('en-US', { timeZone: 'America/Edmonton', hour: 'numeric', hour12: false })`. Use the same pattern as appointment-reminder.ts. Consider extracting a shared `isWithinLocalSendWindow(timezone, startHour, endHour)` utility.

---

### AUDIT-03: Win-Back Temperature 0.9 Is Too High

**Severity:** Critical — brand risk
**Status:** Open

**Problem:** `win-back.ts` uses `temperature: 0.9` — the highest in the codebase. This sends one-shot messages to leads silent for 25-35 days. At 0.9, output variance is maximized. The output guard catches hard violations (pricing leaks, opt-out retention, identity denial), but does NOT catch:
- Awkward phrasing or off-brand tone
- Overly casual or overly formal mismatch
- Non-sequitur openings
- Culturally inappropriate humor attempts

**Impact:** A single weird message from the system can permanently damage contractor credibility with a homeowner. These are cold re-engagements — first impressions after weeks of silence.

**Files affected:**
- `src/lib/automations/win-back.ts` — temperature parameter in `getTrackedAI()` call

**Fix:** Reduce temperature to 0.6-0.7. Maintains enough creativity for natural-sounding messages while significantly reducing variance. Consider adding a tone-check assertion to the win-back eval suite (`win-back.ai-test.ts`).

---

## Strategic Gaps (Missing Systems)

### AUDIT-04: No Conversation Strategy — Agent Is Myopic

**Severity:** High — directly impacts conversion rate
**Status:** Open

**Problem:** `analyzeAndDecide` makes per-turn decisions with no multi-turn plan. The `stage` field is a label the LLM assigns — it's not used to drive strategy. The response prompt's `{strategy}` variable defaults to generic instructions like "Answer their question helpfully."

A lead in `qualifying` gets the same strategy as a lead in `hot`, unless the LLM happens to pick `book_appointment` as the action. There is no concept of "I'm trying to move this lead from qualifying to hot over the next 2-3 messages."

**Impact:** Core value prop is "close more of the revenue already coming to you." A myopic agent responds to messages. A strategic agent drives conversations toward outcomes. Without conversation strategy, conversion rate is left to LLM intuition rather than systematic sales methodology.

**Files affected:**
- `src/lib/agent/nodes/analyze-and-decide.ts` — strategy should inform decision
- `src/lib/agent/nodes/respond.ts` — `{strategy}` variable is too generic
- `src/lib/agent/orchestrator.ts` — no strategy computation before graph invocation
- `src/db/schema/lead-context.ts` — needs `conversationPlan` field

**Fix:** See AUDIT-14 (orchestration redesign spec — to be written separately). Core idea: stage-driven conversation playbook that maps each stage to specific objectives, required information, and next-step proposals.

---

### AUDIT-05: Smart Assist Edits Are Wasted Signal

**Severity:** High — blocks product learning loop
**Status:** Open

**Problem:** When contractors edit AI drafts in Smart Assist mode, `assistOriginalContent` is stored alongside the final `content`, but the delta is never analyzed. No system compares original vs. edited to learn what the AI got wrong.

**Impact:** Contractor edits are the highest-quality training signal available — they're free, labeled corrections from the exact user whose preferences matter. Every edit tells you where the AI's tone, specificity, or approach doesn't match the contractor's expectations. Collecting the data but ignoring the insight.

**Files affected:**
- `src/lib/services/smart-assist-lifecycle.ts` — stores `assistOriginalContent` (line 159)
- New service needed: `src/lib/services/smart-assist-learning.ts`
- New cron needed: correction analysis pipeline

**Fix:**
1. When `assistResolutionSource === 'approved_send'` and `content !== assistOriginalContent`, flag as a correction event
2. Weekly cron: batch corrections by client, run LLM analysis of patterns ("contractor consistently adds project specifics," "contractor removes casual language")
3. Generate per-client adjustment notes stored in KB or agent settings
4. Dashboard metric: correction rate per client over time (should decrease)

---

### AUDIT-06: No A/B Testing / Experimentation Framework

**Severity:** High — blocks systematic improvement
**Status:** Open

**Problem:** Zero ability to measure whether a prompt change, temperature adjustment, guardrail modification, or strategy change actually improves conversion. Every change is an uncontrolled experiment.

**Impact:** Can't systematically improve the agent. Flying on intuition about what works. For a product whose core value is "close more revenue," not measuring impact of AI changes on conversion leaves money on the table.

**Files affected:**
- New table: `experiments`
- `src/lib/agent/orchestrator.ts` — experiment variant assignment
- `src/db/schema/agent-decisions.ts` — variant logging in `actionDetails`
- New service: `src/lib/services/experimentation.ts`
- New dashboard page

**Fix:**
1. `experiments` table: `id, name, variant_a_config, variant_b_config, metric, start_date, end_date, status`
2. On each `processIncomingMessage`, check active experiments, assign lead to variant (sticky by lead ID hash), log variant in `agentDecisions.actionDetails`
3. Dashboard: variant A conversion rate vs variant B, with confidence indicator
4. Start simple: test one variable at a time (booking aggressiveness, temperature, response length)

---

### AUDIT-07: No Conversation-Level Analytics

**Severity:** Medium — blocks data-driven optimization
**Status:** Open

**Problem:** Attribution tracks per-decision outcomes but there's no analysis of conversation patterns that correlate with bookings. Can't answer: "Do leads that get a photo request before a booking attempt convert better?" or "What's the optimal number of messages before proposing an appointment?"

**Impact:** Without pattern analysis, conversation strategy (AUDIT-04) is designed on intuition rather than data. The system generates conversation data daily but extracts zero strategic insight from it.

**Files affected:**
- `src/db/schema/agent-decisions.ts` — data source
- New service: `src/lib/services/conversation-analytics.ts`
- New dashboard components

**Fix:**
1. Extract conversation sequences from `agentDecisions` (ordered actions per lead)
2. Compute conversion funnels by conversation pattern (action sequences that led to `won` vs `lost`)
3. Identify high-converting vs low-converting conversation shapes
4. Feed findings into conversation strategy design
5. Priority: build after 200+ completed leads (need statistical significance)

---

### AUDIT-08: No Lead Scoring Calibration Against Real Outcomes

**Severity:** Medium — accuracy degrades without calibration
**Status:** Open

**Problem:** `urgencyScore`, `budgetScore`, `intentScore` are LLM-generated per-turn with zero historical calibration. The model guesses scores without knowing what score ranges actually predict booking in this product's data.

Model routing triggers at `intentScore >= 80`, `leadScore >= 70`, etc. — these thresholds are arbitrary, not empirically derived.

**Impact:** Model routing may over-trigger or under-trigger quality tier. Conversation strategy may misidentify lead temperature. Scores are decorative rather than predictive.

**Files affected:**
- `src/lib/ai/model-routing.ts` — threshold values
- `src/lib/agent/nodes/analyze-and-decide.ts` — score generation prompt
- New analysis: calibration script

**Fix:**
1. After 200+ completed leads: export outcomes + per-turn scores
2. Compute: what score ranges actually predicted booking?
3. Calibrate routing thresholds against real data
4. Optionally: add calibration instructions to the scoring prompt ("a score of 70 means the lead will book with 70% probability")
5. Re-run calibration quarterly

---

### AUDIT-09: No Outcome Feedback Loop to Agent

**Severity:** Medium — product doesn't improve with usage
**Status:** Open

**Problem:** Attribution system tracks "this AI decision led to this outcome" — data flows only to dashboards. Never flows back into the agent. Agent that handled lead #500 is exactly as smart as the agent that handled lead #1.

**Impact:** The product's core moat should be "gets smarter with every conversation." Without a feedback loop, the moat is static prompt engineering, which competitors can replicate.

**Files affected:**
- `src/lib/services/ai-attribution.ts` — data source
- `src/db/schema/agent-decisions.ts` — data source
- New service: `src/lib/services/agent-feedback-loop.ts`
- `src/lib/services/knowledge-base.ts` — destination for learned patterns

**Fix:**
1. Weekly cron: pull positive-outcome conversations, extract common patterns
2. Pull negative-outcome conversations, extract anti-patterns
3. Generate per-client "winning playbook" entries in KB
4. Example insight: "Leads who ask about timelines convert 3x when offered a same-week estimate visit"
5. Priority: build after 5+ clients with outcome data

---

## Architectural Concerns

### AUDIT-10: Analysis + Decision Coupled in Single LLM Call

**Severity:** Medium — blocks debugging and eval improvement
**Status:** Open

**Problem:** `analyzeAndDecide` produces 25+ structured fields in one call — both analysis (sentiment, scores, stage, extracted info) and decision (action, confidence, reasoning). If the model misreads sentiment, the action is contaminated. Can't determine if analysis was right but decision was wrong, or both wrong.

**Impact:** Eval system can test end-to-end behavior but can't isolate "was the analysis correct?" from "was the decision correct?" Debugging bad decisions requires guessing which half failed.

**Files affected:**
- `src/lib/agent/nodes/analyze-and-decide.ts`
- `src/db/schema/agent-decisions.ts` — logging structure

**Fix:** Don't split into two LLM calls (latency cost not worth it for this use case). Instead:
1. Log analysis fields and decision fields in separate JSONB columns in `agentDecisions`
2. Build evals that test analysis accuracy independently (given this conversation, did the model correctly identify sentiment/urgency/intent?)
3. Build evals that test decision quality given correct analysis (given these scores, was the right action chosen?)

---

### AUDIT-11: Signal Detection Uses `chatJSON` Without Zod Validation

**Severity:** Medium — silent failures
**Status:** Open

**Problem:** `signal-detection.ts` uses `ai.chatJSON<DetectedSignals>()` with raw `JSON.parse()` and `|| false` defaults per field. Malformed response silently returns all-false signals. A ready-to-schedule lead could be missed because the model returned malformed JSON and every signal defaulted to `false`.

**Impact:** Silent false-negatives in signal detection. No error logging. No way to know how often this happens.

**Files affected:**
- `src/lib/services/signal-detection.ts` — `detectSignals()` function

**Fix:** Replace `chatJSON` with `chatStructured` using the same Zod schema pattern as `analyzeAndDecide`. The infrastructure already exists in `AnthropicProvider.chatStructured()`. Add error logging when structured parsing fails.

---

### AUDIT-12: Attribution Window Over-Attributes to Most Recent Decision

**Severity:** Low — reporting accuracy
**Status:** Open

**Problem:** `ai-attribution.ts` uses a 7-day window and attributes outcomes to the most recent AI decision. If a lead had 5 interactions over a week — great Day 1 response, mediocre Day 6 response — Day 6 gets all credit.

**Impact:** Over-attributes to recent touchpoints, under-attributes to earlier touchpoints that may have been causally more important. Distorts which conversation strategies are actually effective.

**Files affected:**
- `src/lib/services/ai-attribution.ts` — `attributeFunnelEvent()`

**Fix:**
1. Tag ALL decisions within the attribution window as `contributing`
2. Tag only the most recent as `primary`
3. Multi-touch attribution reporting: show all contributing decisions, weighted by recency
4. Priority: low — current approach is acceptable for early stage, refine when analyzing patterns at scale

---

### AUDIT-13: Conversation Summary Loses Nuance in Long Conversations

**Severity:** Low — affects long-conversation quality
**Status:** Open

**Problem:** `conversation-summary.ts` compresses messages 1 through (N-15) into a 200-word narrative summary using Haiku. Key signals like "almost booked but backed off at pricing" get flattened into generic summaries. The prompt says "Facts only, no interpretation" but emotional arc and decision dynamics are facts that matter.

**Impact:** Agent loses context about why the lead is where they are. For long conversations (20+ messages), the agent may repeat approaches that already failed or miss objections that were already raised.

**Files affected:**
- `src/lib/services/conversation-summary.ts` — summary prompt and structure
- `src/db/schema/lead-context.ts` — storage structure

**Fix:**
1. Add structured extraction alongside narrative summary
2. Extract: `key_objections[]`, `booking_attempts_and_outcomes[]`, `price_sensitivity_level`, `emotional_arc_summary`
3. Store as JSONB alongside the narrative in `leadContext`
4. Feed structured fields into agent prompt separately from narrative
5. Priority: low — only matters for leads with 20+ message conversations, which are a minority

---

## Cross-Reference: Priority Execution Order

### Before First Client
| Issue | Effort | Risk Mitigated |
|-------|--------|---------------|
| AUDIT-01 | Small (30 lines) | Compliance — stale context messages |
| AUDIT-02 | Small (10 lines) | Compliance — timezone violation |
| AUDIT-03 | Trivial (1 line) | Brand — off-tone messages |

### First 30 Days
| Issue | Effort | Impact |
|-------|--------|--------|
| AUDIT-04 | Large (new system) | Conversion rate — agent drives toward outcomes |
| AUDIT-05 | Medium (new cron) | Learning loop — system improves with usage |
| AUDIT-11 | Small (swap call) | Reliability — no silent signal failures |

### After 5+ Clients / 200+ Leads
| Issue | Effort | Impact |
|-------|--------|--------|
| AUDIT-06 | Large (new system) | Systematic improvement measurement |
| AUDIT-07 | Medium (new service) | Data-driven strategy optimization |
| AUDIT-08 | Medium (analysis + calibration) | Accurate scoring and routing |
| AUDIT-09 | Medium (new cron + KB) | Product learning flywheel |

### Medium-Term
| Issue | Effort | Impact |
|-------|--------|--------|
| AUDIT-10 | Small (logging change) | Debugging and eval quality |
| AUDIT-12 | Small (query change) | Reporting accuracy |
| AUDIT-13 | Medium (schema + prompt) | Long-conversation quality |
