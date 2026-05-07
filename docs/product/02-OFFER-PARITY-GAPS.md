# Offer Parity Gaps (v3.0)

Last updated: 2026-05-03
Source offer: **Business Reference v1.0** — `ConversionSurgery Revenue Recovery System` (uploaded 2026-05-03)
Prior version: archived at `docs/archive/02-OFFER-PARITY-GAPS.md` (Grand Slam Offer v2.1, retired)
Objective: Track every promise in the Business Reference against platform reality. Block any sale that depends on a `P0` gap.

## Status Tags

- `P0` — Sales-claim blocker. Platform does not support the promise as written; cannot sell to a buyer who reads the corresponding offer line until resolved.
- `P1` — Deliverable gap for tiers we plan to sell now (Pilot, Standard). Selling is possible but the buyer experience suffers without it.
- `P2` — Premium-tier (Booked Estimate OS) and add-on gaps. Do not sell the affected tier/add-on until the gap is closed.
- `Done` / `Open` / `Deferred` — implementation status.

## Offer Tier Readiness Snapshot

| Tier | Public price | Readiness |
|---|---|---|
| Estimate Recovery Audit (free) | n/a | Ready — operator process documented at `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`. |
| Pilot Revenue Recovery System | $3,500 setup + $1,500/mo | **Ready to sell** once `PG-001` is resolved. All operational deliverables built. |
| Standard Revenue Recovery System | $5,500 setup + $2,000/mo | **Ready to sell** once `PG-001`, `PG-002` are resolved. |
| Booked Estimate OS (Premium) | $9,500 setup + $3,500/mo | **Do not sell yet.** 6 of 11 attribution / CRM-depth deliverables open (`PG-101..PG-106`). |
| Microsite + Tracking add-on | $2,500-$5,000 | **Out of scope.** `OFFER-APPROVED-COPY` Section 8 explicitly excludes website work. Resolve scoping before listing. |
| Advanced Attribution Setup add-on | $2,500-$5,000 | Depends on `PG-101..PG-104`. Do not sell until those land. |
| Other add-ons (Dormant Blitz, Reviews, Payment Reminders, AI Voice) | $250-$2,500 | Ready — already shipped as automations. AI Voice is included in base; needs repackaging if sold separately. |

## Gap Register

### P0 — Sales-claim blockers (resolve before any sale)

| ID | Promise (Business Reference §) | Platform reality | Status | Owner |
|---|---|---|---|---|
| `PG-001` | Operational guarantee: "If core system is not live within 21 days, we continue working at no additional charge until it is live. If connected inquiries and flagged estimates are not being logged with source, status, and follow-up activity by day 30, we pause monthly billing until fixed." (§11) | Platform implements a different guarantee: 30-day free + 90-day pipeline guarantee (`MS-02-GUARANTEE-V2-PARITY.md`). No 21-day go-live gate. No day-30 logging gate. `OFFER-APPROVED-COPY.md` §3 reflects the platform's guarantee, not the Business Reference's. | Open | Founder must reconcile: (a) implement 21-day / day-30 gates, or (b) update Business Reference §11 to match platform guarantee. **Do not edit `OFFER-APPROVED-COPY.md` without explicit approval.** |
| `PG-002` | Source visibility on the Standard-tier dashboard: "Lead-source map across website forms, calls, texts, Google Business Profile, Houzz, referrals, and paid lead sources where relevant." (§6.2 Pilot, §6.3 Standard) | `leads.source` is a free-text varchar(50). Codebase only writes `missed_call`, `form`, `manual`. No channel-level capture (Google / Houzz / LSA / Meta / referral / organic). No reporting dimension surfaces channel-level breakdown. | **Deferred to Wave A.5** — Per `WAVE-A-CUT-LIST.md`, reword Pilot/Standard offer line to "entry channel" (call vs. form vs. manual) and reserve channel attribution for Premium. `OFFER-APPROVED-COPY.md` §6.2-6.3 already uses "entry channel" language. Not blocking first Pilot sale. |

### P1 — Standard-tier deliverable gaps (open while selling Standard)

| ID | Promise (Business Reference §) | Platform reality | Status |
|---|---|---|---|
| `PG-003` | Won/lost reason tracking ("Won/lost reasons logged" KPI, §12) | `lostReason` exists on `jobs` table only, not `leads`. No structured reason capture surface in portal. Win-back AI uses conversation history but doesn't classify objections. Cross-references gap-register `BL-14`. | Open |
| `PG-004` | Estimator-level reporting & pipeline visibility (§6.3, §6.4) | Estimator-specific briefing on appointment reminder is built. No `assignedEstimatorId` FK on `leads` or `appointments`. Portal cannot filter pipeline by estimator. | Open |
| `PG-005` | First-response time as a surfaced KPI (§12) | `avg_response_time_seconds` is logged on `analytics-daily/weekly` and `lead-context`. Confirm whether the bi-weekly report or contractor portal exposes it as a named metric to the buyer. | Needs verification |

### P2 — Premium tier (Booked Estimate OS) gaps (do not sell tier until closed)

| ID | Promise (Business Reference §6.4) | Platform reality | Status | Cross-ref |
|---|---|---|---|---|
| `PG-101` | Source tracking by Google, Houzz, referral, LSA, Meta, organic, call | Same gap as `PG-002`, but at Premium scope this also requires UTM capture, referrer parsing, and per-channel reporting in the dashboard. | Open | `BL-11` |
| `PG-102` | GCLID / GBRAID / WBRAID capture | No columns, no capture path, not in any backlog. | Open | n/a |
| `PG-103` | Call tracking and dynamic number insertion | Voice AI handles inbound calls but no per-source tracking numbers. No DNI in any landing-page surface (because microsite builder is also out of scope). | Open | n/a |
| `PG-104` | Offline conversion export / upload to ad platforms | Not implemented. Facebook Lead Ad inbound is also `OUT-08` in `PLATFORM-GAP-REGISTER` (~2 weeks). | Open | `OUT-08` |
| `PG-105` | Revenue-by-source dashboard | Reports show aggregate probable + confirmed pipeline. No source dimension. | Open | `BL-11` |
| `PG-106` | Multi-service-line dashboard (kitchens / baths / basements / additions) | `leads.projectType` is free-text varchar(255). No taxonomy, no segmentation, no per-service-line reporting. | Open | n/a |

### P2 — Add-on gaps

| ID | Add-on (Business Reference §6.5) | Platform reality | Status |
|---|---|---|---|
| `PG-201` | Microsite + Tracking ($2,500-$5,000 setup) | `OFFER-APPROVED-COPY` Section 8 explicitly excludes "Website design or development." Two offer documents now contradict. | Open — Founder must reconcile scope. |
| `PG-202` | Advanced Attribution Setup ($2,500-$5,000 setup) | Depends on `PG-101..PG-104` shipping first. | Blocked |
| `PG-203` | Extra Service-Line Dashboard ($500-$1,500 setup) | Depends on `PG-106` shipping first. | Blocked |

## What's already done (no action)

Every Pilot-tier and Standard-tier operational deliverable is built. See `docs/product/PLATFORM-CAPABILITIES.md` for the complete inventory. Spot-check:

| Business Reference promise | Platform evidence |
|---|---|
| Missed-call capture with compliant text-back | `src/lib/automations/missed-call-text-back.ts`, compliance gateway, 2-3 sec response |
| 4-6 touch estimate follow-up over 14-30 days | 4-touch sequence, pause-on-reply, soft-rejection cancellation |
| Stale estimate reactivation | Probable-wins nudge (cron), 21+ day stuck-estimate callout, proactive 3-day quote SMS |
| Pipeline stages | `leads.status` enum: `new`, `contacted`, `estimate_sent`, `won`, `lost`, `completed` |
| Weekly Pipeline Pulse | Monday SMS (redesigned 2026-04-09) |
| Dedicated business number | Twilio provisioning, up to 3 numbers in base plan |
| Dormant lead reactivation | Win-back automation (25-35 day stale leads) |
| Appointment reminders + no-show recovery | 2h reminder + 4h operator escalation + AI-personalized homeowner recovery |
| Review request workflow | Auto-trigger on `status=completed`, CTIA rate cap |
| Payment / deposit reminders | Stripe links + deposit→final chaining + "Mark Paid" portal action |
| AI voice receptionist | Included in base, no per-minute charge |
| A2P 10DLC / consent / quiet hours / STOP | `MS-08` quiet-hours classification, CASL attestation, instant STOP, audit trail |
| 21-day onboarding workflow | 3-week progression + 11-item checklist (`FMA-W2-4`) |
| Booked consult rate (primary KPI) | Auto-pipeline proof + bi-weekly report + operator capacity KPI |
| Source-aware AI opening strategy | Different opening for missed-call / form / referral / dormant entry channels |

## Process

- **On every code change**: if it ships a feature listed Open above, update the row to `Done` and link the PR.
- **On every offer copy change**: re-verify `PG-001` through `PG-006` are still aligned. Sales claims and platform behavior must agree.
- **Do not edit `OFFER-APPROVED-COPY.md`** without explicit founder approval — it is approved sales language. Changes there require sign-off.
- **Numbering**: `PG-001..099` for Pilot/Standard scope, `PG-101..199` for Premium tier, `PG-201..299` for add-ons. Do not reuse archived `GAP-XXX` IDs from v2.1.

## Managed-Service Spec Mapping

The following MS specs implement parity items tracked above or operational improvements:

| Spec | Title | Resolves |
|---|---|---|
| `MS-01-UNLIMITED-MESSAGING-PARITY.md` | Unlimited Messaging Parity | Operational — messaging cost model |
| `MS-02-GUARANTEE-V2-PARITY.md` | Guarantee v2 Parity (30-Day Proof + 90-Day Recovery) | `PG-001` |
| `MS-03-ESTIMATE-TRIGGER-STACK.md` | Estimate Trigger Stack Parity | Operational — automation coverage |
| `MS-04-SMART-ASSIST-AUTO-SEND.md` | Smart Assist Auto-Send Parity | Operational — AI draft delivery |
| `MS-05-QUARTERLY-GROWTH-BLITZ.md` | Quarterly Growth Blitz Productization | Operational — campaign system |
| `MS-06-BIWEEKLY-WITHOUT-US-MODEL.md` | Bi-Weekly "Without Us" Model Parity | Operational — reporting |
| `MS-07-CANCELLATION-EXPORT-PARITY.md` | Cancellation and Data Export Parity | Operational — offboarding |
| `MS-08-QUIET-HOURS-CLASSIFICATION.md` | Quiet-Hours Classification Switch | Operational — compliance |
| `MS-09-DAY-ONE-ACTIVATION-TRACKING.md` | Day-One Activation and Revenue Leak Audit Tracking | Operational — onboarding |
| `MS-10-ADDON-BILLING-TRANSPARENCY.md` | Add-On Billing Transparency Parity | Operational — billing UX |
| `MS-11-REPORT-DELIVERY-OBSERVABILITY.md` | Report Delivery Observability and Retry UX | Operational — observability |
| `MS-12-CRON-CATCHUP-GUARANTEES.md` | Cron Catch-Up Guarantees | Operational — reliability |
| `MS-13-KB-GAP-CLOSURE-QUEUE.md` | Knowledge Gap Closure Queue | Operational — AI knowledge |
| `MS-14-ONBOARDING-QUALITY-GATES.md` | Onboarding Quality Gates | Operational — onboarding |
| `MS-15-REMINDER-ROUTING-FLEXIBILITY.md` | Reminder Recipient Routing Flexibility | Operational — automation |

## Related registers

- `docs/specs/PLATFORM-GAP-REGISTER.md` — engineering-side gap register (Waves 1-5). Premium-tier items are tracked there as Wave 5.
- `docs/product/FEATURE-BACKLOG.md` — implementation specs for Open items. Premium items as `FB-04..FB-08`.
- `docs/product/SERVICE-DELIVERY-GAPS.md` — ICP-specific delivery gaps (orthogonal to this register).
- `docs/business-intel/OFFER-APPROVED-COPY.md` — the language we sell. Source of truth for marketing claims; reconcile to Business Reference v1.0 with founder approval.

## Historical / Shipped Specs (Grand Slam Offer v2.1)

These MS specs were implemented under the prior offer architecture (v2.1, archived at `docs/archive/02-OFFER-PARITY-GAPS.md`). All shipped. Listed here for traceability and to satisfy the `check-ms-gap-map` quality gate. Most map cleanly to capabilities still required under Business Reference v1.0; reconciliation notes where the v1.0 offer model affects them.

| Spec file | What shipped | v1.0 status |
|---|---|---|
| `docs/specs/MS-01-UNLIMITED-MESSAGING-PARITY.md` | Unlimited-messaging plan policy across runtime + billing | Reusable — Business Reference v1.0 also implies no message caps within tier |
| `docs/specs/MS-02-GUARANTEE-V2-PARITY.md` | 30-day-free + 90-day pipeline guarantee evaluator | Superseded by `PG-001` (21-day go-live + day-30 logging gates per Business Reference §11) |
| `docs/specs/MS-03-ESTIMATE-TRIGGER-STACK.md` | EST keyword + dashboard + auto-trigger from conversation signal | Reusable — required by all v1.0 tiers |
| `docs/specs/MS-04-SMART-ASSIST-AUTO-SEND.md` | 5-minute Smart Assist queue with operator approval | Reusable — required by v1.0 onboarding progression |
| `docs/specs/MS-05-QUARTERLY-GROWTH-BLITZ.md` | Quarterly campaign planner + transitions + reporting | Reusable — listed as Standard/Premium upgrade path in §6.3 |
| `docs/specs/MS-06-BIWEEKLY-WITHOUT-US-MODEL.md` | Bi-weekly performance report with "Without Us" ROI | Reusable — required by v1.0 reporting deliverables |
| `docs/specs/MS-07-CANCELLATION-EXPORT-PARITY.md` | 30-day cancellation + 5-day export SLA | Reusable — required by v1.0 §7 (90-day minimum then month-to-month with 30 days notice) |
| `docs/specs/MS-08-QUIET-HOURS-CLASSIFICATION.md` | Quiet-hours classification + inbound-reply exemption | Reusable — required by v1.0 §11 compliance principles |
| `docs/specs/MS-09-DAY-ONE-ACTIVATION-TRACKING.md` | Day-one activation milestone tracker + SLA alerts | Reusable — feeds the new `PG-001` 21-day go-live gate |
| `docs/specs/MS-10-ADDON-BILLING-TRANSPARENCY.md` | Add-on pricing visibility + ledger + invoice itemization | Reusable — required by v1.0 §6.5 add-on model |
| `docs/specs/MS-11-REPORT-DELIVERY-OBSERVABILITY.md` | Report delivery monitoring + retry workflow | Reusable — supports v1.0 weekly/bi-weekly reporting |
| `docs/specs/MS-12-CRON-CATCHUP-GUARANTEES.md` | Cron job heartbeat + catch-up guarantees | Reusable — supports v1.0 automation reliability |
| `docs/specs/MS-13-KB-GAP-CLOSURE-QUEUE.md` | KB gap detection + lifecycle queue + stale alerts | Reusable — required by v1.0 ongoing-management deliverable |
| `docs/specs/MS-14-ONBOARDING-QUALITY-GATES.md` | Onboarding checklist + autonomous-mode gates | Reusable — feeds the new `PG-001` 21-day go-live gate |
| `docs/specs/MS-15-REMINDER-ROUTING-FLEXIBILITY.md` | Configurable reminder routing per client | Reusable — required by v1.0 §6.3 routing rules
