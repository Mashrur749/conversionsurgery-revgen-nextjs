# MS-09: Day-One Activation and Revenue Leak Audit Tracking

## Status
- `STATE: DONE`
- `DONE_AT: 2026-02-24`
- `REMAINING: []`

## Goal
Productize Day-One Activation promises with tracked SLA checkpoints:
- number live
- missed-call text-back live
- call-your-own-number proof completed
- Revenue Leak Audit delivered within target window

## Why This Matters
This is the first-value moment for paying clients. If timeline evidence is missing, trust drops and disputes increase.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Public onboarding status/request endpoints:
- `src/app/api/public/onboarding/status/route.ts`
- `src/app/api/public/onboarding/request-setup/route.ts`
- Number provisioning and missed-call automation plumbing already exists.

### Misaligned behavior to change
- No first-class activation milestone tracker.
- No formal Revenue Leak Audit artifact + delivery timestamp tracking.
- No SLA breach flagging workflow.

## Target State
- Each onboarding account has Day-One milestone statuses with timestamps.
- Audit artifact exists in system records with delivery proof.
- SLA breach signal triggers internal follow-up task.

## Work Units (Tiny, Executable)
### Milestone A: Data model for activation milestones
1. Add onboarding milestone entity with:
- `milestoneKey`
- `status`
- `targetAt`
- `completedAt`
- `completedBy`
2. Seed required milestone keys for every new onboarding.
3. Add query helpers for milestone progress summary.

Refactor checkpoint A:
- Keep onboarding progress computation in one service (no duplicated route math).

### Milestone B: Revenue Leak Audit artifact
1. Add audit artifact record:
- summary
- findings
- estimated impact ranges
- deliveredAt
2. Add operator API to create/update/deliver audit.
3. Add client-visible read-only view of delivered audit.

Refactor checkpoint B:
- Separate audit artifact schema/service from generic onboarding notes.

### Milestone C: SLA timers and alerts
1. Compute deadline windows for each required milestone.
2. Add SLA checker cron to flag overdue milestones.
3. Create internal alert/task when breach occurs.

Refactor checkpoint C:
- Centralize SLA threshold constants in onboarding policy file.

### Milestone D: Operator UX and proof trail
1. Add onboarding timeline panel with milestone state chips.
2. Show required evidence links (e.g., call test confirmed, audit file).
3. Add immutable activity entries for milestone completion.

Refactor checkpoint D:
- Reuse existing activity log component instead of new bespoke audit trail UI.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove checklist-only docs that are not backed by system-tracked milestones.
- Remove manual spreadsheet dependency for audit delivery tracking.
- Remove ambiguous onboarding statuses that overlap milestone keys.

## Testing & Acceptance
### Automated
1. Milestones auto-create on onboarding start.
2. Completing milestone writes `completedAt` and actor.
3. SLA checker raises overdue flag when target missed.

### Manual
1. New onboarding shows all Day-One milestones.
2. Audit artifact can be delivered and appears in client portal.
3. Overdue milestone generates clear operator action item.

## Definition of Done
- Day-One promises are system-tracked, timestamped, and reviewable.
- Revenue Leak Audit delivery is operationally provable.

## Implementation Evidence
- `src/db/schema/onboarding-day-one.ts`
- `drizzle/0027_goofy_vindicator.sql`
- `src/lib/services/day-one-policy.ts`
- `src/lib/services/day-one-activation.ts`
- `src/app/api/admin/clients/[id]/onboarding/day-one/route.ts`
- `src/app/(dashboard)/admin/clients/[id]/day-one-activation-card.tsx`
- `src/app/api/public/signup/route.ts`
- `src/app/api/public/onboarding/status/route.ts`
- `src/app/signup/next-steps/onboarding-checklist.tsx`
- `src/app/api/cron/onboarding-sla-check/route.ts`
- `src/app/api/cron/route.ts`
