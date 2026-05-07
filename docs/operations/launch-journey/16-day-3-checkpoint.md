# 16 — Day 3 Checkpoint

## What this is
The end of the 3-day execution sprint. You verify five boxes are green, confirm the platform is sales-ready and outreach is in motion, then transition to reactive mode. From here forward, files 17–26 open only when a real client lifecycle event triggers them — they are job-aids, not pre-reading.

## Before you start this
- [ ] Batches 1 and 2 (files 13 and 15) are sent — 50 emails total
- [ ] Your prospect list spreadsheet has every send logged

## Time required
~15 minutes (verification only)

## What you'll do

### The 5 checkboxes

Tick each one. If any stays red, do not consider Day 3 done — go back and finish.

- [ ] **50 cold emails sent this week.** Count rows in your spreadsheet where `sent_date_batch_1` or `sent_date_batch_2` = today (or this week). Must equal 50.
- [ ] **Tracking spreadsheet up to date.** Every sent row has `variant`, `data_point_used`, and `sent_date_batch_X` filled. Open + reply columns will fill in over 48–72h — that's fine.
- [ ] **Loom audit template recorded.** From file 10. Sharable URL works on a fresh incognito browser. You can drop it into a reply within 30 seconds.
- [ ] **At least 1 staging Twilio number ready for Dead Lead Resurrection demos.** Test it: send a text to your own phone from the staging environment. The conversation agent should reply within 60s. If not, fix before the first warm reply lands.
- [ ] **First warm reply protocol (file 14) bookmarked for fast reach.** Browser bookmark or open tab. When a reply lands, you should be able to open file 14 in under 5 seconds.

### What you have at end of Day 3

After three days you should be in this state:

- **Sales-ready.** OFFER-APPROVED-COPY internalized (file 09). 4 Irresistibility Levers rehearsed. ROI calculator working. Audit template recorded. You can pitch the Pilot tier ($3,500 setup + $1,500/mo, 90-day minimum) in your sleep.
- **Outreach in motion.** 50 emails out this week. Reply data accumulating over the next 48–72h. Prospect list still has 30+ unsent qualified rows for next week.
- **Ready to handle warm replies.** File 14 protocol bookmarked. Staging Twilio ready for resurrection demos. Calendar booking links in your reply templates.

### What's NEXT — the reactive files

Files 17–26 are not sequential pre-reading. They open ONLY when the corresponding situation arises during real client lifecycle. Treat them like job-aids in a binder, not chapters in a book.

| File | Open when |
|------|-----------|
| 17 — Discovery Call           | A discovery call is on your calendar (today or tomorrow)            |
| 18 — Closing                  | Prospect on a discovery call says yes                               |
| 19 — Onboarding               | Service agreement signed, signing fee captured                      |
| 20 — Implementation           | Day 1 of any new client (covers Days 1–21)                          |
| 21 — Go-Live Gate             | Day 21 of any new client                                            |
| 22 — Day-14 Cancel Window     | Day 1 of any client (window closes Day 14)                          |
| 23 — 30-Day Logging Audit     | Day 30 of any client                                                |
| 24 — Pause Request            | Client asks to pause (post-Minimum-Term entitled, ad-hoc otherwise) |
| 25 — Cancel Request           | Client asks to cancel                                               |
| 26 — Quarterly Review         | Every 90 days you have an active client                             |

Do not open these files speculatively. The first time you open file 17 should be the first time you have a discovery call booked, not before.

### A2P final status check

Before you close Day 3:

1. Open Twilio Console → Messaging → A2P 10DLC.
2. Check brand and campaign status. If both show **Approved**, you're done — production phone numbers can be associated with the campaign as you provision them per client.
3. If still **Pending**, that's normal (1–5 business day window). The early sales conversations from Batches 1 and 2 don't require A2P — they're SMS to no one yet. But every paid client must be on an approved campaign before their first homeowner SMS goes out. When approval lands, associate the production Twilio number(s) you've already provisioned (file 05) with the campaign.
4. Set a calendar nudge for 48h from now to re-check if still pending.

### Stop here

Close the laptop. The sprint is done. Cold replies will land over the next 48–72 hours — file 14 is ready when they do.

## What success looks like
- [ ] All 5 boxes above ticked green
- [ ] You can name what file to open for any of these triggers without rereading: discovery call booked, contract signed, Day 21 of client, client wants to pause
- [ ] A2P status is either Approved (proceed) or Pending with calendar nudge set
- [ ] Calendar weekly review (Friday) is scheduled

## If something goes wrong
- **Fewer than 50 emails sent.** Send the gap tomorrow morning before 11 AM. Do not let the weekly floor slip in week 1 — it sets the cadence for every week after.
- **Loom or staging Twilio not actually working.** Fix it now. The first warm reply could land in the next 12 hours. You will not have time to debug then.
- **A2P stuck in carrier review past 5 business days.** Open a Twilio support ticket referencing your campaign ID. Most stuck cases resolve within 24h of the ticket.

## Reference
- `docs/operations/launch-journey/14-warm-reply-protocol.md` (the next file you'll open in anger)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §7.2 (Friday weekly review)
- `docs/operations/COLD-START-PLAYBOOK.md` §Email Outreach Floor

## Next
[17 — Discovery Call](./17-discovery-call.md) (open only when a discovery call is booked)
