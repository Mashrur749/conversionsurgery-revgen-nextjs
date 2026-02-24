# Admin Onboarding Wiki

Last updated: 2026-02-24
Audience: Founder/admin operator
Goal: be fully confident selling and delivering the managed service.
Last verified commit: `273a105`

## Canonical Order (Read + Execute)

1. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/GRAND-SLAM-OFFER.md`
Purpose: master the finalized offer source-of-truth, client promises, guarantee language, and delivery commitments.

2. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/BUSINESS-CASE.md`
Purpose: internal company context, ICP details, and operating assumptions behind the offer.

3. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/01-OPERATOR-MASTERY-PLAYBOOK.md`
Purpose: understand the complete operator path from setup to ongoing service delivery.

4. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/02-TESTING-GUIDE.md`
Purpose: execute hands-on validation so you can operate confidently under real conditions.

5. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/04-OPERATIONS-GUIDE.md`
Purpose: lock in daily operations, cron checks, and incident response rhythm.

6. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/03-ACCESS-MANAGEMENT.md`
Purpose: safely onboard your spouse/internal monitor and client-side assistants.

7. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/07-LAUNCH-READINESS.md`
Purpose: verify launch gate status and confirm operational readiness.

8. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/10-OFFER-PARITY-GAPS.md`
Purpose: verify offer promises are matched by implementation before selling.

9. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/06-REMAINING-GAPS.md`
Purpose: confirm earlier launch-hardening wave is closed and historical context is preserved.

## Documentation Sync Contract (Mandatory)
For every implementation milestone (code change), documentation must be updated in the same execution stream before moving to the next spec.

Required docs to sync each milestone:
1. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/10-OFFER-PARITY-GAPS.md`
2. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/specs/MS-IMPLEMENTATION-BOARD.md`
3. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/specs/MS-CONTEXT-SNAPSHOT.md`
4. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/02-TESTING-GUIDE.md` (if testing flow changed)
5. `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/04-OPERATIONS-GUIDE.md` (if ops flow/cron changed)

Cadence rule:
1. Implement milestone.
2. Run verification gate (`npm run ms:gate` + targeted tests).
3. Sync docs.
4. Commit code/docs.

## Mandatory Execution Before Selling Next Week

1. Complete `02-TESTING-GUIDE.md` end-to-end.
2. Run one mock client onboarding from signup to checklist progression.
3. Run one incident drill from `01-OPERATOR-MASTERY-PLAYBOOK.md` (cron auth failure or escalation fallback).
4. Validate your wife/internal monitor can access only assigned clients.
5. Validate one generated report includes the "Without Us (Directional Model)" section with assumptions/disclaimer or explicit insufficient-data state.
6. Review all `P0` items in `10-OFFER-PARITY-GAPS.md` and close or qualify before selling (current remaining P0: `GAP-007`).

## Confidence Criteria (Go/No-Go)

Go only if all are true:
1. You can explain the offer and guarantee without referring to notes.
2. You can run daily ops from `04-OPERATIONS-GUIDE.md` in under 30 minutes.
3. You can recover from one simulated operational failure without engineering help.
4. `07-LAUNCH-READINESS.md` and `06-REMAINING-GAPS.md` show no open blockers.
5. `10-OFFER-PARITY-GAPS.md` has no unresolved `P0` items for sold promises.
