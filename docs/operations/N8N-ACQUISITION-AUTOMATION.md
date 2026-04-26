# n8n Acquisition Automation System

**Created:** 2026-04-22
**Status:** Built, pending credential setup
**n8n instance:** `n8n-internal.conversionsurgery.io`
**Google Sheet:** `1p4IbPtuJjftVIViUmFfz0iWuCxu5JakiTEn4F9pBm4Q`

---

## Overview

Six n8n workflows automating the customer acquisition pipeline defined in `ACQUISITION-PLAYBOOK-0-TO-5.md` and `templates/SALES-TOOLKIT-BASEMENT.md`. Targets Calgary basement development contractors per `docs/business-intel/ICP-DEFINITION.md`.

**What it automates:**
- Lead sourcing from Google Maps + HomeStars
- AI enrichment and ICP qualification (Claude Haiku)
- Revenue Leak Audit generation (Claude Sonnet)
- Instantly.ai email campaign creation with 3-step sequences
- Daily outreach orchestration (call lists, follow-ups, pipeline metrics)
- Post-demo AI-personalized follow-up sequences
- Apollo contact enrichment (verified emails, phones, company data)

**What stays manual (per playbook):**
- Cold calls (workflow provides prioritized call list + personalized hooks)
- Instagram/Facebook DMs (workflow provides template + list)
- Demos (workflow provides pre-call research)
- Closing and onboarding

---

## Workflow Inventory

| ID | Name | Nodes | Trigger | Purpose |
|----|------|-------|---------|---------|
| `vzresGAahYULlBlJ` | CS 0: Setup & Initialize | 13 | Manual | One-time: creates 5 Google Sheet tabs, tests all API connections |
| `qpHeumDTXCI7CVG3` | CS 1: Lead Sourcing + AI Enrichment | 20 | Manual | Google Maps + HomeStars scraping, Claude Haiku website analysis, Apollo enrichment, ICP scoring |
| `mNuBJ8go3MgEPAsU` | CS 2: Revenue Leak Audit Generator | 9 | Webhook | Claude Sonnet generates personalized audit + outreach email + Day 3/7 follow-ups |
| `V0xHBdgUO60azOGY` | CS 3: Instantly.ai Campaign Builder | 14 | Webhook | Reads leads + audits, builds 3-step email sequences, pushes to Instantly.ai API |
| `JGLRMa8m8SJN7cJt` | CS 4: Daily Outreach Orchestrator | 9 | Cron (7AM Mon-Sat) + Webhook | Pipeline analysis, daily call list, follow-up actions, cold text generation, metrics |
| `mZehJNqI22xRHiyZ` | CS 5: Post-Demo Follow-Up + Nurture | 8 | Webhook | AI-personalized Day 0/3/7 post-demo sequences, monthly nurture, Day 30 referral asks |

---

## Execution Flow

```
CS 0 (run once)
  |
  v
CS 1: Source leads ──────────────────> Leads tab (Google Sheet)
  |                                         |
  v                                         v
CS 2: Generate audits for Tier A/B ──> Audits tab
  |                                         |
  v                                         v
CS 3: Build Instantly campaigns ─────> Campaigns tab + Instantly.ai
  |
  v
CS 4: Daily 7AM brief (activate!) ──> DailyBriefs tab
  |
  v
CS 5: Post-demo follow-ups ─────────> FollowUps tab
```

---

## Google Sheet Tabs

All created by CS 0 on first run.

### Leads (main tab)

| Column | Source | Purpose |
|--------|--------|---------|
| businessName | AI enrichment | Company name |
| ownerName | AI enrichment | Owner/founder name |
| url | Google Maps / HomeStars | Website URL |
| emails | Scraping + Apollo | Verified email addresses |
| phones | Scraping + Apollo | Phone numbers |
| services | AI enrichment | Services offered |
| isBasement | AI enrichment | Boolean: does basement work? |
| teamSize | AI enrichment | solo/small/medium/large |
| reviewCount | AI enrichment | Google review count |
| icpFit | AI enrichment | 0-100 ICP score |
| qualTier | Qualification logic | A (70+) / B (45-69) / C (<45) |
| icpReasoning | AI enrichment | Why this score |
| personalizedHook | AI enrichment | Cold outreach opener line |
| painSignals | AI enrichment | Detected pain points |
| source | Pipeline | google_maps / homestars |
| status | Manual tracking | new / contacted / responded / demo booked / demo done / follow-up / signed / pass |
| auditSent | Manual tracking | Yes / No |
| callStatus | Manual tracking | new / voicemail / connected / demo booked / signed / pass |
| lastContactDate | Manual tracking | Date of last outreach |
| channelsUsed | Manual tracking | phone, email, dm, text |
| demoDate | Manual tracking | Scheduled demo date |
| notes | Manual tracking | Call notes, objections |

### Audits

| Column | Purpose |
|--------|---------|
| businessName | Lead reference |
| url | Website |
| auditText | Full Revenue Leak Audit (Claude Sonnet) |
| emailSubject | Outreach email subject line |
| emailBody | Full outreach email wrapping the audit |
| followUp3 | Day 3 follow-up text |
| followUp7 | Day 7 follow-up text |
| generatedAt | Timestamp |
| sentAt | When sent (manual) |
| responseReceived | Did they reply? (manual) |

### Campaigns

| Column | Purpose |
|--------|---------|
| email | Lead email |
| businessName | Company |
| campaignType | cold_audit / nurture_monthly / referral_request |
| campaignId | Instantly.ai campaign ID |
| step1Subject / step1Body | Day 0: Audit delivery email |
| step2Subject / step2Body | Day 3: Follow-up |
| step3Subject / step3Body | Day 7: Final touch |
| sentAt | Campaign creation timestamp |
| opened / replied | Tracking (from Instantly) |

### DailyBriefs

| Column | Purpose |
|--------|---------|
| date | Brief date |
| dayOfWeek | Monday-Saturday |
| brief | Full text daily brief |
| callCount | Leads to call today |
| followUpCount | Day 3/7 follow-ups due |
| auditsNeeded | Tier A/B without audit |
| pipelineTotal | Total leads |
| newLeads / contacted / demosBooked / signed | Pipeline stage counts |

### FollowUps

| Column | Purpose |
|--------|---------|
| businessName | Lead reference |
| phone / email | Contact info |
| sequenceType | post_demo / nurture / referral |
| day0Message | Same-day follow-up |
| day3Message | Day 3 follow-up |
| day7Message | Day 7 final touch |
| day0Sent / day3Sent / day7Sent | Send tracking |
| replied | Stops sequence if Yes |
| generatedAt | Timestamp |
| notes | Manual notes |

---

## AI Usage

| Workflow | Model | Purpose | Cost/lead |
|----------|-------|---------|-----------|
| CS 1 | Claude Haiku 4.5 | Website analysis, ICP scoring, personalized hook | ~$0.002 |
| CS 2 | Claude Sonnet 4.5 | Revenue Leak Audit generation + outreach emails | ~$0.02 |
| CS 5 | Claude Sonnet 4.5 | Personalized follow-up sequences based on objections | ~$0.01 |

Estimated cost per full pipeline lead: ~$0.03

---

## Credentials

Created in n8n, need real API keys:

| Credential | n8n ID | Type | Status |
|-----------|--------|------|--------|
| Anthropic API Key | `JTu5n2bdJFUTnonb` | httpHeaderAuth (x-api-key) | Needs real key |
| Apollo API Key | `JvZHNJ90928rb32W` | httpHeaderAuth (x-api-key) | Needs real key |
| Instantly API Key | `BQoiK1glM1eVG5U8` | httpHeaderAuth (Authorization: Bearer) | Needs real key |
| Google Sheets OAuth2 | — | OAuth2 | Needs full setup |

---

## MCP Access

n8n MCP server connected to Claude Code via `.mcp.json` (gitignored, contains bearer token).

MCP capabilities:
- `search_workflows` &mdash; find workflows
- `get_workflow_details` &mdash; inspect workflow config
- `execute_workflow` &mdash; trigger workflows with MCP access enabled

All CS workflows have `availableInMCP: true`.

n8n REST API used for workflow creation/updates (separate API key from MCP token).

---

## Setup Steps

1. **n8n Settings &rarr; Credentials:** Update placeholder keys with real API keys for Anthropic, Apollo, Instantly
2. **Google Sheets OAuth2:** Create Google Cloud OAuth credential, connect in n8n (see setup steps in conversation history)
3. **Connect Google Sheets** to every CS workflow: open each workflow &rarr; click each Sheets node &rarr; select credential &rarr; Save
4. **Run CS 0:** Initializes all sheet tabs + tests API connections
5. **Activate CS 4:** Only workflow that should stay active (daily 7AM cron)
6. **Run CS 1:** First lead sourcing batch
7. **Run CS 2** for Tier A/B leads: generates Revenue Leak Audits
8. **Run CS 3:** Builds Instantly.ai campaigns from leads + audits

---

## Playbook Alignment

| Playbook Step | Workflow | Automation Level |
|--------------|----------|-----------------|
| Phase 0: Build prospect list | CS 1 | Full auto: 15 queries across Calgary + satellite cities |
| Phase 0: Qualification filter | CS 1 | Full auto: Claude scores against ICP 30-second qualifier |
| Phase 0: Rank list | CS 1 | Full auto: A/B/C tiers |
| Phase 1: Revenue Leak Audit (2/day) | CS 2 | Full auto: Sonnet writes audit + wraps in outreach email |
| Phase 1: Multi-channel outreach | CS 3 + CS 4 | Partial: email via Instantly, texts via CS 4, calls/DMs manual |
| Phase 1: Follow-up cadence (Day 0/3/7) | CS 3 | Full auto: 3-step Instantly sequence |
| Phase 2: Post-demo follow-up | CS 5 | Full auto: AI-personalized based on objection handling |
| Phase 3: Monthly nurture | CS 5 | Triggered: market insight emails for non-closers |
| Phase 3: Referral request | CS 5 | Triggered: Day 30 ask for signed clients |
| Daily routine: 7AM brief | CS 4 | Full auto: pipeline analysis + prioritized action list |
| Weekly rhythm: call sessions | CS 4 | Partial: call list generated, calls are manual |
| Pre-call research | CS 1 + CS 2 | Full auto: AI provides personalized hook per prospect |

---

## ICP Queries (Pre-loaded in CS 1)

```
basement+development+calgary
basement+finishing+calgary
basement+renovation+calgary
basement+contractor+calgary
secondary+suite+contractor+calgary
basement+development+airdrie
basement+development+cochrane
basement+development+chestermere
basement+development+okotoks
basement+finishing+airdrie
basement+finishing+cochrane
basement+finishing+chestermere
basement+finishing+okotoks
legal+suite+contractor+calgary
basement+renovation+airdrie+cochrane
```

---

## Maintenance

- **Adding queries:** Pin new data to CS 1 "Run Pipeline" node
- **Changing email templates:** Edit CS 2 "AI Generate Audit" prompt or CS 3 "Build sequences per lead" code
- **Adjusting ICP scoring:** Edit CS 1 "AI Enrich (Claude)" prompt
- **Changing follow-up cadence:** Edit CS 5 "AI Generate follow-ups" prompt
- **Adding new sources:** Add HTTP Request + Code nodes to CS 1 before "Loop over leads"

---

*This system was built 2026-04-22 via n8n REST API from Claude Code. Template workflows from Akram and Nick are retained as reference in n8n but inactive.*
