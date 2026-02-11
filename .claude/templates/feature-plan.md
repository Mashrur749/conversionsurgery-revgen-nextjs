# Feature Plan: {{FEATURE_NAME}}

> **Created:** {{DATE}}
> **Status:** Planning | In Progress | Complete
> **Slices:** {{SLICE_COUNT}}

## Overview

_What this feature does and why._

## Success Criteria

1. ...
2. ...

---

## Slices

### Slice 0: Shared Foundation
> **Branch:** `feature/{{FEATURE_NAME}}/slice-0`
> **Dependencies:** None
> **Status:** ⬜ Not Started

**What:** New Drizzle schema tables, shared types, utility functions.

**Scope:**
- `src/db/schema/<new-table>.ts`
- `src/db/schema/index.ts` (re-export only)
- `src/types/<feature>.ts`
- `src/lib/utils/<feature>.ts`

**Contract:**
- Produces: [exported tables, types, utils]
- Consumes: nothing new

**Done when:**
- [ ] Schema files follow one-table-per-file pattern
- [ ] Re-exported from `src/db/schema/index.ts`
- [ ] `npm run db:generate` produces clean migration
- [ ] `npm run build` passes
- [ ] No implementation logic — types/schema/utils only

---

### Slice 1: {{SLICE_1_NAME}}
> **Branch:** `feature/{{FEATURE_NAME}}/slice-1`
> **Dependencies:** Slice 0
> **Status:** ⬜ Not Started

**What:** _Description_

**Scope:**
- `src/lib/services/...`
- `src/lib/automations/...`

**Contract:**
- Produces: [service functions]
- Consumes: [schema/types from Slice 0]

**Done when:**
- [ ] ...
- [ ] `npm run build` passes

---

### Slice N: Integration
> **Branch:** `feature/{{FEATURE_NAME}}/slice-N`
> **Dependencies:** All previous
> **Status:** ⬜ Not Started

**What:** Wire API routes to services, build UI pages, E2E tests.

**Scope:**
- `src/app/api/<routes>/`
- `src/app/(dashboard)/<pages>/`
- `src/components/<feature>/`

**Done when:**
- [ ] All slices integrated
- [ ] Auth checks on all routes
- [ ] `npm run build` passes
- [ ] No regressions

---

## Merge Order

```
Slice 0 (schema/types) → Slice 1 (services) → ... → Slice N (UI/integration)
```

## Risks

- ...
