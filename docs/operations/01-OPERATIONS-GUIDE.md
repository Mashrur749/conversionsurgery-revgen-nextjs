# Operations Guide

Last updated: 2026-04-01
Audience: Founder (solo operator), operations monitor
Last verified commit: `docs: Wave 7 additions (2026-04-01)`

## Backup Coverage Protocol

**Before client 3, designate a backup person** who can triage the admin dashboard during a 48-hour operator absence (sick, travel, emergency).

**What they need:**
- Admin account with `agency_admin` role and `all` client scope
- Access to `/escalations` (triage queue) and `/admin/ai-quality` (flag review)
- SMS alerts forwarded (set their phone as secondary `operator_phone` or add them to escalation team)

**Published escalation SLA for contractors:**
- Priority 1 (legal threat, angry customer, explicit "talk to someone"): 4 business hours
- Priority 2 (complex question, pricing negotiation): next business day
- This SLA should be communicated verbally during onboarding, not in the offer doc

**What still works during a 48-hour outage:**
- All AI responses, automation sequences, cron jobs, compliance enforcement
- Operator SMS alerts fire (to backup person if configured)

**What breaks:**
- Escalation queue piles up (SLA breach at 24h for P1)
- Mid-onboarding clients go silent
- Guarantee deadline remediation missed
- Contractor can't reach a human

**Capacity ceiling:** 10 clients comfortable for solo operator (post-automation: weekly pipeline SMS, Voice AI default-on, Jobber sync reduce per-client time to ~30-45 min/week). 15 is the stretch max before quality degrades. At 15+ clients, hire a part-time ops person or reduce onboarding pace. Onboarding cap remains 2 new clients per week regardless of total count.

---

## Daily Operations Checklist
1. Check cron health response and errors.
2. Check failed webhook logs (Twilio, Stripe, form/webhooks).
3. Review unresolved escalations and SLA breaches.
4. Review message delivery failures and opt-out anomalies.
5. Confirm quiet-hours policy mode in `/admin/compliance` (`Strict Queue` vs `Inbound Replies Allowed`) and check unexpected client overrides.
6. Review onboarding clients in `pending` and move blockers (number, hours, knowledge, team).
7. Review Day-One activation panel per onboarding client (milestones, open SLA alerts, audit delivery proof).
8. Review subscriptions in guarantee-v2 risk states (`proof_pending`, `recovery_pending`, `refund_review_required`) and action queues. For clients in active guarantee windows, check the Guarantee Status card on their Overview tab (admin client detail page) — it shows phase, QLE count vs. target, pipeline vs. $5K floor, days remaining, and on-track/at-risk/failing badge. Act on at-risk or failing statuses before the window closes.
9. Review data export SLA queue in admin billing (`requested`, `processing`, `ready`, `failed`) and clear at-risk/breached items.
10. Review Smart Assist pending approvals and auto-send backlog. See `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 3 for the full Smart Assist review process. Approve (`SEND [ref]`), edit (`EDIT [ref]: text`), cancel (`CANCEL [ref]`), or let auto-send fire. Estimate follow-up and payment messages never auto-send &mdash; you must explicitly approve those.
11. Review quarterly campaign lifecycle health (planned/scheduled/launched/completed + overdue launches).
12. Review latest bi-weekly report "Leads at Risk" status per client (`ready` vs `insufficient_data`) and investigate repeated insufficiency.
13. Review `Report Delivery Operations` panel for latest cycle states (`generated`, `queued`, `retried`, `sent`, `failed`) and clear failed/terminal queues.
14. Review `/admin/settings` `Cron Catch-Up Controls` for monthly reset and bi-weekly backlog/staleness.
15. Spot-check billing transparency: team/phone limit responses and client billing usage card should show explicit add-on rates.
16. Verify add-on billing ledger health: recent `addon_billing_events` rows for team seats, numbers, and voice rollups exist for active clients.
17. Spot-check invoice UX parity: invoice line items include add-on labels for matching periods and CSV download works from client billing usage card.
18. Review admin client `Add-On Charge Provenance` card and clear any unresolved `disputed`/`reviewing` annotations.
19. Review Knowledge Gap Queue (`/admin/clients/<id>/knowledge?tab=queue`) for stale high-priority items and unresolved owners.
20. Review `Onboarding Quality Gates` panel for onboarding clients and clear critical failures before autonomous mode.
21. Review reminder delivery audit outcomes (`reminder_delivery_sent`, `reminder_delivery_no_recipient`) and fix routing-policy gaps for any no-recipient cases.
22. Review internal `error_log` records for new unresolved 5xx issues and triage by `source` + `created_at`.
23. Verify kill-switch settings in `/admin/settings` are in expected state (`false`) before normal campaign operations.
24. Review `Solo Reliability Dashboard` in `/admin/settings` and clear top failure clusters before end of day.
25. Confirm no active client requests are being fulfilled via one-off custom code paths (policy enforcement check).
26. Spot-check AI attribution: review recent conversions (`funnel_events` with `event_type` in `appointment_booked`, `job_won`, `payment_received`) and confirm `agent_decision_id` is populated for leads that had AI conversations. Flag orphaned conversions (no attribution) for manual review.
27. Review flagged AI messages from past 24h (`GET /api/admin/ai-quality`) &mdash; investigate recurring patterns (same flag reason across multiple clients), update KB entries or prompt guidance if a pattern emerges. Clear flags that were training errors.
28. Spot-check model routing distribution: query recent `agent_decisions` rows and verify `actionDetails.modelTier` split is reasonable (expect ~15-25% quality, ~75-85% fast). If quality ratio is unexpectedly high, investigate whether confidence scores are systematically low (prompt issue) or lead scores are inflated.
29. **Pre-launch gate (new client activation):** Before enabling autonomous mode for a new client, run `npm run test:ai` with the client&apos;s knowledge base context. All 10 Safety tests must pass. Quality test failures require prompt review. This is a hard gate &mdash; do not activate a client with failing Safety tests.
30. **Output guard violations:** The post-generation output guard blocks AI messages that contain pricing leaks (when pricing is gated), opt-out retention attempts, or AI identity denial. When a message is blocked, a safe fallback is sent instead and the violation is logged in `agent_decisions` with `actionDetails.violation` set. Review blocked messages periodically via the agent decisions table or AI Quality page. Recurring violations for a specific client indicate a prompt or KB issue that needs attention. The guard covers the agent orchestrator, win-back, and no-show automations.
31. **Weekly AI effectiveness review:** Open `/admin/ai-effectiveness` and review 14-day window. Key health indicators: positive rate should be &gt;20% (alarm if &lt;10%), avg confidence &gt;60 (alarm if &lt;45), avg response time &lt;5s. Check model tier split (fast vs quality). If quality usage exceeds 30%, investigate &mdash; may indicate systematically low confidence or inflated lead scores. Review top escalation reasons and feed patterns back into knowledge base entries or guardrail tuning.
31. **Operator alerting:** Verify `operator_phone` is set in the `agencies` table (via `/admin/agency`). When any cron job fails, the system sends an SMS alert to this number from the agency line. Alerts are deduplicated (1 per subject per hour). If you are not receiving alerts, check: (a) `operator_phone` is set, (b) agency Twilio number is configured, (c) the phone number is valid and can receive SMS.
   - **Operator SMS alerts:** You will receive SMS alerts for: AI health critical breaches (weekly Monday check), payment failures (real-time from Stripe), and escalation SLA breaches (real-time). These are deduplicated &mdash; you won&apos;t get repeat alerts for the same event within 1 hour.
32. **Agency voice webhook:** The agency number (#5) has a voice webhook at `/api/webhooks/twilio/agency-voice`. Callers hear &quot;This number is for text messages only.&quot; Verify this is configured in Twilio Console under the agency number&apos;s voice URL. If callers report the number just rings or goes to Twilio default voicemail, the webhook is not configured.
33. **Confirmed revenue on lead wins:** When marking a lead as &quot;won&quot; in the admin UI, always enter the actual job value in the confirmed revenue field. This feeds into the bi-weekly report &quot;Confirmed Won&quot; total and provides concrete ROI proof for contractors and their bookkeepers. If the field is left blank, the report falls back to pipeline estimates only.
34. **KB gap &quot;Ask Contractor&quot; button:** Instead of manually texting contractors about knowledge gaps, use the &quot;Ask Contractor&quot; button on each gap card in the gap queue (`/admin/clients/[id]/knowledge` &rarr; Gaps tab). This sends a formatted SMS to the contractor with the specific question and automatically sets the gap to `in_progress`. Saves time and keeps the gap lifecycle in sync.
35. **Report follow-up SMS is automated:** After each bi-weekly report delivery, the system automatically sends a follow-up SMS to the contractor via the agency number prompting them to check their email or dashboard. No manual follow-up text is needed. If a contractor says they did not receive the text, verify the agency Twilio number is configured and the contractor phone number is correct.
36. **Operator Triage Dashboard — start your day here:** Open `/admin/triage` before the full daily checklist. It surfaces the highest-priority action items across all clients in one view (P1 escalations, overdue KB gaps, onboarding SLA breaches, failed report deliveries). Use it to decide which clients need attention before opening individual client pages.
37. **Engagement health (weekly, Mondays):** The `engagement-health-check` cron runs every Monday and flags clients with 3+ consecutive weeks of declining engagement. Flagged clients appear in the Triage dashboard. When a client is flagged, review their recent AI quality metrics and knowledge gap queue — declining engagement often signals KB staleness or a recurring AI deferral pattern. For a per-client view, check the Engagement Health badge on the client detail page (Overview tab) — it shows `at_risk` or `disengaged` status with signal bullets.
38. **KB Intake Questionnaire — new client onboarding:** When creating a new client, complete the KB intake questionnaire on the admin client detail Overview tab before activating any automations. This pre-populates the knowledge base and significantly reduces AI deferrals in Weeks 1-2. Aim to fill this out on the same day as the onboarding call.
39. **Dormant re-engagement (Wednesdays):** The `dormant-reengagement` cron runs every Wednesday and sends a single re-contact message to leads that have been dormant for 6+ months. No action needed — monitor for any response that comes back as an escalation.
40. **Probable wins nudge + auto-detect (daily):** The `probable-wins-nudge` cron runs daily at 10am UTC and prompts contractors to mark leads won or lost when an appointment is 7+ days old with no resolution. Up to 5 leads per client are batched into a single numbered SMS. Contractors reply with compact syntax: `W1` (won #1), `L2` (lost #2), `W13 L2` (mixed), `W` (all won), `0` (skip). Replies work on EITHER the agency number or the business number (cross-route detection). Legacy commands (`WON 4A`, `LOST 4A`, `WINS`) still work. If a client reports issues, verify: (a) phone configured, (b) status not paused, (c) 7-day cooldown not tripped.
40a. **Proactive quote prompt (daily):** The `proactive-quote-prompt` cron runs daily at 10am UTC. When a lead has been in `new` or `contacted` for 3+ days with no EST trigger, the contractor gets via agency channel: &ldquo;[Name] &mdash; 3 days, no quote yet. 1 = Yes (start follow-up)  2 = Not yet.&rdquo; Fires once per lead (audit_log tracked). Replies work on either number.
40b. **Booking confirmation mode:** For non-Google-Calendar clients with `bookingConfirmationRequired = true`, AI booking requests go through a contractor approval step before confirming with the homeowner. The contractor gets an SMS with the booking details and replies YES (or `1`, `Y`, `OK`, `CONFIRM`) or suggests a new time. 2-hour reminder + 4-hour operator escalation if no response. Set this toggle during onboarding for any contractor who answers &ldquo;no&rdquo; to &ldquo;Do you use Google Calendar daily?&rdquo;
41. **Weekly activity digest (Mondays):** The `weekly-digest` cron sends Monday morning SMS to contractors with an activity summary (new leads, appointments, follow-ups, won jobs, jobs to close out). Cadence adapts: weekly for active clients, biweekly for quiet weeks with follow-ups, monthly reassurance for slow periods (3+ weeks zero leads). Per-client toggle: `weeklyDigestEnabled`. Skips clients in first 7 days. If a client reports not receiving digests, verify: (a) `weeklyDigestEnabled = true`, (b) client is 7+ days old, (c) phone and twilioNumber are both set. If a slow-period client hasn&apos;t received a digest in 4+ weeks, the system correctly paused — reach out to them directly instead.
41. **Webhook configuration (Jobber / Zapier clients):** For clients using Jobber or Zapier integrations, confirm `webhookUrl` and `webhookEvents` are set on their client record (admin client detail). The `lead.status_changed` event fires when a lead is marked `won` or `lost`. If a client reports their integration stopped receiving events, check: (a) `webhookUrl` is a valid HTTPS endpoint, (b) `webhookEvents` includes `"lead.status_changed"`, (c) look for error logs in `error_log` with source `[LeadManagement]`.
42. **AI Preview for KB verification:** When completing the KB intake questionnaire or adding new knowledge base entries for a client, use the &ldquo;Test the AI&rdquo; panel on the admin client detail page to verify the AI answers correctly before activating the client. Ask 3-5 questions the homeowner is likely to ask. If answers are weak or incorrect, refine the KB entries and test again. This takes 5 minutes and prevents AI deferrals on day one.
42a. **Estimate auto-trigger monitoring:** When a lead&apos;s inbound message implies a quote was already sent (&ldquo;waiting on the quote&rdquo;, &ldquo;comparing prices&rdquo;, &ldquo;got your estimate&rdquo;), the system automatically starts the 4-touch estimate follow-up sequence — no contractor action required. To verify: check the lead&apos;s scheduled messages in the conversation view (messages should be queued within seconds of the trigger). The trigger is also recorded in `audit_log` as `estimate_auto_triggered`. If a contractor reports their estimate follow-up is firing unexpectedly, check `audit_log` for this entry to confirm the auto-trigger fired and identify the phrase that matched.
42b. **Pricing KB gate (onboarding quality):** New clients must have at least one service with pricing ranges configured before the AI can be promoted to autonomous mode. If the Onboarding Quality Gates panel shows a pricing failure, guide the client to add a price range to at least one service in the portal Knowledge Base (Structured Knowledge tab). A valid entry includes a minimum and maximum price for the service. The gate clears automatically once a qualifying entry is saved — no manual override needed.
43. **Voyage AI embedding service:** KB entries are embedded via Voyage AI for semantic search. Requires `VOYAGE_API_KEY` in environment variables. If the key is missing or the service is down, KB search falls back to keyword matching with synonym expansion &mdash; no disruption to conversations. Monitor the embedding backfill cron: if many entries stay in `failed` status, check the Voyage API key and service health. The backfill runs hourly and processes up to 50 entries per run.
44. **Conversation memory (automatic):** For leads with 20+ messages or who re-engage after 24+ hours, the system automatically summarizes the earlier conversation. The AI uses this summary to maintain context across long conversations. No operator action needed. If a returning lead reports the AI &ldquo;forgot&rdquo; their project details, check `lead_context.conversation_summary` for that lead &mdash; if null, the summary hasn&apos;t been generated yet (may need manual trigger or the message count hasn&apos;t reached the threshold).
44a. **AI eval system (pre-merge quality gate):** Before merging changes to AI prompts, guardrails, or KB search logic, run `npm run test:ai:full`. The HTML report at `.scratch/eval-report.html` shows pass/fail per category. Safety regressions (any drop) block the merge. Quality/accuracy regressions (&gt;10pp drop) should be investigated before merging. Weekly scheduled runs catch regressions from upstream model changes (Anthropic updates).
44b. **AI Health Check (Mondays):** The `ai-health-check` cron runs weekly and writes a report to `ai_health_reports`. Check the admin AI Health dashboard for any warning/critical alerts. Key thresholds: confidence delta &lt; -10% (warning) / &lt; -20% (critical), escalation rate delta &gt; +50% (warning) / &gt; +100% (critical), output guard violations &gt; 3% (warning) / &gt; 5% (critical), avg response time &gt; 6s (warning) / &gt; 10s (critical).
45. **Flow reply-rate monitoring (weekly):** Check `templateMetricsDaily.leadsResponded` and `templateStepMetrics` for each active client once a week. A healthy estimate follow-up sequence should show 10-15% reply rate; win-back sequences 5-10%. If a client shows 0% across multiple weeks, verify the inbound SMS webhook is firing correctly and the client has active flow executions in the `flow_executions` table.
46. **ROI worksheet before sales calls:** Keep `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md` open during sales calls. Fill in the prospect&apos;s outstanding quote count and average job value live — it makes the recoverable pipeline number concrete and directly addresses price sensitivity (Objection 8 in the Sales Objection Playbook).
46a. **Call prep (before biweekly calls):** Open the client detail page, click &ldquo;Prep for Call&rdquo; to generate the briefing. Review performance, attention items, and talking points before dialing.
46b. **Onboarding monitoring (new clients):** Check the onboarding progress tracker on new client detail pages. If quality gates are failing past Day 3, nudge the contractor to complete KB setup. AI activation is blocked until critical gates pass.

### Self-Serve Onboarding Monitoring
47. **AI auto-progression (daily):** The `ai-mode-progression` cron runs daily at 10am UTC and advances clients through `off → assist → autonomous` based on time and quality signals. When a client advances, the contractor receives an SMS. Monitor audit_log for `ai_mode_progression` entries. If a client should have advanced but did not, check: (a) quality gates are passing, (b) client age is 7+ or 14+ days, (c) the cron is running without errors. Manual overrides are not overwritten by the cron.
48. **KB empty nudge delivery (daily):** The nudge fires once per client when client age is 48-72 hours and KB entries &lt; 3. If a contractor reports no nudge despite a thin KB, check audit_log for a prior `kb_empty_nudge` entry — it may have already fired. No second nudge is sent regardless of KB count.
49. **Day 3 check-in SMS (daily):** Fires once at 66-78 hours post-signup. If a contractor reports not receiving it, check audit_log for `day3_checkin` and confirm the client&apos;s phone number is set. Check that the daily 7am UTC cron ran without errors.
50. **KB gap auto-notify (daily):** The cron sends at most 2 gap notifications per client per day. If a contractor reports excessive gap notifications, verify the audit_log deduplication is working (one entry per gap per day). If a contractor reports no notifications despite open gaps, confirm the cron ran and check for per-client SMS delivery failures.
51. **KB gap deep link (quality check):** Each gap notification SMS now includes a `?add=` deep link that pre-fills the portal KB add form with the gap question. If a contractor reports the link is not working or the form is blank on arrival, verify the `?add=` parameter is URL-encoded correctly in the SMS body and that the portal KB page is reading the query param.
52. **CASL attestation audit trail (import verification):** After any CSV lead import (admin or portal), confirm the import response includes the `caslAttested` field. If a contractor claims they imported without consenting, check the import route&apos;s audit response — the attestation value is echoed at time of import. If `caslAttested` is missing from old imports, those were pre-attestation and should be reviewed against your CASL records.
53. **Help center articles (post-deploy check):** After every production deploy with a fresh seed (`npm run db:seed -- --lean`), verify 12 help articles are present in the contractor portal Help section. If articles are missing, re-run the seed. Articles cover: Getting Started (3), AI &amp; KB (3), Leads &amp; Follow-Up (3), Billing (2), Compliance (1).

### Review Monitoring (daily)
54. **Pending review response drafts:** Check `/admin/reviews` or the client detail Reviews tab daily. Approve or edit AI-generated response drafts before they auto-post. A draft sitting unreviewed past 24 hours risks posting stale or misworded copy.
55. **Negative review triage:** When a &le;2-star review arrives, contact the contractor within 2 hours to discuss response strategy. The AI will draft a response, but contractor guidance is required before posting anything on a negative review.
56. **Google Places sync health:** Verify `lastSyncAt` on each client&apos;s review source record is within the last 2 hours. If stale, check cron logs for `review-sync` failures and the client&apos;s Google Places API key configuration.

### Voice AI Operations (per client with voice enabled)
57. **Activation mode verification:** Confirm each voice-enabled client&apos;s mode matches their preference: always-on, after-hours, or overflow. Check the client feature configuration in admin. A misconfigured mode can result in the AI answering calls that should go directly to the contractor.
58. **Post-call transcript review (weekly):** Review recent call transcripts for quality. Flag calls where the AI provided incorrect information, made promises outside scope, or failed to transfer when the caller requested a human. Feed patterns back into KB entries.
59. **Voice usage cost monitoring:** Check the admin billing page weekly for voice minutes consumed per client. Alert contractors approaching their plan&apos;s voice allocation before they hit an overage.

### Speed-to-Lead Monitoring (weekly)
60. **Average response time audit:** Review average lead response time across all active clients. Investigate any client whose average exceeds 5 minutes — this is the primary conversion driver and the guarantee anchor. If degraded, check: cron orchestrator health, Anthropic API latency, and Twilio webhook delivery logs.

### Calendar Sync Troubleshooting
61. **Consecutive error check (weekly):** Review `consecutiveErrors` for all calendar integrations. Any integration with 3+ consecutive errors needs immediate investigation — the contractor may be missing booking notifications.
62. **Token expiry fix:** The most common calendar sync failure is an expired OAuth token. Have the contractor reconnect via Settings &rarr; Features &rarr; Calendar. Reconnection resets the error counter and resumes sync immediately.
63. **Stale sync detection:** If a calendar integration shows no sync activity in the last 30 minutes, verify the `calendar-sync` cron is running and check for `error_log` entries with source `[CalendarSync]`.

### DNC List Management
64. **Permanent removal requests:** When a lead requests permanent removal beyond the standard STOP opt-out, add their number to the global DNC list via the admin compliance tools. DNC blocks ALL outbound including transactional messages, unlike opt-out which only blocks commercial messages.
65. **DNC list audit (monthly):** Periodically audit the DNC list to confirm no legitimate leads were accidentally added. Check for numbers that were added without a clear opt-out or removal request in the audit log.

### Feature Toggle Reference
66. **Toggle-first diagnosis:** When a contractor reports unexpected behavior (AI not responding, flows not sending, voice not activating), check their feature toggle state before investigating code. The 18 toggles are: `missedCallSms`, `aiResponse`, `aiAgent`, `autoEscalation`, `voice`, `flows`, `leadScoring`, `reputationMonitoring`, `autoReviewResponse`, `calendarSync`, `hotTransfer`, `paymentLinks`, `photoRequests`, `multiLanguage`, `smartAssist`, `smartAssistDelay`, `smartAssistManualCategories`, `preferredLanguage`. Most &ldquo;broken feature&rdquo; reports are a disabled toggle.

### Notification Feature Flags (FMA Wave 1)
66a. **Automation feature flags** control 8 notification and automation behaviors. Unlike the 18 feature toggles above (which control core product capabilities), these flags control notification *frequency and batching*. They have system-wide defaults configurable in `system_settings` and can be overridden per client:

| Flag | Default | What it controls |
|------|---------|-----------------|
| `dailyDigestEnabled` | on | Contractor P2 notifications are batched into one 10am SMS daily |
| `billingReminderEnabled` | on | Day 25 trial-end billing reminder SMS |
| `engagementSignalsEnabled` | on | Weekly engagement health signals to contractor |
| `autoResolveEnabled` | on | KB gaps auto-resolve when a matching entry is added |
| `forwardingVerificationEnabled` | on | Call-forwarding health check nudges |
| `opsHealthMonitorEnabled` | on | Operator alerts for platform health thresholds |
| `callPrepEnabled` | on | Pre-call context brief generation |
| `capacityTrackingEnabled` | on | Contractor capacity signals and booking limit nudges |

To override a flag for a specific client: admin client detail page → Configuration tab → Notification Flags card. To change the system default: `/admin/settings` → `system_settings` section.

66b. **Daily digest diagnosis:** If a contractor reports not receiving individual notification types (KB gap nudges, stale estimate prompts, WON/LOST nudges), first check if `dailyDigestEnabled` is on — if so, those notifications are being batched into the 10am daily digest, not sent individually. If the contractor prefers individual SMS, disable the flag for their client.

66c. **globalAutomationPause emergency procedure:** In a platform-wide incident (e.g., runaway automation sending incorrect messages), set `globalAutomationPause = true` in `system_settings` via `/admin/settings`. This immediately halts all non-critical outbound automations across ALL clients (equivalent to enabling the outbound kill switch but persistent). To resume: set the value back to `false`. This does NOT affect inbound processing, escalation alerts, or P0 (critical) notifications like payment failures.

### Email Fallback Awareness
67. **Booking notification email fallback:** When a booking notification is blocked by compliance (quiet hours, opt-out), the system falls back to email. If a contractor reports receiving unexpected booking emails, check the audit log for `reminder_delivery_no_recipient` entries — these confirm the SMS chain failed and email was used as fallback. Resolve by reviewing the contractor&apos;s notification routing policy.

### Stripe &amp; Billing Health (weekly)
68. **Stripe reconciliation verification:** Confirm the Stripe reconciliation cron ran and subscription status in the database matches Stripe. Discrepancies (e.g., active in Stripe but &ldquo;cancelled&rdquo; in DB) can silently disable client features. Resolve via admin client billing page.
69. **Message limit monitoring:** For clients not on unlimited plans, check weekly whether they are approaching their plan&apos;s message limit. Proactively notify before they hit the cap to avoid unexpected send failures.
70. **Plan change processing:** For upgrade or downgrade requests, process via the admin client billing page and verify Stripe reflects the change within 60 seconds. If Stripe does not update, check for webhook delivery failures in the Stripe dashboard.

### Trial Management
71. **Trial expiry outreach:** Monitor clients in trial status and proactively reach out at least 3 days before trial expiry to convert to paid. Waiting until expiry day risks losing the client to inertia.
72. **Post-expiry behavior verification:** If a trial expires without payment, verify the system correctly transitions the client (features disabled or grace period active per current policy). Check the client status in admin and confirm no automation sequences are still firing for an expired trial client.

## Knowledge Gap Resolution Process

The AI automatically records questions it can&apos;t answer into a per-client knowledge gap queue. This is how the AI gets smarter over time without the contractor doing anything.

### How gaps get created

When a lead asks something and the AI&apos;s confidence is low (no matching knowledge base entries), two things happen:
1. The AI defers: &quot;Let me have [owner] get back to you on that.&quot;
2. The lead&apos;s question is recorded in the gap queue with a priority score.

If multiple leads ask the same thing, occurrences increment and priority climbs. The system deduplicates by question similarity.

### Daily routine (5 minutes)

1. Open `/admin/clients/[id]/knowledge` &rarr; **Gaps** tab for each active client.
2. Sort by priority (highest first). Focus on gaps with 2+ occurrences &mdash; those are real patterns, not one-off questions.
3. For each actionable gap:
   - **If you know the answer:** Add a KB entry directly. Link it to the gap. Mark resolved.
   - **If you need the contractor&apos;s input:** Use the &quot;Ask Contractor&quot; button on the gap card &mdash; it sends a formatted SMS with the question and sets the gap to `in_progress` automatically. The contractor receives: &quot;[Business Name] &mdash; a customer asked about [question]. How should we answer this?&quot; Add the KB entry from their response.
   - **If it&apos;s not relevant** (spam, gibberish, off-topic): Mark as resolved with note &quot;not actionable.&quot;

### How to write a good KB entry

The AI matches lead questions against KB entries by content similarity. Write entries like you&apos;re answering the customer:

| Bad entry | Good entry |
|-----------|------------|
| &quot;We do flat roofs&quot; | &quot;Yes, we handle flat roof repairs, replacements, and coatings. Typical project range is $3,000-$12,000 depending on size and material. We use TPO and EPDM membrane systems.&quot; |
| &quot;Financing available&quot; | &quot;We offer financing through [partner]. Most homeowners qualify for 0% interest over 12 months. The application takes 5 minutes and doesn&apos;t affect your credit score.&quot; |

More detail = higher AI confidence = fewer future deferrals on that topic.

### Resolution lifecycle

| Status | Meaning |
|--------|---------|
| **new** | Just detected. Needs triage. |
| **in_progress** | You&apos;re working on it (waiting for contractor response). |
| **blocked** | Can&apos;t resolve yet (e.g., contractor hasn&apos;t answered). |
| **resolved** | KB entry added and linked. Requires KB entry link. |
| **verified** | Confirmed working (high-priority gaps require verification). |

### Auto-reopen

If a gap was resolved but leads keep asking the same question and the AI still can&apos;t answer confidently, the gap auto-reopens. This means the KB entry wasn&apos;t detailed enough. Improve it and re-resolve.

### Cron alerts

The daily cron (`/api/cron/knowledge-gap-alerts`) emails you when high-priority gaps are past their due date. Due dates are auto-calculated: priority 9+ = 1 day, 7-8 = 2 days, lower = 3-5 days.

### Week 2 KB sprint

During the contractor&apos;s second week (Smart Assist mode), gaps accumulate fastest because the AI is handling real conversations for the first time. Plan 15-20 minutes on Day 8-10 to clear the queue in bulk. This is the single biggest quality improvement moment.

### Bi-weekly check-in

Every 2 weeks, review the gap queue with the contractor on a 10-minute call. Go through the top 3-5 unresolved gaps. This keeps the AI improving and gives the contractor visibility into what leads are asking about (market intelligence they&apos;d never get otherwise).

---

## Cron Operations

### Required auth
All cron routes require:
- `Authorization: Bearer $CRON_SECRET`

### Manual trigger examples
```bash
export BASE_URL="http://localhost:3000"
export CRON_SECRET="<secret>"

curl -s -X POST "$BASE_URL/api/cron" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/process-scheduled" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/check-missed-calls" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/guarantee-check" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/biweekly-reports" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/report-delivery-retries" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/process-queued-compliance" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/quarterly-campaign-planner" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/quarterly-campaign-alerts" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/access-review" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/onboarding-sla-check" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/voice-usage-rollup" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/knowledge-gap-alerts" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/engagement-health-check" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/dormant-reengagement" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/probable-wins-nudge" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/ai-mode-progression" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/daily-digest" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/billing-reminder" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/guarantee-alert" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/onboarding-reminder" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/onboarding-priming" \
  -H "Authorization: Bearer $CRON_SECRET"

# Deterministic replay helper (preferred)
./scripts/ops/replay.sh all-core
```

### Expected behavior
- 2xx responses with per-job result payloads.
- Any non-empty error bucket is an incident candidate.
- Quarterly planner is idempotent (no duplicate client/quarter campaign records).
- Quarterly alerts include overdue campaign count for launch-risk visibility.
- Bi-weekly report payload includes directional "Leads at Risk" model section or explicit insufficient-data state.
- Monthly reset and bi-weekly report cron responses now include `catchup` payloads (processed periods, backlog remaining, stale-backlog indicators).
- `/admin/settings` `Cron Catch-Up Controls` must reflect the same backlog state shown by `/api/admin/cron-catchup`.
- Report delivery retry payload includes `retried/sent/failed/backoffPending/terminal` counters and should trend to zero failed terminal items.
- Terminal report-delivery failures trigger daily agency-owner email alert digest (deduped per UTC date).
- Client dashboard report-delivery card should mirror latest delivery state and expose report artifact download when available.
- Cancellation-confirmed clients receive export requests with 5-business-day due date and monitored SLA states.
- Quiet-hours policy mode is visible in admin compliance dashboard and should match current legal operating posture.
- Onboarding SLA checker marks overdue Day-One milestones and opens operator alerts/tasks.
- Voice usage rollup upserts add-on ledger rows by billing period with idempotency protection.
- Knowledge-gap alert cron sends one stale high-priority digest/day to agency owners when overdue queue items exist.
- Autonomous mode transitions are blocked when onboarding quality critical gates fail (unless audited override is active).
- Internal appointment/booking reminders resolve recipients via routing policy (owner/assistant/team fallback chain) instead of owner-only assumptions.
- Twilio webhook failures should appear in `error_log` with redacted context (no full phone numbers/body text/secrets).
- Cron endpoint failures should also appear in `error_log` via `safeErrorResponse` with sanitized context (no raw stack/body leakage).
- Lead/payment/support API failures should also appear in `error_log` via `safeErrorResponse` without exposing internal details in API responses.
- Claims, sequences, escalations, and analytics API failures should also use the same centralized `safeErrorResponse` path.
- Public onboarding/signup and client-auth workflow failures should use centralized safe/sanitized logging without raw provider/token/PII leakage.
- Calendar, team-member, and client conversation/team workflow failures should also use centralized safe/sanitized logging.
- API routes should have zero raw `console.error`; verify with `rg -n "console\\.error" src/app/api`.
- If kill switches are enabled, message/voice behavior should match containment mode and be documented in incident notes.
- **Voice AI ConversationRelay flow:** Inbound calls hit `/api/webhooks/twilio/voice/ai` which returns `<Connect><ConversationRelay>` TwiML pointing at the Durable Object WebSocket server (`packages/voice-agent/`). The DO handles the full conversation (Claude streaming, tool use, interruptions). When the session ends, `/api/webhooks/twilio/voice/ai/session-end` handles transfer, summary, and notifications. If debugging voice AI issues, check the DO logs via `wrangler tail` from `packages/voice-agent/`.
- **Voice AI kill switch:** Prominent toggle on `/admin/voice-ai` page. Per-client `voiceEnabled` toggle also available in the voice settings per client. Both bypass AI and forward calls directly to the owner.
- **Voice AI configuration:** `canDiscussPricing` and `voiceMaxDuration` are configurable per client on the admin Voice AI page. Business hours display inline when mode is "after hours." Operator can see the contractor-set `agentTone` as a badge on each client row.
- **Voice AI Playground:** Each client on `/admin/voice-ai` has a built-in QA suite: Greeting Preview (hear the actual greeting in the selected voice), Text Simulator (type as homeowner, AI responds with real KB + guardrails), KB Gap Test (10 canned questions, surfaces missing answers), Guardrail Stress Test (8 adversarial inputs, pass/fail). QA Checklist gates "Go Live" behind all-green auto + manual checks. Use the playground before enabling voice for any new client.
- **HELP keyword (CTIA):** inbound `HELP`/`INFO` messages trigger auto-reply with business contact + opt-out info. Works even for opted-out leads. All exempt sends (HELP, opt-in, opt-out confirmations) produce `compliance_exempt_send` audit events.
- **Stuck message recovery:** `process-scheduled` cron recovers messages claimed >5 minutes ago (within 1-hour lookback) by resetting them for retry. This handles serverless function kills mid-send.
- **Max-attempts retry cap:** scheduled messages retry up to `maxAttempts` (default 3) before permanent cancellation. Prevents infinite retry loops on permanently-failing sends.
- **Ambiguous send handling:** if Twilio may have accepted a message but the response was lost (network timeout after retries exhausted), the message stays claimed and is NOT retried. The Twilio status callback reconciles actual delivery. Look for `TwilioAmbiguousError` in logs.
- **Atomic claims:** both `process-scheduled` and `check-missed-calls` crons use UPDATE-WHERE atomic claims to prevent double-processing on concurrent runs.
- **Compliance gateway coverage:** all lead-facing outbound SMS (including Stripe payment confirmations and ring-group missed-transfer messages) route through `sendCompliantMessage()` for opt-out/DNC/consent/quiet-hours enforcement.

## Deterministic Replay Commands
Preferred replay path for critical jobs:
```bash
export BASE_URL="http://localhost:3000"
export CRON_SECRET="<secret>"

./scripts/ops/replay.sh process-scheduled
./scripts/ops/replay.sh process-queued-compliance
./scripts/ops/replay.sh report-delivery-retries
./scripts/ops/replay.sh guarantee-check
./scripts/ops/replay.sh all-core
```

Rules:
- Use replay script commands instead of ad-hoc curl for incident response.
- Every replay command must return 2xx; otherwise incident stays open.

## Weekly Maintenance Budget (Solo)
Reserve protected engineering maintenance time every week:
- Minimum: `4 hours/week` in one protected block (or two 2-hour blocks).
- Focus only on:
  - reliability fixes
  - refactors
  - test expansion
  - documentation synchronization

Mandatory weekly command set:
```bash
npm run quality:no-regressions
npm run quality:feature-sweep
npm run quality:logging-guard
```

## Backup/Export Recovery Drill
Run once per week for one pilot client:
```bash
npm run ops:drill:export -- --client-id <client-id>
```

Success criteria:
- export bundle builds successfully
- required sections exist (`leads.csv`, `conversations.csv`, `pipeline_jobs.csv`)
- drill result is logged in weekly notes

## Alert Compression Policy (Solo)
- `Sev1`: immediate response, no batching.
- `Sev2/Sev3`: triage in hourly digest windows via `Solo Reliability Dashboard`.
- Do not send immediate notifications for non-Sev1 unless legal/compliance breach risk exists.

Hourly digest sweep:
1. Open `/admin/settings` -> `Solo Reliability Dashboard`.
2. Triage by this order:
   - failed/stale cron jobs
   - unresolved internal errors
   - report delivery failures
   - escalation SLA breaches
3. Execute replay commands for affected pipelines.

## No-Custom-Code Client Policy
Do not ship one-off code for a single client.

Required approach:
- solve with reusable settings, templates, role permissions, or policy flags
- document behavior in operations/testing docs in same commit

Reject requests that require:
- hardcoded client IDs in logic
- private fork behavior in main codebase
- hidden behavior toggles without documented policy keys

## Access Management Operations

### Onboard internal monitor (agency user)
1. Add agency team member.
2. Assign role template.
3. Set `assigned` scope unless full access is required.
4. Validate they can only access intended clients.

### Add contractor assistant (client-side)
1. Add client team member via portal/team flow.
2. Assign role template.
3. Confirm plan limit enforcement if at capacity.

## Incident Severity
- Sev1: Messaging outage, auth outage, cross-tenant exposure, billing corruption.
- Sev2: Automation lag, cron failures for core jobs, onboarding blockers.
- Sev3: UI defects with operational workaround.

## Incident Response Runbook
1. Acknowledge and scope impact (clients, revenue flow, compliance risk).
2. Contain (disable automation path/feature flag if needed).
3. Restore core service path.
4. Verify with smoke tests.
5. Write incident notes and remediation actions.

### Emergency Kill Switches
Set via `/admin/settings` using System Settings Manager:

| Setting Key | `true` behavior | Default |
|---|---|---|
| `ops.kill_switch.outbound_automations` | Blocks outbound automation sends through compliance gateway | `false` |
| `ops.kill_switch.smart_assist_auto_send` | Forces Smart Assist drafts to manual approval (disables auto-send) | `false` |
| `ops.kill_switch.voice_ai` | Bypasses Voice AI conversation and routes to human fallback | `false` |

## Smoke Tests After Incident
1. Agency login and scoped client switch.
2. Client portal login and permission-gated page access.
3. Inbound message -> compliant outbound response path.
4. Escalation routing fallback behavior.
5. Cron orchestrator run with authenticated request.

## Metrics to Watch Weekly
- MRR trend and churn.
- Response time to lead.
- Escalation SLA breaches.
- Message send failure rate.
- API cost per active client.

## Engineering Quality Gate (Required Before Deploy)
```bash
npm run quality:no-regressions
npm run quality:feature-sweep
```
If this fails, do not deploy.

Recommended local enforcement:
```bash
npm run quality:install-agent-hooks
```

## Deploy + Rollback (Single Path)

### Deploy path (production)
1. Run release gate:
```bash
npm run quality:feature-sweep
```
2. Deploy Cloudflare worker build:
```bash
npm run cf:deploy
```
3. Verify active deployment:
```bash
npx wrangler deployments status
```
4. Run post-deploy smoke validation checklist from `docs/engineering/01-TESTING-GUIDE.md` (Final smoke + telemetry checks).

### Rollback path (production)
1. List recent versions:
```bash
npx wrangler versions list
```
2. Select last known-good `version-id`.
3. Roll traffic back to that version:
```bash
npx wrangler versions deploy <version-id>@100 --message "rollback to stable" -y
```
4. Confirm rollback state:
```bash
npx wrangler deployments status
```
5. Re-run smoke validation and confirm incident containment notes are updated.

Rule:
- Do not use ad-hoc deploy/rollback commands outside this path.

## References
- `src/app/api/cron/route.ts`
- `src/lib/utils/cron.ts`
- `docs/engineering/01-TESTING-GUIDE.md`
- `docs/archive/REMAINING-GAPS.md`
- `docs/onboarding/02-OPERATOR-MASTERY-PLAYBOOK.md`
- `docs/engineering/03-RUNTIME-RELIABILITY-SYSTEM.md`
