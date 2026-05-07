# 22 — Delivery Window (Day 21 to Day 90)

## What this is
Reactive operating window. Day 21 (go-live) through Day 90 (decision point), per client. This is the file you reread every Monday morning to remind yourself what cadence the client is on, and what the platform is doing for you so you don't have to.

## Before you start this
- [ ] Client has gone live (Day 21 milestone passed — file 21)
- [ ] You have read `docs/operations/E2E-OPERATOR-FLOW.md` §6.1–6.16 once end-to-end
- [ ] You have read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §3, §4, §5

## Time required
~3–5 hours per week, per client, during this window. Reactive — you do not block calendar time for "delivery." You respond to escalations and run the cadences.

## What you'll do

### The four cadences

These cadences run for every active client between Day 21 and Day 90. Some are platform-driven (you do nothing). Some are operator-driven (you do them).

**Daily — operator triage (~15–30 min/day, batched)**
- Review the queue at `/admin/conversations?filter=needs-attention`
- Action escalations flagged by the AI (low-confidence handoffs, complaints, after-hours emergencies)
- Spot-check 3–5 AI replies for quality. Flag any that drift off-script.
- Add KB entries for any gap that produced a fallback or escalation today.
- Reference: `docs/operations/E2E-OPERATOR-FLOW.md` §7.1 (Daily ops checklist)

**Weekly — platform-driven (auto, you do nothing unless an alert fires)**
- Monday Pulse email/SMS to contractor (last week's results)
- Friday Pulse SMS to contractor (this-week summary)
- Recovery SMS to dormant homeowner leads
- You only act if `/admin/system-health` flags a missed cron run. See file 25 for cron failure handling.

**Bi-weekly — strategy call (30 min, on calendar)**
- Calendar invite was created at onboarding (Day 14)
- Agenda from `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §4: results review (5m), AI quality review (5m), KB additions (5m), upcoming campaigns (5m), open questions (10m)
- Send 1-page summary email after the call. Template in §4.

**Day 45 — proactive retention call (15–20 min)**
- Mid-Pilot check-in. The contractor is past the honeymoon and not yet at decision time. This is where churn risk peaks.
- Structured agenda from `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §10b: what's working, what's frustrating, what they would change about the offer, surface any unspoken concerns.
- Outcome: either reaffirm the relationship or surface an issue early enough to fix before Day 90.

### The Day-30 logging gate

The operational guarantee says: 80% of inbound leads logged in CRM by Day 30, or the client is owed a credit.

- On Day 28, run the logging report at `/admin/clients/{id}/logging-audit`
- If logging % < 80%, escalate immediately:
  - Diagnose root cause (integration issue? AI mis-logging? lead source not connected?)
  - Apply credit per `docs/operations/E2E-OPERATOR-FLOW.md` §8.3
  - Notify contractor proactively — do not let them discover this
- If logging % >= 80%, no action needed. Confirm in Day-45 call.

### Edge cases (rare, but know where to find them)

You will not hit most of these. When you do, the runbook is in E2E:
- Day-14 cancel right exercised → §8.0a
- Pause request received → §8.0b
- Go-live slipped past Day 21 → §8.2
- Logging gate failed → §8.3
- Mid-term cancel attempt (before Day 90) → §8.4
- Compliance complaint (CASL/CRTC) → file 25 §Failure mode 7

Do not improvise on these. The procedures exist for legal and contractual reasons.

### What you do NOT do during this window

- Do not push new features to the contractor mid-Pilot. Stability > novelty.
- Do not skip the bi-weekly call to "save time." This is the trust-building cadence.
- Do not let escalations sit overnight. After-hours emergencies that touch the homeowner side go to the on-call protocol (see Anti-On-Call rules in `02-MANAGED-SERVICE-PLAYBOOK.md` §6).

## What success looks like
- [ ] Daily triage completed, queue empty by EOD each weekday
- [ ] All weekly platform pushes fired (verify via system-health on Mondays)
- [ ] Bi-weekly call held and 1-page summary sent
- [ ] Day 45 retention call held with structured agenda
- [ ] Day 30 logging gate ≥ 80% (or credit applied if not)
- [ ] No escalation older than 24 hours

## If something goes wrong
The delivery window is where most operational issues surface. Match the issue to a runbook section:
- Platform/automation breakage → file 25 (When Things Break)
- Contractual/billing issue → `docs/operations/E2E-OPERATOR-FLOW.md` §8
- Communication breakdown with contractor → call them. Do not email a hard issue.

## Reference
- `docs/operations/E2E-OPERATOR-FLOW.md` §6.1–6.16, §7.1, §8.0a–§8.4
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §3, §4, §5, §10b
- `docs/operations/launch-journey/25-when-things-break.md`

## Next
[23 — Day 90 Decision](./23-day-90-decision.md)
