# 01 — Mental Model

## What this is
The conceptual map of what you are about to deploy. Read this once before you touch any dashboard. Every later file assumes you have this mental model.

## Before you start this
- [ ] You have read [00 — Start Here](./00-START-HERE.md)

## Time required
~30 minutes (just reading)

## What you'll do

Read each section below. No actions, no dashboards. Just orientation.

### The platform in one paragraph

ConversionSurgery is a managed service that captures every lead a renovator misses, replies within 60 seconds via SMS, qualifies the homeowner through a structured AI conversation, and books the contractor an estimate. You sell the service. The platform does the lead handling. The contractor (your client) gets a portal showing the new estimates booked. You operate the system.

### The three external integrations

| Integration | Purpose | What breaks if it stops |
|-------------|---------|--------------------------|
| Stripe      | Money in (setup + monthly) | No new signups; existing clients keep running |
| Twilio      | SMS to homeowners + missed-call voice AI | Core product stops — no replies go out |
| Resend      | Magic-link login emails to clients + operator notifications | Clients cannot log in to portal |

If any of these are broken, the platform is broken. You will configure all three on Day 1.

### The two AI layers

1. **Conversation agent** — talks to homeowners over SMS. Built on Anthropic. Qualifies the lead, books the estimate, hands off to the contractor. Tracked end-to-end via the agent graph.
2. **Operator-facing tools** — Smart Assist (suggests replies), AI Preview (shows what the agent would send), audit generation, summary digests. These help you operate at scale.

You do not write AI prompts during launch. The prompts ship with the product. You only configure per-client knowledge (services, pricing rules, exclusions).

### The lifecycle of a single lead

1. Homeowner texts the contractor's Twilio number (or calls and the call is missed)
2. Platform receives webhook → conversation agent generates qualifying reply within 60s
3. Multi-turn conversation runs (services, timing, budget, address, name)
4. Agent books the estimate slot from the contractor's calendar (or hands off to operator if Smart Assist is on)
5. Conversation status closes as `won` / `lost` / `disqualified` with full transcript
6. Contractor sees the new estimate in their portal at `/client/leads`
7. Operator (you) sees aggregate health on `/admin/dashboard`

### The lifecycle of a single client (contractor)

1. **Sale** — discovery call, audit handoff, contract signed, signing fee charged
2. **Onboarding** (Days 0–7) — knowledge base built, Twilio number provisioned, calendar connected, AI rehearsed
3. **Day-14 cancel right** — client may cancel with one call. Max exposure: signing fee. Day 7+ signing fee non-refundable.
4. **Day-21 go-live** — operational guarantee: all systems live and answering homeowners
5. **Day-30 logging audit** — operational guarantee: 80%+ of leads logged correctly
6. **90-day Minimum Term** — contract floor before month-to-month
7. **Renewal / cancel / upgrade** — Pilot clients who renew flip to Standard pricing on the next billing cycle

Every client cancellation goes through `/admin/clients/[id]` cancel form, which writes a row to `client_cancellations` with reason category. No refund logic outside the contract.

### Your four operating surfaces

| Surface | URL | What it is for |
|---------|-----|-----------------|
| Admin dashboard | `/admin` (your deployed domain) | Triage, conversation review, client health, billing state |
| Client portal | `/client` (each contractor logs in here) | Their leads, calendar, billing — you DO NOT log in here as them; you see what they see |
| Stripe Dashboard | dashboard.stripe.com | Subscriptions, invoices, refunds, dispute response |
| Twilio Console | console.twilio.com | A2P state, phone number config, message logs, voice logs |

You will live in admin dashboard 80% of the time. Stripe + Twilio are checked weekly unless something breaks.

## What success looks like
- [ ] You can name the three external integrations and what each does
- [ ] You can describe a homeowner's path from inbound text to booked estimate without looking
- [ ] You can name the four operating surfaces

## If something goes wrong
This is a reading file. If a concept is unclear, do not improvise — open the referenced doc and skim until it clicks. If still unclear after 10 minutes, write the question down and ask before proceeding.

## Reference
- Platform capabilities: `docs/product/PLATFORM-CAPABILITIES.md`
- Operator guide overview: `docs/operations/00-OPERATOR-GUIDE.md`
- Use cases: `docs/operations/02-USE-CASES.md`

## Next
[02 — A2P First](./02-a2p-first.md)
