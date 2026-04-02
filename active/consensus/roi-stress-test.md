# ROI Stress Test — 10-Agent Consensus

**Problem**: Is $1,000/month genuinely a no-brainer for Alberta renovation contractors? What gaps exist between "good service" and "undeniable offer"?
**Agents**: 10 (Sonnet, varied framings)
**Date**: 2026-04-02

---

## Verdict: $1,000/month is correct. Don't change the price.

10/10 agents confirmed the ROI math works. Break-even is 1 recovered project per year — a trivially low bar.

| Profile | Leads/mo | Avg Project | Break-Even | Realistic ROI |
|---------|:--------:|:-----------:|:----------:|:-------------:|
| Small (deck/bath) | 8 | $20-25K | 1 job / 6 months | 5-8x |
| Medium (kitchen) | 15 | $40-45K | 1 job / 9 months | 13-17x |
| Large (kitchen/basement) | 25+ | $50-55K | 1 job / year | 25x+ |

10/10 agents rejected performance-based and hybrid pricing. Attribution disputes destroy relationships.

---

## The 5 Things That Make This Undeniable

1. **Social proof from client #1** (10/10) — one real Alberta story outweighs every ROI table
2. **Lead Leak Snapshot** (7/10) — pre-signup calculator showing the contractor's own loss number
3. **System announces its own wins** (8/10) — Revenue Recovered card as loudest dashboard element
4. **Loss ceiling stated explicitly** (7/10) — "Max risk: $1,000. One project covers 3-5 years."
5. **Relationship Protection Clause** (5/10) — name the existing AI safety net as a formal promise

---

## The 5 Anxiety Points

1. "AI will say something wrong" (10/10) — show Smart Assist live, say "review mode forever if you want"
2. "I got burned before" (9/10) — lead with guarantee, not features
3. "$1,000 in a slow month" (8/10) — state loss ceiling, seasonal pause exists
4. "I don't have time" (7/10) — "20-minute call, then 2-3 texts per week"
5. "My referral business is different" (7/10) — pivot to estimate follow-up + reviews

---

## Lead Leak Snapshot — Marketing Site Spec

### What it is
A pre-signup conversion tool on the marketing site. The contractor enters 5 numbers about their business and gets a personalized estimate of annual revenue they're currently losing to missed follow-ups, slow response, and dormant quotes. No account required.

### Fields (5 inputs)

1. **How many estimates do you send per month?** (number input, default: 10)
2. **What's your average project value?** ($, default: $40,000)
3. **How many of those estimates get no response?** (number or %, default: 60%)
4. **How many old quotes are sitting in your phone with no follow-up?** (number, default: 20)
5. **How quickly do you typically respond to a new inquiry?** (dropdown: under 5 min / 5-30 min / 30 min - 2 hours / same day / next day)

### Formulas

```
Dead Quote Recovery:
  recoverable = old_quotes * 0.10 (conservative 10% recovery rate)
  dead_quote_value = recoverable * avg_project_value

Estimate Follow-Up Recovery (annual):
  monthly_cold = estimates_per_month * no_response_pct
  annual_recoverable = monthly_cold * 12 * 0.10
  followup_value = annual_recoverable * avg_project_value

Speed-to-Lead Recovery (annual):
  if response_time > 30 min:
    monthly_lost = estimates_per_month * 0.30 (30% lost to faster competitor)
  elif response_time > 5 min:
    monthly_lost = estimates_per_month * 0.15
  else:
    monthly_lost = estimates_per_month * 0.05
  speed_value = monthly_lost * 12 * 0.15 * avg_project_value

Total Annual Revenue at Risk:
  total = dead_quote_value + followup_value + speed_value

ROI Multiple:
  roi = total / 12000  (annual service cost)
```

### Output (one-page result)

```
Based on your numbers:

You have approximately $[total] in annual revenue at risk from:

  Dead quotes sitting unanswered:     $[dead_quote_value]
  Estimates with no follow-up:        $[followup_value]
  Leads lost to slow response:        $[speed_value]

ConversionSurgery costs $12,000/year.
Break-even: recovering [break_even_projects] projects.
You have [old_quotes] quotes sitting in your phone right now.

[CTA: "Get your first month free if 5 leads don't engage in 30 days"]
```

### Design notes
- No account required — this is a marketing page, not a product feature
- Results should feel personal, not generic — use their numbers throughout
- Include a "conservative estimate" label so it doesn't feel like a sales trick
- Add a "share with your spouse" email/PDF export option (addresses Anxiety #3)
- End with the guarantee: "Your maximum risk is $1,000. One month."
- Link to book a demo call or start signup

### Where it fits in the sales process
- Before the sales call: send the prospect a link to fill out
- During the sales call: pull up their results and discuss
- In cold outreach (Angle A): "I ran your numbers — you have ~$X in dead quotes"
