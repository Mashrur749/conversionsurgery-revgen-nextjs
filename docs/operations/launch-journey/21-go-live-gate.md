# 21 — Go-Live Gate

## What this is
Reactive job-aid for Day 21 of every new client. The go-live gate is the contractual transition point: AI mode flips from Smart Assist to Autonomous, the second 50% of setup gets charged, and the monthly subscription begins recurring. The gate is also the operational guarantee anchor — passing on Day 21 is what the contract promised.

## Before you start this
- [ ] You have read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §5 (Guarantee Evaluation)
- [ ] You have read `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §5.8 (Day 21 Go-Live Review) and §8.2 (Go-live slips)
- [ ] All Day 1–20 implementation work (file 20) is complete

## Time required
~30 min for the gate verification + 30 min for the staff walkthrough call. Total: ~1 hour, plus calendar follow-ups for the next 30 days.

## What you'll do

### Pre-gate checklist

Before declaring go-live, confirm every item below. If any is red, do not advance — see the "If something goes wrong" section.

- [ ] **All Phase 5 items (Day 1–21) complete** per file 20 / E2E §5.1–5.8
- [ ] **All 16 Phase 6 production tests pass** against this client's real data (E2E §6.1–6.16)
- [ ] **AI mode advanced from Smart Assist to Autonomous** in `/admin/clients/[id]` — no more operator-in-the-loop on every outbound by default. Smart Assist remains available as a per-conversation option.
- [ ] **Day-21 go-live cron triggered, gate passed.** Cross-reference E2E Appendix A for the cron name and the gate logic. The cron evaluates whether the client meets the operational-guarantee criteria for go-live and writes a `go_live_gate` record to the client.
- [ ] **Day-30 logging gate trending green.** It's only Day 21, but you can see the trajectory: are conversations being logged correctly? Are estimates being attributed? If logging is below 60% trending up, that's fine. If logging is below 40% with no upward trajectory, the Day-30 gate is at risk — see `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §8.3.

### Operator action at go-live

In sequence — do not skip and do not reorder.

#### 1. Verify Guarantee Status card

- Open `/admin/clients/[id]` → Overview tab.
- The Guarantee Status card should show: **`go-live: passed`** with today's date as the gate date.
- If it shows `pending` or `failed`, do not proceed. The cron has not run or the client has not met the gate criteria. Open §8.2 of the E2E guide.

#### 2. Charge the second 50% of setup

- Pilot tier: $1,750 second-half setup fee
- Standard tier: $2,750 second-half setup fee

This is operator-triggered, not automatic. From `/admin/clients/[id]` billing actions:

- Generate a Stripe invoice for the second-half setup. The action button on the client billing tab handles this — it pulls the right amount based on the client's tier.
- The invoice goes to the client's billing email. Net-7 payment terms (i.e. due within 7 days). Most clients pay same-day from a stored card.
- Confirm the invoice was created in Stripe Dashboard → Invoices.

#### 3. Verify monthly subscription auto-charges

The monthly recurring ($1,500 Pilot / $2,000 Standard) activates at go-live. Stripe handles the proration automatically — the subscription was created at signing but typically configured to start billing on go-live date.

- Open Stripe Dashboard → Customers → this customer → Subscriptions.
- Confirm the subscription status is `active` and the next invoice date is set (typically 1 month from today).
- Confirm in `/admin/clients/[id]` that the platform sees the active subscription.

If the subscription is still on a trial / future billing-start date, manually advance the billing-cycle anchor in Stripe to today. This is a Stripe-side action — `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §3.4 has the exact UI path.

#### 4. Send "system fully autonomous" SMS

Send via `/admin/clients/[id]` messaging panel (logs the message to their thread):

> [Name] — system is now fully autonomous as of today, Day 21. Every inbound lead is handled end-to-end by the AI without me in the loop unless something needs escalation. You'll see leads + booked estimates in your portal at [client portal URL]. Daily Digest comes at 8 AM your time. Reply STATUS, LEADS, BOOK, or HOLD to those if you need anything quick. Want a 15-min walkthrough of the staff-side commands? [time slot 1] / [time slot 2]?

This SMS is the official contractor-facing handoff. Save the timestamp.

#### 5. 15-min staff walkthrough call

Same day or within 24h. The contractor and any front-desk / admin / spouse who will interact with the system. 15 minutes, screen-shared if possible. Cover:

- The 4 SMS commands the contractor can text into the system: `STATUS`, `LEADS`, `BOOK`, `HOLD`. Show what each one does.
- The Daily Digest reply syntax — how they confirm or reroute the booked estimates from a single SMS reply.
- Where to find leads in the portal (`/client/leads`)
- What to do if they want to reach you: text the operator number, expect a reply within 4 business hours during business days.

This call sets the floor on contractor self-service. Without it, every client question routes to you — which doesn't scale.

### Day-30 logging gate is next

The Day-21 gate is the first of two operational guarantees. The Day-30 logging gate is the second — 80% of leads logged correctly by Day 30. The Day-30 logging audit lives in file 23. Calendar nudge for Day 30 of this client right now.

## What success looks like
- [ ] Guarantee Status card shows `go-live: passed`
- [ ] Second 50% of setup invoiced in Stripe ($1,750 / $2,750)
- [ ] Monthly subscription auto-charging confirmed
- [ ] AI mode: Autonomous
- [ ] Autonomous handoff SMS sent and logged
- [ ] 15-min staff walkthrough call done
- [ ] Day-30 logging audit on calendar

## If something goes wrong
- **Gate did not pass on Day 21.** This is the §8.2 path in `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`. Per the operational guarantee, you extend the engagement at no additional charge until the gate passes. Communicate transparently with the client: "We're not at go-live yet — here's what's pending, here's the new target date." Do not charge the second-half setup until the gate passes.
- **Client wants to delay go-live themselves.** Allowed, but document it. They cannot also claim the operational guarantee was missed if they were the cause of the delay. Email summary: "Per your request, go-live moves from [date] to [date]. The 21-day go-live guarantee resets to the new date you chose."
- **Second-half setup invoice fails.** Same handling as the signing-fee path in file 18 — re-send the link, follow up at 24h and 48h. After 72h with no payment, the engagement is in dispute — escalate to a written status email and pause new outbound activity until billing is resolved.
- **AI mode stuck at Smart Assist.** Most common cause: a manual override flag set during week 1 that wasn't cleared. Check `/admin/clients/[id]/settings` → AI Mode override. Clear it and refresh.
- **Logging trending below 40%** at Day 21. This is a real risk for the Day-30 gate. Open §8.3 of the E2E guide. Most common causes: webhook misconfiguration, KB gaps causing too many escalations, or calendar sync issues hiding booked estimates from the logging count. Triage today.

## Reference
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §5 (Guarantee Evaluation — Layer 1: 21-day go-live, Layer 2: 30-day logging)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §5.8 (Day 21 Go-Live Review), §6.13 (Test 13 — Go-Live gate), §8.2 (go-live slips), §8.3 (logging falls below 80%)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` Appendix A (cron jobs, including go-live gate cron)

## Next
[22 — Delivery Window](./22-delivery-window.md)
