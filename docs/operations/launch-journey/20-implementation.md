# 20 — Implementation

## What this is
Reactive job-aid covering Day 1–21 of every new client. The implementation phase: from "onboarding call done" to "Day 21 go-live gate." The full timeline lives in the E2E delivery guide — this file is the high-level checkpoint map you use to know what week you're in and what should be done by when.

## Before you start this
- [ ] File 19 (Onboarding) completed: priming SMS sent, onboarding call done, KB seeded, phone provisioned + A2P-associated, Day-1 smoke tests passed, old quotes imported
- [ ] You have read `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §5.1–5.8 at least once

## Time required
Varies — used reactively across 21 days. Typical operator load: 30–60 min/day per client during implementation, dropping to 15–30 min/day after go-live.

## What you'll do

The implementation is split into 8 phase windows. Each window has specific deliverables — the full task lists are in `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §5.1–5.8. Use this file to know which phase window you're in and what state the client should be in by the end of it.

### Day 1–2 — Foundation (E2E §5.1)

By end of Day 2, the client should be in this state:

- Onboarding call complete (file 19)
- KB wizard saved with at least 80% of fields filled (gap email sent for the rest)
- Twilio number provisioned, webhooks wired to production, A2P campaign association confirmed
- Old quote CSV imported, lead count matches their export
- Day-1 smoke tests (inbound SMS + missed-call text-back) passed

If any of these slipped from Day 0, finish them now. Don't move to Day 3 work with Day 1 gaps open.

### Day 3–5 — Mapping & templates (E2E §5.2)

- Phone-tree, web form, and intake-channel mapping done. Confirm every channel where leads currently arrive (their existing phone, contact form, FB inbox if forwarded, etc.) is either routed to the new Twilio number or has a clear reason it isn't.
- Messaging templates approved by the client. Show them the AI's qualifying-question copy, the missed-call response, the estimate-confirm message. Get explicit "yes, this sounds like me" from the client.
- Set the AI mode to **Smart Assist** for week 1 (operator reviews every outbound). This is intentional — week 1 is where you catch KB gaps that don't show up until real conversations happen.

### Day 6–8 — Missed-call live + Day 7 listing migration (E2E §5.3)

- Missed-call response is live and tested against a real homeowner-style inbound (you call from a non-test number, hang up, confirm text-back).
- **Day 7 listing migration call** — 15–20 min, scripted in `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §10a. This is where their Google Business Profile, Facebook page, and any other public listings flip the contact number to the new Twilio number. This is the highest-leverage moment of week 1 — without it, none of the resurrection or missed-call recovery actually catches new traffic.

### Day 9–12 — Estimate flow + 4-touch follow-up + reactivation batch (E2E §5.4)

- Estimate trigger verified end-to-end. Send a lead through the full qualification → estimate-booked path on staging or production with a test homeowner. Confirm the calendar slot books correctly.
- 4-touch estimate follow-up templates approved by client. The 4 touches and timing are pre-built — client just needs to approve copy.
- **Stale estimate batch run.** All quotes from the last 90 days that the client imported get a structured re-engagement sequence. This is the resurrection deliverable from `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §2 — typically generates the first booked estimate of the engagement during this window.

### Day 13–15 — Pipeline + escalation + first Pulse (E2E §5.5)

- Pipeline stages confirmed (intake → qualified → estimate-booked → won/lost) match how the contractor thinks about their funnel.
- Escalation rules configured: which conversations should ping the operator (you), which should ping the contractor directly, which can go automated.
- **First weekly Pulse SMS fires** to the contractor on Friday morning of week 2 — summary of leads, estimates booked, conversations needing attention. Verify it actually arrived (not just that the cron ran). Cron details: `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` Appendix A.

### Day 16–18 — First scoreboard + KB gap fixes (E2E §5.6)

- First bi-weekly performance scoreboard drafted. The scoreboard format and sample is in `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §4. This is the artifact you'll deliver on the bi-weekly strategy call.
- Walk the AI's conversation logs from Day 6–15. Any "I don't know" / "let me check with the team" / hedged answers from the agent are KB gaps — fix them in `/admin/clients/[id]/knowledge`. Aim for zero hedge responses by Day 18.

### Day 19–20 — Production tests (E2E §5.7)

- Run all 16 production tests from `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §6 against this client's setup. Tests 1–16 cover: inbound SMS, missed-call, web form, voice AI, estimate trigger, follow-up sequence, stale reactivation, appointment booking, review request, payment reminder, KB gap detection, compliance (STOP/quiet hours), Day-21 go-live gate, Day-30 logging gate, performance report, weekly Pulse.
- Every test must pass with this client's real data (KB, phone number, calendar). A passing test on a different client is not a passing test for this client.

### Day 21 — Go-Live (file 21)

If everything in Days 1–20 is green, you advance to file 21. The Day-21 go-live is gated — it does not happen automatically.

## What success looks like
- [ ] Day 1–2 foundation confirmed
- [ ] Day 7 listing migration call done, public listings flipped
- [ ] Stale estimate batch fired by Day 12
- [ ] First weekly Pulse SMS confirmed delivered
- [ ] First bi-weekly scoreboard drafted
- [ ] Zero "I don't know" hedges from AI by Day 18
- [ ] All 16 production tests pass against this client's data by Day 20
- [ ] Ready to advance to file 21 on Day 21

## If something goes wrong
- **Listing migration call refused / postponed.** This is the most common slip. Push hard: "Without this, the system can't see the new traffic. Moving the call by a week moves go-live by a week." If they still postpone, log it in the client record and document that go-live will slip — this is on them, not on the operational guarantee.
- **AI keeps hedging on KB gaps.** Run the gap-detection tooling in admin (Test 11). It surfaces the specific topics the agent is failing on. Fix those in KB, don't try to fix the prompt.
- **Production test fails on Day 19.** Identify whether it's a configuration issue (most common: webhooks, KB gaps, calendar sync) or a platform issue. Configuration → fix and re-run. Platform → escalate; do not advance to go-live with a failing test.
- **Day-7 setup non-refundable trigger has fired but client is dragging implementation.** That's now their problem economically — but operationally you still need to push. Send a written summary email after each missed milestone: "We agreed to X by Y. We're now at Z. Here's what's blocking go-live." Documentation matters if Day-14 cancel comes in.

## Reference
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §5.1–5.8 (the full Day 1–21 timeline)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §6 (16 production tests)
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §2 (Quote Reactivation), §4 (Bi-weekly scoreboard), §10a (Day-7 listing migration call)

## Next
[21 — Go-Live Gate](./21-go-live-gate.md)
