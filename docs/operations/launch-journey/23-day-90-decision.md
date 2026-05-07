# 23 — Day 90 Decision

## What this is
Reactive — Day 90 of every client. The 90-day Minimum Term ends. Three branches: continue month-to-month, upgrade Pilot to Standard, or cancel. This file is what you reread the week before the call.

## Before you start this
- [ ] Client has been delivered for 90 days (Day 21 go-live + 70 days of operation)
- [ ] Day 45 retention call happened (file 22)
- [ ] You have read `docs/operations/E2E-OPERATOR-FLOW.md` §8.7 (Pilot → Standard hard rule)
- [ ] You have read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §7c (cancel handling)

## Time required
~2 hours total: 30 min prep (Day 75–80), 30 min call, 60 min post-call admin (transition email, contract action if needed, win-back trigger if cancel).

## What you'll do

### Pre-Day-90 prep (Day 75–80)

Pull together the 90-day picture for the call:
- Total leads logged, total replies, total appointments booked, total deals closed (if known)
- Headline number — pick one ("This week you closed a $48K basement that started as a 19-day-old quote we re-engaged")
- Open KB entries, AI quality trend, any incidents
- Capture key wins in your client notes file. Per project memory, formal case studies are deferred — do not productize this yet. Just keep the raw material so you have it later.

### Day-90 conversation framing

Open the call this way: "We're at Day 90. The Pilot Minimum Term ends today. Let's set the agenda for month four. Here's what we accomplished, here's what's next, and here's what changes contractually."

Do not let this become a reactive call. You are leading the agenda. The contractor's main question is "is this worth $1,500/mo to keep going" — you are answering that with data, then routing to one of three branches.

### Branch A — Continue (most common)

The client wants to keep going. Their Pilot pricing locks in (per the offer): $1,500/mo continues, no contract action needed.
- Confirm verbally: "We'll continue at $1,500/mo. You now have a 30-day cancel right at any time. No paperwork."
- Update internal client record: `pilotPhase` → `post-pilot`, `cancelNoticePeriod` → 30 days
- Trigger the next-month invoice on the existing schedule
- No transition email required. Send a short thank-you with the headline number from your prep.

### Branch B — Upgrade Pilot to Standard

This applies to clients 1–3 (Pilots) only. Per `E2E-OPERATOR-FLOW.md` §8.7, Pilot pricing is the original cohort discount — it does not transfer if the client wants the full Standard offer (e.g., they want add-ons or a renegotiated SLA that wasn't in the Pilot scope).

Mechanics:
- Setup fee waived (already paid + delivered)
- Monthly: $1,500 → $2,000
- Standard SLA terms apply going forward
- You issue a new Standard agreement (electronic signature)
- New monthly billing schedule starts the next billing date

Do not push this branch. Most contractors should stay on the Pilot rate. Only move them to Standard if they affirmatively ask for something Standard-specific.

### Branch C — Cancel (post-90-day)

Cancel is fine. The Pilot did its job either way — you have data, they have results, the relationship can end cleanly.

Mechanics per `02-MANAGED-SERVICE-PLAYBOOK.md` §7c:
- 30 days written notice. The end-of-service date is 30 days after notice.
- During the notice window, full service continues (no degradation).
- Data export delivered within 5 business days of notice. Use the admin export tool.
- Final invoice covers the partial month if applicable.
- Twilio number: per the offer, contractor can port the number out. Initiate port-out request immediately on notice.

Required: capture cancel reason in admin (`/admin/clients/{id}/cancel-reason`). Day-90 cancels are the second-most-valuable feedback after Day-14 cancels — they tell you what the offer didn't deliver in 90 days. Do not skip.

### Post-cancel win-back

Day 7 after cancel: send a single short email asking how things are going post-cancel and whether anything changed. No pitch. Just a check-in. Reference: `02-MANAGED-SERVICE-PLAYBOOK.md` §7c (win-back template).

If they re-engage, you re-onboard at Standard pricing (not Pilot). The Pilot rate was a one-time cohort discount.

### Documentation update at Day 90

Whatever happened on this call — continue, upgrade, or cancel — log it in your reflection notes. File 26 (Pilot Reflection) is where this material gets processed at Day 120.

## What success looks like
- [ ] Day-90 call held with prepared headline number
- [ ] Branch decided cleanly (continue, upgrade, or cancel)
- [ ] Internal records updated (`pilotPhase`, billing, cancel-reason if applicable)
- [ ] Cancel: data export completed within 5 business days, win-back scheduled Day 7
- [ ] Continue/upgrade: contractor confirms in writing (email reply) that they understand the new terms

## If something goes wrong
- **Contractor wants to cancel mid-Pilot but is past Day 90.** That's just a normal post-Pilot cancel. Branch C applies.
- **Contractor pushes for a price reduction below $1,500.** Hold the line. The Pilot rate is already a discount. If they need to leave on price, they need to leave.
- **Contractor wants to renegotiate scope.** That's Branch B (Standard) territory. Send them the Standard agreement.
- **You realize on the call the client should have been pulled at Day 14 and wasn't.** Document it in file 26 under "What broke." Don't litigate it on the call.

## Reference
- `docs/operations/E2E-OPERATOR-FLOW.md` §8.7 (Pilot → Standard hard rule)
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §7c (cancel + win-back)
- `docs/business-intel/OFFER-APPROVED-COPY.md` (current pricing — do not edit without asking)
- `docs/operations/launch-journey/26-pilot-1-reflection.md` (Day 120 retro)

## Next
[24 — Monthly Machine](./24-monthly-machine.md)
