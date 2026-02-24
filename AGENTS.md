## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file.

### Available skills
- create-migration: Safe Drizzle schema and migration workflow (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/create-migration/SKILL.md)
- neon-postgres: Neon operational workflow for branching, migration safety, and rollback readiness (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/neon-postgres/SKILL.md)
- ux-standards: UI/UX standards for ConversionSurgery interfaces (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ux-standards/SKILL.md)
- ms-spec-delivery: Execute one managed-service spec milestone in small, auditable units (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-spec-delivery/SKILL.md)
- ms-refactor-checkpoint: Required refactor checkpoint after each major milestone implementation (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-refactor-checkpoint/SKILL.md)
- ms-test-and-doc-sync: Verification gate and required docs alignment before commit (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-test-and-doc-sync/SKILL.md)
- ms-gap-status-governance: Keep `/docs/10-OFFER-PARITY-GAPS.md` and spec statuses synchronized with implementation truth (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-gap-status-governance/SKILL.md)
- ms-cx-offer-guardrails: Client-experience and offer-parity checks to prevent regressions in sold promises (file: /Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-cx-offer-guardrails/SKILL.md)

### How to use skills
- Discovery: The list above is the authoritative skill registry for this repository.
- Trigger rules:
  - If the user names a skill (with `$SkillName` or plain text), you must use that skill.
  - If implementing any `MS-*` spec under `/docs/specs/`, always use:
    - `ms-spec-delivery`
    - `ms-refactor-checkpoint`
    - `ms-test-and-doc-sync`
    - `ms-gap-status-governance`
  - Also use `ms-cx-offer-guardrails` for all client-facing behavior changes.
  - For every `MS-*` implementation, treat `/docs/GRAND-SLAM-OFFER.md` as business source-of-truth and validate milestone outcomes against the offer promise.
  - Use `create-migration` + `neon-postgres` whenever schema/migration work is involved.
  - Use `ux-standards` whenever a frontend UI is changed.
- Missing/blocked: If a named skill is missing or unreadable, state that and continue with best fallback.
- Progressive disclosure:
  1. Read the skill `SKILL.md` first.
  2. If the skill references templates/scripts, use them rather than rewriting process logic.
  3. Load only the minimum additional files needed to execute the current milestone.
- Coordination and sequencing:
  - Declare which skills are being used before coding.
  - For `MS-*` implementation, execute one milestone at a time.
  - Refactor checkpoint and verification are mandatory before commit.
  - Run `npm run ms:gate` before marking milestone done.
  - Update `docs/specs/MS-IMPLEMENTATION-BOARD.md` milestone status in every milestone commit.
- Context hygiene:
  - Keep changes tightly scoped to current milestone.
  - Avoid unrelated refactors.
  - Remove deprecated code only when called out by the spec milestone.
  - When sessions get long, prefer starting a fresh session after 2-4 milestones and continue from repo state.
  - Use file paths as canonical context; avoid restating large documents in chat.
- Safety:
  - Never run destructive migrations or schema drops without explicit approval.
  - Never mark a gap/spec as done without tests and docs alignment.
