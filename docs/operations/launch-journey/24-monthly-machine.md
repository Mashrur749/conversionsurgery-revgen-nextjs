# 24 — Monthly Machine

## What this is
Reactive — once multiple clients are past Day 90 in steady-state delivery. This is the cadence the business runs on. Not a one-time setup; a recurring rhythm.

## Before you start this
- [ ] At least one client is past Day 90 in steady-state (delivery window — file 22 — has been completed at least once)
- [ ] You have read `docs/operations/E2E-OPERATOR-FLOW.md` §7.1 and §7.5
- [ ] You have read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §1.5 and §1.6

## Time required
Per week, all clients combined: ~6–10 hours total when the system is healthy. Daily 15–30 min, Weekly 1 hour, Monthly 2 hours, Quarterly 4–6 hours. Capacity self-check below.

## What you'll do

### Daily routine (15–30 min, batched 1–2× per day)

The same triage rhythm as the delivery window, applied across every active client:
- Queue: `/admin/conversations?filter=needs-attention` — handle any escalations
- Spot-check 3–5 AI replies across the portfolio
- Add KB entries for gaps surfaced today
- Review `/admin/system-health` once daily — green is the only acceptable state
- Reference: `docs/operations/E2E-OPERATOR-FLOW.md` §7.1

If your daily is consistently >30 min, you have either a client onboarding mid-window or a system issue. Investigate.

### Weekly routine — Friday review (~1 hour)

Block Friday 2–3 PM as the weekly review hour. Do these in order:

1. **Pipeline pulse per client.** Open the client list at `/admin/clients`. Per client: leads logged this week, replies, appointments, closed deals. Sanity-check trend lines.
2. **Outreach floor.** Did you send 50 cold messages this week? (50/wk minimum to keep the acquisition pipeline filled. See `docs/operations/COLD-START-PLAYBOOK.md`.) If not, schedule the catch-up Monday.
3. **At-risk health signals.** Per `02-MANAGED-SERVICE-PLAYBOOK.md` §1.5, flag any client with: declining lead volume, 0 appointments this week, ignored Friday Pulse, missed bi-weekly call. Email the at-risk contractor by Monday morning.
4. **Note for next week.** One sentence per client: "What I'm watching this week."

### Monthly routine (~2 hours, last business day of the month)

Done quarterly is too late, daily is too often.

1. **Template refinement.** Pull the top 10 AI replies and bottom 10 (by quality flag or operator override). Update prompts/KB if you see a pattern.
2. **KB optimization across clients.** Are similar KB entries duplicated across clients? Promote shared knowledge to a portfolio-level KB. Are unique KBs drifting from client truth? Refresh.
3. **Compliance audit.** Sample 20 random outbound messages from the past 30 days. Verify: sender ID present, STOP language present, consent record exists in `complianceConsent`. Document the audit run in your ops log. This is your CASL/CRTC defense if a complaint ever lands. The compliance audit log + consent records export to Cloudflare R2 weekly via `/api/cron/audit-log-export`. Logs retained 7 years with COMPLIANCE-mode object-lock. View export status at `/admin/system-health`.
4. **Billing reconciliation.** Verify Stripe charges match expected MRR per client. Investigate any failed payment.

### Quarterly routine — Growth Blitz (~4–6 hours)

Per `E2E-OPERATOR-FLOW.md` §7.5, every quarter you run a Quarterly Growth Blitz per client.

- **Q1 (winter):** "Get on the spring schedule" — pre-season basement bookings
- **Q2 (spring–early summer):** "Mid-year cancellation recovery" — fill cancelled summer slots
- **Q3 (late summer–fall):** "Lock in fall projects before snow" — finalize fall basement starts
- **Q4 (winter holiday):** "Plan your spring now" — early commitment incentive

Per client per quarter:
- Pick the seasonal hook
- Build the campaign in admin (template-driven — do not handcraft per-client)
- Get contractor approval on the message
- Schedule the send window (1–2 weeks of touches)
- Review results at end of campaign — feed wins into next quarter's templates

### Capacity self-check

The honest answer for a solo founder:
- **6–10 hrs/wk total** (across the whole portfolio): comfortable. System is working.
- **10–12 hrs/wk:** monitor. Either a client is in a high-touch phase (onboarding, retention call, blitz) or something is breaking. Diagnose.
- **12+ hrs/wk consistently:** structural. Pause new client acquisition. Either the ops are inefficient (file 25 may have an open thread) or the service mix is wrong (file 26 reflection due).

Do not keep selling when you are above 12 hours/wk. The next Pilot will be the one that breaks the system.

### What you do NOT do as the machine

- Do not invent new cadences. The four above are the system. Adding a "monthly NPS survey" or "weekly tip-of-the-week email" is scope creep on the operator's calendar.
- Do not skip the monthly compliance audit. It is the cheapest insurance you have.
- Do not let the Friday review become "look at the queue again." It is portfolio-level, not transactional.

## What success looks like
- [ ] Daily triage closed each weekday before EOD
- [ ] Friday review held weekly with one-sentence per-client note
- [ ] Monthly: 4 audits/refinements completed and logged
- [ ] Quarterly: each active client has one Growth Blitz run that quarter
- [ ] You are at 6–10 hrs/wk delivery, sustained

## If something goes wrong
- **Daily triage takes >30 min consistently.** A client is mid-issue or a system needs fixing. File 25.
- **You missed a Friday review.** Do it Monday morning. Don't double-up.
- **At-risk signal fires and you don't know how to address it.** Day 45 retention call (file 22) script generally applies — call them.

## Reference
- `docs/operations/E2E-OPERATOR-FLOW.md` §7.1 (daily ops), §7.5 (Quarterly Growth Blitz)
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §1.5 (at-risk signals), §1.6 (daily ops)
- `docs/operations/COLD-START-PLAYBOOK.md` (outreach floor)
- `docs/operations/launch-journey/22-delivery-window.md`
- `docs/operations/launch-journey/25-when-things-break.md`

## Next
[25 — When Things Break](./25-when-things-break.md)
