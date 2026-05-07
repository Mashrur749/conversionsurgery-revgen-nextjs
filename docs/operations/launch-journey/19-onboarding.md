# 19 — Onboarding

## What this is
Reactive job-aid. Open this file after the client has signed and the signing fee is captured. Covers the priming SMS, the 30–45 min onboarding call, and the ~1 hour of operator work afterwards (KB seed, phone provisioning, Day-1 verification, old quote import). This is Day 0–1 of the implementation phase.

## Before you start this
- [ ] Service agreement signed (file 18)
- [ ] First 50% of setup ($1,750 / $2,750) captured in Stripe
- [ ] Subscription record active in `/admin/clients/[id]`
- [ ] Onboarding call is on your calendar
- [ ] You have read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §10 (full onboarding script)

## Time required
~30–45 min for the call + ~1 hour for the post-call setup work. Total: ~2 hours, all on the same day if possible.

## What you'll do

### Within 24 hours of signature — pre-onboarding priming SMS

Send the priming SMS within 24h of signature. The exact copy is in `docs/business-intel/OFFER-APPROVED-COPY.md` §12.3. The point: get them thinking about dead quotes BEFORE the onboarding call so the call doesn't burn time on remembering names.

Substance of the priming SMS:

> Hey [Name] — thanks for signing on. Quick prep for our onboarding call: think of 5 dead quotes from the last 90 days. Just first names, project type, and rough city. Example: "Sarah, kitchen reno, NW Calgary." Bring the list to the call. We'll run them through the system live.

Send via the `/admin/clients/[id]` messaging panel so it logs to their conversation thread. If you send from your personal phone you'll lose the audit trail.

### The onboarding call (30–45 min)

Follow the 7-beat script in `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §10. Do not freelance — the script is sequenced for a reason.

The 7 beats:

1. **Anchor in pain.** Re-state the dead-quote / missed-call gap they admitted on the discovery call. "Last time you said you send ~20 quotes a month and 12 go quiet. We're solving that." 5 min.
2. **Demo (live, not video).** Open their staging client in `/admin` and walk them through one resurrection conversation — their data, their quote names. 10 min.
3. **Payment capture confirmation.** Confirm they see the signing-fee charge on their card, confirm they understand the second 50% of setup is at Day 21 go-live, confirm the monthly recurring kicks in at go-live. 3 min.
4. **Exclusion list.** Ask: "Any homeowner numbers we should never text? Family, ex-clients, anyone you've explicitly told to leave you alone." Capture the list directly into `/admin/clients/[id]/knowledge` exclusions. 5 min.
5. **KB setup walk-through.** Open the KB wizard live, do the first 1–2 questions together so they understand the format. They'll finish the rest async. 10 min.
6. **Expectations set.** Walk through the timeline: Day 1–2 setup, Day 7 listing migration call, Day 21 go-live, Day 30 logging audit. State the operational guarantees out loud. 5 min.
7. **Day 7 commitment.** Confirm the Day 7 listing migration call is booked. This is not optional — it's where their Google Business Profile and call-forwarding go live. Put the time in their calendar before the call ends. 2 min.

### Post-call setup work (~1 hour)

Do this same-day if possible. Day 1 momentum matters.

#### 1. KB wizard (~20 min)

- Open `/admin/clients/[id]/knowledge` → **Guided Interview** tab.
- Walk through the 4-step wizard. Fill in what you got from the call. Where data is missing, mark fields and email the client a list of "5 things I still need from you to finish your KB."
- Save. The KB is what the AI uses to qualify leads — incomplete KB = bad responses.

#### 2. Phone provisioning (~15 min)

Cross-reference `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §4.5 for the full provisioning flow. Summary:

- Provision a Twilio number for this client in Twilio Console (or via the `/admin/clients/[id]/phone` flow if available).
- Configure SMS webhook + voice webhook to point at the production app's Twilio webhook endpoints.
- **Associate the new number with your approved A2P 10DLC campaign.** This is a hard requirement — without A2P association, outbound SMS to homeowners will fail. Open Twilio Console → Messaging → A2P 10DLC → Campaign → Add Phone Number. Do this before any homeowner SMS goes out.
- Save the new number to `/admin/clients/[id]` so the platform knows which number is theirs.

#### 3. Day-1 activation verification (~10 min)

Cross-reference `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §4.6. Run two quick smoke tests against the new number:

- **Inbound SMS test.** Text the new number from your phone with a test message ("test, looking for kitchen renovation"). The conversation agent should reply within 60s with a qualifying question. Confirm it shows up in `/admin/conversations`.
- **Missed-call test.** Call the new number, hang up after 2 rings. Within 60s your phone should receive a text-back from the platform. Confirm the call shows up in Twilio Voice logs and the conversation record exists.

If either test fails, fix before moving to old quote import. The system has to be answering on Day 1.

#### 4. Old quote import (~15 min)

Cross-reference `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §2 for the full Quote Reactivation deliverable.

- Get the client's last-90-days quote list (CSV: name, phone, email, project type, **inquiry_date**, quote value).
- **Capture `inquiry_date` for each lead** — the date the homeowner first reached out, not the date the contractor sent the quote. The platform's CSV importer requires this column on every row.
- **If any lead is >180 days old, switch to express-consent CSV mode and capture `express_consent_evidence` per lead** (e.g. "signed estimate request form on 2024-08-15"). Standard CSV mode rejects rows older than 6 months per CASL §10(1). Refer the contractor to `02-MANAGED-SERVICE-PLAYBOOK.md` §1.7 if older leads come up.
- Import via the CSV upload at `/admin/clients/[id]/leads/import` (or the API endpoint if no UI).
- Once imported, the leads enter the resurrection sequence per the rules in §2 — staged outbound starts on a delay so they don't all fire at once.
- Confirm the import log shows expected row count.

### A2P association reminder (final check)

Before you close the laptop on this client's Day 1: open Twilio Console → A2P 10DLC → your approved campaign → confirm the new number you just provisioned is listed under "Phone Numbers." If it's not, the SMS will fail silently when the resurrection sequence fires tomorrow morning. This is the #1 Day-1 failure mode — verify it now.

## What success looks like
- [ ] Priming SMS sent within 24h of signature, logged in conversation thread
- [ ] Onboarding call completed, all 7 beats covered, notes saved
- [ ] Day 7 listing migration call on the calendar
- [ ] KB wizard saved (Guided Interview tab) — gaps emailed to client if any
- [ ] Twilio number provisioned and webhooked
- [ ] Number associated with approved A2P campaign
- [ ] Inbound SMS smoke test passed (reply within 60s)
- [ ] Missed-call smoke test passed (text-back within 60s)
- [ ] Last-90-days quotes imported, count verified

## If something goes wrong
- **Client cancels the onboarding call last-minute.** Reschedule within 48h. The Day-21 clock starts at signature, not at onboarding — every day they delay onboarding is a day eaten from the implementation runway. Communicate this.
- **A2P campaign not yet approved.** You can provision the number and wire webhooks, but you cannot send outbound SMS. Pause the resurrection import until A2P clears. Log a calendar nudge to associate the number the moment the campaign is approved.
- **Smoke tests fail.** Do not import quotes. Debug the Twilio webhook config first — the most common failure is the SMS webhook URL pointing at staging instead of production, or a missing webhook signing secret.
- **Client refuses to send their old quote list.** Soft path: explain that without it, the resurrection demo (Lever 1) goes from week 1 to week 2 and they lose the highest-leverage early win. Most reconsider. If they still refuse, proceed without the import — the system still works on inbound from Day 21 forward.

## Reference
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §10 (Onboarding Call Script — 7 beats)
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §2 (Quote Reactivation — first-week deliverable)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §4.2 (Pre-onboarding priming), §4.4 (KB wizard), §4.5 (Phone provisioning), §4.6 (Day-1 activation)
- `docs/business-intel/OFFER-APPROVED-COPY.md` §12.3 (priming SMS copy)

## Next
[20 — Implementation](./20-implementation.md)
