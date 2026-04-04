# Stochastic Multi-Agent Consensus Report: Voice AI Configuration UI

**Problem:** What configuration UI should exist for operator and contractor to ensure smooth Voice AI operations and delivery?
**Agents:** 10 (neutral, risk-averse, growth, contrarian, first-principles, user-empathy, resource-constrained, long-term, data-driven, systems-thinker)
**Date:** 2026-04-04

---

## Consensus (8+ of 10 agents agree)

### 1. Prominent Voice Kill Switch — Operator (10/10 agents)
Move the voice AI kill switch from the generic system settings key-value editor to a dedicated, prominently placed emergency toggle on the admin Voice AI page. Red/destructive styling when active. One click to disable, one click to restore.

**Why unanimous:** Every agent identified this as the highest-risk operational gap. The kill switch infrastructure exists (`OPS_KILL_SWITCH_KEYS.VOICE_AI`), but the UI path to reach it under pressure (client panicking on the phone) is unacceptably slow. This is a 10-line UI change with disproportionate operational impact.

### 2. Contractor Voice Status Card — Read-Only Portal (10/10 agents)
A read-only card in the contractor portal showing: Voice AI ON/OFF, current mode, phone number it covers. No controls — just visibility.

**Why unanimous:** Contractors pay $1,497/mo and have zero visibility into whether voice AI is running. Every agent concluded that visibility without control is the correct pattern for a managed service — contractors want proof-of-work, not configuration knobs.

### 3. Business Hours — Editable Post-Onboarding (9/10 agents)
Surface business hours editing in the admin client detail page (not just the onboarding wizard). Show hours inline on the Voice AI page when mode is `after_hours`.

**Why near-unanimous:** Business hours are the #1 configuration that changes (seasonal, holidays, staff changes) and directly control when voice AI answers. Wizard-only editing is a weekly operational burden at scale.

### 4. `canDiscussPricing` Toggle — Operator (9/10 agents)
Add the existing schema field as a labeled toggle on the admin voice settings per client. Currently impossible to configure without direct DB access.

**Why near-unanimous:** This is a per-client business decision with real caller experience stakes. Some contractors want pricing pre-qualification; others don't. The field exists, the logic reads it, but no human can change it.

### 5. Operator Visibility into Contractor-Set `agentTone` (9/10 agents)
Show the contractor's current `agentTone`, `canScheduleAppointments`, and `primaryGoal` values as read-only badges in the admin client view.

**Why near-unanimous:** The operator configures voice (greeting, mode, voice ID) but can't see the tone the contractor independently set. This creates a blind spot when debugging call quality complaints. Read-only display costs nothing to implement.

### 6. `voiceMaxDuration` Editable Field — Operator (8/10 agents)
Expose the existing schema field (default 300s) as an editable number input on the admin voice settings per client.

**Why strong consensus:** 5 minutes may be too short for complex renovation inquiries or too long for simple service calls. The operator needs per-client control. Two agents (contrarian, resource-constrained) pushed back — contrarian argued it optimizes for the wrong metric (cost vs conversion), resource-constrained considered it low priority.

---

## Divergence (5-7 of 10 agents)

### 7. Transfer Phone Number — Dedicated Field (7/10 agents)
Add a `voiceTransferNumber` field (separate from `client.phone`) so voice AI transfers go to a configured destination, not the generic client phone.

Split: 7 agents recommended this as critical for operations (contractors have different numbers for job sites, dispatch, owner cell). 3 agents saw this as already handled by the existing `client.phone` field + team ring group.

**Judgment call:** Worth adding if contractors frequently need different transfer destinations than their primary number. Skip if `client.phone` always matches where calls should transfer.

### 8. Voice Call Log Summary in Portal — Contractor (7/10 agents)
A read-only card showing recent AI-handled calls: timestamp, duration, outcome, AI summary.

Split: 7 agents recommended this for trust-building and churn prevention. 3 agents considered it lower priority because contractors already receive per-call SMS notifications.

**Judgment call:** High value for retention (aggregate view vs individual SMSes), but not operationally blocking.

### 9. Greeting Preview with Voice Playback — Operator (5/10 agents)
"Preview this greeting" button that synthesizes the greeting in the selected ElevenLabs voice and plays it back.

Split: 5 recommended it (quality assurance before go-live). 5 considered it nice-to-have since the voice picker already has preview.

### 10. Remove `agentTone` from Contractor Portal (4/10 agents — contrarian-led)
The contrarian and first-principles agents argued that giving contractors a "tone" dropdown creates confusion without meaningful impact. Hard-code to `professional` and let the greeting carry personality.

Split: 4 agents favored removing it. 6 agents preferred keeping it with operator visibility. This is a genuine product philosophy question about managed-service boundaries.

---

## Outliers (1-3 agents)

### Contractor Transfer Number Override (2/10 — growth, resource-constrained)
Let the contractor set their own transfer number from the portal. The operator sees it; the contractor controls it. Captures the "I'm on a different job site this week" scenario without operator involvement.

### Unified Voice Config Tab per Client (1/10 — long-term)
Reorganize all voice config into a dedicated "Voice" tab on the client detail page instead of splitting between the global Voice AI page and per-client feature toggles. The global page becomes a fleet overview.

### Calendar Connect CTA on Dashboard (1/10 — long-term)
Move Google Calendar connect from buried settings to a persistent dashboard card, shown until connected. Drives completion of the one integration that activates appointment booking.

---

## Aggregated Priority Ranking

Points: 1st=10, 2nd=9, ..., 8th=3. Summed across 10 agents.

| Rank | Recommendation | Total Points | Agents Recommending |
|------|---------------|:---:|:---:|
| 1 | **Kill Switch prominence** | 92 | 10/10 |
| 2 | **Contractor Voice Status Card** | 87 | 10/10 |
| 3 | **Business Hours editing** | 74 | 9/10 |
| 4 | **`canDiscussPricing` toggle** | 71 | 9/10 |
| 5 | **agentTone operator visibility** | 64 | 9/10 |
| 6 | **`voiceMaxDuration` field** | 52 | 8/10 |
| 7 | **Transfer number field** | 48 | 7/10 |
| 8 | **Call log in portal** | 41 | 7/10 |
