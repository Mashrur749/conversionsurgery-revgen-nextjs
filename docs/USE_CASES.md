# Use Cases

Last updated: 2026-02-21
Scope: Managed service operations now + SaaS-ready workflows next

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
2. AI handles routine flow; humans intervene on exceptions.
3. Escalations route to configured recipients.

Outcome: Faster responses and less lead leakage.

## 3. Reliability Use Cases

### U6. Cron operation and recovery
1. Run authenticated cron endpoint.
2. Inspect job-level result payload.
3. Re-run affected sub-jobs on failure.

Outcome: Predictable automation operations.

### U7. No-team escalation fallback
1. Lead requires escalation.
2. No eligible escalation team members are active.
3. Owner is notified as fallback.

Outcome: No escalation is silently dropped.

## 4. SaaS Transition Use Cases (Near-Term)

### U8. Public self-serve signup baseline
1. Prospect visits `/signup` and submits business details.
2. Platform creates client in `pending` state + owner membership.
3. Team or automation completes setup before activation.

Outcome: Acquisition funnel starts without manual data entry.

### U9. Customer-controlled team management (future self-serve)
1. Customer manages their own assistants and roles.
2. Platform enforces plan limits and permission boundaries.
3. Tutorial-led setup reduces support overhead.

Outcome: SaaS-ready control model with low operational risk.
