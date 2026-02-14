# ConversionSurgery — Product Principles (Hook Model)

Reference this document during `/plan` phases when decomposing features that touch user-facing UI.
Every feature should reinforce the Trigger → Action → Variable Reward → Investment loop.

## Users

- **Agency admins**: power users managing multiple clients — need information density, fast navigation, bulk actions
- **Client portal users**: business owners checking leads, conversations, revenue — need clarity, quick answers, mobile access

## 1. Triggers — what brings them back

**Internal triggers** (the goal — users open the app from habit):
- Agency admin: "I wonder which clients need attention" → open admin dashboard
- Client user: "Did any new leads come in?" → open client dashboard
- Both: anxiety about missed revenue → check conversations

**External triggers** (bootstrap the habit until internal triggers form):
- Daily summary email — show just enough value to pull them back in (new leads count, revenue recovered, action items). Never send empty summaries.
- Hot lead alerts — time-sensitive, high-value. SMS or push for hot leads only — don't dilute the channel with low-priority noise.
- Weekly performance digest — "You recovered $X this week" reinforces the product's value and builds the internal trigger.
- Milestone notifications — "You just hit $10K recovered" — celebrate progress to build emotional investment.

**Trigger design rules:**
- Every notification must be actionable — link directly to the relevant page, not the homepage
- Frequency should match urgency: hot lead = instant, summary = daily, digest = weekly
- Let users control notification granularity — never spam, always respect preferences
- External triggers should decrease over time as internal triggers strengthen

## 2. Action — minimize friction to the core behavior

| User | Core action | Target friction |
|------|------------|-----------------|
| Agency admin | Check which clients need attention | One glance at dashboard — red indicators on clients needing action |
| Client user | See new leads and their status | Number visible immediately on dashboard, no clicks needed |
| Client user | Check if AI is handling conversations | Conversation list with status badges — scan in 3 seconds |

**Friction reduction rules:**
- The most important number on each page should be visible without scrolling
- Core actions should take 0-1 clicks from the dashboard
- Pre-load the most likely next page (e.g., clicking a lead should instantly show the conversation)
- Never require login more than once per device — session persistence matters for habit formation
- Mobile experience must match desktop for core actions — client users check on their phone between appointments

## 3. Variable Reward — unpredictable payoffs

In B2B SaaS, these must be genuine business value — not gamification tricks.

**Reward of the Hunt** (finding valuable things):
- New leads appearing — the count changes each time they check
- Revenue recovered ticking up — the number is different every visit
- AI successfully handling a conversation — "it worked without me"
- Discovering a high-value lead in the pipeline

**Reward of Self** (personal achievement):
- Revenue milestones: "$5K recovered", "$10K recovered" — make these visible
- Response time improvements: "Your avg response time improved 40%"
- Conversion rate trends going up on the dashboard
- Seeing flows you configured actually working

**Reward of Tribe** (social validation):
- Client rankings (admin view) — which clients are performing best
- Team performance visibility — who's handling the most conversations
- "Your client [X] just recovered $Y" — success attribution

## 4. Investment — user effort that improves future cycles

**Stored value that compounds:**
- Knowledge base content → AI gives better responses → fewer manual interventions
- Flow customization → more personalized outreach → higher conversion rates
- AI settings/preferences → conversations match business tone → less correction needed
- Team member additions → faster response times → better metrics

**Investment design rules:**
- Show the feedback loop explicitly: "Adding KB articles improves AI response quality"
- After investment, show immediate impact: "AI confidence increased to 85%" after adding KB content
- Make early investment easy — pre-built flow templates, suggested KB entries, sensible defaults
- Never let investment feel wasted — customizations should persist and be visible
- Progress indicators for setup completion: "Your account is 70% configured"

## Applying During Feature Planning

When decomposing a feature, ask:
1. Which part of the Hook loop does this feature serve?
2. Does it create a new trigger, reduce action friction, add variable reward, or deepen investment?
3. If it doesn't serve any part of the loop, is it truly necessary?
4. Can we add a Hook element without additional complexity? (e.g., adding "+12% vs last week" to a KPI is cheap but creates variable reward)
