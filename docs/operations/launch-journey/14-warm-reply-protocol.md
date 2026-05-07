# 14 — Warm Reply Protocol

## What this is
Reactive job-aid. What to do the moment a prospect replies positively to your cold outreach. Bookmark this file — when a warm reply lands, you reread this before you respond. The first hour after a positive reply is the highest-leverage hour in the entire client lifecycle.

## Before you start this
- [ ] You have sent at least one batch of cold outreach (file 13 or 15)
- [ ] You have a staging Twilio number ready to run the Dead Lead Resurrection demo (file 07 covered this; verify before you reply)
- [ ] You have your calendar booking link ready (Calendly, Cal.com, or just two specific time slots)

## Time required
Varies — used reactively. Plan 30 min for the first reply (initial response + scheduling) and 60–90 min for pre-call prep 24–48h before the call.

## What you'll do

### Trigger

A prospect replies positively to one of your cold emails. "Positive" means any of:

- They ask a question about the offer
- They ask for the demo number / Loom link
- They ask about price or scheduling
- They say "tell me more"
- They forward to a partner or business email and ask you to follow up

A "thanks but no thanks" or "remove me" is not warm. Mark `replied = no` on the spreadsheet and stop.

### Why the Loom comes NOW (not in the cold email)

This is the moment to send the Loom audit URL — not before. Two reasons:

1. **Sales sequencing.** A cold prospect doesn't watch a 5-minute video from a stranger. A warm prospect who just expressed interest does. The reply is the permission.
2. **Deliverability protection.** A link in a cold first email is the single most reliable spam trigger for a brand-new sender account. Once a conversation thread exists (their reply created it), the algorithm trusts the thread. Links inside an active thread are normal email behavior, not spam signals.

This is why file 13 explicitly forbade Loom links in the cold email — and why this file says "send the Loom now."

### Within 1 hour of the reply

Move fast. Reply rates drop sharply if you wait more than 60 minutes — they have moved on to their next job.

1. **Reply to schedule a 15-min discovery call.** Offer two specific time slots, not "what works for you." Example: "Tomorrow at 2:00 PM MST or Thursday at 10:00 AM MST — which works?" If neither works, send your booking link as a fallback. Keep the message under 60 words.
2. **Send the pre-call message asking for 5–10 dead quotes.** This is the Dead Lead Resurrection setup — Lever 1 of the Irresistibility Stack. The full protocol is in `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §1.7. The CASL-compliant ask sounds like:

   > Quick favor before our call so I can show you something concrete: send me 5–10 names + project type from quotes you sent in the last 90 days that went quiet. First name, project (e.g. "kitchen reno"), city. I'll show you what would happen if those leads went through the system. To be CASL-clean, please confirm in writing that you have authorization to share these contacts and that I can text these homeowners on your behalf for the demo. I'll only use them for the demo we run together.

3. **Save their written confirmation.** Screenshot or PDF the email/SMS where they say "yes, you have authorization." Store it in your CRM or prospect list under that prospect's row. This is your CASL paper trail. No confirmation, no demo — fall back to a generic Dead Lead Resurrection demo using your existing test data.

### Pre-call (24–48 hours before the discovery call)

This is where the demo gets built. The full Dead Lead Resurrection protocol lives in `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §1.7 — read it before every demo until it's muscle memory. The summary:

1. **Run their dead quotes through your staging Twilio number.** Use the staging client + AI mode set to Smart Assist or Autonomous on your test environment. Send the resurrection sequence to each homeowner number they gave you (only after their CASL confirmation is saved).
2. **Capture screenshots of every conversation thread.** Screenshot both the inbound homeowner replies and the outbound AI messages. Capture the timestamps. If a homeowner books an estimate or expresses interest, that screenshot is gold — they will see it on the call.
3. **Pick 1–2 strongest threads for the live walkthrough.** One thread that booked or showed strong interest. One thread that shows the AI handling an objection or stalled lead gracefully. Save the URLs to those conversations in `/admin/conversations/[id]` so you can pull them up live during the demo.
4. **Pre-fill the ROI calculator with their numbers.** From the discovery call (or pre-call email), you should have: estimates per month, average project value, % that go quiet. Have those numbers in the calculator before the call so you can show them annual revenue at risk in the first 5 minutes.

### On the discovery call

This file ends when the discovery call starts. The discovery call itself is file 17 — open that file before you start the call.

## What success looks like
- [ ] Reply to warm reply sent within 1 hour
- [ ] Discovery call scheduled (specific time, on calendar)
- [ ] CASL written confirmation saved for the dead quote list
- [ ] 5–10 dead quotes received from prospect
- [ ] Resurrection sequence run through staging Twilio, screenshots captured
- [ ] 1–2 strongest threads bookmarked for live walkthrough
- [ ] ROI calculator pre-filled with prospect's numbers

## If something goes wrong
- **Prospect won't send dead quotes.** Two paths: (a) offer to run the demo on a synthetic dataset that matches their service area + project type, or (b) ask for just 2–3 names instead of 5–10. Do not skip the demo — it is the entire point of the call.
- **CASL confirmation comes back unclear.** Reply once asking for explicit "yes, you have authorization to text these homeowners on my behalf for the demo." If still unclear, switch to the synthetic demo path. Never run live SMS to homeowners without written authorization.
- **Discovery call gets rescheduled twice.** Move them to a 7-day follow-up sequence (Script G in `docs/operations/COLD-START-PLAYBOOK.md`). If they reschedule a third time, archive — they are not ready.

## Reference
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §1.7 (Dead Lead Resurrection Pre-Sale Demo — full protocol)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §1.3 (Discovery Call Prep)
- `docs/operations/COLD-START-PLAYBOOK.md` §Script G (3-day follow-up if reschedule)

## Next
[15 — Cold Outreach Batch 2](./15-cold-outreach-batch-2.md)
