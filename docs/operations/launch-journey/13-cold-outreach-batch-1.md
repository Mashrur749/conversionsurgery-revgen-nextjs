# 13 — First Send Day (Cold Outreach, Week 1 Warming)

## What this is
Your first 5 personalized cold emails. The Day 3 task. Yes, only 5 — not 25. This is Week 1 of a sender-account warming protocol. Send more than this from a brand-new account and your emails go straight to spam, where they will stay for weeks.

## Before you start this
- [ ] Your prospect list (file 11) has at least 30 qualified contractors with first name, business name, email, and one specific data point per row
- [ ] You have read `docs/operations/COLD-START-PLAYBOOK.md` §Deliverability Discipline (the 9 rules) — non-negotiable
- [ ] Your sender email account is the one you'll use for all cold outreach going forward (don't switch later — every account warms independently)
- [ ] Your audit Loom template (file 10) is recorded — but you will NOT include it in this first email

## Time required
~30 minutes (5 emails × 6 minutes each)

## What you'll do

### Why only 5 emails today

Your sender account is brand new to the carrier reputation algorithms. They have zero history on you. A brand-new account sending 25-50 cold emails on Day 1 is the textbook spammer pattern, and Gmail/Outlook will route every future email you send to spam — for weeks. There is no recovery worth the time; you'd spin up a new account and start over.

The warming protocol is non-negotiable:

| Week | Per-day max (weekdays) | Weekly total |
|---|---|---|
| Week 1 (this week) | 5 | 25 |
| Week 2 | 10 | 50 (you hit the floor) |
| Week 3 | 15 | 75 |
| Week 4+ | 30 | 150 (per-account ceiling) |

You will hit the 50/week outreach floor in Week 2, not Week 1. That is the honest pacing. Anyone selling you a way to skip warming is selling you a way to burn your sender reputation faster.

### The 9 deliverability rules (re-read before sending)

Full detail in `docs/operations/COLD-START-PLAYBOOK.md` §Deliverability Discipline. Summary:

1. **No links** on first cold email (no Loom, no website, no calendar)
2. **No attachments** on first cold email (no PDF, no flyer, no screenshot)
3. **Plain text** only, 3-5 sentences
4. **Personalize beyond first name** — one specific data point per email
5. **Ask for a reply, not a sale** (one-word "yes/no/send it" question)
6. **Subject line specific**, not "question" (which is now spam-tier)
7. **Warm new accounts slowly** (the table above)
8. **Spread sends across the day** (2-3 per hour, not all at once)
9. **No bulk platforms** (no Mailchimp, no Constant Contact, no MailerLite)

### Pick 5 prospects from your list

From file 11's prospect list, pick 5 rows where you have the strongest specific data point. Strongest = most concrete, most useful, most "they will recognize this is about them." Skip rows with weak/generic data points.

### Pick one of three email variants per prospect

Map to scripts in `docs/operations/COLD-START-PLAYBOOK.md` §The Scripts (Scripts A, C, D adapted for email):

- **Email A — Specific Finding.** Lead with one number. "I noticed [Business] has 12 Google reviews; [Competitor] has 84. I can tell you what that gap is likely costing in 60 seconds — worth a reply?"
- **Email B — Missed Call Hook.** Lead with the recovery angle. "I built a tool that texts back missed calls in seconds during permitted hours. Most renovators I talk to lose 3-4 jobs a year to leads that went cold on a job site. Want me to show you what mine sends back?"
- **Email C — Direct Pain Point.** Lead with the dead-quote question. "Quick question — when [Business] sends a quote and the homeowner goes quiet, what happens after that?"

NO Loom link. NO calendar link. NO attachments. The Loom is for the SECOND email, after they reply (file 14).

### Send timing

- Send between 9:00 AM and 11:00 AM their local time (Calgary/Edmonton MST/MDT).
- Spread across that 2-hour window. ~25-30 minutes between sends. Do not blast 5 in 5 minutes.
- Tuesday-Thursday is the sweet spot. Avoid Mondays before noon (cluttered inbox).

### Track every send

In your prospect list spreadsheet, fill these columns for each row:

- `sent_date` — today
- `variant` — A, B, or C
- `data_point_used` — one phrase ("12 vs 84 reviews vs Trico")
- `opened` — fill in tomorrow morning
- `replied` — fill in as replies arrive

### After the 5 emails

Stop. Do not send 5 more this afternoon. Tomorrow you send another 5. Wednesday another 5. Thursday 5. Friday 5. That is Week 1 done — 25 emails total.

## What success looks like
- [ ] 5 personalized cold emails sent to 5 different prospects
- [ ] Every email cites one specific data point about that prospect
- [ ] No links, no attachments, plain text only — verified before sending
- [ ] Subject line is specific (not "question")
- [ ] Spreadsheet `sent_date` and `variant` columns filled for all 5 rows
- [ ] You did NOT send more than 5 today

## If something goes wrong
- **You only have 3 strong data points.** Send 3 today. Spend the freed time adding data points to more rows for tomorrow. Quality > volume during warming.
- **You're tempted to send 25 anyway.** Don't. Read `docs/operations/COLD-START-PLAYBOOK.md` §Rule 7 again. Sender reputation tanks fast and recovers slow.
- **You included a link or attachment by reflex.** If you already sent, that account is now scored against you. Mark the spreadsheet row, send 4 more today instead of 5 (to compensate for the bad signal), and double-check before each send for the rest of the week.

## Reference
- `docs/operations/COLD-START-PLAYBOOK.md` §Deliverability Discipline (the 9 rules — read this first)
- `docs/operations/COLD-START-PLAYBOOK.md` §The Scripts (Scripts A, C, D)
- `docs/operations/launch-journey/11-loom-and-prospects.md` (your prospect list)

## Next
[14 — Warm Reply Protocol](./14-warm-reply-protocol.md) (open the moment a positive reply lands — could be tomorrow, could be next week)
