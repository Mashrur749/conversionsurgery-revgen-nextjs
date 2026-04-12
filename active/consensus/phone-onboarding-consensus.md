# Phone Onboarding Consensus Report

**Problem:** Should the default phone setup on Day 0 be Twilio-primary (update Google/HomeStars listings immediately) or conditional forwarding first (contractor keeps their number, migrate later)?
**Agents:** 10 (Neutral, Risk-averse, Growth, Contrarian, First-principles, User-empathy, Resource-constrained, Long-term, Data-driven, Systems thinker)
**Date:** 2026-04-12

---

## Q1: Default Phone Setup on Day 0

### Distribution

| Default | Agents | Confidence |
|:--------|:------:|:----------:|
| **(b) Conditional forwarding first, migrate Day 7-14** | 7 | 7-8 (avg 7.9) |
| **(a) Twilio-primary from Day 0** | 3 | 7-8 (avg 7.7) |

### Consensus (7/10): Conditional Forwarding First, Migrate at Day 7-14

**Agents:** Neutral, Risk-averse, First-principles, User-empathy, Resource-constrained, Long-term, Systems thinker

The dominant reasoning across all seven agents: **proof generates trust faster than time does, but you need the proof to exist before you ask for more.** The contractor is at peak skepticism on Day 0 — they've paid $1,000 but haven't seen a single captured call. Asking for their Google listing before the system has proven itself is the highest-friction ask at the worst possible moment.

Key arguments:
- Conditional forwarding requires zero trust and zero listing changes. The contractor sees AI catching missed calls within 24-48 hours — real proof from their own business.
- Day 7-14 migration is not a concession — it's a **sales moment backed by data**. "You missed 3 calls this week. We caught them. But we only caught the ones that rang your cell first. Google leads that you answered? We have no data. Update your Google listing and we catch everything."
- Agency-fatigued contractors have had someone "optimize their listings" before and lost something. Bundling the listing change with Day 0 onboarding creates unnecessary friction on the harder ask.

**Critical condition (5/7 agents stated this explicitly):** The Day 7 migration must be **pre-scheduled on the onboarding call**, not left as an open suggestion. "We'll update your Google listing together on our Day 7 check-in — I'll share my screen and it takes 12 minutes." If it's not calendared before the onboarding call ends, completion rate collapses.

### Minority (3/10): Twilio-Primary from Day 0

**Agents:** Growth, Contrarian, Data-driven

The minority reasoning: **conditional forwarding is a degraded product, not a safety measure.** The split-number problem (text-back from Twilio, lead called the contractor's cell) actively harms lead conversion. A confused homeowner who gets a text from an unknown number either ignores it or texts the wrong number back. The system silently underperforms during its most critical window.

Key arguments:
- The 12-minute listing update is not a technical barrier — it's a trust barrier. That's a sales problem, not a reason to ship a degraded product.
- Day 7 migration is harder than Day 0, not easier. The contractor hasn't won a job yet, is wondering if this was a mistake, and now you're asking them to do the scary thing they hesitated about initially.
- Mode A's split-number problem degrades the core value proposition (speed-to-response) for 75-85% of leads.

**Contrarian's challenge:** "The conventional wisdom is 'ease them in gently.' It sounds reasonable. It's wrong because it optimizes for contractor comfort at the exact moment that should be optimized for homeowner conversion — and those two things are in direct tension."

---

## Q2: Biggest Risk

### For Conditional Forwarding (7 agents)

| Risk | Agents |
|------|:------:|
| **Contractor never completes migration — system permanently underperforms** | 4 (Risk-averse, User-empathy, Resource-constrained, Long-term) |
| **Contractor sees text from unknown number, calls it a bug before Day 7** | 1 (Neutral) |
| **Invisible lead loss — leads call Google number, miss, system never knows** | 1 (First-principles) |
| **Contractor manually texts lead from their cell, fracturing the thread** | 1 (Long-term) |

**Modal risk (4/7): The migration never happens.** This was the dominant concern across the conditional-forwarding camp. The contractor habituates to the partial state, the system produces thin results because it only sees missed calls (not the full pipeline), ROI reporting looks weak, and the contractor churns at Month 3 thinking the service underperformed — when really it was never fully deployed.

The mitigation every agent proposed: **hard-schedule the Day 7-10 migration call on the onboarding call itself.** Not "we'll do this when you're ready" but "we'll update your Google listing on our Day 7 check-in."

### For Twilio-Primary (3 agents)

| Risk | Agents |
|------|:------:|
| **Day 0 trust failure — contractor feels listings were hijacked, cancels Week 2** | 2 (Growth, Data-driven) |
| **Contractor cancels Month 2, doesn't revert listings, dead Twilio number on Google for weeks** | 1 (Contrarian) |

**The exit-experience risk (Contrarian's unique insight):** If a churned contractor doesn't revert their Google listing, their primary business number points to a dead or reassigned Twilio number. The "5 minutes to revert" assumes the contractor is motivated and organized on exit — churned clients are neither. Mitigation: give the contractor a one-page "what you own" document at onboarding listing every change made, with URLs and their original number.

---

## Q3: The One Thing That Makes Them Say Yes

### Consensus (10/10): Live Demo Before the Ask

**Every single agent** — regardless of whether they recommended Day 0 or Day 7 — said the same thing: **show the system working on a real call before asking for the listing change.** The specific tactic varied slightly, but the structure was unanimous:

1. **Demo first.** Call the Twilio number live on the onboarding call. Let the contractor's phone ring. Let it go to voicemail/AI. Watch the text-back fire in real time. The contractor experiences the product, not a description of it.

2. **Ask second.** The listing change request comes immediately after the emotional peak ("that actually worked"), not before it. The sequence is: proof of value → name the specific gap → immediate close.

3. **Frame as expansion, not replacement.** "We're not changing your number — we're adding a safety net to your biggest lead source." / "Making sure Google sends people to the number that has the safety net." / "Your cell still rings first — this just catches what you miss."

4. **Do it together, live, on screen share.** The contractor watches every click. No async trust gap. No homework. "I'll do it right now while we're on this call — takes 5 minutes."

### Divergence: When to Do the Demo + Ask

| Timing | Agents | Reasoning |
|--------|:------:|-----------|
| **On the onboarding call (Day 0)** | 5 | Demo creates the emotional peak. Strike immediately. If they say yes, do the listing update right then. If they say "let me think about it," schedule Day 7. |
| **On the Day 7 check-in (after real data)** | 5 | Real missed-call data from their own business is more persuasive than a simulated demo. "Tuesday at 2pm you missed a call — here's what happened." |

This is the genuine judgment call. Both groups agree on the mechanic (demo → ask → do it live). They disagree on whether a simulated demo on Day 0 is sufficient, or whether real data from the contractor's own business at Day 7 is meaningfully more persuasive.

### Notable Tactics

| Agent | Specific Tactic |
|-------|----------------|
| **Contrarian** | Show them their own Google "calls" count from the last 30 days. "47 people clicked 'call' on your listing last month. We don't know how many you answered." Make the current leak visible before proposing the fix. |
| **Risk-averse** | Do it live on screen: "I'm showing you the exact action, right now, with you watching, and you can undo it in 90 seconds." Control and reversibility are the levers, not features. |
| **First-principles** | Don't ask "can I update your Google listing?" — ask "can you share your screen for 60 seconds so I can verify your listing is set up correctly?" Reframe as verification, not modification. |
| **Contrarian** | Give them a "what you own" document at onboarding listing every change with URLs and original numbers. Makes exit feel safe, which paradoxically increases Day 0 commitment. |
| **Systems thinker** | Pre-schedule the listing update as a hard calendar event before the onboarding call ends. Not a suggestion — a deliverable. |

---

## Raw Scores

### Q1: Default Setup

| Option | Votes | Avg Confidence |
|:-------|:-----:|:--------------:|
| (b) Conditional → migrate Day 7-14 | 7 | 7.9 |
| (a) Twilio-primary Day 0 | 3 | 7.7 |
| (c) Conditional only (never push) | 0 | — |
| (d) Something else | 0 | — |

### Q2: Risk Categories

| Risk | Votes |
|------|:-----:|
| Migration never happens (permanent underperformance) | 4 |
| Day 0 trust failure (cancels Week 2) | 2 |
| Text-back from unknown number causes confusion | 1 |
| Invisible lead loss (Google calls never reach system) | 1 |
| Thread fracture (contractor texts from personal cell) | 1 |
| Exit-experience problem (dead Twilio number on Google) | 1 |

### Q3: Persuasion Mechanic

| Approach | Votes |
|----------|:-----:|
| Live demo (simulated or real) before the ask | 10/10 |
| Do it together on screen share | 8/10 |
| Frame as "adding safety net" not "changing number" | 7/10 |
| Show their own Google call data | 3/10 |
| Proactively state the exit/reversal story | 4/10 |
| Pre-schedule migration as hard calendar event | 5/10 |

---

## Synthesis & Recommendation

### The Default: Conditional Forwarding Day 0, Twilio-Primary Day 7

The 7/10 consensus is conditional forwarding first. But the consensus comes with a critical condition that 5 of those 7 agents stated explicitly: **the migration must be pre-committed on the onboarding call, not left open.**

The recommended onboarding flow:

1. **Onboarding call (Day 0):** Set up conditional forwarding. Demo the system live — call the Twilio number, let Voice AI pick up, watch text-back fire. The contractor sees it work.

2. **The ask (still Day 0, after the demo):** "This is catching every call to your new business line. But right now, your Google leads still call your cell. When you miss those, they call the next contractor. On our Day 7 check-in, I'll update your Google listing so every Google lead gets this same safety net. It takes 5 minutes and you'll watch me do it on screen share. Sound good?"

3. **Day 7 check-in:** Open with real data from the first week. "You missed 3 calls this week — here's what happened with each one." Then do the listing update live on screen share.

4. **Exception:** If the contractor says "just do it now" on Day 0 after the demo — do it. Don't manufacture friction where none exists.

### The Risk Mitigation

The #1 risk (migration never happens) is addressed by:
- Pre-scheduling Day 7 as a hard calendar event on Day 0
- Framing it as a deliverable, not a suggestion
- Having real data to show on Day 7 that makes the case self-evident

### The Reframe That Makes It Work

Every agent converged on the same psychological lever: **"We're not changing your number. We're adding a safety net to your biggest lead source."** The contractor's cell still rings first. Their existing contacts still reach them. The only thing that changes is which leads the system can see.

### The Contrarian's Exit Document

One unique and high-value idea: give the contractor a one-page "what you own" document at onboarding that lists every change made (with URLs, original values, and how to revert). This makes exit feel safe, which paradoxically increases willingness to commit. Worth implementing.

### Open Question (Data-Driven Agent)

The Data-driven agent flagged a dependency that could block Day 0 Twilio-primary entirely: **does the contractor have Google Business Profile access?** If they need to claim their listing first, Mode B has a blocking dependency. Verify GBP access during the sales call qualification (add to the ICP qualifier checklist).
