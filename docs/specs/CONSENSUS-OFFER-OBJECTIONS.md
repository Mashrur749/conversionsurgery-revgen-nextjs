# Consensus Report: Offer, Objections, and Operator Capacity

Date: 2026-04-01
Agents: 5 (capabilities gap analyst, contractor objection handler, spouse/bookkeeper, internal alignment advisor, solo operator consultant)

---

## Part 1: Offer Document Issues (must address before selling)

### Deal-Killer Gaps in Offer Language

| # | Issue | Offer says | Reality | Fix |
|---|-------|-----------|---------|-----|
| 1 | "Under 15 minutes per week" is misleading for Month 1 | "Total ongoing time: under 15 minutes per week" | Week 2 alone is 50-75 min. Month 1 average is 30-45 min/week. | Add qualifier: "once the system is trained (typically by Week 3). During setup, expect 30-45 minutes per week." |
| 2 | "AI trained on your business" implies fine-tuning | "An AI trained on your business" | AI reads a static knowledge base built from a 30-min call. Not trained/fine-tuned. | Change to: "An AI configured with your business information" |
| 3 | "Books appointments into your calendar" implies external calendar | "books estimate appointments into your calendar" | Books into platform-internal calendar only. No Google Calendar sync. | Change to: "books estimate appointments" (remove "into your calendar") |
| 4 | "Dormant Client Reactivation — 6+ months" doesn't match platform | "Past customers who haven't booked in 6+ months" | System targets stale pipeline leads (25-35 days), not completed-job customers. | Change to: "Past inquiries that went cold get re-engaged automatically" |
| 5 | "A/B testing" listed under "what we handle" doesn't exist | "A/B testing and optimization" | No A/B testing capability exists in the platform. | Remove "A/B testing" or replace with "message optimization" |
| 6 | "No questions asked" contradicts the defined conditions | "no questions asked" (Layer 1 guarantee) | Layer 1 has specific conditions (5 QLE). | Remove "no questions asked" or move to verbal-only |
| 7 | Quiet hours section is marked "interim" | "We are actively reviewing..." | Legal review incomplete. Cannot promise instant response to 10pm inquiries. | Keep interim version, don't use post-legal version until counsel confirms |

### Undersold Capabilities (add to offer)

| Capability | Why it matters to the contractor | Where to add |
|-----------|--------------------------------|-------------|
| Voice AI call answering (multi-turn, warm transfer) | Buried as a price line. Major differentiator. | Section 2 — expand the add-on description |
| Negative review alerts + AI response drafts | Contractors fear bad reviews. Instant alert is compelling. | New bullet in Section 2 |
| Knowledge gap auto-detection | Answers "what if AI says something wrong?" — it learns and improves. | Section 7 (Compliance) or Section 2 |
| Per-lead conversation takeover | Contractor can jump in anytime. Addresses AI fear directly. | Section 2 or Section 7 |
| Ring group simultaneous dial | Hot leads never ring unanswered. | Section 2 under "Team" |
| Data export on cancel — "you leave with everything" | Trust signal. Currently buried in Section 5. | Move to Section 9 summary prominently |

---

## Part 2: Sales Objections (contractor perspective)

### Objections Ranked by Severity

| # | Objection | Severity | Offer handles it? | What actually convinces them |
|---|-----------|----------|--------------------|------------------------------|
| 1 | "I've been burned by agencies before. Prove you're different." | **Deal-killer** | Weak — no social proof | A specific contractor story with dollar amounts. Until you have one: live demo where they text the number and see the AI respond. |
| 2 | "What if the AI says something wrong to my customer?" | **Deal-killer** | Partial — guardrails mentioned but no liability statement | Demo the AI failing gracefully. Show the takeover button. Explain Week 2 review window. |
| 3 | "What does near-instant actually mean at 10pm?" | **Speed-bump → deal-killer** | Hedged — interim quiet hours language | Give a straight answer: "9pm cutoff, they hear from you at 10am. We're working on removing that restriction." |
| 4 | "The guarantee has escape hatches" | **Speed-bump** | Inconsistent — "you confirm" is subjective | Change Layer 2 to objective log-based attribution only |
| 5 | "I already have a number my customers know" | **Speed-bump** | Not addressed | Explain parallel operation or call forwarding |
| 6 | "I don't get 15 leads a month" | **Speed-bump** | Well handled — volume condition | Sharpen the "below 8" clause with a defined outcome |
| 7 | "Why not GHL for $50?" | **Speed-bump** | Adequate — "done for you" | Rep must deliver this confidently |
| 8 | "What's my all-in cost?" | **Non-issue** | Well handled | Transparent add-on pricing |
| 9 | "What happens to my data?" | **Non-issue** | Well handled | Full export, 5 business days |

---

## Part 3: Spouse/Bookkeeper Concerns

### Top Cancellation Triggers

| Concern | Would push to cancel? | Fix |
|---------|----------------------|-----|
| ROI numbers are modeled, not measured | Maybe | **Win notification SMS** (now built) — sends concrete "recovered [Lead] — $X" when contractor marks won |
| 90-day guarantee requires subjective confirmation | Maybe | Make attribution objective or fully generous |
| "No message limits" has a vague review clause | No, but wants clarity | Define the threshold or remove the clause |
| Quarterly campaigns contact old customers without approval | Maybe | Add contact-level exclusion option |
| Voice AI has no spending cap | No, but wants cap | Add monthly cap or threshold alert |
| Escalation time commitment is open-ended | No | Add average escalation count to the table |
| CASL compliance on imported contacts is unclear | No, but legal exposure | Clarify consent responsibility for contractor-provided lists |

---

## Part 4: Solo Operator Capacity

### Time Model

| Phase | Per client | Notes |
|-------|-----------|-------|
| **Week 1** (onboarding) | 3.0-3.5 hours | Call, KB, CSV, audit, config |
| **Week 2** (KB sprint) | 2.5-3.0 hours | AI review, gap clearing, Smart Assist |
| **Week 3** (transition) | 1.0-1.5 hours | Safety gate, enable autonomous |
| **Week 4+** (steady state) | 10 min/day avg | Escalations, quality, gaps |

### Capacity Ceiling

| Clients | Daily delivery time | Feasible? |
|---------|-------------------|-----------|
| 3 | ~40 min/day | Comfortable |
| 5 | ~65 min/day + 3.75 hrs/week | Comfortable |
| 7 | ~90 min/day | Ceiling for sustainability |
| 10 | ~130 min/day | Hard max, no room for onboarding or sales |

### What Breaks in a 48-Hour Outage

| Still works | Breaks |
|------------|--------|
| All AI responses | Escalation queue piles up (SLA breach at 24h) |
| All automation sequences | Contractor can't reach a human |
| Cron jobs | Mid-onboarding client goes silent |
| Opt-out/compliance | Guarantee deadline remediation missed |

**Critical need:** Designate a backup person with admin access before you have 3+ clients.

### Top 3 Tasks to Automate Next

1. **Bi-weekly report follow-up text** — currently manual, should auto-send after report delivery
2. **KB gap contractor outreach** — "Send question to owner" button that fires formatted SMS
3. **Guarantee at-risk proactive alert** — auto-text contractor when approaching 30/90-day mark

---

## Part 5: Code Changes Shipped This Round

| Change | Status |
|--------|--------|
| Win notification SMS when lead marked "won" | Done |
| "Your Account Manager" card in client portal | Done |
| Auto-trigger estimate follow-up on CSV import (72h, not 25-day wait) | Done |
| Typecheck + tests | Pass |

---

## Action Items Summary

### Before first sales call (0 code, just doc edits)

1. Update "15 min/week" → add Week 1-2 qualifier
2. Fix "AI trained on your business" → "configured with"
3. Remove "into your calendar" from booking claim
4. Fix "6+ months" dormant language → "past inquiries that went cold"
5. Remove "A/B testing" from managed service list
6. Remove "no questions asked" from Layer 1 guarantee headline
7. Prepare 2-minute demo script: "Text this number right now"
8. Prepare answer for "what if AI says something wrong" (show takeover, explain Week 2)
9. Prepare answer for quiet hours (straight: "9pm cutoff, working on removing it")
10. Set `operator_phone` and `operator_name` in system_settings

### Before first client goes live (code, 1-2 sessions)

11. Google Calendar two-way sync (most-requested missing feature)
12. Bi-weekly report auto-follow-up SMS
13. KB gap "ask contractor" button
14. Guarantee at-risk proactive alert

### Before client 5 (operational)

15. Designate backup admin for 48-hour resilience
16. Document capacity model in ops guide
