# 03 — Stripe Products

## What this is
Create three products and six prices in Stripe, copy the IDs into your env, and seed the database. The single most common launch-day mistake is on this page — read the **CRITICAL** callout below before you click anything.

## Before you start this
- [ ] You have admin access to Stripe
- [ ] You have `.env.local` open in your editor

## Time required
~45 minutes

## CRITICAL — Read this before creating prices

The setup-at-signing one-time price you create in Stripe MUST equal **50% of the total setup fee**, not the full setup fee. The other 50% is invoiced at go-live. The platform is wired to charge whatever you put in this price ID at signing — if you accidentally enter the full setup, you will overcharge every signing client by 2x.

| Tier     | Total setup | Setup-at-signing price (50%) | Monthly recurring |
|----------|-------------|-------------------------------|-------------------|
| Pilot    | $3,500      | **$1,750**                    | $1,500            |
| Standard | $5,500      | **$2,750**                    | $2,000            |
| Premium  | $9,500      | **$4,750**                    | (per offer)       |

When you create the one-time setup price, enter the **bold** number.

## What you'll do

1. Toggle Stripe Dashboard to **Test mode** (top-right toggle). Every step in this file is in test mode. You will switch to live mode only after end-to-end rehearsal in file 08.
2. Create three Products: **Products** → **+ Add product**. For each:
   - Name: `Pilot` / `Standard` / `Premium`
   - Description: short one-liner (e.g. "Revenue Recovery — Pilot")
   - Pricing model: choose **Standard pricing** (you will add multiple prices to each product)
3. For each product, add two prices:

   **Pilot:**
   - Recurring: $1,500/month CAD
   - One-time: $1,750 CAD (label this clearly: "Pilot setup — signing 50%")

   **Standard:**
   - Recurring: $2,000/month CAD
   - One-time: $2,750 CAD ("Standard setup — signing 50%")

   **Premium:**
   - Recurring: $(per offer) CAD
   - One-time: $4,750 CAD ("Premium setup — signing 50%")

4. Copy the 9 IDs (Stripe shows them under each product/price page):
   - 3 product IDs (`prod_...`)
   - 3 monthly recurring price IDs (`price_...`)
   - 3 setup one-time price IDs (`price_...`)
5. Add to `.env.local` — these exact variable names are what `seed-plans.ts` reads:

   ```
   STRIPE_PRODUCT_PILOT=prod_...
   STRIPE_PRICE_PILOT_MONTHLY=price_...
   STRIPE_PRICE_PILOT_SETUP=price_...
   STRIPE_PRODUCT_STANDARD=prod_...
   STRIPE_PRICE_STANDARD_MONTHLY=price_...
   STRIPE_PRICE_STANDARD_SETUP=price_...
   STRIPE_PRODUCT_PREMIUM=prod_...
   STRIPE_PRICE_PREMIUM_MONTHLY=price_...
   STRIPE_PRICE_PREMIUM_SETUP=price_...
   ```

6. Run the seed script:
   ```
   pnpm tsx scripts/seed-plans.ts
   ```
   Expected output: three rows upserted (pilot, standard, premium) with their Stripe IDs filled in.

7. Verify with a SQL query against your dev database:
   ```sql
   SELECT slug, stripe_product_id, stripe_price_id_setup, stripe_price_id_monthly
   FROM plans
   ORDER BY slug;
   ```
   You should see three rows. Every column must be populated. If any column is empty, the env var is missing — fix and re-run seed.

## What success looks like
- [ ] 3 products visible in Stripe test mode dashboard
- [ ] 6 prices created (3 monthly recurring + 3 one-time setup)
- [ ] Each one-time setup price equals 50% of the total setup fee for its tier
- [ ] 9 env vars set in `.env.local`
- [ ] `seed-plans.ts` ran cleanly with no errors
- [ ] SQL query shows 3 plans rows with all Stripe IDs populated

## If something goes wrong

- **`seed-plans.ts` reports empty IDs** — env var name mismatch. Check exact spelling against the list above.
- **Wrong amount on an invoice during E2E test** — almost always the 50% rule violated. Stop, fix the Stripe price, re-copy ID, re-run seed.
- **Currency mismatch** — Stripe defaults to USD if your account is US-based. Set CAD explicitly per price (or accept USD if your tax/account setup mandates it; just be consistent across all 6 prices).

## Reference
- Launch checklist: `docs/operations/LAUNCH-CHECKLIST.md` Phase 4.1 (Stripe)
- Seed script source: `scripts/seed-plans.ts`
- Approved offer copy: `docs/business-intel/OFFER-APPROVED-COPY.md`

## Next
[04 — Deploy](./04-deploy.md)
