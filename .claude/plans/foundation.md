# Foundation — Shared Patterns for Refactoring Sub-Agents

> Every sub-agent MUST read this file before starting work.
> These patterns are **non-negotiable** — violating them fails the module.

---

## 1. Database Access

```typescript
import { getDb } from '@/db';

// Always create per-request — NEVER cache or store in a variable outside a function
const db = getDb();
```

- Use Drizzle ORM query builder (`db.select()`, `db.insert()`, etc.)
- Import schema tables from `@/db/schema` (which re-exports from `@/db/schema/index.ts`)
- Import `eq`, `and`, `or`, `sql`, `desc`, `asc`, `count`, `sum` from `drizzle-orm`

---

## 2. Authentication

**Server Components:**
```typescript
import { auth } from '@/lib/auth';
const session = await auth();
```

**API Routes:**
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
const session = await getServerSession(authOptions);
```

**Admin Check (all `/api/admin/*` routes):**
```typescript
if (!(session as any)?.user?.isAdmin) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

---

## 3. API Route Parameters (Next.js 16)

```typescript
// Params are async Promises — always await
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

---

## 4. Input Validation

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// In API route:
const body = await request.json();
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
    { status: 400 }
  );
}
```

---

## 5. Phone Numbers

```typescript
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/phone';

// normalizePhoneNumber: strips formatting, ensures +1 prefix
// formatPhoneNumber: display format (xxx) xxx-xxxx
```

---

## 6. Templates

```typescript
import { renderTemplate } from '@/lib/utils/templates';

// renderTemplate(templateString, { variable: value })
```

---

## 7. Schema Pattern

- **One table per file** in `src/db/schema/`
- Re-export from `src/db/schema/index.ts`
- Use `pgTable` from `drizzle-orm/pg-core`
- UUIDs with `uuid('id').defaultRandom().primaryKey()`
- Timestamps with `timestamp('created_at').defaultNow().notNull()`

---

## 8. FROZEN FILES — DO NOT MODIFY

These files are **READ-ONLY**. Never add, remove, or change lines:

| File | Reason |
|------|--------|
| `src/db/schema/index.ts` | 92 exports, guaranteed merge conflict (C2) |
| `src/db/schema/relations.ts` | 470+ line cross-module monolith (C3) |
| `src/lib/automations/incoming-sms.ts` | Imports 9 services from 6 modules (C5) |

If your refactoring requires changes to these files, **STOP and note it in your completion report**. The orchestrator will batch those changes in a final integration pass.

---

## 9. FROZEN_EXPORTS — Signature Preservation

Each module plan lists `FROZEN_EXPORTS` — function signatures that **other modules import**.

Rules:
- The function name, parameter types, and return type MUST NOT change
- You MAY refactor the internal implementation
- You MAY add new optional parameters with defaults
- You MUST NOT rename the export
- You MUST NOT change the file path from which it's exported

Example:
```typescript
// FROZEN: export async function sendSMS(to: string, body: string, from: string): Promise<string>
// OK: refactor internals, add error handling
// NOT OK: rename to sendTextMessage, change param order, make sync
```

---

## 10. Refactoring Rules

### DO:
- Move files to better locations (update all imports)
- Extract shared logic into service functions
- Add proper TypeScript types (replace `any`)
- Improve error handling
- Add JSDoc to exported functions
- Consolidate duplicate code within your module
- Add barrel exports (`index.ts`) within your module directory

### DO NOT:
- Run `npm run db:generate` or `npm run db:migrate` (M1: parallel migration conflicts)
- Install new npm dependencies
- Modify files outside your module scope
- Change FROZEN files or FROZEN_EXPORTS signatures
- Create new database tables or modify existing schemas
- Remove exports that other modules consume

### Commit Format:
```
refactor(<module-name>): <description>
```

Example: `refactor(compliance): extract consent service and add types`

---

## 11. Completion Protocol

When your module refactoring is complete:

1. Run `npm run build` — must pass with 0 errors
2. Run `npm run lint` — must be clean
3. Verify all files are within scope: `git diff main...HEAD --name-only`
4. Create a final commit with all changes
5. Create the sentinel file:
   ```bash
   touch .refactor-complete
   ```
6. The orchestrator will detect the sentinel and begin merge verification

---

## 12. If Something Goes Wrong

- **Build fails**: Fix it. Do not create the sentinel file until build passes.
- **Need a frozen file changed**: Add a note to `.refactor-notes.md` explaining what change is needed and why.
- **Import from another module breaks**: Check that you haven't changed a FROZEN_EXPORT. If the import was already broken, note it in `.refactor-notes.md`.
- **Out of scope file needs changes**: Note it in `.refactor-notes.md`. Do not touch it.
- **Rate limit hit**: The orchestrator will pause you. Do nothing — it will restart your session.

---

## Quick Reference

| Pattern | Import |
|---------|--------|
| Database | `import { getDb } from '@/db'` |
| Schema tables | `import { tableName } from '@/db/schema'` |
| Auth (server) | `import { auth } from '@/lib/auth'` |
| Auth (API) | `import { getServerSession } from 'next-auth'` + `import { authOptions } from '@/lib/auth'` |
| Phone utils | `import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/phone'` |
| Templates | `import { renderTemplate } from '@/lib/utils/templates'` |
| Validation | `import { z } from 'zod'` |
| ORM helpers | `import { eq, and, or, sql, desc, asc } from 'drizzle-orm'` |
