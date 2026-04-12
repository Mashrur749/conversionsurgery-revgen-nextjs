# ICP Definition — Calgary Basement Development Contractor

**Status:** Canonical. This is the single source of truth for who ConversionSurgery sells to.
**Last updated:** 2026-04-11
**Source:** 8-agent stochastic niche consensus + 500-scenario Monte Carlo simulation + 30-profile delivery simulation

All other documents reference this one. Do not duplicate ICP definitions elsewhere &mdash; add a pointer to this file instead.

---

## The One-Liner

&ldquo;We help basement contractors in Calgary catch every lead they miss while they&rsquo;re underground.&rdquo;

---

## Primary ICP: Calgary Basement Development Contractor

| Attribute | Value |
|-----------|-------|
| Trade | Basement development, finishing, secondary suite conversion |
| Revenue | $600K&ndash;$1.5M |
| Avg project | $50&ndash;100K (legal suites: $80&ndash;120K) |
| Team | Owner + 1&ndash;3 crew, NO dedicated office manager |
| Leads | 15&ndash;25/month inbound (Google, HomeStars, Facebook) |
| Follow-up | None systematic &mdash; &ldquo;I send the estimate and hope they call back&rdquo; |
| Google reviews | 10&ndash;60 |
| Location | Calgary metro (Airdrie, Cochrane, Chestermere, Okotoks) |
| Seasonality | Year-round interior work &mdash; zero seasonal risk |
| Response time | Currently 1&ndash;4 hours (underground, no cell signal during builds) |
| Current ad spend | $500&ndash;2,000/month on Google/HomeStars (or tried and stopped) |

---

## The 30-Second Qualifier

All six must pass (Q1-Q4 are dealbreakers, Q5-Q6 are flags):

1. &ldquo;Do you do basement development or finishing?&rdquo; &mdash; if no, pass
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

## Sub-Segments (Priority Order)

| Priority | Segment | Revenue | Leads/mo | Churn/qtr | LTV | Upsell | Verdict |
|:--------:|---------|---------|:--------:|:---------:|:---:|:------:|---------|
| 1 | Small Crew Developer | $800K&ndash;$1.2M | 20&ndash;25 | 3&ndash;5% | $14&ndash;18K | Medium | **PRIMARY TARGET** |
| 2 | Suite Specialist | $1M&ndash;$1.5M | 15&ndash;22 | 2&ndash;3% | $18&ndash;24K | High | Premium &mdash; target 3&ndash;5 |
| 3 | Solo Finisher | $600&ndash;800K | 15&ndash;18 | 8&ndash;12% | $8&ndash;10K | Low | Inbound only until 5+ primary clients &mdash; don&rsquo;t cold-call. Higher churn (58-62% per Markov sim) makes acquisition effort ROI thin. |
| 4 | Referral Veteran (15+ yrs) | Varies | 10&ndash;15 | 10&ndash;15% | $6&ndash;8K | Very low | **AVOID as primary** |

---

## Where to Find Them in Calgary

1. Google Maps: &ldquo;basement development Calgary&rdquo; + &ldquo;basement finishing Calgary&rdquo;
2. BILD Calgary member directory (bild.ca) &mdash; renovation category
3. HomeStars Calgary &mdash; basement renovation filter
4. Instagram: #calgarybasement #yycbasement #calgarybasementdevelopment
5. Facebook: &ldquo;Calgary Basement Development&rdquo; group
6. Kijiji Calgary &mdash; services &mdash; basement
7. Supplier showrooms: lumber yards, Olympia Tile, Emco &mdash; ask reps &ldquo;who are your busiest small basement contractors?&rdquo;

---

## Cold Call Script

&ldquo;Hey [Name], this is [Your Name] from Calgary. Quick one &mdash; I built something for basement contractors that texts back every missed call in 5 seconds, follows up on every estimate for 2 weeks, and books the site visit while you&rsquo;re still on the job. Most guys I talk to are losing 3&ndash;4 basement jobs a year just from leads that went cold. First month&rsquo;s free. You got 15 minutes this week?&rdquo;

---

## Pricing

| Client # | Rate | Notes |
|----------|------|-------|
| 1&ndash;8 | $1,000/month | Founding rate |
| 9&ndash;15 | $1,200/month | &mdash; |
| 16+ | $1,500/month | Case studies justify premium |

Never announce rate increases. Change the rate for new clients; existing clients stay at their original rate.

---

## Expansion Path

**Do NOT pursue until primary ICP is proven (5+ clients).**

| Phase | Timing | Move |
|-------|--------|------|
| Phase 2 | Month 4+ | Kitchen &amp; bath contractors in Calgary &mdash; enter with case studies |
| Phase 3 | Month 6+ | Basement contractors in Edmonton/Alberta &mdash; phone/video sales |
| Phase 4 | Month 8+ | National expansion |

---

## Who to AVOID

| Profile | Reason |
|---------|--------|
| Referral-only contractors (60%+ referral, &lt;10 inbound leads) | Speed-to-lead pitch falls flat |
| Contractors who already have a receptionist/office manager | Problem is already solved |
| Contractors with &lt;$500K revenue | $1,000/month feels heavy |
| Contractors with 48h+ response time | &ldquo;Ghost&rdquo; profiles consume 2.5&times; operator time |
| Deck/fence/exterior contractors | Seasonal churn in Calgary winters |

---

## Background Research

Full analysis: `.scratch/calgary-basement-stress-test.md` and `.scratch/consensus-aggregation.md`
