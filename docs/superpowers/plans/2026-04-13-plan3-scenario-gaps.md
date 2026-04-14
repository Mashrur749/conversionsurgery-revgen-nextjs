# Scenario Gap Fixes — Implementation Plan (Overview)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 scenario-specific gaps discovered during the simulation stress test.

**Architecture:** Most fixes integrate with the 6-layer architecture from Plan 2. Some are independent patches.

**Depends on:** Plan 2 (orchestration redesign) — most gaps are addressed BY the new architecture. Items marked [independent] can ship with Plan 1.

**Full spec:** `docs/superpowers/specs/2026-04-13-scenario-simulation.md`

---

## Task Breakdown

### Task 1: Win-Back Distinguishes Pause vs Ghost (GAP-S4) [independent]

**Issue:** Win-back triggers on calendar time (25-35 days), not conversation state. A lead who said "I'll be on vacation" gets the same treatment as a lead who ghosted after one message.

**Files:**
- Modify: `src/lib/automations/win-back.ts`
- Modify: `src/db/schema/lead-context.ts` — add `lastEngagementDepth` (integer: message count in last active conversation)

**Approach:** Before generating win-back, check `leadContext.totalMessages`. If `totalMessages > 5` (had real engagement), use a "reconnect" tone. If `totalMessages <= 2` (barely engaged), use a "fresh intro" tone. Pass this as context to the AI generation prompt.

### Task 2: Returning Lead Stage Reset (GAP-S5) [depends on Plan 2]

**Issue:** When a dormant lead replies, `leadContext.stage` is NOT reset. The AI resumes with stale stage context.

**Files:**
- Modify: `src/lib/agent/orchestrator.ts` — detect returning lead (gap > 7 days since last message)
- Modify: `src/lib/agent/strategy-resolver.ts` — returning lead resets to `greeting` stage with summary

**Approach:** In orchestrator, before running the graph: if `daysSinceLastMessage > 7`, reset `leadContext.stage` to `greeting` and ensure conversation summary is fresh. The strategy resolver then treats this as a re-engagement with full prior context.

### Task 3: Decision-Maker Tracking (SIM-03) [depends on Plan 2]

**Issue:** No concept of "who's involved in this decision." Partner-approval objections mis-handled.

**Files:**
- Modify: `src/db/schema/lead-context.ts` — add `decisionMakers` JSONB field
- Modify: `src/lib/agent/nodes/analyze-and-decide.ts` — extract decision-maker info
- Modify: `src/lib/agent/strategy-resolver.ts` — don't count partner-approval as booking rejection
- Modify: `src/lib/agent/playbooks/basement-development.ts` — add decision-maker handling patterns

**Approach:** When `analyzeAndDecide` detects "need to check with my wife/husband/partner," it sets `decisionMakers.partnerApprovalNeeded = true`. The strategy resolver then enters a "partner-decision" sub-stage that offers to include the partner and sets a 3-day check-back, WITHOUT incrementing `bookingAttempts`.

### Task 4: Emergency Mode Bypass (SIM-04) [depends on Plan 2]

**Issue:** No emergency handling. Flooding basement gets the same qualify → propose flow.

**Files:**
- Modify: `src/lib/agent/strategy-resolver.ts` — add emergency bypass logic
- Modify: `src/lib/agent/playbooks/basement-development.ts` — add `emergencySignals`
- Modify: `src/lib/agent/playbooks/types.ts` — add `emergencySignals` to interface
- Modify: `src/lib/agent/orchestrator.ts` — emergency = immediate human notification

**Approach:** Strategy resolver checks `urgencyScore >= 90` OR message matches playbook `emergencySignals`. If triggered: skip entire methodology, send deterministic acknowledgment ("We're on it — [ownerName] will call you ASAP"), create priority-1 escalation, send contractor notification with "EMERGENCY" prefix.

### Task 5: Form Data Fast-Track (SIM-05) [depends on Plan 2]

**Issue:** Form submissions with rich data get re-qualified from scratch.

**Files:**
- Modify: `src/lib/agent/entry-context.ts` — parse form data fields into `skipQualifying[]`
- Modify: `src/lib/agent/strategy-resolver.ts` — skip stages when required info already present
- Modify: `src/lib/automations/form-response.ts` — store extracted fields in leadContext on creation

**Approach:** When form provides projectType + size + timeline + budget, the entry context marks all qualifying questions as answered. Strategy resolver sees `allRequiredInfoCollected: true` and skips straight to `proposing` stage. First AI message references the form data and proposes an estimate visit.

### Task 6: Voice → SMS Context Handoff (SIM-06) [independent]

**Issue:** SMS agent doesn't know about prior voice calls. Re-qualifies leads that were already qualified by Voice AI.

**Files:**
- Modify: `src/lib/agent/orchestrator.ts` — load `voiceCalls` transcript alongside `conversations`
- Modify: DB query in orchestrator (around line 115-120)

**Approach:** After loading conversation history, query `voiceCalls` for this lead's most recent call with a transcript. If found, insert a synthetic `conversations` record with `messageType: 'voice_summary'` and content from `voiceCalls.aiSummary`. This makes the voice context appear naturally in the agent's conversation history without changing the graph or prompt structure.

### Task 7: Contextual Estimate Follow-Up (SIM-07) [independent]

**Issue:** 4-touch estimate follow-up uses static templates that don't reference the lead's specific project or concerns.

**Files:**
- Modify: `src/lib/automations/estimate-followup.ts` (or wherever the 4 template messages are defined)
- Add variant templates keyed by objection type

**Approach:** Start with variant templates (not full AI generation — cheaper, more predictable):
- Default: "Just checking in on the estimate..."
- `price_comparison` objection: "Know you're comparing quotes — [contractor] can walk you through what's included..."
- `timeline_concern` objection: "Wanted to follow up — [contractor] has availability in [timeframe]..."
- `partner_approval` objection: "Hi! Checking if you and [partner] had a chance to discuss..."

Select variant based on `leadContext.objections` at time of send.

### Task 8: Competitive Differentiation Framework (GAP-S8) [depends on Plan 2]

**Issue:** Agent has no structured competitive positioning. Can only parrot KB entries.

**Files:**
- Modify: `src/lib/agent/playbooks/basement-development.ts` — add `differentiators` section
- Modify: `src/lib/agent/strategy-resolver.ts` — inject differentiators when `comparing_quotes` objection active

**Approach:** Playbook gets a `differentiators[]` array with approved positioning statements:
- Speed: "You're texting with us right now — how fast did the other companies respond?"
- Transparency: "We send a line-by-line estimate, not just a lump sum"
- Follow-through: "We stay in touch at every stage — no wondering what's happening"

Strategy resolver injects these into the prompt guidance when the objection is `price_comparison` or `competing_quote`.

### Task 9: Opt-Out Reason Capture (SIM-09) [independent]

**Issue:** When leads opt out, the reason isn't captured for analytics.

**Files:**
- Modify: `src/db/schema/leads.ts` — add `optOutReason` varchar field
- Modify: `src/lib/compliance/opt-out-handler.ts` — extract reason from message text
- Migration needed

**Approach:** When opt-out is triggered and the message contains more than just "STOP," classify the accompanying text into categories: `competitor_chosen`, `project_cancelled`, `bad_experience`, `cost`, `not_interested`, `unknown`. Use regex patterns (not LLM — this runs on every opt-out). Store in `leads.optOutReason`.

### Task 10: Status/Stage Sync (SIM-02) [depends on Plan 2]

**Issue:** `leads.status` and `leadContext.stage` diverge because they're updated by different code paths.

**Files:**
- Modify: `src/lib/agent/orchestrator.ts` — add sync logic after stage updates
- Create: `src/lib/services/lead-state-sync.ts` — helper to sync status ↔ stage

**Approach:** Define a mapping:
- `stage: 'booked'` → `status` should be at least `'contacted'` (don't downgrade from `estimate_sent`)
- `stage: 'lost'` → `status` should be `'lost'`
- `status: 'won'` → `stage` should be `'booked'` or stays as-is
- `status: 'estimate_sent'` → `stage` can be anything (contractor action, not AI)

After every `leadContext.stage` update, call `syncLeadStatus()`. After every `leads.status` update in outcome commands, call `syncLeadStage()`. Both are idempotent.

---

## Execution Order

1. Tasks 1, 6, 7, 9 can ship independently (before Plan 2)
2. Tasks 2, 3, 4, 5, 8, 10 require Plan 2 architecture
3. Within the Plan 2-dependent group: Task 10 (sync) should go last — it touches the most files

**Note:** This plan needs full step-by-step detailing before execution. Prioritize the 4 independent tasks first.
