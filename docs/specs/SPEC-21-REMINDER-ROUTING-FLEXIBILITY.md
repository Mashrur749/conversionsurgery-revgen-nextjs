# SPEC-21: Reminder Recipient Routing Flexibility

## Goal
Allow appointment and operational reminders to route by role/policy:
- owner
- assistant/office manager
- team member fallback chain

## Why This Matters
Managed-service operations often require non-owner routing. Owner-only reminders cause missed actions and weak delivery consistency.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Scheduled processing in `src/app/api/cron/process-scheduled/route.ts`.
- Appointment reminder automation in `src/lib/automations/appointment-reminder.ts`.
- Team-member model and escalation contacts already available.

### Misaligned behavior to change
- Reminder routing is owner-centric.
- No policy-based recipient fallback chain for operational scenarios.

## Target State
- Reminder policy supports role-based routing.
- Each reminder event resolves recipients through deterministic priority order.
- Delivery logs show final recipient and fallback reason.

## Work Units (Tiny, Executable)
### Milestone A: Routing policy model
1. Add client-level reminder routing config:
- default recipient role
- fallback roles/order
- quiet-hours handling preference per recipient channel
2. Add validation for valid active recipients.
3. Add helper `resolveReminderRecipients(clientId, reminderType)`.

Refactor checkpoint A:
- Centralize all reminder recipient resolution in one service.

### Milestone B: Automation integration
1. Update appointment reminder and related automations to use resolver.
2. Support primary+secondary recipient sends where policy requires.
3. Add de-duplication to avoid duplicate sends to same number.

Refactor checkpoint B:
- Remove hard-coded owner phone references in reminder paths.

### Milestone C: Failure and fallback behavior
1. If primary recipient unreachable, route to next configured fallback.
2. Record fallback reason in event logs.
3. Raise operator alert if no valid recipient exists.

Refactor checkpoint C:
- Reuse existing delivery-attempt status models instead of custom flags.

### Milestone D: Policy UX and auditability
1. Add settings UI for routing policy by reminder type.
2. Add audit history for policy changes.
3. Add reminder delivery detail panel with recipient chain view.

Refactor checkpoint D:
- Use shared settings form components and audit log modules.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove owner-only assumptions in reminder docs and templates.
- Remove dead config fields replaced by routing policy.
- Remove stale tests expecting owner-only routing behavior.

## Testing & Acceptance
### Automated
1. Reminder resolves to configured role recipient.
2. Fallback chain engages when primary is unavailable.
3. Duplicate recipient de-duplication works correctly.

### Manual
1. Configure assistant-first routing and verify live reminder delivery.
2. Simulate primary failure and verify fallback path.
3. Verify logs clearly show recipient and fallback outcomes.

## Definition of Done
- Reminder delivery can be operationally delegated without code changes.
