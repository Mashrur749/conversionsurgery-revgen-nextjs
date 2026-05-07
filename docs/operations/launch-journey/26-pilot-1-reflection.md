# 26 — Pilot 1 Reflection

## What this is
Post-Pilot retrospective template. Every Pilot teaches you something the docs missed. This template captures it before memory fades. Run it for Pilot #1, then again for #2 and #3. After three Pilots, you have a real data point to re-evaluate the offer model.

The reflection is wasted if it doesn't change behavior. Each block ends with a "what changes" prompt. You answer it, then update the actual doc/code/script.

## Before you start this
- [ ] Pilot #1 has been past Day 90 for ~30 days (so you're at Day 120 roughly)
- [ ] You have the client notes file with key wins captured during the Pilot (file 23)
- [ ] You have your Friday-review notes from the delivery window (file 24)
- [ ] Block 90 minutes in one sitting. Do not do this in fragments.

## Time required
~90 minutes per reflection. Plus 30–60 min after to update the docs that the reflection surfaced.

## What you'll do

### Reflection rules

1. Be honest. The contractor is not reading this. Nothing is too small.
2. Be specific. "The onboarding call ran long" → no. "The KB walkthrough took 22 min when budgeted 10 because the Twilio number embed instructions were unclear" → yes.
3. End every block with one or more concrete changes. If a block produces no changes, you didn't reflect hard enough.

### Block 1 — What broke

Operational reality vs documented expectation. Where did the system, the platform, or your own process diverge from what the docs said would happen?

Prompts (answer each in 2–4 sentences):
- Which automation failed unexpectedly? (Cron, webhook, AI, SMS, email, Stripe, etc.)
- Which manual process took longer than docs estimated? By how much?
- Which doc was wrong, outdated, or missing the critical detail?
- Which integration glitched and how? (Twilio carrier filter, Stripe webhook delay, Resend bounce, Neon timeout, etc.)

What changes:
- Specific docs to fix (with file path + section)
- Specific code/automation to harden (with ticket-style note)
- Specific manual process to either automate or remove

### Block 2 — What surprised about the offer

The offer is your hypothesis. The Pilot is the test. Where did the hypothesis fail or exceed?

Prompts:
- Which objection did you not anticipate? (And how did you handle it on the fly?)
- Which benefit did the contractor cite back to you that you didn't explicitly pitch?
- Which lever (Dead Lead Resurrection, Day-14 cancel, 30-day Pause, Spouse Pre-Sell) actually closed the deal?
- Which feature of the platform did the contractor never use, even when prompted?

What changes:
- Discovery script edits (specific lines)
- OFFER-APPROVED-COPY edits to flag for review (do not edit unilaterally — flag for the user per CLAUDE.md doc-sync rules)
- Features to deprioritize or remove from the demo

### Block 3 — Contractor friction you didn't predict

Where did the contractor experience pain that you, the operator, didn't see coming? This is the block that improves Pilot #2 the most.

Prompts:
- Which onboarding step took longer than budgeted? Where did the contractor ask questions you weren't ready for?
- Which KB gap caused the most pain in delivery? (Counted by escalations/fallbacks tied to that gap.)
- Where did the contractor want more involvement from you? Where did they want less?
- Did the 4 Irresistibility Levers hold up in real conversations, or did one fall flat? Be honest about which one.

What changes:
- Onboarding script revisions (file 21 cross-reference)
- KB defaults that should be pre-loaded for every contractor in this ICP
- Operator-touch calibration: more or fewer check-ins between bi-weekly calls

### Block 4 — What changes for Pilot #2

The synthesis block. Three columns: discovery, onboarding, offer. Plus one platform feature you wished existed.

Prompts:
- Three specific changes to the discovery call (script lines, demo order, objection responses)
- Three specific changes to the onboarding call (KB walkthrough, expectation-setting, first-week plan)
- One offer-doc edit you should make (or flag — see Block 2)
- One platform feature you wish existed and would have saved real time this Pilot

What changes:
- Update file 16 (Discovery Calls) and file 21 (Day 14 Onboarding) directly
- Add the platform feature to a backlog file (`.scratch/feature-wishlist.md` is fine — formal product backlog later)
- Re-read these changes before Pilot #2 Day 0

### Block 5 — Your personal capacity

The block nobody runs but everyone needs. Your sustainability is the binding constraint on the whole business.

Prompts:
- Hours/week actually spent on this client (delivery only, not sales). Be honest. Use estimates if you didn't track.
- Hours/week spent on outreach + sales (separate from delivery)
- Total hours/week. How does this compare to the 6–10 hr/wk delivery + outreach floor in file 24?
- Energy level vs Day 0 — better, worse, same?
- Burnout warning signals: sleep quality, irritability, avoidance behaviors (skipping the Friday review, putting off the bi-weekly call, dreading the queue), declining output quality
- Sustainable client count given current efficiency: 1, 3, 5, 8, 10? (Not what you wish — what you can deliver without breaking.)

What changes:
- If sustainable count < 3: do not sell Pilot #4 yet. Improve efficiency or scope first.
- If sustainable count >= 5: re-evaluate the offer model (see post-3-Pilot note below).
- If burnout signals are firing: take a real week off before Pilot #2.

### After completing the reflection

Update real-time. The reflection is wasted if it doesn't change behavior:
1. Make the doc edits Block 1 surfaced (within the same week)
2. Make the script edits Block 3 and 4 surfaced (before next discovery call)
3. Flag the OFFER-APPROVED-COPY items per Block 2 for the user to review (do not edit unilaterally)
4. Add the platform-feature wish to your backlog file
5. Capture capacity reality from Block 5 in your operational dashboard or ops log — this is the number that governs Pilot #4 timing

## What success looks like
- [ ] All five blocks completed with specific (not generic) answers
- [ ] At least 5 concrete changes captured across all blocks
- [ ] Doc/script/code updates made within 7 days of the reflection
- [ ] OFFER-APPROVED-COPY discrepancies flagged for user review
- [ ] Capacity number from Block 5 written down and dated

## If something goes wrong
- **You don't have enough data because the Pilot was rough.** That's fine — a rough Pilot produces the most reflection signal. Run it anyway.
- **You realize the Pilot was a structural mistake (wrong ICP, wrong offer, wrong fit).** That's a Block 4 + Block 2 finding combined. Document it. Pilot #2 changes.
- **You don't want to do the reflection.** That's a Block 5 burnout signal. Take 48 hours, then run the reflection.

## Reference
- `docs/operations/launch-journey/22-delivery-window.md` (delivery cadence — what should have happened)
- `docs/operations/launch-journey/23-day-90-decision.md` (what was decided at Day 90)
- `docs/operations/launch-journey/24-monthly-machine.md` (capacity benchmarks)
- `docs/business-intel/OFFER-APPROVED-COPY.md` (current offer — flag changes, do not edit)
- Memory: `project_business_direction_v2` (offer model — performance pricing question deferred until 3 Pilots)
- `.scratch/offer_business_model_redesign.md` (the deferred model-redesign workspace)

## Next

This is the last file in the launch journey.

If you're here, you've completed Pilot #1. Two paths forward:

1. **Pilot #2.** Re-run files 13–26 with refinements from Block 4 above. Keep what worked, change what didn't.
2. **Re-evaluate the offer model.** With 3+ Pilots of real data, revisit the deferred performance-pricing question (per project_business_direction_v2 memory — see `.scratch/offer_business_model_redesign.md`).

The journey doc evolves with you. When something in this folder is wrong, fix it. The next operator (yourself, in 6 months, or a future hire) will thank you.
