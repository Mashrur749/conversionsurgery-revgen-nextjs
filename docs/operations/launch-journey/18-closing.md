# 18 — Closing

## What this is
Reactive job-aid. Open this the moment a prospect says yes on the discovery call. The next 30 minutes turn a verbal yes into a signed contract and a captured first payment. Speed matters — yeses cool fast.

## Before you start this
- [ ] Discovery call (file 17) ended with a verbal yes
- [ ] Tier confirmed (Pilot or Standard)
- [ ] You have the prospect's full legal business name, billing email, and contact phone

## Time required
~30 min from "yes" to "agreement sent." Stripe payment capture follows whenever they sign — usually same-day or next-day.

## What you'll do

### Step 1 — Prepare the agreement (10 min)

1. Open `docs/templates/SERVICE-AGREEMENT-TEMPLATE.md`.
2. Save a working copy as: `[Client Business] - Service Agreement - YYYY-MM-DD.md` in your local working folder. Use today's date.
3. Fill **every** `[bracketed]` field. Common fields: client legal name, billing email, signing date, contractor primary phone, business address, tier-specific pricing.
4. In §4 (the pricing table), pick the tier you quoted on the call — delete the rows for the tier you did NOT pick. Leave only Pilot OR Standard, never both.
5. Delete the operator note block at the top (the "instructions for the operator" comment block in the template). It should not appear in the document the client reads.
6. Re-read every section once. Confirm:
   - 90-day Minimum Term language is present
   - Day-14 Cancel right is present (max exposure $1,750 Pilot / $2,750 Standard)
   - 30-day Pause right (post-Minimum-Term) is present
   - 21-day go-live + 30-day logging operational guarantees are present
   - Setup is split 50/50, with second half due at Day 21 go-live
   - Day-7 setup non-refundable trigger is present

### Step 2 — Export to PDF (3 min)

Markdown is for you, PDF is for them. Export options:

- **Google Docs.** Paste markdown into a Doc, format headings, File → Download → PDF. Works in 2 minutes.
- **A markdown-to-PDF tool.** `pandoc`, `md-to-pdf`, or any web tool. Render with default styles — the agreement does not need design polish.
- **Print to PDF from VS Code preview.** Open the markdown, command palette → "Print" → save as PDF.

Filename for the export: `[Client Business] - Service Agreement - YYYY-MM-DD.pdf`.

### Step 3 — Send via e-signature (5 min)

Pick one delivery method and stick to it across all clients:

- **DocuSign / HelloSign / PandaDoc.** Upload the PDF, drop signature + date fields, send to their billing email. Their inbox has a one-click sign experience. This is the cleanest path.
- **PDF email + reply-to-confirm.** If you don't have e-signature set up yet: email the PDF with a clear ask — "Reply 'I agree to the terms in the attached service agreement' from this email and I'll treat that as your signature." Less polished, but legally workable for v1 launches. Save their reply.

Email subject: `Service Agreement — [Client Business]`. Email body: 3–4 sentences max. "Per our call, attached is the service agreement at the [Pilot/Standard] tier we discussed. Sign and reply, and I'll send the payment link for the signing fee — $1,750 [or $2,750]. Once that clears, we book the onboarding call. Any questions, call me."

### Step 4 — Set the Day-7 reminder (1 min)

Open your calendar. Create a 7-day-from-signature reminder titled `[Client] — Day-7 setup non-refundable trigger`. This is the date the first 50% of setup ($1,750 / $2,750) becomes non-refundable. You don't take any action on Day 7 — but you need to know which clients have crossed the threshold if a Day-14 cancel comes in (max-exposure math changes).

### Step 5 — After signature lands

The client signs and returns the agreement. Now capture payment.

1. **Open `/admin/clients/[id]`.** If they don't exist as a client record yet, create them via the new-client flow first (name, email, phone, business name, tier).
2. **Use the `GenerateCheckoutLink` component on that page.** Generate a Pilot (or Standard) checkout URL for the signing fee — first 50% of setup. The component handles tier-aware pricing and creates a Stripe Checkout Session pre-filled with the right amount.
3. **Use `SendPaymentLink` to deliver via SMS + email** (one-click). The component sends both channels with templated copy. SMS is the higher-conversion delivery — they tend to pay from their phone within 30 minutes.
4. **Verify payment in Stripe Dashboard.** Open dashboard.stripe.com → Payments. Filter by customer email. Confirm the charge succeeded and the customer record exists.
5. **Confirm subscription + welcome flow fired.** Back in `/admin/clients/[id]`:
   - The subscription should show as `active` (or `trialing` if you set up a trial — most don't)
   - The welcome email + SMS should have fired automatically. If not, check `/admin/messages` for delivery logs.

### Step 6 — Schedule onboarding call

Reply to their signed-agreement email or text them directly: "Payment cleared — let's book the onboarding call. 45 minutes. Two slots: [day] at [time] or [day] at [time]." Use file 19 to prep for that call.

### Common gotchas

- **Pilot cap hit but contractor wants Pilot.** They cannot have Pilot pricing if you already have 3 active Pilots. Operator handling: `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §11b. Either reissue at Standard or put them on the Pilot waitlist (which means a 90-day delay). Get the call before you generate the agreement.
- **Wrong legal entity name.** Some contractors operate under a numbered company while branding under a trade name. Get the legal name on the agreement (the one Stripe will pull from). The trade name appears in the Description field.
- **Spouse / partner is a co-decision-maker.** Get both on the call before sending the agreement, or you'll see a 24h delay while they consult. Don't send the agreement to one of two decision-makers — wait until both have heard the pitch.
- **They want to redline.** Pilot/Standard agreements are not negotiable in v1. State this calmly: "The terms are the same for every contractor at this tier — that's how I'm able to keep the price what it is. If something is a deal-breaker for you, tell me and I'll explain why it's there." Most concerns dissolve when you explain the why.

## What success looks like
- [ ] Agreement sent within 30 min of verbal yes
- [ ] Day-7 calendar reminder set
- [ ] Signed agreement received and saved
- [ ] Stripe checkout link generated, sent via SMS + email
- [ ] First 50% of setup ($1,750 / $2,750) captured in Stripe
- [ ] Subscription record exists in `/admin/clients/[id]`, status active
- [ ] Welcome email + SMS confirmed delivered
- [ ] Onboarding call booked

## If something goes wrong
- **Stripe checkout link won't generate.** Check Stripe Live mode is enabled, prices are seeded (file 06), and the env vars from file 03 are populated in production. If the GenerateCheckoutLink component errors, the most common cause is a missing tier-specific Stripe price ID env var.
- **Payment fails.** Stripe will email you and the customer. Most common: insufficient funds or 3DS challenge. Re-send the link with a quick "looks like the first try didn't go through — try this one" message. Do not switch to a different payment processor — keep Stripe as the single source of truth.
- **Client signs but ghosts on payment.** Send one follow-up at 24h. If still no payment after 48h, the agreement is not in force — the contract is contingent on signing-fee receipt. Re-send the link with a soft nudge. After 72h with no payment, the deal is cold. Do not move to onboarding without the signing fee.

## Reference
- `docs/templates/SERVICE-AGREEMENT-TEMPLATE.md`
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §3.1–3.5 (Payment & Contract)
- `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` §11b (Pilot tier handling when cap is hit)

## Next
[19 — Onboarding](./19-onboarding.md) (open after payment clears and onboarding call is booked)
