# 02 — A2P First

## What this is
You file A2P/10DLC registration with Twilio FIRST because carrier approval takes 1–5 business days. This is a background process. You file, then move on — do not wait.

## Before you start this
- [ ] You have a Twilio account with a payment method on file
- [ ] You have your business EIN / business number, legal address, and contact email handy
- [ ] You have a public-facing website URL (your contractor-facing landing page)

## Time required
~30 minutes filing + 1–5 days waiting (passive)

## Why A2P first

US/Canadian carriers filter A2P SMS traffic. Unregistered numbers get filtered or blocked. You register the brand once, register the campaign once, and every phone number you ever provision (current and future, all clients) inherits the campaign approval. This is the single longest-pole dependency in your launch — start the clock immediately.

## What you'll do

1. Open Twilio Console → **Trust Hub** → **Brand Registrations**.
2. Click **Register New Brand**. Fill in:
   - Legal business name
   - Business type (LLC / Sole Prop / Corporation)
   - EIN / business registration number
   - Registered business address
   - Contact email + phone
   - Public website URL
3. Pay the starter brand fee (~$4 USD).
4. Once the brand record exists, go to **Campaign Registrations** → **Create Campaign**.
5. Use case: **Customer Care** or **Mixed** (if Twilio asks for a single primary use case, pick Customer Care — your traffic is conversational replies to inbound homeowner leads, not marketing).
6. Provide sample messages — Twilio requires 2–4 representative outbound SMS examples. Pull from `docs/business-intel/OFFER-APPROVED-COPY.md` and `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md`. At minimum include:
   - The first auto-reply to an inbound homeowner lead
   - A booking confirmation
   - An after-hours acknowledgment
7. Specify opt-in mechanism: homeowner initiates the conversation by texting the contractor's published number (this is the standard "consumer-initiated" opt-in path).
8. Submit. Note the expected approval window Twilio shows you (usually 1–3 business days for Customer Care).

## Do not wait

After submission you proceed immediately to file 03. Do not check Twilio every hour. Do one thing: set a calendar reminder for 48 hours from now to check status.

## Once approved (might be Day 3–5)

When Twilio emails approval:

1. Go to **Phone Numbers** → **Active Numbers** in Twilio Console.
2. For every production phone number you have provisioned (or will provision), open the number config and associate it with the approved A2P campaign under **Messaging Service** (or directly on the number's Messaging settings).
3. From now on, every new contractor's phone number you buy gets associated with this same campaign during their onboarding.

## What success looks like
- [ ] Brand registration submitted (you have a brand SID)
- [ ] Campaign registration submitted (you have a campaign SID)
- [ ] You have noted the expected approval window
- [ ] Calendar reminder set for 48-hour status check
- [ ] You have moved to file 03 without waiting

## If something goes wrong

- **Brand rejected** — usually missing/mismatched EIN. Twilio's rejection email lists the field. Fix and resubmit.
- **Campaign rejected for sample messages** — the messages did not show clear opt-in or had marketing-style language. Replace with conversational customer-care examples from `OFFER-APPROVED-COPY.md`.
- **Carrier filtering after approval** — happens occasionally on T-Mobile. Twilio's support can escalate. This is post-launch problem; document and move on.

## Reference
- Master launch checklist: `docs/operations/LAUNCH-CHECKLIST.md` Phase 4.1 (External Services)
- Approved sample messages: `docs/business-intel/OFFER-APPROVED-COPY.md`
- Sales toolkit (basement): `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md`

## Next
[03 — Stripe Products](./03-stripe-products.md)
