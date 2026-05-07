# 17 — Discovery Call

## What this is
Reactive job-aid. Open this file when you have a discovery call on your calendar — today or tomorrow. Covers the 30-min prep and the 30-min call. Every discovery call uses this file from now until the muscle memory is automatic (probably your first 10 calls).

## Before you start this
- [ ] Discovery call is on your calendar with a specific time
- [ ] File 14 (Warm Reply Protocol) was followed: dead quotes received, CASL confirmation saved, resurrection demo built, screenshots captured, ROI calculator pre-filled
- [ ] You have read `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §1.3 and §2.1–2.5 at least once

## Time required
~60 min total — 30 min prep + 30 min call. Block the 30 min immediately before the call as protected prep time.

## What you'll do

### Pre-call prep (30 min before the call)

Open these tabs in this order — do not start the call until all are open and ready:

1. **Audit one-pager.** Their Loom audit URL or the audit deck you customized for this prospect (file 10).
2. **ROI calculator.** Pre-filled with their numbers from file 14 (estimates/month, average project value, % that go quiet). The annual revenue at risk number should be visible at a glance.
3. **SALES-OBJECTION-PLAYBOOK** open as a reference tab. You won't read from it on the call, but you want it one click away.
4. **Dead Lead Resurrection screenshots** from the staging Twilio runs. The 1–2 strongest threads, with `/admin/conversations/[id]` URLs ready to share-screen.
5. **Service agreement template** (`docs/templates/SERVICE-AGREEMENT-TEMPLATE.md`) open in a separate tab — you'll need it the moment they say yes.
6. **Pilot tier availability check.** Open `/admin/clients` and count active Pilots. The Pilot tier is reserved for the first 3 clients. If you are at 3 active Pilots and their book is full, this prospect quotes at Standard pricing ($5,500 setup + $2,000/mo) — see `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §11b.

### On the call (30 min)

Follow the structure in `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §2.1–2.5. Do not improvise — the structure is the point.

#### 1. Cold opener (E2E §2.1) — 2 min

Cold open with the dead-quote question. Do not warm them up. Do not thank them for their time. Open with:

> Before I show you anything, tell me: in the last 90 days, how many estimates did you send that went quiet? And do you know which ones you actually lost vs. which ones might still come back?

Let them answer. The number they give is your anchor.

#### 2. 10-question scorecard (E2E §2.2) — 10 min

Ask all 10. Do not skip. Take notes verbatim — write down their words, not your paraphrase. The 10 questions are in E2E §2.2; bring them up on a second screen if you need.

You're scoring the lead on:
- Volume (estimates per month, project size)
- Pain awareness (do they know the gap exists?)
- Decision authority (can they sign today?)
- Tech literacy (can they operate the portal at the level Pilot/Standard requires?)
- ICP fit (Calgary/Edmonton design-build renovator, $25K+ avg ticket)

#### 3. Pass threshold

**7 of 10 from the qualification scorecard.** If they score 7 or higher, advance to tier recommendation. If 6 or lower, you do not pitch — close the call with "I don't think we're the right fit right now, but if your situation changes in 6 months reach out." Do not soften. Wrong-fit clients destroy operator capacity later.

#### 4. Tier recommendation (E2E §2.3 — hard rules)

The hard rules:
- First 3 paying clients → **Pilot** ($3,500 setup + $1,500/mo, 90-day minimum)
- Client 4+ → **Standard** ($5,500 setup + $2,000/mo, 90-day minimum)
- No exceptions on Pilot pricing once the cap is hit. If they push, refer to `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §11b for the operator-side handling.

State the tier flatly: "Based on what you told me, I'd put you in our Pilot tier. $3,500 setup, $1,500 a month, 90-day minimum. Setup splits 50/50 — half on signature, half at go-live which is Day 21."

#### 5. The 4 Irresistibility Levers (E2E §2.4.5)

Insert before quoting price would have landed flat — but you've already quoted, so use the levers as the closing weight on the offer. State all four:

1. **Dead Lead Resurrection.** "I already ran your dead quotes through the system — let me show you" → share screen, walk through the 1–2 strongest threads. This is the single most powerful moment in the call. Use it.
2. **Day-14 Cancel Right.** "If after 14 days it's not what I told you, you cancel with one phone call. Max you're out is the signing fee — $1,750."
3. **30-Day Pause Right** (post-Minimum-Term). "Slow season hits, you pause for 30 days. No charge during the pause. You don't lose your phone number or your data."
4. **Spouse Line.** "Your spouse / partner gets a separate line into the system. They see what's coming through, they can flag what matters. No more 'did you call them back?' fights."

Cross-reference: `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §1.7 (Resurrection), §1.8 (Spouse Line), §6a (Pause), §7a (Day-14 Cancel) for the operator-side mechanics.

#### 6. Demo close (E2E §2.5) — 5 min

The demo close is in E2E §2.5. Land on:

> Here's what I propose. Pilot tier. $3,500 setup, $1,500 a month, 90-day minimum. System is live within 21 days or we extend at no charge. If it doesn't work in 14 days, you cancel and you're out $1,750. If it works — and it will — one recovered job pays for the year. Can I get you set up this week?

### If they say yes

Move to file 18 immediately. Do not let the conversation drift into "let me think about it" territory after a yes. The service agreement should land in their inbox within 30 minutes of the call ending.

### If they say "let me think about it"

Pull from `docs/operations/COLD-START-PLAYBOOK.md` §Script H. Schedule a specific follow-up: "I'll text you tomorrow at this time — work for you?" If they say no to that, follow up at:

- 24 hours (one SMS, soft check-in)
- 7 days (one email, no pressure)
- Then archive. Two follow-ups, then they go cold. Do not chase.

### If they say no

Thank them. Ask one question: "What would have made this a yes?" Listen. Add their answer to a `lost_reasons` column in your spreadsheet — patterns there improve future pitches.

## What success looks like
- [ ] All 10 scorecard questions asked, notes taken verbatim
- [ ] Tier stated flatly, all 4 Irresistibility Levers covered
- [ ] Dead Lead Resurrection screenshots shown live
- [ ] Demo close delivered
- [ ] Outcome logged: yes (file 18) / think-about-it (24h+7d follow-up) / no (one diagnostic question)

## If something goes wrong
- **They ask a question you don't know the answer to.** "Good question — let me give you the precise answer in writing tonight rather than guess." Then check `docs/business-intel/OFFER-APPROVED-COPY.md` and `docs/sales/SALES-OBJECTION-PLAYBOOK.md` and reply by email same day.
- **They want a custom tier.** No. The tier rules are hard. Quote Pilot or Standard or close the call.
- **Pilot cap hit and they want Pilot pricing.** "I have 3 Pilots active right now and that pricing is reserved for the first 3. I can put you on the Pilot waitlist or quote you at Standard — your call." Then `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §11b.
- **They want to talk to a current customer.** If you have one and that customer agreed to references, connect them. If you have none yet, say so honestly: "I'm in launch — you'd be one of the first three. That's why the price is what it is." Most respect the honesty.

## Reference
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §1.3 (Discovery Call Prep), §2.1–2.5 (Sales Conversation)
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §1.7, §1.8, §6a, §7a, §11b
- `docs/sales/SALES-OBJECTION-PLAYBOOK.md`
- `docs/business-intel/OFFER-APPROVED-COPY.md`
- `docs/operations/COLD-START-PLAYBOOK.md` §Script H

## Next
[18 — Closing](./18-closing.md) (open the moment they say yes)
