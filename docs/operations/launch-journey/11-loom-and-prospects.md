# 11 — Loom and Prospects

## What this is

Two parallel sales-prep tasks. Stand up your Loom Pro account and record a first audit template. Then refine the prospect CSV to 30+ qualified Calgary/Edmonton contractors who match the ICP exclusion gates.

## Before you start this

- [ ] Script rehearsal complete (you've heard yourself talk through the audit)
- [ ] Credit card available for Loom Pro signup
- [ ] `docs/operations/templates/calgary-basement-prospects.csv` exists (it does — start there)

## Time required

~2 hours

## What you'll do

### Part 1: Loom Pro account + first audit recording (~1 hour)

#### 1.1 Sign up for Loom Pro

Go to loom.com. Pick the Pro plan (~$15/mo). The free tier caps individual videos at 5 minutes — your audits will run 5-7 minutes, so you need Pro from day one. Don't try to make 5-minute audits work. The math doesn't.

#### 1.2 Record a practice audit using a real Calgary contractor

Use a real Calgary basement contractor as the example. Public data only — their website, their Google Business Profile, their public reviews, their public contact form. Do NOT record anything that requires login or implies you have access to private information. The point is to make a template you can re-use, not to send this one.

Cross-reference: E2E §1.2 for full Loom audit recording structure. Follow the structure verbatim:

- Open with their business name + a specific finding (e.g., "I saw 3 reviews from this quarter mentioning slow response")
- Walk their website → contact form (show what happens after submit)
- Show the leak map: where leads are slipping through (form, missed call, slow reply, no follow-up)
- Close with the CTA: 15-minute call, no obligation

Length target: 5-7 minutes. Audio clear. Screen share clean. Don't apologize, don't ramble, don't try to be funny.

#### 1.3 Save as the template

In Loom, save the video to a folder named "Audit Template v1." This is the structural template you copy for every real prospect — same flow, different contractor data. You'll re-record the actual content for each prospect, but the muscle memory of the structure is what matters.

### Part 2: Prospect list refinement (~1 hour)

#### 2.1 Open the existing CSV

Open `docs/operations/templates/calgary-basement-prospects.csv`. Whatever's in there is your starting point. You're getting it to 30+ qualified rows.

#### 2.2 Source new contacts

Use the sources documented in `docs/business-intel/ICP-DEFINITION.md` §"Where to Find Them":

- BILD Calgary Region member directory
- BILD Edmonton Region member directory
- Google Maps "design build" / "basement renovation" / "kitchen renovation" searches in Calgary + Edmonton
- Google Business Profiles with 4.5+ rating and 20+ reviews
- Houzz Calgary/Edmonton Pro listings
- Instagram / Facebook business pages with consistent project posts

#### 2.3 Required columns per row

Every row must have:

- Business name
- Owner name (first + last)
- Phone (mobile if findable, office otherwise)
- Email (founder/owner inbox preferred over `info@`)
- GBP rating (4.5+ baseline)
- Trade (kitchen/bath, basement, whole-home, additions)
- Pain angle (what specific leak you'll lead with)
- Personalization notes (one or two specifics from their website / GBP / recent post)

If you can't find one of these, skip the contact. Going wide with bad data wastes outreach. Quality > quantity at 30 contacts.

#### 2.4 Trade mix target

Aim for this distribution across the 30+:

- ~50% kitchen/bath
- ~30% basement
- ~20% whole-home / additions

Reason: kitchen/bath is the largest pool of qualified contractors in your geo. Basement is the warmest niche given your prep materials (BASEMENT-KB-PRESET, SALES-TOOLKIT-BASEMENT). Whole-home/additions is the highest-LTV tail.

#### 2.5 Apply ICP exclusion gates

Before adding a row, check it against `docs/business-intel/ICP-DEFINITION.md` §"Who to AVOID". Reject:

- Solo handymen / one-person shops
- Sub-$1M annual revenue
- Pure referral-only operators (no marketing presence at all)
- Deck/fence/landscape-only contractors

Mark borderline cases in a `notes` column rather than dropping them silently — you may want to revisit later.

## What success looks like

- [ ] Loom Pro account live
- [ ] "Audit Template v1" recorded, saved, and reviewable
- [ ] `calgary-basement-prospects.csv` has 30+ qualified rows
- [ ] Trade mix roughly matches the 50/30/20 target
- [ ] Every row has all required columns filled
- [ ] No exclusion-gate violations in the file

## If something goes wrong

If you can't hit 30 in one hour — don't pad with junk. Note where you got stuck (specific source ran dry, specific niche thin) and add to a separate `prospect-gaps.md` file in `.scratch/`. Continue on Day 3 with the gap-filling baked into your outreach hour.

If the Audit Template v1 recording feels rough — re-record once. Don't re-record five times. Done is better than perfect at this stage; you'll iterate the template after the first 5 real audits anyway.

## Reference

- `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md` §1.2 (Loom audit structure)
- `docs/business-intel/ICP-DEFINITION.md` §"Where to Find Them", §"Who to AVOID"
- `docs/operations/templates/calgary-basement-prospects.csv`
- `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md`

## Next

[12 — Day 2 Checkpoint](./12-day-2-checkpoint.md)
