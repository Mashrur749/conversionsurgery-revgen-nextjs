# Operator Launch Action List — Pilot/Standard Sales-Ready

**Audience:** Operator (you).
**Purpose:** Single document of every action only YOU can take to make Pilot/Standard sellable. Claude cannot do these. They are external accounts, dashboard configs, real-world rehearsal, and outreach.
**Counsel review is NOT in this list** — explicitly deferred until cashflow starts.
**Estimated total time:** ~8-12 hours of operator work + 1-5 days A2P approval window.

---

## Why This List Exists

The platform code is ready. The docs are aligned. The offer is structured. The 4 Irresistibility Levers are committed. What's missing between today and your first paying client is **external account configuration** and **operator rehearsal** — work that lives in third-party dashboards or your own discipline, not in the codebase.

Work this list top to bottom. The first item runs in the background; start it before anything else.

---

## ACTION 1 — File A2P/10DLC Registration (START TODAY, runs 1-5 days in background)

**Why first:** Approval takes 1-5 business days. Everything else can run in parallel. If you don't start today, you push first paid client back a week.

**Where:** Twilio Console → Messaging → Trust Hub → Brand Registrations.

**Steps:**
1. Register your business brand. Need: EIN/business registration number, business address, contact info, website URL.
2. Create a Campaign Registration. Use case: "Customer Care" (recommended) or "Mixed". Sample messages required.
3. Submit. Note the expected approval window (usually 1-3 business days).
4. Once approved: associate your production phone number(s) with the approved campaign.

**Done when:** Twilio Console shows "Brand: Approved" + "Campaign: Approved" + at least one phone number associated.

**Estimated time:** 30 minutes filing + 1-5 days waiting + 10 minutes association.

---

## ACTION 2 — Create Stripe Test-Mode Products + 6 Prices

**Where:** Stripe Dashboard (test mode toggle ON).

**Steps:**

1. **Create 3 Products:**
   - `Revenue Recovery Pilot`
   - `Revenue Recovery Standard`
   - `Revenue Recovery Premium`

2. **Create 2 Prices per product (6 prices total):**

   | Tier | One-time setup price (50% of total) | Recurring monthly price |
   |---|---|---|
   | Pilot | $1,750 (50% of $3,500) | $1,500/mo |
   | Standard | $2,750 (50% of $5,500) | $2,000/mo |
   | Premium | $4,750 (50% of $9,500) | $3,500/mo |

3. **Copy 9 IDs** (3 product IDs + 6 price IDs). Save them in a temp note — you'll paste them into env vars next.

**Note on the 50% setup price:** Per the Day-14 cancel right + 50/50 split decision, the Stripe price for the "setup at signing" line item must be 50% of total setup, not 100%. The remaining 50% is invoiced manually at go-live (not auto-charged via this Price).

**Done when:** Stripe Dashboard shows 3 active products, each with 2 active prices, all in test mode.

**Estimated time:** 20-30 minutes.

---

## ACTION 3 — Set 9 Stripe Env Vars + Run Seed Script

**Where:** Local dev machine, `.env.local` file.

**Steps:**

1. Open `.env.local` (do not commit this file — it's gitignored).
2. Add the 9 vars from Action 2:
   ```
   STRIPE_PRODUCT_PILOT=prod_xxx
   STRIPE_PRICE_PILOT_MONTHLY=price_xxx
   STRIPE_PRICE_PILOT_SETUP=price_xxx
   STRIPE_PRODUCT_STANDARD=prod_xxx
   STRIPE_PRICE_STANDARD_MONTHLY=price_xxx
   STRIPE_PRICE_STANDARD_SETUP=price_xxx
   STRIPE_PRODUCT_PREMIUM=prod_xxx
   STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
   STRIPE_PRICE_PREMIUM_SETUP=price_xxx
   ```
3. Run: `pnpm tsx scripts/seed-plans.ts`
4. Verify in DB:
   ```sql
   select slug, stripe_product_id, stripe_price_id_monthly, stripe_price_id_setup
   from plans
   order by slug;
   ```

**Done when:** Three rows appear (pilot, standard, premium), each with non-empty Stripe IDs.

**Estimated time:** 10-15 minutes.

---

## ACTION 4 — Deploy App to Production With Real Domain

**Why:** Stripe Checkout, Twilio webhooks, and contractor portal links all need a real, SSL-enabled URL. Localhost won't work.

**Pick one:**

**Option A — Cloudflare Workers (`wrangler`):**
1. Run `pnpm exec wrangler login`.
2. Configure your real domain in `wrangler.toml` (replace placeholder `your-domain.com`).
3. Deploy: `pnpm exec wrangler deploy`.
4. Verify SSL active by hitting `https://yourdomain.com/login`.

**Option B — Vercel:**
1. Connect GitHub repo at vercel.com.
2. Set production env vars in Vercel dashboard (mirror `.env.local`).
3. Add custom domain (Settings → Domains).
4. Deploy.

**Either way:**
1. Update env var `NEXT_PUBLIC_APP_URL` to deployed URL.
2. Redeploy if you changed env vars.

**Done when:** `https://yourdomain.com/login`, `/signup`, and `/client-login` all return HTTP 200.

**Estimated time:** 30-60 minutes (Vercel faster, Wrangler if you prefer Cloudflare ecosystem).

---

## ACTION 5 — Configure Stripe Webhook (Live Mode After Test-Mode E2E Passes)

**Where:** Stripe Dashboard → Developers → Webhooks → Add endpoint.

**Steps:**

1. Endpoint URL: `https://yourdomain.com/api/webhooks/stripe`.
2. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `payment_method.attached`
3. Copy webhook signing secret (`whsec_...`).
4. Add to env: `STRIPE_WEBHOOK_SECRET=whsec_...`. Redeploy.

**Done when:** Stripe Dashboard shows webhook endpoint with green "Status: Enabled".

**Note:** Do test mode first (same setup, test webhook secret). Switch to Live mode only after Action 9 (E2E rehearsal) passes.

**Estimated time:** 15 minutes.

---

## ACTION 6 — Verify Resend Domain (SPF/DKIM)

**Where:** Resend Dashboard → Domains → Add Domain.

**Steps:**

1. Add the domain you'll send from (matches `EMAIL_FROM` env var).
2. Resend gives you 2-3 DNS records (SPF + DKIM, sometimes DMARC).
3. Add them to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.).
4. Wait 5-30 min for verification. Click "Verify" in Resend.

**Done when:** Resend Dashboard shows "Verified" green checkmark next to the domain.

**Estimated time:** 15-30 minutes (mostly DNS propagation wait).

---

## ACTION 7 — Provision Production Twilio Phone Number(s)

**Where:** Twilio Console → Phone Numbers → Buy a Number.

**Steps:**

1. Filter: Country = Canada, Locality = Calgary or Edmonton (403/780 area code).
2. Capabilities: SMS + Voice required.
3. Buy at least one number (~$1.20/mo).
4. Configure webhook on the number:
   - Voice: `https://yourdomain.com/api/webhooks/twilio/voice`
   - SMS: `https://yourdomain.com/api/webhooks/twilio/sms`
5. After Action 1 (A2P) approves: associate this number with your approved campaign.

**Done when:** Number appears in Twilio Console, webhooks configured, ideally A2P-associated.

**Estimated time:** 10-15 minutes (plus A2P association after approval).

---

## ACTION 8 — Set Operator Phone + Name at /admin/agency

**Where:** Deployed admin dashboard (after Action 4).

**Steps:**

1. Log in to `https://yourdomain.com/admin`.
2. Navigate to `/admin/agency`.
3. Set:
   - `operator_phone` — your real cell number (E.164 format, e.g., `+14035551234`)
   - `operator_name` — your name as it should appear in alerts and notifications

**Why:** All cron failure alerts, escalation SMS, payment failure notifications, and AI quality alerts route to this phone. If unset, alerts are dropped silently.

**Done when:** Settings saved; test by triggering any cron manually and confirming you receive an SMS.

**Estimated time:** 5 minutes.

---

## ACTION 9 — Run E2E Rehearsal End-to-End

**Why:** This catches every infra bug before a real client touches the system. Skip this and your first paying client will surface bugs you should have found yourself.

**Reference:** `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` Phases 1-7.

**Steps (high-level — full detail in the E2E guide):**

1. Pick a test contractor identity. Suggested: "Peak Basements YYC" — Calgary basement contractor, $1.5M revenue, 18 leads/month, $55K average project. Use a phone number you own.
2. Use the admin wizard (`/admin/clients/new/wizard`) to create the test client.
3. Generate a Pilot checkout link via the GenerateCheckoutLink component on the client detail page.
4. Pay with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
5. Verify: subscription created, client status = active, welcome email + welcome SMS received.
6. Walk Phases 4-5 (onboarding through Day 21 implementation) using yourself as the contractor.
7. Run all 16 production tests in Phase 6 — SMS, missed call, voice, estimate trigger, follow-up sequence, no-show recovery, review request, payment reminder, KB gap, compliance/quiet hours/STOP, Day-21 gate, Day-30 gate, bi-weekly report, weekly pulse.
8. Trigger a Day-14 cancel scenario manually — verify operator response script (Action 13 in this list, but also docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md once Claude updates it).

**Done when:** All 16 tests pass against the test contractor profile, every checkbox in Phase 10 sign-off checklist is green.

**Estimated time:** 4-6 hours spread across 1-2 days.

---

## ACTION 9.5 — Record Your Origin Story Video (60-90 seconds)

**Why:** Your origin story is your unfair advantage. Every marketing company who has ever called them was from Toronto or Vancouver or a call center. You're from Calgary. You built this because of a real contractor you know. That story is worth more than any feature list. Use it when the conversation gets real, and use it as a trust signal on your website/social profiles.

**Script (from `SALES-TOOLKIT-BASEMENT.md` Section 1 Notes):**

> "My buddy's dad runs a contracting business here in Calgary. Great guy, incredible work. But I watched him lose a $60K basement job last year because he was on a job site and missed the call. By the time he called back, the homeowner had already booked with someone else. That happened three more times that quarter. I built this system so that never happens again — not to him, not to any contractor in this city."

**Steps:**
1. Record on your phone or Loom. 60-90 seconds max.
2. Standing up, looking at the camera, not reading.
3. Post to: your website About section, LinkedIn profile, Instagram story, and send as a follow-up to prospects who say "I need to think about it."
4. Save as "Origin Story v1" — refine after your first 5 sales calls based on what resonates.

**Done when:** Video recorded, posted to at least one public profile, and you can recite the story without notes.

**Estimated time:** 30 minutes (15 min recording + 15 min posting).

---

## ACTION 10 — Set Up Loom Pro Account + Record First Audit Template

**Why:** Every warm prospect gets a personalized 3-7 minute Loom audit before the discovery call. The Loom is the lead magnet that opens the conversation. No Loom = no warm-prospect pipeline.

**Steps:**

1. Sign up for Loom Pro (~$15/mo). Free tier limits videos to 5 minutes — Pro is required for the audit format.
2. Pick one real Calgary contractor as the example. Public data only — Google Business Profile, website contact form, response time test.
3. Record a 5-minute Loom following the Phase 1.2 structure in the E2E guide:
   - Their business name + a specific finding ("you have 47 reviews, your top competitor has 214")
   - Walk their website → contact form → response gap
   - One-paragraph leak map
   - CTA: "Want me to show you what we'd do about this? 15 minutes."
4. Save as a personal reference template. Title it "Audit Template v1 — [Contractor Name]".

**Done when:** Loom account active, one full audit recorded and reviewable.

**Estimated time:** 60-90 minutes including the practice run.

---

## ACTION 11 — Refine Prospect List to 30+ Qualified Contacts

**Why:** Outreach floor is 50 emails/week (per EXECUTION-PLAN). You need a list to send to. The existing `docs/operations/templates/calgary-basement-prospects.csv` has 20+ contacts — needs growth and personalization data.

**Steps:**

1. Open `docs/operations/templates/calgary-basement-prospects.csv`.
2. Source new contacts per ICP-DEFINITION §"Where to Find Them":
   - Google Maps: "kitchen renovation Calgary", "basement development Calgary", "home renovation Edmonton"
   - BILD Calgary member directory (bild.ca)
   - HomeStars Calgary/Edmonton — renovation, kitchen, bathroom, basement filters
   - Instagram: #calgaryrenovation, #yyccontractor, #edmontonrenovation, #yegreno
   - Kijiji Calgary/Edmonton services
3. For each contact, fill columns: business name, owner name, phone, email, GBP rating, trade, pain angle (specific finding), personalization notes.
4. Target balance: 50% Kitchen/Bath, 30% Basement, 20% Whole-Home/Additions. Mirror sub-niche priority from ICP-DEFINITION.
5. Apply ICP gates — exclude solo handymen, sub-$1M, referral-only contractors, deck/fence.

**Done when:** 30+ rows with all columns populated.

**Estimated time:** 90 minutes for first pass, then ongoing throughout outreach.

---

## ACTION 12 — Rehearse Cold Scripts + 4 Irresistibility Levers Out Loud

**Why:** Reading scripts silently is not preparation. Buyers can hear when you're reading from a page. The first 3 mock calls feel awkward. By the 4th-5th, the language becomes natural.

**Reference docs:**
- `docs/operations/COLD-START-PLAYBOOK.md` Scripts A-F (cold call openers, demo close, follow-up)
- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §2.4.5 (Four Irresistibility Levers — Dead Lead Resurrection, Day-14 Cancel, 30-day Pause, Spouse Line)
- `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` Tier 1+2 objections

**Steps:**

1. Read every script aloud. Time yourself. The cold opener should hit 60 seconds.
2. Run one full mock discovery call with a friend or family member playing the contractor. Ask them to push back on price and ask "what proof do you have."
3. Iterate — record the call (audio only) on your phone. Listen back. Where do you stumble?
4. Rehearse the Four Irresistibility Levers in order: Dead Lead Resurrection setup → Day-14 Cancel → 30-day Pause → Spouse Line. They have to flow naturally before price.
5. Repeat until you can deliver the full sequence in under 10 minutes without referencing notes.

**Done when:** You can run a full mock discovery call, including objection handling, without looking at scripts.

**Estimated time:** 2-3 hours (the right kind of work).

---

## ACTION 13 — Send 50 Personalized Cold Emails (Week 1 Outreach Floor)

**Why:** Sales cycle is 30-45 days. Every day of delay = a day added to first revenue. The outreach floor is 50/week. If you're targeting the 4-month savings timeline, double it to 100/week.

**Important:** This action is NOT BLOCKED by A2P, Stripe, or deployment. Cold email uses email (not SMS), so you can start outreach today even before Actions 1-9 finish. The audit and discovery call don't require the contract or checkout to be ready — by the time someone replies and you book a call (3-5 days later), the rest will be done.

**Steps:**

1. Use scripts from `COLD-START-PLAYBOOK.md` (Email A — Specific Finding, Email B — Missed Call Hook, Email C — Direct Pain Point).
2. Personalize every send. One specific data point per email (their GBP review count vs competitor, response time finding, or specific pain angle from your prospect list).
3. Send in small batches (10-15 at a time) — avoid being flagged as spam.
4. Track in a single sheet: name, business, sent date, opened, replied, status.
5. Friday review: count emails sent, replies received, calls booked. Hold yourself to 50/week minimum.

**Done when:** 50 emails sent in the first 7 days. (Then sustain 50/week ongoing.)

**Estimated time:** 4-6 hours for first batch. Faster after templates are dialed.

---

## ACTION 14 — Build First 3 Dead Lead Resurrection Demos (When Warm Replies Come In)

**Why:** Lever 1 of the 4 Irresistibility Levers. When a prospect replies positively to outreach, they're warm. Before the discovery call, ask for 5-10 of their dead quotes from the past 90 days. Run those through your test environment. On the call, screen-share the actual SMS threads — replies, booked calls, delivery receipts. They watch their dead pipeline come back to life.

**Steps (per warm prospect):**

1. After they reply but before the discovery call: send a short message asking for 5-10 dead quotes (name, phone, project type, last contact date).
2. CASL compliance: ask the prospect to confirm in writing that these contacts had a prior business relationship and consent to follow-up. Save that confirmation.
3. Use your staging Twilio number to run a test reactivation sequence against those leads. Operator-controlled prompt set, NOT mass-message.
4. Capture screenshots of every conversation thread.
5. On the discovery call, screen-share the threads. Walk through 1-2 of the strongest ones live.

**If you have no warm prospects yet:** See `ACQUISITION-PLAYBOOK-0-TO-5.md` Phase 2 "What If You Have No Warm Prospects?" Run a simulated demo using test numbers you control, record the staging sequence, and use that recording on cold calls. It's weaker than real data but stronger than no demo.

**Note:** This is the single highest-leverage sales motion you have available pre-case-study. Per the consensus, it converts skeptics in under 15 minutes.

**Done when:** First 3 warm prospects have demos prepared before their discovery calls (or simulated demo recorded if no warm prospects yet).

**Estimated time:** 30-60 minutes per demo (mostly running the staging sequence and waiting for replies). 15 minutes for a simulated demo.

---

## When You're Done With Actions 1-14

You're ready to take a paying client. Once you close client #1:

1. Treat them as your case study factory. Day-75 video interview, Day-90 win story, written testimonial.
2. After client #2 lands, formalize the supplier referral channel (Olympia Tile, Emco — see Phase 7 of E2E guide).
3. After client #3 hits Day 90, revisit counsel review (per your deferred-counsel decision, this is when cashflow opens that door).

---

## Quick Reference — What Claude Is Doing in Parallel (You Don't Need to Track This)

While you work this list, Claude is handling all platform-side and doc-only tasks:
- Operator response scripts for Day-14 cancel and 30-day pause (added to MANAGED-SERVICE-PLAYBOOK)
- First Missed Lead Replay SMS trigger wired into the cron
- Friday Pulse SMS timezone verification
- Day-14 Cancel countdown UI in admin client detail
- Cancel-reason capture form
- E2E Phase 10 sign-off checklist updates

When Claude is done with the platform side and you're done with this list, the system is sales-ready end-to-end.

---

## Total Effort Summary

| Bucket | Time |
|---|---|
| Operator-only external configs (Actions 1-8) | ~3-4 hours active + 1-5 days A2P wait |
| E2E rehearsal (Action 9) | 4-6 hours over 1-2 days |
| Sales prep (Actions 9.5, 10-12, 14) | ~6-8 hours |
| Cold outreach (Action 13) | 4-6 hours/week ongoing |
| **Total to first sales-ready state** | **~12-17 hours over 5-7 days** |

The longest pole is A2P approval (1-5 days). Start it now, do everything else in parallel.
