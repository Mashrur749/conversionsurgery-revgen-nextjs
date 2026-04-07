---
name: ms-test-and-doc-sync
description: Verification gate and documentation synchronization for managed-service milestones
---

# Test and Doc Sync

Use before marking any work item done — MS milestones, UX fixes, edge case fixes, or feature work.

## Verification Gate
1. Run targeted tests for changed modules.
2. Run `npm run typecheck` for TypeScript integrity.
3. Run `npm run build` for high-risk or cross-cutting changes.
4. Run `npm run quality:no-regressions` as completion gate.
5. Execute manual checks from the acceptance criteria.

## Documentation Gate

Scan the CLAUDE.md Change-to-Doc mapping table. Update every doc that matches your change:

| If your change affects... | Update these docs |
|--------------------------|-------------------|
| What the platform does | `docs/product/PLATFORM-CAPABILITIES.md` |
| How to verify it works | `docs/engineering/01-TESTING-GUIDE.md` |
| How operator delivers the service | `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` |
| Operator daily workflow | `docs/operations/01-OPERATIONS-GUIDE.md` |
| Client-facing claims or promises | Flag to user — `docs/business-intel/OFFER-APPROVED-COPY.md` |
| Onboarding or first-client delivery | `docs/operations/LAUNCH-CHECKLIST.md` |
| Offer parity gaps | `docs/product/02-OFFER-PARITY-GAPS.md` |
| UX audit tracked items | `docs/specs/UX-AUDIT-FULL.md` (mark Done in Already Fixed table) |
| Edge case tracked items | `docs/specs/EDGE-CASES-AUDIT.md` (update status) |
| Work tracker items | `.claude/work-tracker.md` (update status to done) |

## Required Output
- What tests ran
- What passed/failed
- What docs were updated
- Any unresolved risks

## Templates and Scripts
- Template: `.claude/skills/ms-test-and-doc-sync/templates/verification-report.md`
- Script: `scripts/specs/ms-quality-gate.sh`
