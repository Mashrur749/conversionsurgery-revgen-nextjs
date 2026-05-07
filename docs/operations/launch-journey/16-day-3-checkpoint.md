# 16 — Day 3 Checkpoint

## What this is
The end of the 3-day execution sprint. You verify six boxes are green, confirm the platform is sales-ready and outreach is in motion under a proper warming protocol, then transition to reactive mode. From here forward, files 17–26 open only when a real client lifecycle event triggers them — they are job-aids, not pre-reading.

## Before you start this
- [ ] Day 3 first send (file 13) is sent — 5 emails out (NOT 50 — see warming protocol)
- [ ] Your prospect list spreadsheet has every send logged
- [ ] You have read `docs/operations/COLD-START-PLAYBOOK.md` §Deliverability Discipline

## Time required
~15 minutes (verification only)

## What you'll do

### The 6 checkboxes

Tick each one. If any stays red, do not consider Day 3 done — go back and finish.

- [ ] **5 cold emails sent today.** Count rows in your spreadsheet where `sent_date` = today. Must equal 5 (NOT 50 — sender warming requires Week 1 = 5/day, ramping to 50/week in Week 2). If you sent more than 5 today, your sender account is now at risk; pause sending for the rest of the week and resume tomorrow at 5.
- [ ] **Warming schedule understood and committed to calendar.** You know that Week 1 = 5/day, Week 2 = 10/day, Week 3 = 15/day, Week 4+ = 30/day cap. Daily 30-min outreach block is on your calendar 9-11am weekdays.
- [ ] **Tracking spreadsheet up to date.** Every sent row has `variant`, `data_point_used`, and `sent_date` filled. Open + reply columns will fill in over 48–72h — that's fine.
- [ ] **Loom audit template recorded.** From file 10. Sharable URL works on a fresh incognito browser. You can drop it into a warm reply within 30 seconds. Reminder: the Loom URL goes ONLY in the second email (after warm reply), never in cold first email.
- [ ] **At least 1 staging Twilio number ready for Dead Lead Resurrection demos.** Test it: send a text to your own phone from the staging environment. The conversation agent should reply within 60s. If not, fix before the first warm reply lands.
- [ ] **First warm reply protocol (file 14) bookmarked for fast reach.** Browser bookmark or open tab. When a reply lands, you should be able to open file 14 in under 5 seconds.

### What you have at end of Day 3

After three days you should be in this state:

- **Sales-ready.** OFFER-APPROVED-COPY internalized (file 09). 4 Irresistibility Levers rehearsed. ROI calculator working. Audit template recorded. You can pitch the Pilot tier ($3,500 setup + $1,500/mo, 90-day minimum) in your sleep.
- **Outreach in motion under proper warming.** 5 emails out today. The Week 1 schedule (5/day × 5 weekdays = 25/week) is on your calendar. You'll hit the 50/week floor in Week 2 (10/day). Prospect list still has 30+ unsent qualified rows for the rest of Week 1.
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
- **Fewer than 5 emails sent today.** Acceptable if it's because you didn't have 5 strong data points — quality > volume during warming. Add data points to more rows tonight, send the missing ones tomorrow morning. Don't double up tomorrow to make up for today; that breaks the warming protocol.
- **More than 5 emails sent today.** This is a deliverability problem, not a volume win. Pause sending for the rest of this week. Resume Monday at 5/day. Track whether your sender reputation tanks — if it does, you may need to spin up a new account.
- **Loom or staging Twilio not actually working.** Fix it now. The first warm reply could land in the next 12 hours. You will not have time to debug then.
- **A2P stuck in carrier review past 5 business days.** Open a Twilio support ticket referencing your campaign ID. Most stuck cases resolve within 24h of the ticket.

## Reference
- `docs/operations/launch-journey/14-warm-reply-protocol.md` (the next file you'll open in anger)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §7.2 (Friday weekly review)
- `docs/operations/COLD-START-PLAYBOOK.md` §Email Outreach Floor

## Next
[17 — Discovery Call](./17-discovery-call.md) (open only when a discovery call is booked)
