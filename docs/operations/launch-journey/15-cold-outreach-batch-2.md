# 15 — Week 1 Daily Continuation + Week 2 Ramp

## What this is
The discipline file for Days 4-10. Day 3 (file 13) sent your first 5 emails. Now you sustain 5/day for the rest of Week 1, then ramp to 10/day in Week 2 (when you hit the 50/week floor), then 15/day in Week 3, then 30/day cap from Week 4 onward. This file replaces what would have been "Day 3 Batch 2" — there is no afternoon batch, because warming protocol forbids it.

## Before you start this
- [ ] Day 3 (file 13) sent — 5 emails out, spreadsheet logged
- [ ] You read `docs/operations/COLD-START-PLAYBOOK.md` §Deliverability Discipline §Rule 7 (warming) and accept the pacing
- [ ] You set a daily 30-min calendar block for cold outreach, weekday mornings, 9-11am

## Time required
~30 min/day in Week 1, ~60 min/day in Week 2, ~90 min/day in Week 3, ~3 hours/day at Week 4+ cap

## What you'll do

### The honest pacing

Repeat after me: warming is not optional. The 50/week outreach floor is a Week 2 milestone, not a Day 3 milestone.

| When | Per-day | Weekly total | Cumulative total |
|---|---|---|---|
| Day 3 (file 13) | 5 | 5 (Day 3 only) | 5 |
| Days 4-7 (rest of Week 1) | 5 | 25 | 25 |
| Week 2 | 10 | 50 (floor hit) | 75 |
| Week 3 | 15 | 75 | 150 |
| Week 4+ | 30 | 150 (per-account cap) | rolling |

If you have data points for fewer prospects than your daily cap, send what you have. Skip rows without strong personalization. Quality > volume during warming.

### Daily routine (Week 1, Days 4-7)

Same protocol as Day 3 (file 13). Five emails, one spreadsheet row each, full personalization, no links, no attachments, plain text, 9-11am their local time.

By end of Friday Week 1: 25 emails sent, sender account has 5 days of clean signal, ready to step up.

### Daily routine (Week 2)

Step up to 10/day. Same rules. Two batches of 5, spaced an hour apart in the 9-11am window — or 10 sends spread evenly across that window with 12-15 minutes between sends.

You will hit the 50/week floor by Friday Week 2. From the data perspective, this is also when reply patterns become statistically meaningful — you can start refining subject lines and opener variants by what's actually opening + replying.

### Daily routine (Week 3)

Step up to 15/day. Same rules. Now you're sending across a wider window — 9-11am for the first 10, then 1-2pm for the additional 5. Still spaced. Still personalized. Still no copy-paste.

### Daily routine (Week 4+)

You're now at full sustainable cap: 30/day weekdays, 150/week per account. This is the steady state.

If you want more volume than 150/week, see `docs/operations/COLD-START-PLAYBOOK.md` §Multi-Account Strategy. For solo founders launching this business, **150/week is plenty for the first 90 days** — you'll have your first 3-5 warm replies by Week 3, your first discovery call by Week 4, your first close by Week 6-8.

### Refine as you learn

Once Week 2 reply data starts landing, do a weekly mini-review:

1. **Subject line opens.** Which subject lines hit >40% open rate? Use those for the next week.
2. **Personalization angle.** Which data points (review-count, missed-call, dead-quote) are pulling the most replies? Weight that variant heavier.
3. **Time-of-day.** Track open times. Adjust your send window based on when your prospects actually open.

Do not over-engineer this. 10 minutes of reflection per week is enough.

### Track every send (same as Day 3)

For each row, fill: `sent_date`, `variant`, `data_point_used`, `opened`, `replied`. The spreadsheet is your reply pipeline + your deliverability dashboard combined.

### Friday review ritual

Every Friday afternoon, do the operator weekly routine described in `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §7.2:

- Compute reply / open / discovery-call-booked rates from this week
- Decide next week's volume (hold per warming schedule, accelerate only if account has clean signal)
- Top up the prospect list — never start a Monday with fewer than 30 unsent qualified rows
- Reread `docs/operations/COLD-START-PLAYBOOK.md` §Deliverability Discipline if anything felt sloppy this week

This is the only thing that produces clients in month 1. Friday review is what keeps the pipeline alive.

## What success looks like
- [ ] By end of Week 1: 25 emails sent (5/day × 5 days)
- [ ] By end of Week 2: 50 cumulative this week (10/day × 5 days) — outreach floor hit
- [ ] By end of Week 3: 75 cumulative this week (15/day × 5 days)
- [ ] By Week 4+: 150/week at the per-account cap, sustained
- [ ] Friday review on calendar as recurring weekly event
- [ ] Spreadsheet updated for every send (no untracked sends)

## If something goes wrong
- **You're tempted to skip warming and send 25 today.** Don't. Re-read `docs/operations/COLD-START-PLAYBOOK.md` §Rule 7.
- **Your reply rate is zero through Week 1.** Normal. Most replies land 24-72h after send, and Week 1 is only 25 emails. Wait for Week 2 data before adjusting variants.
- **Your account got flagged anyway.** Check Gmail's "Postmaster Tools" if your sending domain has more than ~200 sends/week — it shows reputation. If reputation is "Bad" or "Low", pause sending for 5 business days, then resume at half pace.
- **Reply pipeline fills before you finish warming.** Pause cold sends, run file 14 protocol on warm replies, resume cold sends only when discovery-call calendar has slots open.

## Reference
- `docs/operations/COLD-START-PLAYBOOK.md` §Deliverability Discipline (the 9 rules + warming protocol)
- `docs/operations/COLD-START-PLAYBOOK.md` §The Scripts, §Email Outreach Floor
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §7.2 (Operator Weekly Routine — Friday review)
- `docs/operations/launch-journey/13-cold-outreach-batch-1.md`

## Next
[16 — Day 3 Checkpoint](./16-day-3-checkpoint.md)
