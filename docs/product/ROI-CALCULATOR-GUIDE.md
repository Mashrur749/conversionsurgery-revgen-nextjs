# ROI Calculator — Marketing Site Reference Guide

This guide covers everything you need to build the ROI Calculator on the marketing site: what it does, how to wire up the API, what each form field means, how the math works, and how to display the results.

---

## What It Does

The ROI Calculator takes a contractor's business inputs — how many estimates they send, their average project value, close rate, and how fast they respond — and shows them two numbers:

1. **How much revenue they're losing annually** to slow response and poor follow-up
2. **How much of that is recoverable** with ConversionSurgery

The goal is to make the problem visceral and personal before asking for a booking. When someone sees "$480,000 left on the table per year," the $1,000/month price stops looking like a cost and starts looking like a no-brainer.

Every submission is stored in the database for follow-up. If the prospect books a call, the salesperson (you) already has their numbers before the conversation starts.

---

## The API Endpoint

```
POST /api/public/roi-calculator
```

- **Authentication:** None required. This is a public endpoint.
- **Content-Type:** `application/json`
- **CORS:** Open (`*`) — you can call this directly from any marketing site domain.
- **Rate limit:** 10 requests per IP per minute (protects against abuse).
- **Deduplication:** Same email submitted twice within 60 seconds returns a result without writing a second row to the database.

**Base URL in production:** `https://app.conversionsurgery.com/api/public/roi-calculator`

---

## Form Fields

### Required Fields

| Field | Type | Constraints | Suggested Form Label |
|---|---|---|---|
| `name` | string | max 200 chars | "Your name" |
| `email` | string (email format) | valid email | "Email address" |
| `businessName` | string | max 200 chars | "Business name" |
| `monthlyEstimates` | integer | 1 – 500 | "How many estimates do you send per month?" |
| `avgProjectValue` | number | $100 – $1,000,000 | "What is your average project value?" |
| `currentCloseRate` | number | 0 – 100 (as a percentage) | "What percentage of your estimates turn into jobs?" |
| `responseTime` | enum (see below) | one of 5 values | "How quickly do you typically respond to a new lead?" |

### Optional Fields

| Field | Type | Constraints | Suggested Form Label |
|---|---|---|---|
| `phone` | string | max 20 chars | "Phone number" |
| `trade` | string | max 100 chars | "What type of renovation work do you do?" |
| `afterHoursPercent` | number | 0 – 100 | "What percentage of your leads come in after business hours?" |
| `followUpConsistency` | enum (see below) | one of 4 values | "How consistently do you follow up on estimates that go quiet?" |
| `followUpTouches` | integer | 0 – 20 | "How many times do you typically follow up before giving up?" |
| `hoursPerWeek` | number | 0 – 100 | "How many hours per week do you spend on lead follow-up and admin?" |
| `hourlyValue` | number | $0 – $1,000 | "What is your time worth per hour?" |
| `utmSource` | string | max 255 chars | (hidden field — auto-populate from URL params) |
| `utmMedium` | string | max 255 chars | (hidden field — auto-populate from URL params) |
| `utmCampaign` | string | max 255 chars | (hidden field — auto-populate from URL params) |
| `referrer` | string | max 2000 chars | (hidden field — auto-populate from `document.referrer`) |

### Help Text for Key Fields

**"How many estimates do you send per month?"**
Count all quotes — formal proposals, verbal ballparks, and follow-up numbers. If it takes your time to produce it, count it.

**"What is your average project value?"**
Your typical kitchen, bathroom, or renovation job in dollars. If you do a mix, use a weighted average. A $200K custom job that happens once a year should not inflate this number — think about the job you win most often.

**"What percentage of your estimates turn into jobs?"**
If you send 10 quotes and win 3, that is 30%. Most residential remodelers are between 20% and 40%.

**"What is your time worth per hour?"**
Use what you would charge for a consulting hour, or divide your annual income by the hours you actually work. This is used to calculate time savings — it does not affect the revenue recovery numbers.

---

## Enum Values (copy these exactly into your API calls)

### `responseTime`

| API value | Display label |
|---|---|
| `under_5min` | Under 5 minutes |
| `5_30min` | 5–30 minutes |
| `30min_2hr` | 30 minutes to 2 hours |
| `2hr_24hr` | 2–24 hours |
| `over_24hr` | Over 24 hours |

### `followUpConsistency`

| API value | Display label |
|---|---|
| `always` | Always — I have a system |
| `sometimes` | Sometimes — when I remember |
| `rarely` | Rarely — a few attempts at most |
| `never` | Never — I send the quote and wait |

---

## How the Calculation Works

The math has two steps. Both use conservative industry benchmarks.

### Step 1: Lost Revenue from Slow Response

The first contractor to respond wins the job 78% of the time (Harvard Business Review, Lead Response Management study). Every hour of delay shrinks the odds that the lead is still comparing options — and grows the odds a competitor already has them.

The calculator translates response time into a "revenue at risk" percentage of your total unclosed annual pipeline:

| Response time | Revenue at risk |
|---|---|
| Under 5 minutes | 5% (you are already fast) |
| 5–30 minutes | 15% |
| 30 minutes to 2 hours | 30% |
| 2–24 hours | 50% |
| Over 24 hours | 70% |

**Formula:**

```
Lost Revenue (annual) =
  Monthly Estimates
  x Average Project Value
  x (1 - Close Rate / 100)          <- the unclosed portion of your pipeline
  x 12                               <- annualized
  x Response Time Penalty
```

**Example:** 20 estimates/month, $50,000 avg value, 25% close rate, responding in 2–24 hours:

```
20 x $50,000 x 0.75 x 12 x 0.50 = $4,500,000
```

This is the portion of your annual unclosed pipeline attributed to slow response. It is a theoretical ceiling, not a guarantee.

### Step 2: Recoverable Revenue Through Better Follow-Up

Of the revenue being lost, only a portion is practically recoverable — the rest is lost to competitors who were faster, leads that were never serious, or jobs outside your capacity. The recovery rate is based on how consistent follow-up is today: the less follow-up happening now, the more upside exists.

| Follow-up consistency | Recovery rate |
|---|---|
| Always (you have a system) | 10% of lost revenue |
| Sometimes | 20% |
| Rarely | 35% |
| Never | 45% |

If `followUpConsistency` is not provided, the API defaults to `sometimes` (20%).

**Formula:**

```
Potential Recovery (annual) = Lost Revenue x Follow-Up Recovery Rate
```

**Example (continuing):** $4,500,000 lost x 35% (rarely follows up) = $1,575,000

### Step 3: Projected ROI

```
Projected ROI = Potential Recovery / Annual Service Cost ($12,000)
```

**Example:** $1,575,000 / $12,000 = **131x**

The annual service cost is always $12,000 ($1,000/month x 12). This is hardcoded in the calculator.

---

## Sample API Request

```json
POST /api/public/roi-calculator
Content-Type: application/json

{
  "name": "Mike Caruso",
  "email": "mike@carusoreno.com",
  "businessName": "Caruso Renovation",
  "phone": "6175551234",
  "trade": "Kitchen and bath",
  "monthlyEstimates": 20,
  "avgProjectValue": 50000,
  "currentCloseRate": 25,
  "responseTime": "2hr_24hr",
  "followUpConsistency": "rarely",
  "afterHoursPercent": 40,
  "followUpTouches": 2,
  "hoursPerWeek": 8,
  "hourlyValue": 150,
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "contractor-roi-2026",
  "referrer": "https://google.com"
}
```

## Sample API Response

```json
{
  "success": true,
  "results": {
    "lostRevenueAnnual": 4500000,
    "potentialRecoveryAnnual": 1575000,
    "projectedRoi": 131.25,
    "monthlyServiceCost": 1000,
    "annualServiceCost": 12000
  }
}
```

### Error Response (validation failure)

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "monthlyEstimates": ["Expected number, received nan"],
    "email": ["Invalid email"]
  }
}
```

### Error Response (rate limited)

```json
{
  "success": false,
  "error": "Too many requests. Please try again later."
}
```

HTTP status codes: `200` success, `400` validation error, `429` rate limited, `500` server error.

---

## Displaying the Results

### Recommended Copy Blocks

Use these on the results page or inline after form submission. Replace the bold placeholders with the values from the API response.

**Primary headline:**
> Based on your numbers, you are leaving approximately **$[lostRevenueAnnual formatted]** on the table every year due to slow lead response.

**Recovery line:**
> With instant response and systematic follow-up, the estimated recoverable revenue is **$[potentialRecoveryAnnual formatted]** per year.

**ROI line:**
> At $1,000/month, that is a projected **[projectedRoi]x return** on your investment.

**Payback line:**
> One recovered [trade] project at $[avgProjectValue formatted] covers **[months to break even] months** of service.

To calculate months to break even: `Math.ceil(1000 / (potentialRecoveryAnnual / 12))`

**Disclaimer (include below all results — non-negotiable):**
> Estimates are based on industry response-time data and the inputs you provided. Actual results vary by market, competition, close process, and lead quality.

### Formatting Numbers

- Dollar amounts: use `$` prefix, comma separators, no decimals for whole numbers (e.g., $1,575,000 not $1575000.00)
- ROI multiplier: one decimal place followed by "x" (e.g., 131.3x)
- If `projectedRoi` is less than 1, show it as a fraction or percentage rather than a multiplier (rare edge case for very low estimates or very high close rates)

### Call to Action

Place immediately below the results:

> **Want to see this in action with your own data?**
> Book a 15-minute call and we will walk through exactly how ConversionSurgery captures the leads you are currently losing — using your numbers, not hypotheticals.
> [Book a Call →]

---

## Privacy and Data Handling

Every form submission is written to the `roi_calculator_leads` table in the database. This includes:

- All form inputs (name, email, business name, phone, trade, and all numeric inputs)
- The calculated results (lost revenue, potential recovery, projected ROI)
- Attribution data: UTM source, medium, campaign, and the page referrer
- Technical metadata: IP address and browser user agent (for abuse detection only)

**What the data is used for:**
- If the prospect books a call, their numbers are pre-loaded so you can reference them in the conversation
- The submission list serves as a warm lead pool for outreach
- UTM data shows which channels are driving high-intent calculator usage

**What you should tell users on the form:**
A one-liner is enough: "We store your results to personalize your consultation. No spam — ever."

---

## Implementation Notes for the Marketing Site

1. **Send UTM params automatically.** Parse `utm_source`, `utm_medium`, and `utm_campaign` from the URL on page load and include them in the API payload as hidden fields. Same for `document.referrer`. This attribution data is valuable for tracking which ads and content drive bookings.

2. **Show a progress bar or step indicator.** The form has 13+ fields. Break it into 2–3 steps: business basics (name, email, business), estimate volume and value, response habits. Fewer fields per screen = higher completion rate.

3. **Show results without a page reload.** Call the API via `fetch` on form submit, parse the JSON, and animate the numbers into view on the same page. A result page that loads instantly feels credible; a full page reload feels like software.

4. **Gate the results behind email.** Email is required. The CTA after results should be a calendar booking link (Calendly or equivalent), not another form.

5. **Mobile-first.** Most contractors will use this on a phone, often mid-conversation with a salesperson or after seeing a social ad. Stack the form vertically, use large tap targets, and show results in a single-column layout.

6. **Do not show the raw ROI multiplier if it is extreme.** A 1,000x ROI claim looks fake. Cap the displayed multiplier at 200x for credibility, or switch to a dollar-amount-only format for very large contractors. The underlying data is still stored accurately.
