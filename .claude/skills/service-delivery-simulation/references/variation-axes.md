# Variation Axes — Profile Generation

## Default ICP

Alberta renovation contractors, $500K-$3M annual revenue. Adjust axes if the user specifies a different market.

## Axes

### 1. Team Structure
| Value | Description | ICP frequency |
|-------|-------------|:------------:|
| Solo operator | Owner does everything: sales, estimates, work, follow-up | 25% |
| Owner + spouse/partner | Spouse handles office/phone while owner is on site | 15% |
| Owner + 1-2 crew | Owner runs jobs with small crew, handles all customer contact | 25% |
| Owner + crew leads (3-5 people) | 2-3 crew leads handle site visits; owner manages and sells | 20% |
| Owner + office manager + crew | Dedicated office person handles calls/scheduling; owner focuses on estimates/sales | 10% |
| Owner + office + multiple crews (6+) | Multiple concurrent job sites, dedicated admin staff | 5% |

### 2. Monthly Lead Volume
| Range | Description | ICP frequency |
|-------|-------------|:------------:|
| 5-10 | Low volume, mostly referral-dependent | 20% |
| 10-20 | Moderate, mixed sources | 30% |
| 20-40 | Active, multiple lead sources | 25% |
| 40-60 | High volume, established marketing | 15% |
| 60+ | Very high, likely multi-crew operation | 10% |

### 3. Tech Comfort
| Level | Indicators | ICP frequency |
|-------|-----------|:------------:|
| Low | Uses phone for calls/texts only, paper notes, no apps | 20% |
| Medium-Low | Has smartphone, texts freely, but avoids apps/dashboards | 25% |
| Medium | Uses 1-2 business apps (Jobber, QuickBooks), can navigate a dashboard | 30% |
| Medium-High | Comfortable with multiple tools, uses Google Calendar, responds to email | 15% |
| High | Tech-forward, already uses CRM, marketing tools, tracks metrics | 10% |

### 4. Existing Tools
| Value | Description | ICP frequency |
|-------|-------------|:------------:|
| Nothing | Phone contacts, memory, paper | 25% |
| Spreadsheet / notes app | Google Sheets, Notes app, basic tracking | 15% |
| Jobber | Most common FSM in renovation ICP | 25% |
| Housecall Pro | Second most common FSM | 10% |
| ServiceTitan | Enterprise-tier FSM, rare in ICP | 5% |
| Other FSM (Buildertrend, CoConstruct, etc.) | Various project management tools | 10% |
| Full CRM (HubSpot, Salesforce) | Rare in ICP, indicates larger operation | 5% |
| QuickBooks only | Accounting but no operational tool | 5% |

### 5. Lead Source Mix
| Pattern | Description | ICP frequency |
|---------|-------------|:------------:|
| Mostly referral (70%+) | Word of mouth drives the business | 25% |
| Referral + Google (50/50) | GBP + referrals, some form fills | 30% |
| Mostly inbound (70%+) | Google Ads, GBP, website forms, social | 20% |
| Mixed (calls + forms + referral) | Diversified lead sources | 20% |
| Almost all phone calls | Leads come in by calling, rarely text or fill forms | 5% |

### 6. Average Project Value
| Range | Typical projects | ICP frequency |
|-------|-----------------|:------------:|
| $5K-$15K | Small repairs, single-room updates | 10% |
| $15K-$30K | Bathroom renos, deck builds, smaller kitchens | 25% |
| $30K-$60K | Kitchen renos, basement finishes, additions | 35% |
| $60K-$100K | Full-floor renos, large additions | 20% |
| $100K+ | Whole-home, custom builds | 10% |

### 7. Seasonality Pattern
| Pattern | Description | ICP frequency |
|---------|-------------|:------------:|
| Steady year-round | Interior work, no major dips | 20% |
| Mild seasonal (slight winter dip) | 70% of work in Apr-Oct, 30% Nov-Mar | 35% |
| Strong seasonal (winter dead) | Roofing, concrete, landscaping — near zero Dec-Feb | 25% |
| Boom-bust (feast or famine) | Irregular, large project dependent | 15% |
| Inverse seasonal (busier in winter) | Interior renos peak when people are home | 5% |

### 8. Current Follow-up Process
| Value | Description | ICP frequency |
|-------|-------------|:------------:|
| Nothing | Sends estimate, waits, forgets | 35% |
| Mental notes | "I should call them back" — sometimes does, usually doesn't | 25% |
| Spouse/partner follows up | Informal system, depends on one person remembering | 15% |
| Office manager handles | Systematic but manual — calls, no SMS automation | 10% |
| Basic automation (Jobber reminders) | FSM sends basic notifications, no conversation | 10% |
| Structured follow-up process | Rare — has a defined sequence they actually execute | 5% |

### 9. Business Phone Setup
| Value | Description | ICP frequency |
|-------|-------------|:------------:|
| Personal cell only | Business and personal on same number | 40% |
| Separate business cell | Second phone or second SIM | 25% |
| Google Voice | Uses GV as business line | 15% |
| VoIP/PBX (RingCentral, etc.) | Business phone system | 10% |
| Landline | Office landline, rare but exists | 5% |
| Receptionist/answering service | Already has someone answering | 5% |

### 10. Calendar System
| Value | Description | ICP frequency |
|-------|-------------|:------------:|
| None (memory/paper) | Knows schedule from memory, maybe a paper calendar | 20% |
| Phone calendar (basic) | Uses default phone calendar, no sharing | 25% |
| Google Calendar (personal) | Uses GCal but not for team scheduling | 25% |
| Google Calendar (shared/team) | Team has access to shared calendar | 15% |
| Outlook/Exchange | Microsoft ecosystem | 5% |
| FSM calendar (Jobber, etc.) | Scheduling lives inside their FSM | 10% |

---

## Correlation Rules

These constraints prevent unrealistic profile combinations. When generating profiles, enforce these:

### Hard constraints (never violate)
- Solo operator + 60+ leads/month → impossible (can't handle the volume alone)
- Low tech comfort + uses CRM/FSM → contradictory
- 100% referral + 40+ leads/month → extremely unlikely (referral networks don't scale that fast)
- Office manager + solo operator → contradictory
- $100K+ avg project + 40+ leads/month → unrealistic (custom builders don't get 40 inbound/month)
- Receptionist/answering service + low tech comfort → unlikely combination

### Soft correlations (follow most of the time)
- Higher team size ↔ higher lead volume (0.6 correlation)
- Higher lead volume ↔ higher tech comfort (0.4 correlation)
- Jobber/FSM users → medium+ tech comfort (strong)
- Solo operator → personal cell, likely low-medium tech (moderate)
- Office manager → existing follow-up process is "office manager handles" (strong)
- Higher project value ↔ lower lead volume (moderate negative)
- Referral-heavy → lower lead volume, often higher project value (moderate)
- Strong seasonal → exterior trades, $15K-$60K projects (moderate)
- Google Voice → cannot do call forwarding (hard — affects phone setup)

### Archetype templates

When generating profiles, draw from these common archetypes rather than random combinations:

| Archetype | Team | Volume | Tech | Tools | Leads | Project $ |
|-----------|------|:------:|:----:|-------|:-----:|:---------:|
| The Roofer | 1-2 crew | 20-40 | Med-Low | Nothing | Mostly inbound | $10-25K |
| The Kitchen Guy | Solo/+spouse | 10-20 | Medium | Spreadsheet | Mixed | $35-65K |
| The Growing Crew | 3-5 people | 30-50 | Medium | Jobber | Mixed | $25-50K |
| The Referral King | Solo/+1 | 8-15 | Low-Med | Nothing | 80% referral | $40-80K |
| The Tech-Forward | Office + crew | 40-60 | High | ServiceTitan | Mostly inbound | $30-60K |
| The Handyman | Solo | 15-25 | Low | Nothing | Mixed | $3-12K |
| The Custom Builder | Owner + PM | 5-10 | Medium | Buildertrend | Referral | $80-200K |
| The Concrete Guy | +2-3 crew | 15-30 | Low | Nothing | Signs + GBP | $15-40K |
| The Young Hustler | Solo | 25-40 | High | HubSpot | Mostly inbound | $15-35K |
| The Family Business | +spouse + kids | 15-25 | Med-Low | QuickBooks | Referral + GBP | $20-45K |
