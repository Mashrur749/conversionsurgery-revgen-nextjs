# Use Cases

Last updated: 2026-02-24
Scope: Managed service operations now + SaaS-ready workflows next
Last verified commit: `MS-11 Milestone B working tree`

## 1. Founder/Agency Use Cases

### U1. Onboard a contractor client (managed service)
1. Create client from admin flow.
2. System creates owner person + `business_owner` membership.
3. Configure number, business settings, team, and hours.
4. Move to active service monitoring.

Outcome: Client is operational with agency-managed automation.

### U2. Add internal operations monitor (spouse/team member)
1. Create agency membership.
2. Assign role template and scoped client assignments.
3. Validate read/write permissions by role.

Outcome: Daily monitoring can be delegated safely.

### U3. Restrict account manager to assigned clients
1. Set agency member scope to `assigned`.
2. Add allowed clients via assignments.
3. Verify client selector + APIs enforce scope.

Outcome: No accidental cross-client access.

## 2. Contractor/Client Use Cases

### U4. Add assistant to business account
1. Business owner opens team management.
2. Adds assistant and assigns role template.
3. System enforces plan limits and escalation guardrails.

Outcome: Assistant can operate within controlled permissions.

### U5. Monitor and intervene in lead conversations
1. Assistant/owner views conversations.
2. AI handles routine flow; Smart Assist applies delayed auto-send or manual approval by category.
3. Escalations route to configured recipients.

Outcome: Faster responses and less lead leakage.

## 3. Reliability Use Cases

### U6. Cron operation and recovery
1. Run authenticated cron endpoint.
2. Inspect job-level result payload.
3. Re-run affected sub-jobs on failure.

Outcome: Predictable automation operations.

### U6b. Monthly billing-policy and access-review automation
1. Monthly cron closes usage period and applies billing policy by plan.
2. Unlimited Professional plans skip overage charging by policy while retaining usage/billing audit events.
3. Monthly access-review digest is sent to agency owners.

Outcome: predictable billing behavior and proactive access governance.

### U6c. Quiet-hours policy mode governance
1. Operator checks active quiet-hours policy mode in admin compliance dashboard.
2. Legal posture changes are applied by policy mode switch (`STRICT_ALL_OUTBOUND_QUEUE` or `INBOUND_REPLY_ALLOWED`).
3. Compliance audit logs capture policy mode, message classification, and decision for send/queue/block.

Outcome: legal/compliance operating mode can change without code edits and remains auditable.

### U7. No-team escalation fallback
1. Lead requires escalation.
2. No eligible escalation team members are active.
3. Owner is notified as fallback.

Outcome: No escalation is silently dropped.

### U7c. Smart Assist review + auto-send workflow
1. Inbound lead message generates AI draft.
2. Owner gets reference-code commands (`SEND`, `EDIT`, `CANCEL`).
3. Safe categories auto-send on timeout; sensitive categories remain manual.

Outcome: speed-to-lead is preserved without losing operator control.

### U7b. Dual-layer guarantee automation
1. A new subscription starts with guarantee window metadata.
2. Daily guarantee cron evaluates 30-day proof-of-life and low-volume extension windows.
3. Qualified subscriptions transition into 90-day recovery tracking with attributed-opportunity checks.
4. Subscription is automatically marked `fulfilled` or `refund_review_required`, with billing events logged for audit and operator action.

Outcome: 30-day + 90-day guarantee promise is enforced operationally instead of manual tracking.

## 4. SaaS Transition Use Cases (Near-Term)

### U8. Public self-serve signup baseline
1. Prospect visits `/signup` and submits business details.
2. Platform creates client in `pending` state + owner membership.
3. Checklist + managed setup request path drive completion before activation.

Outcome: Acquisition funnel starts without manual data entry.

### U8b. Guided onboarding completion
1. New signup redirects to onboarding checklist page.
2. Checklist shows setup progress (phone, hours, knowledge, team).
3. User can request managed setup help directly from onboarding.

Outcome: faster activation and fewer manual onboarding handoffs.

### U8c. Day-One activation SLA + audit proof workflow
1. System auto-creates Day-One milestones when onboarding starts.
2. Number assignment and missed-call enablement auto-complete system milestones.
3. Operator confirms `call-your-own-number` proof in admin client Day-One card.
4. Operator drafts and delivers Revenue Leak Audit with timestamped delivery proof.
5. SLA cron flags overdue milestones and opens operator alerts/tasks.

Outcome: Day-One promises are timestamped, auditable, and operationally enforced.

### U9. Customer-controlled team management (future self-serve)
1. Customer manages their own assistants and roles.
2. Platform enforces plan limits and permission boundaries.
3. Tutorial-led setup reduces support overhead and activation time.

Outcome: SaaS-ready control model with low operational risk.

### U10. Quarterly Growth Blitz execution (managed service)
1. Quarterly campaign draft is planned per active client.
2. Operator approves, launches, and completes campaign with evidence/outcome logs.
3. Status appears in reporting and client dashboard summary.

Outcome: retention anchor is operationalized with auditable delivery.

### U11. Bi-weekly "Without Us" directional reporting
1. Bi-weekly report generation collects after-hours lead volume, observed response speed, and delayed follow-up signals.
2. System computes low/base/high directional risk ranges with explicit assumptions and disclaimer text.
3. Report detail view shows either model ranges or an explicit insufficient-data state.

Outcome: retention narrative is evidence-backed and transparent, without fabricated certainty.

### U11b. Bi-weekly report delivery lifecycle + retry observability (MS-11 A-B)
1. Bi-weekly cron creates/updates one delivery cycle record per active client.
2. Delivery transitions are persisted (`generated`, `queued`, `retried`, `sent`, `failed`) with timestamps and channel metadata.
3. Retry cron applies deterministic backoff/attempt policy and idempotent retry claim before resend.
4. Operator can identify failed/backoff/terminal deliveries and rerun safely without re-sending already delivered reports.

Outcome: report delivery is auditable and operationally visible instead of silent best-effort.

### U12. Cancellation + full data export fulfillment (MS-07)
1. Client submits cancellation notice through `/client/cancel`.
2. System sets effective cancellation date to 30 calendar days after written notice.
3. System creates export request with 5-business-day SLA and tracks lifecycle status.
4. Client can retrieve full export bundle (leads, conversations, pipeline/jobs) using secure expiring download token.
5. Operations monitors SLA queue in admin billing and handles any failed or overdue requests.

Outcome: cancellation terms are contract-aligned and auditable without manual ad hoc export handling.

### U13. Add-on billing transparency reference (MS-10 A-D)
1. Client reaches team-member or phone-number plan limit.
2. API/UI limit messaging shows explicit add-on rate per unit.
3. Client billing usage card shows add-on rates and projected recurring add-on subtotal.
4. Team-member over-base events, phone-number purchase events, and voice-minute rollups are recorded in an idempotent add-on billing ledger.
5. Client billing view shows cycle add-on breakdown and allows CSV export of add-on events.
6. Operator reviews add-on event provenance in admin client view and annotates disputes through billing-manage workflow.

Outcome: add-on pricing, event ledger, invoice linkage, event export, and dispute workflow are all operational.
