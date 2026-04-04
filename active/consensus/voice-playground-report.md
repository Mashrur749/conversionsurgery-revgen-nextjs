# Stochastic Multi-Agent Consensus Report: Voice AI Testing & Demo Capabilities

**Problem:** What testing, demo, and preview capabilities should exist in the admin panel for the Voice AI service?
**Agents:** 10 (neutral, risk-averse, growth, contrarian, first-principles, user-empathy, resource-constrained, long-term, data-driven, systems-thinker)
**Date:** 2026-04-04

---

## Consensus (8+ of 10 agents agree)

### 1. Greeting Audio Preview with Real Client Text (10/10 agents)
**Avg confidence: 10/10**

Extend the existing voice preview to synthesize the client's actual `voiceGreeting` text (not a generic sample sentence) in their selected ElevenLabs voice. One "Preview Greeting" button next to the greeting textarea. Plays in-browser.

Every single agent ranked this #1 or #2. The existing preview uses a hardcoded sentence that bears no relationship to what callers actually hear. This is a ~30-minute change to existing code.

### 2. Text-Based Conversation Simulator (10/10 agents)
**Avg confidence: 9.5/10**

Chat-style UI where the operator types as a homeowner, and the system responds using the real client KB + guardrails + system prompt + tone via `getTrackedAI()`. Text output only (no audio synthesis = no ElevenLabs cost). Multi-turn with conversation history maintained in session.

Every agent recommended this. It is the core QA primitive that everything else builds on. Low complexity — reuses existing services with zero new infrastructure.

### 3. KB Gap / Coverage Test (9/10 agents)
**Avg confidence: 9/10**

Run a set of common homeowner questions (pricing, timeline, service area, licensing, process) against the client's KB and display which questions the AI can answer vs. which trigger the "I don't know" fallback. Surfaces gaps before a real caller finds them.

Two flavors proposed: (a) text-based via the conversation simulator, (b) standalone batch test against KB search only. Both are low complexity.

### 4. Guardrail Stress Test (9/10 agents)
**Avg confidence: 8.5/10**

Pre-built panel of adversarial inputs (price commitment, competitor mention, "are you a robot?", opt-out, off-topic) run through the simulator. Shows pass/fail per guardrail rule. Text-only, no audio.

Catches the liability risks (AI promises a price, ignores opt-out) that operators never think to test manually.

### 5. Voice A/B Comparison (8/10 agents)
**Avg confidence: 8/10**

Side-by-side synthesis of the same sentence (or greeting) in 2-3 different ElevenLabs voices. Operator picks the winner based on hearing real client context, not a generic sample.

Low complexity — parallel `synthesizeSpeech()` calls.

### 6. Pre-Launch QA Checklist / Readiness Gate (8/10 agents)
**Avg confidence: 8.5/10**

A visual checklist per client that gates voice activation: greeting set, voice selected, KB has entries, business hours configured, at least one simulator conversation run. Pass/fail per item, "Go Live" button gated behind all-green.

Low complexity — pure DB reads against existing data.

---

## Divergences (5-7 of 10 agents)

### 7. Voice Conversation Simulator — Text-in, Audio-out (7/10 agents)

Same as #2 but each AI response is also synthesized via ElevenLabs and auto-played. Operator types, hears the response in the client's voice.

**Split:** 7 agents wanted this as a natural extension of #2. 3 agents (contrarian, resource-constrained, data-driven) argued text is sufficient for QA and audio adds cost + latency without improving defect detection. The contrarian specifically argued: "QA is about correctness, not experience. Text is faster to read than audio is to listen to."

**Judgment call:** Build #2 first (text-only). Add audio playback as a toggle per-response ("Play this response") rather than auto-playing every turn.

### 8. Shareable Demo Link for Prospects (7/10 agents)

Time-limited, unauthenticated URL where a prospect can interact with the text simulator (or audio) for a specific client config.

**Split:** 7 recommended for async selling leverage. 3 flagged it as medium-high complexity (token auth, public route, scoped KB access) and suggested deferring until prospect sharing is validated as a real need.

### 9. Scenario Presets / Canned Caller Personas (6/10 agents)

Dropdown of pre-written scenarios ("Price Shopper," "Ready to Book," "Angry No-Show") that auto-load into the simulator.

**Split:** Evenly divided on whether this is essential at launch or a nice-to-have after the simulator exists. All agree it's trivial to add (static JSON) once #2 is built.

---

## Outliers (1-3 agents)

### "Call This Number" Button (1/10 — resource-constrained)
Initiates a real Twilio outbound call to the operator's phone, connecting through the client's AI config. The operator experiences the product exactly as a homeowner would. Requires Twilio but is the most authentic demo possible.

### Demo Mode Flag per Client (1/10 — long-term)
A toggle that routes voice sessions through a sandboxed path (no lead creation, no compliance, separate logs). Safe for daily demos without polluting production data.

### Post-Call Transcript Replay with Re-Run (2/10 — long-term, systems)
For past real calls, show full transcript with AI annotations and a "re-run this turn" button that tests whether a KB update would have changed the response.

---

## Aggregated Priority Ranking

Points: 1st=10, 2nd=9, ..., 8th=3. Summed across 10 agents.

| Rank | Capability | Points | Agents | Avg Confidence | Complexity |
|:----:|-----------|:------:|:------:|:--------------:|:----------:|
| 1 | **Greeting Audio Preview (real text)** | 93 | 10/10 | 10.0 | Low |
| 2 | **Text Conversation Simulator** | 89 | 10/10 | 9.5 | Low-Med |
| 3 | **KB Gap / Coverage Test** | 74 | 9/10 | 9.0 | Low |
| 4 | **Guardrail Stress Test** | 68 | 9/10 | 8.5 | Low-Med |
| 5 | **Pre-Launch QA Checklist** | 62 | 8/10 | 8.5 | Low |
| 6 | **Voice A/B Comparison** | 55 | 8/10 | 8.0 | Low |
| 7 | **Audio Conversation (text+voice)** | 48 | 7/10 | 8.5 | Medium |
| 8 | **Shareable Demo Link** | 42 | 7/10 | 7.5 | Med-High |

---

## Build Order (recommended by consensus)

**Phase 1 (1 day):** Greeting Preview (#1) + Voice A/B (#6) — both are extensions of existing `synthesizeSpeech()` + voice picker. Maximum visual impact for minimal code.

**Phase 2 (1-2 days):** Text Conversation Simulator (#2) — the core QA primitive. Everything else builds on this.

**Phase 3 (half day each):** KB Gap Test (#3) + Guardrail Stress Test (#4) + Scenario Presets (#9) — all reuse the simulator with canned inputs. Pure frontend additions once #2 exists.

**Phase 4 (1 day):** Pre-Launch QA Checklist (#5) — gates go-live behind verified quality.

**Phase 5 (deferred):** Audio toggle on simulator (#7), shareable demo link (#8) — build when validated by usage.
