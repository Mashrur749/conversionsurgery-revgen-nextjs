# Phase 2: End-to-End Offer Architecture

Status: Planning (not building until 5-7 paying managed clients)
Date: 2026-04-10

---

## Overview

Evolve ConversionSurgery from a revenue recovery backend into a complete customer acquisition system for contractors. One platform, full funnel, contractor's only job is showing up and doing the work.

**Target ARPU:** $4,000-7,000/month (up from $1,000 managed)

---

## Full Funnel

```
Google Ads → Landing Page → Conversion Experiments → Split Path:

  Path A (Ready Now):
    → AI qualifies → Books appointment → Contractor closes

  Path B (Not Yet):
    → Lead magnet capture → Nurture sequence → AI re-engages when ready
    → Eventually converts to Path A
```

---

## Components

### 1. Google Ads (Templatized)

- Pre-built campaign templates per contractor vertical (kitchen, bathroom, roofing, general, etc.)
- Google Ads API integration — client sets budget, templates handle targeting + copy
- Closed-loop attribution: form fill → AI qualifies → appointment booked → conversion event fired back to Google for campaign self-optimization
- Same playbook deployed N times (not custom campaigns per client)

### 2. Landing Pages (Templatized, Not CMS)

- 3-5 templates per contractor niche
- Client picks template, fills in business info, done
- Hosted on ConversionSurgery (simple subdomain or path routing)
- Embeddable forms for clients who already have websites

### 3. Conversion Experiments

- A/B testing on landing pages (headline, CTA, layout variants)
- A/B testing on lead magnets (which magnet converts better per vertical)
- Data compounds across clients — after 20 clients in same niche, templates outperform any generic agency
- This conversion intelligence is the core IP

### 4. AI Sales + Appointment Setting (Existing)

- Already built: AI conversation agent, booking, calendar sync, follow-up automation
- Extend: support email channel alongside SMS for nurture sequences

### 5. Lead Magnets (Templatized Per Trade Per City)

**Basement-specific magnets (primary):**

| Magnet type | Example | Data captured |
|-------------|---------|---------------|
| Cost guide | "2026 Calgary Basement Development Cost Guide" | Email, project type (full finish vs. secondary suite), budget range |
| Secondary suite ROI calculator | "Will a Legal Suite Pay for Itself? Free Calculator" (interactive) | Email, home value, rental market area, suite scope |
| Contractor vetting checklist | "7 Questions to Ask Before Hiring a Basement Developer" | Email, timeline |
| Before/after gallery | "Calgary Basement Transformations + Pricing Ranges" | Email, project interest |
| Permit guide | "Calgary Secondary Suite Permits: What You Need to Know" | Email, project type, timeline |

**Framework is trade-agnostic:** swap trade, city, and contractor branding for kitchen/bath expansion.

Same framework per vertical — swap trade, city, and contractor branding.

### 6. Lead Nurture Sequences (AI-Driven)

For leads who aren't ready to book immediately (majority for $10-50K renovation decisions):

| Day | Touch | Channel |
|-----|-------|---------|
| 0 | Deliver lead magnet + ask "when are you thinking of starting?" | Email |
| 2 | One relevant tip based on project type | Email |
| 5 | Social proof — recent project completion in their area | Email or SMS |
| 10 | Soft ask — "Want a free estimate? Takes 15 minutes" | SMS |
| 20+ | AI monitors for re-engagement signals, adjusts timing | SMS (existing AI) |

Once the lead replies or engages, the existing AI conversation agent takes over.

---

## Exclusivity Model

**One contractor per trade per metro area.**

- Kitchen remodeler in Calgary = locked. No other kitchen remodeler in Calgary.
- Roofer in Calgary = separate slot, no conflict.
- Kitchen remodeler in Edmonton = separate slot, no conflict.

Why exclusivity matters:
- Justifies premium pricing ($5-7K vs $4K)
- Prevents churn — leaving means a competitor gets their slot
- Creates sales urgency — "your competitor already inquired"
- Caps client count naturally (solo operator constraint)
- Keeps ad data clean — no split loyalty on optimization

---

## Technical Build Assessment

| Component | Status | Lift |
|-----------|--------|------|
| Google Ads API integration | Need | Medium — API is well-documented, templatized approach simplifies |
| Landing page templates | Need | Medium — static templates with variable injection |
| A/B testing framework | Need | Small-medium — variant serving + conversion tracking |
| Email capture + lead magnet storage | Need | Small — new table, Resend integration (already used for auth) |
| Lead magnet hosting (PDFs/pages) | Need | Small — templatized PDF generation or hosted pages |
| Email nurture sequences | Need | Small — extend existing flow engine to support email channel |
| AI conversation + booking | Built | — |
| Follow-up automation | Built | — |
| Dormant re-engagement | Built | — |
| Calendar sync | Built | — |
| Payment collection | Built | — |
| Review generation | Built | — |
| Reporting + ROI attribution | Built | Extend — add ad spend → appointment → close attribution |

Roughly 60% of the backend already exists. Primary builds: ads integration, landing pages, email channel, A/B framework.

---

## Primary ICP: Calgary Basement Development Contractors

**Canonical ICP definition:** `docs/business-intel/ICP-DEFINITION.md` &mdash; single source of truth for profile, sub-segment priority, 30-second qualifier, where to find them, and avoidance criteria.

Per 8-agent stochastic consensus (2026-04-11): basement development beat kitchen/bath on 7 of 8 agent lenses. Key advantages: no agency fatigue (underserved niche), transactional lead type fits AI perfectly, &ldquo;no cell signal underground&rdquo; is a visceral demo, 150&ndash;200+ prospects in Calgary, $50&ndash;120K project values, year-round interior work.

**Upsell filter:** &ldquo;Are you running any ads right now?&rdquo; Best prospects are currently spending $500&ndash;2K/month on Google/HomeStars with no attribution, or tried ads and stopped.

## Upsell Ladder

| Tier | When | What | Price | Cumulative |
|------|------|------|-------|------------|
| Base | Month 1 | Lead response + follow-up + reviews + bi-weekly strategy calls | $1,000/mo | $1,000/mo |
| Team | Month 2-3 | Additional team members + phone numbers | +$55-75/mo | ~$1,050/mo |
| Ads | Month 4-6 | Google Ads management, closed-loop attribution (same budget, 2-3x more appointments) | +$1,500-2,500/mo | $2,500-3,500/mo |
| Web | Month 4-6 | Conversion-optimized landing page replacing DIY website | $2,500 one-time + $200/mo hosting | +$200/mo |
| Growth | Month 8-12 | GBP optimization + content + Facebook Ads | +$800-1,500/mo | $3,500-5,200/mo |

**Key insight:** Don't need 15 clients at $1K. Need 8 at $4K = $32K MRR.

### Pricing Psychology (ICP-specific)

**$1,000 not $997.** Contractors see $997 as a marketing trick. Round number = honest. These are tradesmen, not SaaS buyers.

**Escalation path (invisible):**
- Clients 1-10: $1,000/mo ("founding rate")
- Clients 11-15: $1,200/mo ("founding clients at capacity")
- Clients 16+: $1,500/mo (case studies justify premium)
- Never announce increases. Just change the rate for new clients.

**Framing on the sales call — let them discover the price:**
1. "What are you spending on HomeStars right now?" → they say $400-500
2. "And Google Ads?" → they say $500-800
3. "So $1,200/month on lead gen. How many actually turn into booked estimates?" → "maybe half"
4. "This is $1,000. Less than what you already spend. But the leads actually convert."

**If referral-only (no ad spend):** "What does a day of labor cost you? This is less than one day. Runs 24/7 for a month."

**The one-liner:** "A thousand a month. Month to month. First month free so you can see it work. One recovered basement covers the entire year."

**What NOT to do:**
- No tiers (Basic/Pro/Enterprise) — signals "the cheap one probably doesn't work"
- No $997/$497 "7-ending" pricing — internet marketing signal, contractors see through it
- No annual discounts — they won't commit, and asking signals churn worry
- No performance-based pricing — creates disputes ("that lead was my buddy's referral")

**ROI math (use PROFIT, not revenue):**
- $80K basement project at 20% margin = $16K profit
- One recovered job covers 16 months of the service
- Recovering 1 leaked lead/month = 16x monthly ROI
- Never say "one job pays for 6.7 years" — that's revenue math, not profit math

**Upsell rules:**
1. Never upsell before base service proves ROI (wait for Day 45 strategy call with concrete numbers)
2. Never upsell to a client who hasn't confirmed a win via WON command
3. The upsell should come from THEM on the bi-weekly call, not a pitch

## Sequencing

1. **Now → 5-7 clients:** Prove backend with Calgary basement contractors, collect conversion data, build case studies
2. **At 5-7 clients:** Build templatized ads + landing pages using real keyword/conversion intelligence from basement niche
3. **Upsell existing clients:** $997 → $2,500-4,000/mo via Ads + Web tiers
4. **Month 4+:** Expand to kitchen/bath with 15-client case study proof
5. **Month 6+:** Expand to Edmonton/Alberta via phone/video sales
6. **Agency licensing (Phase 3):** Agencies get the full stack, higher licensing fee ($5-8K/month)

---

## Open Questions (For Monte Carlo Simulation)

- Optimal lead magnet → nurture → booking conversion paths per vertical
- UX flows for contractor onboarding into ads (budget setting, template selection, approval)
- UX flows for lead magnet creation (how much contractor input needed vs fully templatized)
- Nurture sequence timing optimization per project size/timeline
- Landing page variant performance across contractor verticals
- Email vs SMS vs multi-channel nurture effectiveness
- Exclusivity pricing tiers — flat premium or auction-based per market?
