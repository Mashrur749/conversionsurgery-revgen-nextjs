# Wave A Cut List — First Pilot Sale Readiness

Status: Draft for founder approval
Source offer: Business Reference v1.0 (uploaded 2026-05-03)
Goal: Minimum scope to sell, bill, and deliver the first Pilot Revenue Recovery System ($3,500 setup + $1,500/mo)
Out of Wave A: Premium tier (`PG-101..PG-106`), microsite add-on, attribution capture, multi-agency, self-serve

## Effort summary

| Bucket | Items | Effort |
|---|---|---|
| Schema + migrations | 1 | 30 min |
| Stripe billing flow | 1 | 4 hrs |
| Admin UI | 2 | 4 hrs |
| Operational guarantee gates (`PG-001`) | 2 | 8 hrs |
| Pilot tier guard | 1 | 1 hr |
| Plan + Stripe configuration | 1 | 2 hrs |
| Sales-blocker doc reconciliation | 1 (~30 files) | 6-8 hrs |
| Tests + quality gates | 1 | 4 hrs |
| **Total Wave A** | | **~28-30 hrs (3-4 working days)** |

---

## A1. Schema migration — setup fee column

**File:** `src/db/schema/plans.ts`

Add columns:

```ts
priceSetupCents: integer('price_setup_cents').default(0).notNull(),
stripePriceIdSetup: varchar('stripe_price_id_setup', { length: 100 }),
maxActiveClients: integer('max_active_clients'), // null = unlimited; Pilot = 3
publiclyVisible: boolean('publicly_visible').default(false), // Standard = true; Pilot/Premium = false (operator-picked)
```

Generate via `npm run db:generate`, review SQL, ask for `db:push` confirmation.

**Effort:** 30 min

---

## A2. Stripe Checkout flow — bundle setup + recurring

**File:** `src/lib/services/subscription.ts` — replace `createSubscription()` with `createCheckoutSession()`

New behavior:

1. Look up plan by ID
2. Build `Stripe.checkout.sessions.create` with:
   - `mode: 'subscription'`
   - `line_items: [{ price: stripePriceIdSetup, quantity: 1 }, { price: stripePriceIdMonthly, quantity: 1 }]`
   - `metadata: { clientId, planId, planSlug }`
   - `success_url`, `cancel_url`
3. Return checkout URL
4. On webhook `checkout.session.completed`: create subscription row, mark client `active`, fire onboarding workflow, set guarantee window start

Keep existing webhook handler for `customer.subscription.*` — it already covers ongoing lifecycle.

**Files touched:**
- `src/lib/services/subscription.ts`
- `src/app/api/webhooks/stripe/route.ts` (verify checkout completion handler exists; add if missing)

**Effort:** 4 hrs

---

## A3. Admin UI — "Send Checkout Link" on Create Client form

**File:** `src/app/(dashboard)/admin/clients/new/wizard/` (verify path)

Changes:
1. Plan picker shows three radios: Pilot ($3,500 + $1,500/mo), Standard ($5,500 + $2,000/mo), Premium ($9,500 + $3,500/mo) — Pilot disabled if 3 active Pilots exist
2. After client record is created, show "Generate Checkout Link" button
3. Button calls new endpoint `POST /api/admin/clients/[id]/checkout-link` → returns URL
4. Display URL with copy-to-clipboard
5. Optional: "Send via email" button using existing Resend integration

**Effort:** 3 hrs

---

## A4. Pilot tier guard

**File:** `src/lib/services/plan-availability.ts` (new)

Function: `isPilotTierAvailable(): Promise<{ available: boolean, activeCount: number }>`

- Counts subscriptions where `plan.slug = 'pilot'` and `subscription.status = 'active'`
- Returns `available: false` when count >= 3

Used by:
- Plan picker UI (disables Pilot radio with tooltip "Pilot limited to first 3 clients — currently 3/3")
- Checkout link endpoint (refuses to generate Pilot link if cap hit)

**Effort:** 1 hr

---

## A5. Operational guarantee — Day 21 go-live gate (`PG-001` part 1)

**Files:**
- `src/lib/automations/guarantee-gates.ts` (new)
- `src/app/api/cron/guarantee-21day/route.ts` (new) — daily

Logic:
1. For each subscription, on day 21 of activation:
   - "Live" definition: client has `aiMode = 'autonomous'` OR (`aiMode = 'smart_assist'` AND onboarding checklist complete)
2. If not live:
   - Set `client.guaranteeStatus = 'go_live_extended'`
   - Notify operator via SMS (existing agency-communication pattern)
   - Mark `goLiveExtensionStartedAt` timestamp
   - Continue daily check until live
3. Bi-weekly report surfaces extension status
4. When live: log `guarantee_go_live_met` event

**No billing pause needed for this gate** — Business Reference §11 says "we continue working at no additional charge until live." That's an operator commitment, not a billing change. The gate just tracks the operator's obligation.

**Effort:** 4 hrs

---

## A6. Operational guarantee — Day 30 logging gate (`PG-001` part 2)

**Files:**
- `src/lib/automations/guarantee-gates.ts` (extend)
- `src/app/api/cron/guarantee-30day/route.ts` (new) — daily

Logic:
1. For each subscription, on day 30 of activation:
   - "Logging met" definition: ≥80% of inquiries in last 7 days have `source`, `status`, and at least one follow-up activity logged
2. If not met:
   - Pause Stripe subscription billing (`stripe.subscriptions.update(id, { pause_collection: { behavior: 'mark_uncollectible' } })`)
   - Set `client.guaranteeStatus = 'logging_paused'`
   - Operator SMS + dashboard alert
   - Daily recheck — when met, resume billing
3. When met: log `guarantee_logging_met` event, resume billing

**Edge case:** if client's lead volume is too low to evaluate (less than 5 inquiries in 30 days), defer the gate and flag in operator dashboard. Don't penalize for slow market.

**Effort:** 4 hrs

---

## A7. Plan seed data + Stripe configuration

**One-time setup, manual + script:**

1. **Stripe Dashboard:** create three products + six prices:
   - Pilot Product → Setup ($3,500 one-time) + Monthly ($1,500 recurring)
   - Standard Product → Setup ($5,500 one-time) + Monthly ($2,000 recurring)
   - Premium Product → Setup ($9,500 one-time) + Monthly ($3,500 recurring)
2. **DB seed:** `scripts/seed-plans.ts` (new) — inserts/updates 3 plan rows with Stripe IDs
3. Document Stripe IDs in `.env.example` or admin settings

**Effort:** 2 hrs (mostly Stripe Dashboard clicking)

---

## A8. Doc reconciliation (sales-blocker scope only)

**Critical path — must update before first sale:**

| Doc | What changes | Authorization |
|---|---|---|
| `docs/business-intel/OFFER-APPROVED-COPY.md` | Full rewrite to Business Reference v1.0: tiered pricing (Pilot/Standard/Premium), 21-day go-live + day-30 logging guarantee, 90-day minimum, Pilot "first 3 clients" callout, AI receptionist included, removal of single-price + 30-day-free language | **Founder authorized 2026-05-04** |
| `docs/business-intel/offer-page.html` | Same rewrite reflected in HTML offer page | Founder authorized |
| `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` | Tier-specific pricing, setup fee terms, 90-day minimum, operational guarantee language matching new copy | Founder authorized; **legal review required before sending to first client** |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Pricing references, onboarding flow with new guarantee gates, Pilot tier handling | Authorized |
| `docs/operations/LAUNCH-CHECKLIST.md` | Phase 3 (First Client Delivery) updated for new gates and tier model | Authorized |
| `docs/operations/ACQUISITION-PLAYBOOK-0-TO-5.md` | Pricing, objection handling for "why setup + monthly", Pilot tier framing | Authorized |
| `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` | Pricing, proposal language | Authorized |
| `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` | Add: "why both fees", "can I just self-serve", "what if I cancel after 90 days" | Authorized |
| `docs/business-intel/OFFER-STRATEGY.md` | Aligned to v1.0 strategy | Authorized |
| `docs/product/PHASE2-END-TO-END-OFFER.md` | Likely deprecate or rewrite — flag during review | Authorized |
| `docs/product/PLATFORM-CAPABILITIES.md` Section 8 (Billing) | Tier model, setup-fee handling, no message caps within tier | Authorized |
| `docs/engineering/01-TESTING-GUIDE.md` | New test steps for setup + recurring checkout, guarantee gates | Authorized |

**Defer (post-Wave A) — not blocking first sale, queue for Wave A.5:**

| Doc | Reason for deferral |
|---|---|
| `docs/business-intel/COMPETITIVE-COMPARISON.md` | Pricing references not customer-facing immediately |
| `docs/business-intel/RESEARCH-INSIGHTS-MARCH-2026.md` | Historical research; date in title makes staleness obvious |
| `docs/business-intel/ICP-DEFINITION.md` | Pricing referenced in passing; ICP itself unchanged |
| `docs/legal/01-LEGAL-COUNSEL-BRIEF.md` | Update before next legal touchpoint, not before first sale |
| `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` | Update before next risk review |
| `docs/onboarding/02-OPERATOR-MASTERY-PLAYBOOK.md` | Operator can read between the lines for v1 |
| `docs/operations/00-OPERATOR-GUIDE.md` | Same |
| `docs/operations/02-USE-CASES.md` | Examples will need refresh, non-blocking |
| `docs/operations/03-SOLOPRENEUR-SANITY-ACTION-LIST.md` | Personal action list, not customer-facing |
| `docs/operations/COLD-START-PLAYBOOK.md` | Pricing in playbook, refresh next outbound batch |
| `docs/operations/EXECUTION-PLAN.md` | Internal planning doc |
| `docs/product/PRODUCT-STRATEGY.md` | Strategic doc; update at next strategy review |
| `docs/product/ROI-CALCULATOR-GUIDE.md` | Tool-specific; calc logic untouched |
| `docs/product/SERVICE-DELIVERY-GAPS.md` | Methodology doc, dated reference |
| `docs/product/FEATURE-BACKLOG.md` | Already updated by me |
| `docs/specs/CONSENSUS-LAUNCH-READINESS.md` | Historical consensus doc |
| `docs/specs/MS-01-UNLIMITED-MESSAGING-PARITY.md` | Spec for shipped feature, archive |
| `docs/specs/MS-02-GUARANTEE-V2-PARITY.md` | Spec for shipped feature, archive |
| `docs/specs/PLATFORM-GAP-REGISTER.md` | Already updated by me |
| `docs/superpowers/*.md` | Internal planning docs |
| `docs/archive/*` | Already archived |

**Mark as Done in `02-OFFER-PARITY-GAPS.md`:** `PG-001` (after A5+A6), `PG-006` (after A1+A2 — new gap I'll add for billing model)

**Effort:** 6-8 hrs across all critical-path docs

---

## A9. Tests + quality gates

**New tests:**
- `subscription.test.ts` — checkout session creation with bundled line items
- `guarantee-gates.test.ts` — 21-day and 30-day gate logic with edge cases (low volume, already live, etc.)
- `plan-availability.test.ts` — Pilot cap enforcement

**Quality gates before merge:**
- `npm run typecheck`
- `npm run quality:no-regressions` (build + tests + smoke)
- `npm run quality:logging-guard`
- `npm run quality:code-review` (fresh-context review)

**Effort:** 4 hrs

---

## What is explicitly NOT in Wave A

| Item | Why deferred |
|---|---|
| Premium tier deliverables (`PG-101..PG-106` / `W5-01..W5-08`) | Don't sell Premium until first paying Standard client requests it. Build on demand. |
| Channel-level lead source (`PG-002`) | Reword Pilot/Standard offer line to "entry channel" or implement post-sale. Not blocking first Pilot sale. |
| Microsite + Tracking add-on (`PG-201`) | Add-on, not base offer. Reconcile scope when first add-on sale comes up. |
| Annual prepay UI toggle | Manual override possible; UI defer until 2nd or 3rd sale. |
| Self-serve handoff tier | Decided against (see prior conversation). |
| Multi-agency platform (FB-02) | Post-validation, requires 5+ paying clients. |
| Estimator-level reporting (`PG-004`) | Premium-tier promise. Standard buyers can use existing context brief. |
| Won/lost reason capture (`PG-003`) | Useful but not sales-blocking. Wave A.5 candidate. |

---

## Sequence (dependency order)

1. **A1 → A2 → A7** (schema → Stripe flow → seed data) — billing must work end-to-end first
2. **A3 → A4** (admin UI → Pilot guard) — operator can generate links
3. **A5 → A6** (guarantee gates) — can run in parallel with A3/A4
4. **A8** — doc reconciliation (can start in parallel with code; OFFER-APPROVED-COPY is highest priority)
5. **A9** — tests + quality gates as items land
6. **Final pass** — manual end-to-end: create test client, generate Pilot Checkout link, complete payment in Stripe test mode, verify subscription created, verify both line items charged, verify onboarding kicks off

## Open questions

1. **Trial period?** Business Reference doesn't mention a trial — first invoice is setup + first month due immediately. Confirm: no trial days on Stripe side. (Existing platform has 14-day default; we override to 0 for these tiers.)
2. **Failed setup payment?** If the customer's card fails on the bundled checkout, the entire transaction fails (Stripe behavior). They retry. Acceptable?
3. **Day-30 logging gate threshold?** Proposed 80% of inquiries logged. Adjust?
4. **Low-volume defer threshold?** Proposed 5 inquiries in 30 days. Adjust?
5. **Stripe test mode first?** Yes — recommend full Wave A passes Stripe test mode E2E before any live plan creation in production Stripe.
