# Stochastic Multi-Agent Consensus Report

**Problem**: Is ConversionSurgery ready to launch at $1,000/month for Canadian renovation contractors? What are the dealbreakers?
**Agents**: 10 (neutral, risk-averse, growth, contrarian, first-principles, contractor POV, resource-constrained, long-term, data-driven, systems thinker)
**Date**: 2026-04-01

---

## Launch Readiness Score

| Agent | Framing | Score |
|-------|---------|-------|
| 1 | Neutral | 7 |
| 2 | Risk-averse | 5 |
| 3 | Growth | 7 |
| 4 | Contrarian | 6 |
| 5 | First-principles | 6 |
| 6 | Contractor POV | 5 |
| 7 | Resource-constrained | 6 |
| 8 | Long-term | 6 |
| 9 | Data-driven | 7 |
| 10 | Systems thinker | 6 |
| **Mean** | | **6.1** |
| **Median** | | **6** |

---

## Consensus (agreed by 8+/10 agents)

These findings appeared in nearly every analysis. High confidence.

### Dealbreaker 1: AI says something wrong in Week 2 (10/10 agents)

Every single agent flagged this as the #1 or #2 cancellation risk. The knowledge base is built from a 30-minute call. Week 2 is the first time the AI handles real conversations. The playbook expects 5-15 knowledge gaps. Smart Assist's 5-minute window is not sufficient protection for a contractor on a job site.

**Verdict**: Known risk, mitigated but not eliminated. The Week 2 KB sprint is the correct response. The operator must be hyper-attentive during this window.

### Dealbreaker 2: Low lead volume causes guarantee failure (10/10 agents)

Every agent identified the lead volume dependency. Below 15 leads/month, the guarantee window extends. Below 8, it becomes discretionary. The platform doesn't generate leads — it converts inbound. If the contractor has a slow month, the guarantee fails through no fault of the system.

**Verdict**: Structural risk. Cannot be fixed with code. Must be addressed in the sales conversation: qualify lead volume before signing.

### Dealbreaker 3: Estimate flagging is behavioral, not automatic (9/10 agents)

The estimate follow-up sequence — the most visible automation — requires the contractor to flag estimates via SMS keyword or dashboard. If they don't, the highest-value automation never fires. The fallback nudge helps but still requires contractor action.

**Verdict**: Known design limitation. The nudge cron mitigates but doesn't solve. Consider auto-detection in the future (parse outbound email for estimate PDFs, etc.).

### Promise most likely to underdeliver: "Under 15 minutes per week" (10/10 agents)

Every agent called this out. Week 2 alone is 50-75 minutes of AI review. The figure is accurate at steady-state Week 4+, but misleading for Month 1. Contractors feel deceived when the actual time is 3-4x what was promised.

**Verdict**: Update the offer language. Say "under 15 minutes per week once the system is trained (typically by Week 3)" or similar.

### Missing at $1,000/month: Calendar integration (9/10 agents)

The platform books appointments internally but has no two-way sync with Google Calendar or any external calendar. Contractors who already use a calendar will have double-bookings and missed appointments.

**Verdict**: Not a launch blocker for client 1-2 (manual workaround: operator adds to contractor's calendar). Becomes a blocker at scale.

### Spouse/bookkeeper trigger: No visible dollar ROI (10/10 agents)

Every agent identified this. The bi-weekly report shows lead counts and response times, but no specific "this job was recovered by the system." The person controlling the cancel decision (spouse/bookkeeper) has no evidence of concrete return.

**Verdict**: Build a win notification. When a contractor marks a lead "won," send a proactive SMS: "ConversionSurgery helped recover [Lead Name] — estimated project value $X." This is the artifact that survives the bookkeeper review.

---

## Divergences (4-6/10 agents split)

### Missing: Mobile app / PWA (4/10)
Four agents flagged that at $1,000/month, contractors expect a mobile app, not a browser tab. Six agents didn't flag this because the responsive web app and SMS notifications are sufficient.

**Verdict**: Not a launch blocker. Monitor if contractors mention it in the first 90 days.

### Missing: Direct human support line (6/10)
Six agents said contractors expect a named person they can call at $1,000/month. Four said the SMS-based operator model is sufficient for the managed service.

**Verdict**: Add the operator's personal phone number to the contractor's portal as a "Your Account Manager" card. This costs nothing and solves the perception gap.

### Cancellation 30-day notice as resentment trigger (4/10)
Four agents (risk-averse, contrarian, contractor POV, systems thinker) flagged the 30-day notice period as a cancellation accelerator rather than retention tool.

**Verdict**: Standard industry practice. Keep it, but be transparent about it during sales ("month-to-month, 30-day notice just like any contractor agreement").

### Win-back timing gap (3/10)
Three agents (contractor POV, data-driven, systems thinker) noted the win-back automation waits 25-35 days after import, which means imported quotes won't fire until near the end of the guarantee window.

**Verdict**: Fixable. Auto-trigger estimate follow-up (not win-back) for imported leads with status=estimate_sent within 72 hours of import.

---

## Outliers (1-3 agents only)

### Contrarian: "Launch with warm leads only, not cold outreach"
Agent 4 recommended launching with referrals or people you have a relationship with, to protect your ability to learn from failure rather than just survive it.

### Contractor POV: "Lead with the guarantee in the spouse conversation"
Agent 6 suggested the contractor should tell their spouse: "If we don't see 5 real lead conversations, first month is free." This is the sentence the spouse understands.

### First-principles: "The platform cannot prove it recovered a job — it can only claim it"
Agent 5 noted that attribution requires the contractor to subjectively confirm system contribution, creating a permanent dispute surface.

### Systems thinker: "The cascade is: bad AI message -> contractor watches every message -> trust broken -> cancellation by day 20"
Agent 10 mapped the escalation chain from a single Week 2 error to cancellation in under 3 weeks.

---

## Actionable Recommendations (by consensus strength)

### Must-do before first client (8+/10 agree)

1. **Qualify lead volume in the sales conversation.** Ask: "How many calls/form submissions do you get per month?" If under 10, set explicit expectations about the guarantee timeline.

2. **Update "15 minutes/week" language.** Change to "under 15 minutes per week once the system is trained (usually by Week 3). During setup, expect 30-45 minutes per week as we calibrate the AI to your business."

3. **Build a win notification SMS.** When contractor marks a lead "won," auto-send: "[Business Name] recovered [Lead Name] — estimated value $X. Powered by ConversionSurgery." This is the proof artifact the bookkeeper needs.

4. **Add "Your Account Manager" card to the client portal.** Show the operator's name and phone number. Costs nothing, solves the "no human I can reach" perception.

### Should-do within 30 days of first client (5-7/10 agree)

5. **Auto-trigger estimate follow-up for imported leads** within 72 hours (don't wait for the 25-day win-back window).

6. **Add a pre-onboarding lead volume qualification question** to the sales process or signup flow.

7. **Calendar integration** (Google Calendar sync) — critical for client 3+.

### Consider for future (3-4/10 suggest)

8. PWA / mobile app with push notifications
9. CRM integration (ServiceTitan, Jobber) via webhook or Zapier
10. Automated estimate detection (parse outbound for estimate PDFs/emails)
