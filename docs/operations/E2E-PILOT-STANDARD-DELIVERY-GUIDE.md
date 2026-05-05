# E2E Pilot & Standard Delivery Guide

Version 1.0 — May 4, 2026
Audience: Operator (founder + later, an account manager)
Status: Live runbook. Update when delivery patterns change.

---

## Purpose

This is two documents in one:

1. **A rehearsal script** — walk through it once with yourself, a friend, or a willing test contractor before you sell client #1. Every section can be executed against a real (test-mode) Stripe + Twilio + Anthropic stack, end to end, in roughly one weekend.
2. **A real delivery runbook** — once you sell a real client, work this guide top to bottom. Every test in Phase 6 is a thing the contractor will eventually do; the test is just you doing it first.

The product is the same for Pilot ($3,500 setup + $1,500/mo, first 3 clients only) and Standard ($5,500 setup + $2,000/mo, client 4+). The differences are pricing, seat counts, advanced analytics, and operational depth — see Phase 9.

**Source of truth:** Where this guide and another doc disagree, the more recent doc wins. Specific authoritative sources:
- Pricing/terms: `docs/business-intel/Revenue_Recovery_System_Business_Reference.md` §12, `docs/business-intel/OFFER-APPROVED-COPY.md` §4
- Sales scripts: `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md`, `docs/operations/COLD-START-PLAYBOOK.md`
- Daily ops: `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md`
- Feature tests: `docs/engineering/01-TESTING-GUIDE.md`
- Pre-launch infra: `docs/operations/LAUNCH-CHECKLIST.md`

---

## Prerequisites Before You Start

Walk this checklist before doing anything in Phase 1. If anything below is unchecked, stop here and finish `docs/operations/LAUNCH-CHECKLIST.md` Phase 4 first.

- [ ] **A2P/10DLC registered** — Twilio Console → Trust Hub → brand registration approved, campaign approved, production phone numbers associated. See `LAUNCH-CHECKLIST.md` Phase 4.1, "A2P / 10DLC Registration".
- [ ] **Stripe products + prices created** — three tiers (Pilot, Standard, Premium), each with one-time setup price + recurring monthly price. Six prices total per environment (test + live).
- [ ] **Plan rows seeded** — `pnpm tsx scripts/seed-plans.ts` ran cleanly. Verify in DB that `plans` has rows for slugs `pilot`, `standard`, `premium` with correct Stripe Price IDs.
- [ ] **Env vars set** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `VOICE_WS_URL`. See `docs/engineering/ENVIRONMENT-SETUP.md`.
- [ ] **Twilio number provisioned** — at least one real Alberta (403/780) number for production smoke tests. SMS + Voice webhooks point at production URL.
- [ ] **Resend domain verified** — `EMAIL_FROM` domain has SPF/DKIM verified in Resend.
- [ ] **Anthropic API key working** — `pnpm test` passes (312 deterministic tests, no real LLM calls); `pnpm run test:ai` passes safety tests (real LLM calls).
- [ ] **Operator phone + name** set at `/admin/agency`.
- [ ] **Service agreement template** filled with your business name + email. Have counsel review the [PENDING COUNSEL REVIEW] sections before client #1. See `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md`.
- [ ] **Test contractor identity ready** — pick a name, business name, owner email (one you can read), and a real cell phone number you control. You will play this contractor through Phases 1-7. Suggested test profile: "Peak Basements YYC" — Calgary basement contractor, $1.5M revenue, 18 leads/month, $55K average project. Use this when the wizard asks for ICP qualification numbers.

---

## Phase 1: Pre-Sale Preparation (Day 0)

Goal: produce one personalized leak audit and walk into a sales call with a specific data point, not a generic pitch.

### 1.1 Prospect Research

Use `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`. Allow 15-20 min per prospect using only public data:

1. Pull their Google Business Profile review count + most recent review date.
2. Pull top 3 competitors' review counts from Google Maps.
3. Submit their website contact form from a throwaway email — log response time.
4. Call their business number after 6 PM — log whether anyone answered, voicemail behavior, callback time.
5. Run their estimated numbers through the ROI calculator: `POST /api/public/roi-calculator` or `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md`.

For the rehearsal: pick three real Calgary basement contractors and produce three real audits. By the third you should be at 15 min flat. These become your first three real outreach targets.

### 1.2 Loom Audit Recording

Record a 3-7 minute Loom for each warm reply or high-fit prospect. Structure:
1. Their business name + a specific finding ("you have 47 reviews, your top competitor has 214")
2. Walk their website → contact form → response gap
3. One-paragraph leak map
4. CTA: "Want me to show you what we'd do about this? 15 minutes."

Do not pitch the system in the Loom. Pitch the audit only.

### 1.3 Discovery Call Prep

Before any discovery call:
- Have the audit one-pager open on your screen
- Have the ROI calculator open in a tab
- Have `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` open as a reference (do NOT memorize — just keep it findable)
- Confirm Pilot tier availability: count active Pilot clients in `/admin/clients` filtered by plan = pilot. If you already have 3 Pilot clients active, this prospect is Standard ($5,500 + $2,000) — no exceptions.

---

## Phase 2: Sales Conversation (Day 1-7)

### 2.1 Opening — Discovery Call Script

Use the cold call opener from `COLD-START-PLAYBOOK.md` Script C. When you have audit data:

> "Hey [Name] — I noticed [Business Name] has [X] Google reviews while [Competitor] has [Y]. I can tell you what that gap is likely costing you. 60 seconds?"

If no audit data, use the missed-call hook:

> "Hey [Name], this is [Your Name] — I'll be super quick, 60 seconds. I built a tool that texts back missed calls in 5 seconds — every missed call, automatically. I'm not pitching you today. Can I send you our demo number right now? You call it, hang up, and your phone buzzes in 5 seconds."

### 2.2 Discovery Questions

The 10-question scorecard from `Revenue_Recovery_System_Business_Reference.md` §17.6 / §18. Ask all 10. Take notes verbatim — they become your KB during onboarding.

1. How many inbound inquiries do you get in a typical month?
2. How many estimates do you send in a typical month?
3. What's your average project value?
4. What happens after an estimate is sent and the homeowner doesn't reply?
5. Who owns follow-up today?
6. How many open estimates are sitting stale right now?
7. What CRM or tracking do you use?
8. How fast do new inquiries get a response after hours or during busy periods?
9. How do you know which sources turn into booked consults or signed jobs?
10. If one additional project was recovered this quarter, what would it be worth?

**Pass threshold:** 7 of 10 from the qualification scorecard (§4.2 of the Business Reference). If they fail, do not sell — refer them to the Estimate Recovery Audit only.

### 2.3 Tier Recommendation Logic

Hard rules. No exceptions.

| Condition | Recommended tier |
|-----------|------------------|
| You have fewer than 3 active Pilot clients (count at `/admin/clients`) | **Pilot** — $3,500 setup + $1,500/mo, 90-day minimum |
| You already have 3 Pilot clients active | **Standard** — $5,500 setup + $2,000/mo, 90-day minimum |
| Multi-estimator + paid ads + $5M+ revenue + wants attribution | **Standard first**, Premium only after one Standard case study exists (see OFFER-APPROVED-COPY §4 internal note) |

Pilot is enforced in code: `scripts/seed-plans.ts` sets `maxActiveClients: 3` on the Pilot plan. Once 3 clients are bound to it, the platform should not allow a fourth Pilot subscription. If a prospect wants Pilot pricing and the cap is hit, the answer is no — see Phase 8.7.

### 2.4 Common Objections & Responses

Open `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` and pre-read these 7 (Tier 1 + 2 most common). Do not memorize the scripts; know which objection number maps to which fear.

| Their words | Map to | Core move |
|-------------|--------|-----------|
| "What if the AI says something wrong?" | Objection 1 | Smart Assist demo, sample conversation |
| "I tried something like this before, got burned" | Objection 2 | Listen first, then operational guarantee, then 90-day term |
| "I get my work from referrals" | Objection 3 | Pivot to estimate follow-up + reviews + payment reminders |
| "I already respond fast" | Objection 4 | Reframe to gaps (job site, after-hours, follow-up depth) |
| "Setup fee plus monthly feels like double charging" | Objection 8 + 11 | Separate the two, ROI math live |
| "Can I just buy software?" | Objection 12 | Managed service vs. DIY |
| "What if I cancel after 90 days?" | Objection 13 | 90-day term + 30 days notice + full export |

**Always state the operational guarantee before quoting price** (Playbook intro): "21-day go-live, 30-day logging gate, billing pauses automatically if we miss either."

### 2.5 Closing the Deal — Demo Close Script

From `COLD-START-PLAYBOOK.md` Script F (Demo Call), close (5 min):

> "Here's what I propose: [Pilot — $3,500 setup, $1,500 a month / Standard — $5,500 setup, $2,000 a month], 90-day minimum. Setup fee is split — half today, half at go-live. I handle all the setup. System is live within 21 days or we keep working at no charge until it is. If you recover one job, it pays for itself many times over.
>
> Can I get you set up this week?"

If they say yes, immediately move to Phase 3 — do not let the conversation drift.

### 2.6 Sending the Service Agreement

1. Open `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md`. Save a copy as `[Client Business Name] - Service Agreement - YYYY-MM-DD.md`.
2. Fill every `[bracketed]` field. Pick the tier in Section 4 and delete the unselected rows.
3. Delete the operator note block at the top.
4. Export to PDF (any markdown-to-PDF tool, or paste into Google Docs and "Download as PDF").
5. Send via DocuSign / HelloSign / PandaDoc for digital signature, OR send as PDF email attachment with a reply-to-confirm clause.
6. Put a calendar reminder for **Day 7 from signing** to flag setup as non-refundable (Phase 3.5).

**Verbal confirmation is not enough** — get a signed PDF or e-signature before generating the checkout link.

---

## Phase 3: Payment & Contract (Day 7-10)

### 3.1 Generate Checkout Link (admin UI)

After signature is in hand:

1. Open `/admin/clients` — click "+ New Client" → run the wizard at `/admin/clients/new/wizard`.
2. Steps in `src/app/(dashboard)/admin/clients/new/wizard/setup-wizard.tsx`:
   - Step 1: Business info (name, owner, email, phone, timezone, GBP URL, ICP qualification: lead volume + project value + dead quote count)
   - Step 2: AI Business Line — provision or assign Twilio number
   - Step 3: Team members
   - Step 4: Business hours
   - Step 5: Review & launch
3. After client is created, open `/admin/clients/[id]`. The detail page (`src/app/(dashboard)/admin/clients/[id]/page.tsx`) renders two billing components:
   - **`<GenerateCheckoutLink />`** at `src/app/(dashboard)/admin/clients/[id]/generate-checkout-link.tsx` — calls `POST /api/admin/clients/[id]/checkout-link`. Generates a Stripe Checkout URL you copy and paste manually.
   - **`<SendPaymentLink />`** at `src/app/(dashboard)/admin/clients/[id]/send-payment-link.tsx` — generates and SMS/emails the link to the contractor in one click.
4. Pick the tier (Pilot or Standard). The Pilot option must hide once 3 active Pilot clients exist; if it doesn't, treat that as a bug and force-pick Standard manually.

### 3.2 Send Payment Link to Client

Use **Send Payment Link** (one click → contractor receives SMS + email). Stay on the line if you're on a sales call. Confirm receipt verbally.

The link covers the **first 50% of the setup fee only**. Per the payment structure in OFFER-APPROVED-COPY §4 / §5 and SERVICE-AGREEMENT-TEMPLATE §4:
- Pilot: $1,750 setup half charged at signing. Remaining $1,750 setup invoiced at go-live. Monthly $1,500 subscription activated at go-live (Day 21 max).
- Standard: $2,750 setup half charged at signing. Remaining $2,750 setup invoiced at go-live. Monthly $2,000 subscription activated at go-live.

**Stripe price configuration requirement:** the &ldquo;setup at signing&rdquo; Stripe price must equal 50% of the total setup fee (not the full setup). Verify your Stripe Dashboard prices match this structure before sending a real client a payment link. The 90-day minimum term clock starts at signing.

### 3.3 Verify Payment Received in Stripe

1. Stripe Dashboard → Payments → look for the charge under the contractor's customer record.
2. Confirm: setup payment captured + subscription created.
3. Webhook fired: `checkout.session.completed` + `customer.subscription.created`. Check Stripe → Developers → Webhooks → recent deliveries. Both should be 200 OK.

### 3.4 Verify Subscription Created in Platform

Open `/admin/clients/[id]`:

- [ ] Client status = `active`
- [ ] `stripeCustomerId` populated (visible in client detail or DB)
- [ ] `stripeSubscriptionId` populated
- [ ] Plan correctly assigned (`pilot` or `standard` slug)
- [ ] Settings → Billing in contractor portal shows tier name + next billing date
- [ ] Welcome email + welcome SMS fired (check Resend logs + Twilio logs)

### 3.5 Day-7 Non-Refundable Trigger

Per OFFER-APPROVED-COPY §5 and Service Agreement §4: setup fee becomes non-refundable 7 calendar days after signing.

There is no platform UI for this today. Operator process:

1. On the signature date, add a calendar reminder for Day 7.
2. On Day 7, open the client detail page and add an internal note: "Setup non-refundable as of [date] per Service Agreement §4."
3. If the contractor requests a refund between Day 0 and Day 7, honor it. Stripe Dashboard → Payments → refund.
4. After Day 7, refunds for the setup fee are denied per the agreement (monthly retainer auto-pause is the operational remedy — see Phase 8).

---

## Phase 4: Onboarding (Day 1-7 of contract)

### 4.1 Welcome Email & SMS

Both fire automatically on `checkout.session.completed`. Verify:
- Email contains: tier name, next billing date, link to client portal, operator name, operator phone
- SMS contains: short welcome + onboarding call booking link or instructions

### 4.2 Pre-Onboarding Priming SMS

A cron (`/api/cron/onboarding-priming`) sends an automated SMS to the contractor 24-48 hours before the scheduled onboarding call:

> "One thing before our call — think of 5 people you quoted in the last 6 months that never got back to you. Just first names + project type. We'll text them all on the call."

Verify it fired: `/admin/clients/[id]` → Conversations or scheduled messages.

### 4.3 30-Minute Onboarding Call

Run `02-MANAGED-SERVICE-PLAYBOOK.md` §10 (Onboarding Call Script, 30-45 min). Seven beats:

1. Min 0-3: Anchor in their pain — the leak you found in audit
2. Min 3-8: Live missed-call demo + Voice AI demo (the wow moment)
3. Min 8-12: Payment capture if not already collected — second half of setup at go-live
4. Min 12-15: Exclusion list ("anyone we should skip — family, friends?") + old quotes
5. Min 15-25: KB + services setup (closed questions, mandatory pricing range)
6. Min 25-30: Expectations + Day 7 listing migration booking
7. Pre-commit Day 7 listing migration call before hanging up

### 4.4 KB Wizard (4-step questionnaire)

After the onboarding call, complete the KB at `/admin/clients/[id]` → Knowledge Base → Guided Interview tab. Required for the 80% logging gate to make sense:

- At least 1 service with a numeric pricing range (e.g., "Drain cleaning: $150-$400")
- Service area defined
- Warranty stated
- Scope exclusions ("we don't do X, Y")
- Trade-specific FAQ (8-15 entries)

For basement contractors, preload from `docs/operations/templates/BASEMENT-KB-PRESET.md` (21 preset entries; customize the 5 REQUIRED ones).

### 4.5 Phone Number Provisioning

Per OFFER-APPROVED-COPY §2 ("Day-One Activation"): the dedicated business number is live within 24 business hours.

1. In the wizard Step 2 (Phone Number), pick or buy a Twilio number in the contractor's local area code.
2. Verify SMS + Voice webhooks point at production endpoints.
3. Send one test SMS from your own phone to the new number — confirm AI responds within 10s.
4. Place one test call — confirm Voice AI answers OR missed-call text-back fires within 5s.

### 4.6 Day-1 Activation Verification

- [ ] Business number active and receiving traffic
- [ ] Missed call text-back: call from your real phone, let it ring, receive text within 5s
- [ ] Call-your-own-number proof: contractor calls their NEW business number from spouse's/your phone, hears Voice AI greeting
- [ ] Conditional forwarding (`*61*[Twilio]*11*20#`) configured on contractor's existing business cell, per Playbook §10
- [ ] Carrier voicemail disabled (`##004#` on Rogers/Telus/Bell, or call carrier) — single biggest setup failure
- [ ] Exclusion list reviewed and "Mark as Reviewed" clicked (this is one-way, required for autonomous mode)

### 4.7 Pre-Onboarding Quote Import

On the onboarding call OR the Day 2-3 Quote Import Call:

1. Contractor reads dead quote names + project type + last contact date verbally.
2. You type into a CSV with columns: `name,phone,email,status,notes` — set `status=estimate_sent` for everyone.
3. Open `/admin/clients/[id]` → Leads → Import → upload CSV → check the CASL consent confirmation box.
4. Verify follow-up sequences are auto-scheduled (4 touches over 14 days). Check `/admin/clients/[id]` → Scheduled.
5. Post-import text to contractor: "Just sent follow-ups to [N] of your old quotes. You'll start seeing replies within 24-48 hours."

This is the single highest-ROI deliverable in Week 1.

---

## Phase 5: Implementation (Day 1-21)

The 21-day implementation schedule from `Revenue_Recovery_System_Business_Reference.md` §14.1. Map each day range to a concrete checklist item — do not skip days even if "everything is working" because the goal is also to build the operator's muscle memory.

### 5.1 Day 1-2 Tasks
- [ ] Onboarding call complete (Phase 4.3)
- [ ] KB seeded (Phase 4.4)
- [ ] Phone number provisioned + forwarded (Phase 4.5)
- [ ] Day-1 activation verified (Phase 4.6)
- [ ] Old quote import complete (Phase 4.7)
- [ ] Lead source map drafted in client notes (where do their inbound leads come from today?)

### 5.2 Day 3-5 Tasks
- [ ] Phone/form/intake mapped — every inbound channel routes to the platform
- [ ] Web form webhook configured if applicable (`/api/webhooks/forms` or platform-specific)
- [ ] Messaging templates approved by contractor (read them out loud on the Day 7 check-in)
- [ ] Smart Assist mode confirmed enabled for Week 2 (operator reviews every draft)

### 5.3 Day 6-8 Tasks
- [ ] Missed-call response live and tested
- [ ] New inquiry response flow live and tested
- [ ] Day 7 listing migration call held — Google Business Profile updated to point at new number, plus HomeStars / Houzz / Yelp where applicable
- [ ] Exit document (Playbook Appendix) handed to contractor

### 5.4 Day 9-12 Tasks
- [ ] Estimate trigger verified (test `EST [name]` SMS command — see Phase 6.5)
- [ ] 4-touch estimate follow-up sequence templates approved by contractor
- [ ] Stale estimate reactivation batch run (the imported old quotes from Day 1-2)
- [ ] First reactivation replies (if any) escalated to contractor

### 5.5 Day 13-15 Tasks
- [ ] Pipeline stages confirmed visible in dashboard
- [ ] Escalation rules configured (price objection, decision-maker absent, complex permit question)
- [ ] First bi-weekly Pipeline Pulse SMS sent (Monday morning, automated)

### 5.6 Day 16-18 Tasks
- [ ] Bi-weekly performance scoreboard report drafted, reviewed by operator
- [ ] Owner/admin views configured (team member roles right, notifications routed correctly)
- [ ] Reporting cadence confirmed with contractor (every 2 weeks unless they request monthly)

### 5.7 Day 19-20 QA Testing

Run all 16 tests in Phase 6 below against this client. Real test contractor; real test data.

### 5.8 Day 21 Go-Live Review

- [ ] AI mode advanced to Autonomous (was Smart Assist for Week 2)
- [ ] Guarantee Status card on `/admin/clients/[id]` Overview tab shows go-live gate **passed**
- [ ] Staff walkthrough call: 15 min, demonstrate the 4 SMS commands + Daily Digest reply syntax
- [ ] **Second half of setup fee charged** (the $1,750 / $2,750 remaining setup half) — this is operator-triggered in Stripe today; create an invoice for the remaining setup amount and send to the contractor
- [ ] First monthly retainer charge fires automatically per the subscription
- [ ] Welcome-to-week-4 SMS: "System is now fully autonomous. I'll check in every 2 weeks. Anything urgent — text me directly."

---

## Phase 6: Production Testing — End-to-End

Run all 16 tests against the test contractor profile **before you sell client #1**. After that, run any test individually whenever you want to verify a specific automation. Many of these reuse step-by-step procedures from `docs/engineering/01-TESTING-GUIDE.md` — cited inline. Do not duplicate that work; cross-reference and add only what's specific to delivery context.

For each test:
- **Setup**: prerequisites
- **Action**: the exact thing you do
- **Expected**: what should happen
- **Verify in admin**: where to confirm

### 6.1 Test 1: Inbound SMS → AI Response

Reference: `01-TESTING-GUIDE.md` Step A.2 + LAUNCH-CHECKLIST Phase 2 Step 2 (8-turn conversation).

**Setup**: Test client created, KB seeded, AI mode = Autonomous.
**Action**: From Dev Phone #2, text the Business Line: "Hi, looking to finish my basement, ~800 sqft, what would something like that cost?"
**Expected**: AI replies within 10 seconds with a relevant, KB-grounded answer.
**Verify**: `/admin/clients/[id]` → Conversations → thread visible with both messages. Lead created in Leads tab.
- [ ] Pass

### 6.2 Test 2: Missed Call → Text-Back

Reference: `01-TESTING-GUIDE.md` Step A.3.

**Setup**: Same.
**Action**: Call the Business Line from Dev Phone #2. Let it ring through to Voice AI / hang up.
**Expected**: Within 5 seconds, Dev Phone #2 receives "Sorry we missed your call..." text.
**Verify**: New conversation appears in Client View → Conversations.
- [ ] Pass

### 6.3 Test 3: Web Form Submission → AI Response

**Setup**: Web form webhook configured.
**Action**: Submit the contractor's website form with test data (use a number you own).
**Expected**: AI responds within 10 seconds (or queues for 10 AM next day if outside permitted hours and inbound-reply exemption is not enabled).
**Verify**: Lead created with source = `web_form`. Conversation logged.
- [ ] Pass

### 6.4 Test 4: Voice AI Inbound Call

Reference: `01-TESTING-GUIDE.md` Phase D + LAUNCH-CHECKLIST Phase 2 Step 4.

**Setup**: `ELEVENLABS_API_KEY` set, Voice AI enabled at `/admin/voice-ai`.
**Action**: Call Business Line. Let it ring to Voice AI. Say: "I'm looking at finishing my basement, about 1,000 sqft." Wait for response. Then say: "I want to talk to someone."
**Expected**: ElevenLabs voice greeting, KB-grounded reply, transfer attempt on the second ask.
**Verify**: Transcript + AI summary appear on client detail page after call.
- [ ] Pass

### 6.5 Test 5: Estimate Trigger (3 paths)

Reference: `01-TESTING-GUIDE.md` Step 8 + Step 58b.

**Action paths** (test all three):
1. **EST keyword**: Contractor (Dev Phone #3) texts `EST Sarah` to the Business Line.
2. **Dashboard click**: `/admin/clients/[id]` → Overview → "Leads Needing Follow-up" card → "Start Follow-up" on Sarah's lead.
3. **Auto-detect**: `/api/cron/appointment-followup` runs (curl with `Authorization: Bearer $CRON_SECRET`). For appointments completed 4+ days ago, lead status auto-flips to `estimate_sent`.

**Expected**: Lead status = `estimate_sent`. Follow-up messages scheduled for Day 2/5/10/14.
**Verify**: Client View → Scheduled — 4 outbound messages queued.
- [ ] EST keyword pass
- [ ] Dashboard click pass
- [ ] Auto-detect pass

### 6.6 Test 6: 4-Touch Estimate Follow-up Sequence

**Setup**: Lead in `estimate_sent`, 4 messages queued.
**Action**: Use admin time-travel or trigger `/api/cron/process-scheduled` repeatedly to fast-forward. Or wait the actual 14 days if you have patience.
**Expected**: Each touch sends at the right interval, copy escalates appropriately, messages identify the business, STOP handler is included.
**Verify**: Each scheduled message moves to "sent" status. Conversation thread shows all 4 outbound touches.
- [ ] Pass

### 6.7 Test 7: Stale Estimate Reactivation

Reference: `01-TESTING-GUIDE.md` Step 27c (win-back picks up imported estimates).

**Setup**: 5 leads imported via CSV with `status=estimate_sent` and a `lastContact` date 60+ days ago.
**Action**: Trigger `/api/cron/win-back`.
**Expected**: Reactivation message sent to all 5. Replies, if any, create new active conversations.
**Verify**: Scheduled queue cleared. Sent messages visible.
- [ ] Pass

### 6.8 Test 8: Appointment Booking + Reminder + No-Show Recovery

Reference: `01-TESTING-GUIDE.md` Step 24 + Step 56e (Calendar push).

**Setup**: Google Calendar connected (`/client/settings/calendar` OAuth complete) OR booking confirmation mode enabled.
**Action**:
1. Trigger AI to book an appointment via SMS conversation (mention "Thursday at 6pm works").
2. Verify appointment created in platform AND Google Calendar.
3. Wait for / trigger appointment reminder cron.
4. Mark appointment as `no_show` after the time passes.
5. Trigger `/api/cron/no-show-recovery`.

**Expected**: Reminder fires day-of. No-show recovery sends "We missed you, want to rebook?" same day.
**Verify**: Appointment status, reminder + recovery messages in Conversations.
- [ ] Pass

### 6.9 Test 9: Review Request After Job Completion

Reference: `01-TESTING-GUIDE.md` Step 23.

**Setup**: Lead in status `won`. Job marked completed.
**Action**: Mark lead as `completed` (admin or via Mark Job Complete in contractor portal).
**Expected**: Review request scheduled for next day at 10 AM, with direct Google review link.
**Verify**: Scheduled queue. Send fires; conversation logged.
- [ ] Pass

### 6.10 Test 10: Payment Reminder Flow

Reference: `01-TESTING-GUIDE.md` Step 22.

**Setup**: Lead with `depositRequested` or `invoiceDue` flag. (Add-on, only for clients who bought Payment Reminders.)
**Action**: Trigger `/api/cron/billing-reminder` OR set up the deposit/invoice in admin.
**Expected**: Reminder SMS with one-click payment link sent to lead.
**Verify**: Sent message in Conversations. Payment link points at Stripe.
- [ ] Pass (or N/A if add-on not purchased)

### 6.11 Test 11: Knowledge Base Gap Detection

**Setup**: KB sparse on a specific topic (e.g., permits).
**Action**: Send: "Do you handle the permits and inspections, or do we need to arrange?"
**Expected**: AI responds: "Great question — let me have [contractor name] follow up on that directly." Gap is logged.
**Verify**: `/admin/clients/[id]` → Knowledge Base → Gap Queue tab — new gap entry. Daily digest SMS to contractor includes this gap with a free-text reply prompt.
- [ ] Pass

### 6.12 Test 12: Compliance — Quiet Hours, STOP, Opt-Out

Reference: `01-TESTING-GUIDE.md` Step 9 + LAUNCH-CHECKLIST Phase 2 Step 3 + Step 10.

**Action**:
1. Set client timezone so current local time is in quiet hours (9 PM-10 AM).
2. Inbound SMS from Dev Phone #2 → verify reply is **immediate** (inbound-reply exemption per FM-38).
3. Trigger a proactive automation (e.g., estimate follow-up) → verify message is **queued** for 10 AM, not sent immediately.
4. Text `STOP` from Dev Phone #2 → verify confirmation, lead status = `opted_out`, all scheduled messages cancelled.
5. Text `START` from same number → verify re-subscribed.

**Expected**: All four behaviors as described.
**Verify**: Conversation timestamps, lead status, scheduled queue.
- [ ] Inbound-reply during quiet hours pass
- [ ] Proactive queued during quiet hours pass
- [ ] STOP honored pass
- [ ] START re-subscribe pass

### 6.13 Test 13: Day-21 Go-Live Gate

Reference: `02-MANAGED-SERVICE-PLAYBOOK.md` §5 Layer 1.

**Setup**: Test client on Day 21 (or fast-forward client `createdAt`).
**Action**: Trigger `/api/cron/guarantee-21day`.
**Expected**: If forwarding active + AI in at least Smart Assist + ≥1 outbound sent → gate passes (no-op). If not → billing pauses, operator alerted.
**Verify**: `/admin/clients/[id]` → Overview → Guarantee Status card shows phase + result.
- [ ] Pass case verified
- [ ] Fail case verified (use a deliberately broken test client)

### 6.14 Test 14: Day-30 Logging Gate

Reference: `02-MANAGED-SERVICE-PLAYBOOK.md` §5 Layer 2.

**Setup**: Test client on Day 30. At least 7 inquiries logged in trailing 30 days (otherwise low-volume exception applies).
**Action**: Trigger `/api/cron/guarantee-30day`.
**Expected**: If ≥80% of eligible inquiries logged with source/status/follow-up → pass. If below 80% AND ≥7 inquiries → auto-pause billing until threshold restored for full 7-day period.
**Verify**: Guarantee Status card. Subscription status in Stripe Dashboard. Operator alert SMS.
- [ ] Pass case verified
- [ ] Fail case verified
- [ ] Low-volume exception verified (test client with <7 inquiries — gate deferred)

### 6.15 Test 15: Bi-Weekly Performance Report Delivery

Reference: `01-TESTING-GUIDE.md` Step 11 + LAUNCH-CHECKLIST A.18.

**Setup**: Client at 14+ days old.
**Action**: Trigger `/api/cron/biweekly-reports` and `/api/cron/report-delivery-retries`.
**Expected**: Email delivered with metrics (leads, response time, estimates followed up, appointments, pipeline value, "leads at risk"). Follow-up SMS to contractor.
**Verify**: Resend logs (email sent, opened?). Twilio logs (SMS). `/client/reports` shows the report in contractor portal.
- [ ] Pass

### 6.16 Test 16: Weekly Pipeline Pulse SMS (Monday Morning)

Reference: `01-TESTING-GUIDE.md` Step 58a + LAUNCH-CHECKLIST A.18.

**Setup**: Client active 7+ days, `weeklyDigestEnabled = true`.
**Action**: Trigger `/api/cron/weekly-digest` (or `/api/cron/probable-wins-nudge`).
**Expected**: SMS to contractor: "Hey [Name], your week: [N] new leads, [N] appointments booked, $[X] probable pipeline, [N] need your attention." If zero activity, either skip or send the quiet/reassurance variant.
**Verify**: Twilio logs. Activity matches dashboard.
- [ ] Pass
- [ ] Zero-activity case verified (skip OR variant)

---

## Phase 7: Day-to-Day Operations

### 7.1 Operator Daily Routine (15-30 min)

Reference: `02-MANAGED-SERVICE-PLAYBOOK.md` §1.6 (Operator Cockpit).

Run every morning before any other work. Per client takes 5-10 min once routine is muscle memory.

- [ ] **Triage** — open `/admin/triage`. Note any client flagged red (4+ of 6 signals yellow/red). Act today.
- [ ] **Escalations** — open `/escalations` (cross-client). Resolve hot leads the AI couldn't handle. Per-client view at `/admin/clients/[id]` → Escalations.
- [ ] **AI Quality** — open `/admin/ai-quality` (Clients → AI Flagged Responses). Review flagged messages, dismiss false positives, fix KB gaps for legitimate flags.
- [ ] **KB Gap Queue** — for each active client: `/admin/clients/[id]` → Knowledge Base → Gap Queue. Fill any gaps where the contractor hasn't responded via daily digest reply.
- [ ] **Smart Assist Drafts** (Week 1-2 clients only) — `/admin/clients/[id]` → Campaigns → Pending Drafts card. Approve or edit-then-approve every draft within the SLA window.
- [ ] **Operator alerts** — check phone for SMS alerts the platform sent overnight (payment failure, escalation SLA, AI quality, guarantee). Each is deduped to 1/hour. If you got one, something real happened.

### 7.2 Operator Weekly Routine (Friday review)

- [ ] **Pipeline pulse** for each client — read the auto-generated Monday SMS (or open `/admin/clients/[id]/call-prep`). Cross-check against dashboard. Note clients trending down for next bi-weekly call.
- [ ] **Outreach floor** — count cold emails sent this week. Floor is **50/week**; accelerated savings target is **100/week**. See `COLD-START-PLAYBOOK.md` for math.
- [ ] **Health signals** — re-run triage; compare to last Friday. Anyone slipping from green → yellow?
- [ ] **Backlog of bi-weekly calls** — schedule any due in next 7 days. Saturday morning slots tend to work for contractor schedules.

### 7.3 Operator Bi-Weekly Routine (Strategy Call)

Reference: `02-MANAGED-SERVICE-PLAYBOOK.md` §4.

**Pre-call (10 min)**:
1. Open `/admin/clients/[id]/call-prep` — pre-loaded metrics for trailing 14 days
2. Cross-check the bi-weekly report at `/admin/reports`
3. Check leads in `contacted` or `estimate_sent` with appointments >7 days old — these are your "did you close this?" questions
4. Check guarantee status card if Day 80+

**On the call (30 min)**:
- 0-5: Revenue capture — walk every lead, enter WON/LOST as they answer
- 5-15: Report walkthrough
- 15-20: Action items (EST adoption, KB gaps to fill, team setup, calendar)
- 20-25: Business challenges ("anything going on I should know about?")
- 25-30: Next steps + close with a specific dollar number

**Post-call (5 min)**: Enter WON/LOST captured. Fill KB entries from discussion. Update team config.

### 7.4 Operator Monthly Routine

- [ ] **Performance scoreboard** — generate aggregate report across all clients
- [ ] **Template refinement** — review which estimate follow-up templates are getting replies, which aren't
- [ ] **KB optimization** — top 5 KB gaps across the portfolio → fix patterns
- [ ] **Compliance audit** — sample 20 random outbound messages, confirm sender ID + STOP language present
- [ ] **A2P/10DLC throughput check** — Twilio Console, watch for filtering or campaign issues

### 7.5 Quarterly Routine

Reference: `01-TESTING-GUIDE.md` Step 12 + OFFER-APPROVED-COPY §2 (Quarterly Growth Blitz).

- [ ] **Quarterly Growth Blitz selection** for each client (Q1: dormant reactivation, Q2: review acceleration, Q3: pipeline builder, Q4: year-end review + 30-min strategy call)
- [ ] Trigger `/api/cron/quarterly-campaign-planner` — verify alerts fire to operator
- [ ] Run the campaign in admin, message templates approved by contractor first
- [ ] Q4 specifically: schedule the 30-minute strategy call for each client; align next year's expectations + tier upgrade conversations

---

## Phase 8: Edge Cases & Recovery

### 8.1 What If Client Doesn't Pay Setup Second Half (at Day 21 go-live)?

1. Stripe sends `invoice.payment_failed` webhook → operator gets SMS alert.
2. Pause client status to `paused` at `/admin/clients/[id]` → Edit. This blocks all outbound automation per the compliance gateway.
3. Text contractor directly: "Hey [Name], the second setup payment didn't go through. Need to update the card?"
4. Give 5 business days. If still unpaid, send formal email referencing Service Agreement §4.
5. After 14 days unpaid, terminate per breach clause and run cancellation flow (Phase 8.4).

### 8.2 What If Go-Live Slips Past Day 21?

Per OFFER-APPROVED-COPY §3 and Service Agreement §6 Layer 1: monthly billing pauses, work continues at no charge until live.

1. `/api/cron/guarantee-21day` triggers auto-pause.
2. Operator receives alert SMS.
3. Diagnose root cause (most common: contractor didn't disable carrier voicemail; KB sparse; phone forwarding misconfigured).
4. Notify the contractor proactively — do not wait for them to ask.
5. Fix root cause. Resume billing only after verified live (forwarding active + AI in at least Smart Assist + ≥1 outbound sent).
6. Setup fee is **not** refunded under this guarantee (Layer 1 explicit terms). Only the monthly retainer is paused.

### 8.3 What If Logging Falls Below 80%?

Per OFFER-APPROVED-COPY §3 and Service Agreement §6 Layer 2: monthly billing pauses automatically until threshold restored for full 7-day period.

1. `/api/cron/guarantee-30day` evaluates daily after Day 30.
2. If <80% of inquiries logged with source/status/follow-up activity in trailing 30 days → auto-pause subscription via Stripe API.
3. **Low-volume exception**: if contractor received <7 inquiries in 30 days, gate is deferred. Do not penalize for slow market.
4. Diagnose: usually means inbound webhook is broken, or the AI isn't engaging because KB is too sparse.
5. Restore. Logging must hit 80% for a full 7-day window before billing resumes.

### 8.4 What If Client Wants to Cancel Within 90 Days?

Per Service Agreement §5: client may not cancel during the 90-day Minimum Term **except** as provided under §6 (Performance Guarantees).

1. Have the retention conversation first per Playbook §7.
2. If guarantee was triggered and they want out: honor it. Process cancellation via `/client/cancel` (contractor) or admin dashboard.
3. If guarantee was met (system live and logging) and they still want out: they can stop using the service, but they remain contractually obligated for the remaining Minimum Term fees. Setup fee non-refundable.
4. Generate data export within 5 business days (CSV: leads, conversations, pipeline status).
5. Be human about it — angry refund disputes cost more than a partial credit. Use judgment.

### 8.5 What If Client Wants to Cancel After 90 Days?

Per Service Agreement §5: month-to-month with 30 calendar days written notice to operator email.

1. Acknowledge receipt of notice within 24 hours.
2. Set cancellation date = 30 calendar days from notice receipt.
3. Final monthly billing runs at period end.
4. Reminders auto-fire at 20/7/3 days before grace ends (`/api/cron/cancellation-reminders`).
5. Data export delivered within 5 business days of grace end.
6. Win-back email fires 7 days after grace ends (`/api/cron/win-back`).
7. Document the cancellation reason — feed back into product + sales improvement.

### 8.6 What If Voice AI Usage Exceeds 1,000 min/mo?

Per Service Agreement §4: Voice AI included up to 1,000 inbound minutes/month, $0.15/minute above. Operator notifies in writing if usage exceeds 800 minutes for two consecutive months.

1. `/api/cron/voice-usage-rollup` runs monthly, totals usage per client.
2. If trailing month >800 min: log internal note. Watch next month.
3. If trailing two months both >800 min: send written email to contractor: "Heads up — your Voice AI usage hit [X] min last month and [Y] this month. The fair-use threshold is 1,000 min/mo; above that we bill $0.15/min. At your current pace you're projected to be at $[Z]/mo in overage. Options: (a) keep going as-is and pay the overage, (b) we can route some calls to voicemail-only during peak, (c) we can throttle. What works?"
4. If usage exceeds 1,000 min in a given month: bill the overage on the next monthly invoice via Stripe usage records.

### 8.7 What If Pilot Client Wants to Stay at Pilot Pricing After 3 Clients?

**Hard rule: no.** Pilot is for first 3 clients only. Enforced in code: `scripts/seed-plans.ts` → `maxActiveClients: 3` on the Pilot plan.

The script for this conversation:

> "Pilot pricing was for the first 3 clients — that was the deal at signing, in exchange for the case study and feedback. After 90 days, you graduate to Standard at $5,500 setup + $2,000/mo. The setup fee for the upgrade is waived since we already did your implementation — you just move to the new monthly rate. Same system, you keep all your data, no re-onboarding."

Per Business Reference §6.2 (Pilot upgrade path): "After 90 days, upgrade to Standard at $2,000/month if results and usage justify it. For the first one or two case-study clients, you may let them keep $1,500/month if they provide a strong testimonial and referral access." This is a **case-by-case operator decision**, not a contractual right — and only for clients 1 and 2, never for client 3.

If the contractor refuses the upgrade and won't sign a Standard agreement: cancel per Phase 8.5. Better to lose one client than break the offer architecture.

---

## Phase 9: Tier-Specific Differences

Software is mostly identical. Differences are seat counts, advanced analytics + API access, and operational depth. Per `scripts/seed-plans.ts` and `02-MANAGED-SERVICE-PLAYBOOK.md`:

| Capability | Pilot | Standard |
|------------|-------|----------|
| Setup fee | $3,500 | $5,500 |
| Monthly | $1,500 | $2,000 |
| Term | 90-day min | 90-day min then m2m |
| Max active clients on this plan | 3 (hard cap) | unlimited |
| Publicly visible on plan picker | No (operator-assigned) | Yes |
| Marked "popular" | No | Yes |
| Max team members | 3 | 5 |
| Max phone numbers | 1 | 3 |
| Voice AI included | Yes (1,000 min/mo) | Yes (1,000 min/mo) |
| Calendar sync | Yes | Yes |
| Advanced analytics | No | Yes |
| API access | No | Yes |
| White-label | No | No |
| Support level | Priority | Priority |
| Unlimited messaging | Yes | Yes |
| Reporting cadence | Bi-weekly | Bi-weekly |
| Strategy call cadence | Bi-weekly | Bi-weekly |
| Monthly review call | No | Yes (per Business Reference §9.3) |
| Stale lead review depth | Standard | Deeper (per BR §9.3) |
| Optimization capacity | Light | More (per BR §9.3) |
| Onboarding & SOPs | Standard | Stronger (per BR §9.3) |
| Source tracking basics | No | Yes (per BR §9.3) |
| Dormant lead reactivation | First batch only | Approved old inquiries on request |
| Improved routing rules by project type / estimator | No | Yes |

The Pilot is intentionally the same product with less operator depth — it's a market-entry mechanism, not a different product. This is documented in Business Reference §6.3: "Pilot pricing exists because early clients are taking more risk."

---

## Phase 10: Sign-Off Checklist

Before declaring "this client is fully onboarded and the system delivers as promised," every box below must be checked.

**Sales + contract:**
- [ ] Service Agreement signed and stored (PDF + signature)
- [ ] Tier correctly chosen per Phase 2.3 rules
- [ ] First setup half charged via Stripe Checkout
- [ ] Day-7 non-refundable note added to client record

**Onboarding:**
- [ ] 30-min onboarding call completed using Playbook §10 script
- [ ] Wow moment delivered (live missed-call demo or Voice AI demo)
- [ ] Exclusion list reviewed + "Mark as Reviewed" clicked
- [ ] Old quotes imported (≥5 names, status=estimate_sent)
- [ ] KB seeded with: ≥1 service with pricing range, service area, warranty, exclusions, 8+ FAQ
- [ ] Twilio business number live, forwarding configured, carrier voicemail disabled
- [ ] Day 7 listing migration call scheduled (and completed by Day 10)
- [ ] Exit document handed to contractor

**Implementation Day 1-21:**
- [ ] Phase 5.1 through 5.8 checklists complete
- [ ] All 16 Phase 6 production tests pass against this client's setup
- [ ] AI advanced from Smart Assist to Autonomous on Day 21
- [ ] Second setup half charged on Day 21
- [ ] First monthly retainer charge fired automatically

**Guarantee gates:**
- [ ] Day-21 go-live gate passed (`/api/cron/guarantee-21day`)
- [ ] Day-30 logging gate passed OR low-volume exception applied (`/api/cron/guarantee-30day`)

**Operations live:**
- [ ] Daily Digest SMS delivering to contractor + reply commands working
- [ ] Weekly Pipeline Pulse SMS delivering Mondays
- [ ] First bi-weekly report delivered (email + SMS)
- [ ] First bi-weekly strategy call held using Playbook §4 script
- [ ] Operator daily routine running (Phase 7.1)

If anything above is unchecked at Day 30, do not move on. Either fix it or document why the exception applies.

---

## Appendix A: Cron Jobs and What They Do

All routes live under `src/app/api/cron/*`. Cron trigger fires every 5 minutes per `LAUNCH-CHECKLIST.md` Phase 4.3. Each route uses `verifyCronSecret()` for auth.

**Lead lifecycle:**
- `appointment-followup` — checks appointments completed 4+ days ago, sets lead to `estimate_sent`, schedules 4-touch sequence
- `estimate-fallback-nudges` — nudges contractor to flag any estimates the system might have missed
- `proactive-quote-prompt` — 3-day prompt to contractor about pending quotes
- `no-show-recovery` — same-day rebook attempt for missed appointments
- `win-back` — dormant lead reactivation
- `probable-wins-nudge` — reminds contractor to confirm WON/LOST on appointments

**Operator alerts:**
- `escalation-renotify` — re-pings unresolved escalations past SLA
- `ai-quality-alert` — flags AI quality concerns hourly
- `knowledge-gap-alerts` — notifies contractor of unanswered questions
- `kb-gap-notify` / `kb-empty-nudge` — KB-specific operator nudges
- `agent-check` — health checks the AI agent

**Contractor communication:**
- `daily-digest` — daily summary SMS with reply syntax (W1/L1/free text/0)
- `weekly-digest` — Monday Pipeline Pulse
- `weekly-summary` / `daily-summary` — alternate cadence
- `day3-checkin` — Day 3 check-in
- `agency-digest` — operator-side digest
- `send-nps` — NPS prompt

**Reports:**
- `biweekly-reports` — generates and sends bi-weekly performance scoreboard
- `report-delivery-retries` — retries failed report deliveries

**Guarantee + onboarding:**
- `guarantee-21day` — Day-21 go-live gate evaluation
- `guarantee-30day` — Day-30 logging gate evaluation
- `guarantee-check` / `guarantee-alert` — running guarantee status checks
- `onboarding-priming` — pre-onboarding "think of 5 dead quotes" SMS
- `onboarding-reminder` — 2-hour-before reminder
- `onboarding-sla-check` — operator-facing onboarding SLA monitor
- `forwarding-verification` — verifies phone forwarding still active

**Billing + lifecycle:**
- `billing-reminder` — payment reminder triggers for leads (add-on)
- `cancellation-reminders` — 20/7/3-day reminders before grace ends
- `trial-reminders` — Day 7/14/25/28+SMS/30+SMS sequence
- `stripe-reconciliation` — reconciles Stripe state with platform state
- `monthly-reset` — monthly counters reset
- `voice-usage-rollup` — monthly Voice AI minute totals per client

**Quarterly + reviews:**
- `quarterly-campaign-planner` / `quarterly-campaign-alerts` — Growth Blitz cadence
- `auto-review-response` — drafts AI response to new Google reviews

**Misc:**
- `access-review` — periodic access audit
- `ai-mode-progression` — Day 14 auto-advance from Smart Assist to Autonomous
- `calendar-sync` — Google Calendar two-way sync
- `check-missed-calls` — backfill check for missed-call text-back failures
- `expire-prompts` — expires stale prompts
- `heartbeat-check` — system heartbeat
- `process-queued-compliance` / `process-scheduled` — outbound message queue processors
- `voice-callbacks` — Voice AI callback triage

---

## Appendix B: AI Modes

Set per-client at `/admin/clients/[id]` → AI Mode setting.

| Mode | Behavior | When to use |
|------|----------|-------------|
| **Off** | AI does not respond. Inbound captured only. | Pause scenarios, contractor on vacation |
| **Smart Assist (Manual)** | AI drafts every response. Operator must approve before send. No auto-send. | Week 1-2 of new client, OR when AI quality degraded |
| **Smart Assist (Delayed)** | AI drafts, auto-sends after operator review window expires (e.g., 5 min). | Transitional mode |
| **Autonomous** | AI drafts and sends immediately. Escalates only on guardrails. | Default after Day 14 if AI quality stable |

Mode advancement from Smart Assist → Autonomous is auto-driven by `/api/cron/ai-mode-progression` on Day 14 if no AI quality flags in past 7 days. Operator can override anytime.

---

## Appendix C: Compliance Reference Card

Print this. Tape it to your monitor.

**CASL + CRTC (Canada):**
- Express consent required for marketing-style SMS (form opt-in checkbox, missed-call reply, prior business relationship)
- Quiet hours: 9 PM - 10 AM local time. Proactive messages queue. Inbound replies handled per current policy (FM-38 inbound-reply exemption — confirm with counsel before promising).
- STOP / unsubscribe: instant, irreversible until lead texts START
- Sender ID required in every message
- Audit trail per message (consent basis, timestamp, opt-in language)

**A2P/10DLC (US carrier filtering):**
- Brand registration filed before client #1
- Campaign approved
- Phone numbers associated with approved campaign

**DNC vs Opt-Out (operator note):**
- Opt-Out = lead texted STOP. Legal, irreversible. Operator cannot override.
- DNC (Do Not Contact) = operator added a number to the exclusion list. Operational, reversible. Family/friend protection.
- Both block all automated outbound.

**Refusals (do not include in pitch or message templates):**
- No revenue guarantees
- No "never lose a lead again" in writing
- No financing-first / 0% APR CTAs (halal-aligned)
- No fake scarcity, fake reviews, deceptive test leads

**Data ownership:**
- All lead data, conversations, contacts belong to the contractor
- Full CSV export available within 5 business days on request
- Operator is data processor only

---

## Appendix D: Stripe Test Mode Setup

Run the entire flow end-to-end in Stripe test mode before going to production. Your first run-through (Phases 1-7 with the test contractor) should be entirely in test mode.

**Setup:**
1. Stripe Dashboard → toggle to **Test mode**
2. Create three Products with both setup + recurring prices:
   - Pilot: setup $3,500 one-time, recurring $1,500/month
   - Standard: setup $5,500 one-time, recurring $2,000/month
   - Premium: setup $9,500 one-time, recurring $3,500/month
3. Copy six Price IDs (one setup + one recurring per tier)
4. Set env vars: `STRIPE_SECRET_KEY` (test sk_test_*), `STRIPE_WEBHOOK_SECRET` (test whsec_*), and the six `STRIPE_PRICE_*` env vars
5. Run `pnpm tsx scripts/seed-plans.ts` to seed plan rows with test Price IDs
6. Webhook endpoint: `https://your-ngrok-url/api/webhooks/stripe` for local OR `https://yourdomain.com/api/webhooks/stripe` for staging
7. Webhook events to subscribe (per LAUNCH-CHECKLIST Phase 4.1): `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created/closed`, `customer.subscription.paused/resumed/trial_will_end`, `payment_method.attached`

**Test cards** (Stripe docs):
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 0341` — succeeds at first, fails on renewal (use to test 8.1 + payment-failure SMS alert)
- `4000 0000 0000 0002` — declines immediately
- Any future expiry, any CVC, any postal code

**Production switchover:**
1. Repeat all Stripe steps in **Live mode**
2. Update env vars with live keys
3. Re-run `pnpm tsx scripts/seed-plans.ts` against production DB with live Price IDs
4. Smoke test with one real card before client #1 signs (refund yourself immediately)

**Reconciliation:**
- `/api/cron/stripe-reconciliation` runs periodically and detects drift between Stripe state and platform state. Alert operator on any mismatch.

---

*ConversionSurgery — E2E Pilot & Standard Delivery Guide v1.0*
*Source: Business Reference v1.0, OFFER-APPROVED-COPY v2.0, MANAGED-SERVICE-PLAYBOOK, LAUNCH-CHECKLIST, 01-TESTING-GUIDE*
*Last updated: May 4, 2026*
