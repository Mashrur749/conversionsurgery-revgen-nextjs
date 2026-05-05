# ICP Definition — Design-Build Renovation Contractors

**Status:** Canonical. This is the single source of truth for who ConversionSurgery sells to.
**Last updated:** 2026-05-04
**Source:** 8-agent stochastic niche consensus + 500-scenario Monte Carlo simulation + 30-profile delivery simulation + business direction v2 alignment

All other documents reference this one. Do not duplicate ICP definitions elsewhere &mdash; add a pointer to this file instead.

---

## The One-Liner

&ldquo;We help renovation contractors catch every lead they miss while they&rsquo;re on the job site.&rdquo;

---

## Primary ICP: Design-Build Renovation Contractor

| Attribute | Value |
|-----------|-------|
| Trade | Design-build renovation: kitchen/bath, basement, whole-home, additions |
| Revenue | $1M&ndash;$10M |
| Avg project | $50&ndash;120K (varies by sub-niche) |
| Team | Owner + 1&ndash;10 crew, NO dedicated office manager (or overwhelmed one) |
| Leads | 15&ndash;40/month inbound (Google, HomeStars, Facebook, referrals) |
| Follow-up | None systematic &mdash; &ldquo;I send the estimate and hope they call back&rdquo; |
| Google reviews | 10&ndash;100 |
| Location | Calgary + Edmonton first, then broader Alberta/national |
| Seasonality | Year-round interior work &mdash; low seasonal risk |
| Response time | Currently 1&ndash;4 hours (on job sites, busy managing crews) |
| Current ad spend | $500&ndash;5,000/month on Google/HomeStars (or tried and stopped) |

---

## The 30-Second Qualifier

All six must pass (Q1-Q4 are dealbreakers, Q5-Q6 are flags):

1. &ldquo;Do you do renovation work &mdash; kitchens, baths, basements, additions, or whole-home?&rdquo; &mdash; if no, pass
2. &ldquo;How many inquiries do you get a month?&rdquo; &mdash; looking for 15+
3. &ldquo;When you&rsquo;re on a job site and your phone rings, what happens?&rdquo; &mdash; looking for &ldquo;voicemail&rdquo; or &ldquo;I call back later&rdquo;
4. &ldquo;What number do leads call &mdash; your cell, a Google Voice number, or a business line?&rdquo; &mdash; if Google Voice: not a dealbreaker, but flag for modified onboarding (Twilio number as primary business line instead of call forwarding). If VoIP/PBX: confirm admin portal access for forwarding setup.
5. **Live test (30 seconds):** &ldquo;Before we wrap up &mdash; I&rsquo;m going to text your business number right now so we can make sure everything routes correctly.&rdquo; Send a test SMS from your Twilio number to their business line while still on the call. Confirms: (a) texts arrive, (b) no carrier filtering, (c) correct number. If it fails, you caught a Day 1 blocker before signing the contract. See `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10 for the full phone setup flow.
6. **Google Business Profile access:** &ldquo;Can you log into your Google Business Profile?&rdquo; &mdash; not a dealbreaker, but flags a blocker for the Day 7 listing migration. If they can&rsquo;t access it, help them claim/verify it during onboarding so it&rsquo;s ready by Day 7.

---

## Why This Niche

**8-agent consensus rationale (2026-04-11):**

- 4 of 8 agents picked basement as #1. #1 or #2 for 7 of 8 agents.
- Underground = no signal &rarr; Voice AI is uniquely valuable. The pitch writes itself.
- Year-round interior work &rarr; zero seasonal churn risk
- Calgary&rsquo;s secondary suite incentive &rarr; sustained demand, financially motivated buyers
- 150&ndash;200+ contractors in Calgary &rarr; deep enough market for 15&ndash;22 clients
- Underserved by marketing agencies &rarr; low agency fatigue, cold calls get answered
- Transactional lead type &rarr; AI first-response is perfect (spec + quote, not design relationship)
- Standardized scope &rarr; AI KB is easier to build, fewer escalations

---

## Sub-Niches (Priority Order)

| Priority | Sub-Niche | Revenue | Leads/mo | Churn/qtr | LTV | Upsell | Verdict |
|:--------:|---------|---------|:--------:|:---------:|:---:|:------:|---------|
| 1 | Kitchen &amp; Bath Renovators | $1M&ndash;$5M | 20&ndash;35 | 3&ndash;5% | $24&ndash;42K | High | **PRIMARY TARGET** &mdash; high project value, steady demand |
| 2 | Basement Development | $1M&ndash;$3M | 20&ndash;30 | 3&ndash;5% | $18&ndash;30K | Medium | Strong &mdash; underground = no signal, Voice AI pitch writes itself |
| 3 | Whole-Home / Additions | $2M&ndash;$10M | 15&ndash;25 | 2&ndash;3% | $30&ndash;50K | High | Premium tier target &mdash; longer sales cycles, higher project values |
| 4 | Solo Finisher (&lt;$1M) | $600K&ndash;$1M | 15&ndash;18 | 8&ndash;12% | $8&ndash;12K | Low | Inbound only &mdash; higher churn makes acquisition ROI thin |
| 5 | Referral Veteran (15+ yrs) | Varies | 10&ndash;15 | 10&ndash;15% | $6&ndash;8K | Very low | **AVOID as primary** |

---

## Where to Find Them (Calgary + Edmonton)

1. Google Maps: &ldquo;kitchen renovation Calgary&rdquo;, &ldquo;basement development Calgary&rdquo;, &ldquo;home renovation Edmonton&rdquo;
2. BILD Calgary member directory (bild.ca) &mdash; renovation category
3. HomeStars Calgary/Edmonton &mdash; renovation, kitchen, bathroom, basement filters
4. Instagram: #calgaryrenovation #yyccontractor #edmontonrenovation #yegreno
5. Facebook: &ldquo;Calgary Renovation&rdquo; and &ldquo;Edmonton Renovation&rdquo; groups
6. Kijiji Calgary/Edmonton &mdash; services &mdash; renovation
7. Supplier showrooms: lumber yards, Olympia Tile, Emco &mdash; ask reps &ldquo;who are your busiest renovation contractors?&rdquo;

---

## Cold Call Script

&ldquo;Hey [Name], this is [Your Name] from Calgary. Quick one &mdash; I built something for renovation contractors that texts back every missed call in 5 seconds, follows up on every estimate for 2 weeks, and books the site visit while you&rsquo;re still on the job. Most guys I talk to are losing 3&ndash;4 jobs a year just from leads that went cold. We have a Pilot rate for our first three clients. You got 15 minutes this week?&rdquo;

---

## Pricing

| Tier | Setup Fee | Monthly Fee | Availability |
|------|-----------|-------------|--------------|
| **Pilot** | $3,500 | $1,500/mo | First 3 clients only (case studies), 90-day minimum |
| **Standard** | $5,500 | $2,000/mo | General availability, 90-day minimum then month-to-month |
| **Premium / Booked Estimate OS** | $9,500 | $3,500/mo | Larger firms, 90-day minimum then month-to-month |

Setup fee always charged (can split 50/50 for Standard/Premium). Voice AI included free in all tiers. No trial period, no free month.

---

## Expansion Path

**Do NOT pursue until primary ICP is proven (5+ clients).**

| Phase | Timing | Move |
|-------|--------|------|
| Phase 2 | Month 4+ | Edmonton renovation contractors &mdash; enter with Calgary case studies |
| Phase 3 | Month 6+ | Broader Alberta &mdash; phone/video sales |
| Phase 4 | Month 8+ | National expansion |

---

## Who to AVOID

| Profile | Reason |
|---------|--------|
| Referral-only contractors (60%+ referral, &lt;10 inbound leads) | Speed-to-lead pitch falls flat |
| Contractors who already have a receptionist/office manager | Problem is already solved |
| Contractors with &lt;$1M revenue | $1,500&ndash;$3,500/month feels heavy relative to revenue |
| Contractors with 48h+ response time | &ldquo;Ghost&rdquo; profiles consume 2.5&times; operator time |
| Deck/fence/exterior contractors | Seasonal churn in Calgary winters |

---

## Background Research

Full analysis: `.scratch/calgary-basement-stress-test.md` and `.scratch/consensus-aggregation.md`
