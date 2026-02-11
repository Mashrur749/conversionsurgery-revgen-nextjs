# Module: compliance
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

SMS/phone compliance system — consent tracking, opt-out management, TCPA compliance checks, and admin compliance dashboard.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/compliance.ts` | `consentRecords` and `optOutRecords` tables |
| `src/app/api/compliance/report/route.ts` | GET — compliance report for client |
| `src/app/api/compliance/check/route.ts` | POST — check if number is compliant to message |
| `src/app/api/compliance/consent/route.ts` | POST — record consent from lead |
| `src/app/(dashboard)/admin/compliance/page.tsx` | Admin compliance dashboard page |
| `src/components/compliance/ConsentCapture.tsx` | Client-facing consent capture component |
| `src/components/compliance/ComplianceDashboard.tsx` | Admin compliance metrics dashboard |

## FROZEN_EXPORTS

None — this module has no exports consumed by other modules.

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads` from `@/db/schema` (for joins)
- `auth` / `authOptions` from `@/lib/auth`
- `normalizePhoneNumber` from `@/lib/utils/phone`

## REFACTORING GOALS

1. **Add TypeScript types** — Create proper interfaces for consent and opt-out records, replace any `any` types
2. **Extract compliance service** — If compliance logic is inline in API routes, extract to `src/lib/services/compliance.ts` (new file within scope)
3. **Standardize error handling** — Ensure all 3 API routes use consistent Zod validation and error responses
4. **Component cleanup** — Ensure ConsentCapture and ComplianceDashboard use proper TypeScript props interfaces
5. **Add JSDoc** — Document exported functions with parameter descriptions

## DONE WHEN

- [ ] All files have proper TypeScript types (no `any`)
- [ ] API routes use Zod validation with proper 400 error responses
- [ ] Admin route checks `isAdmin` and returns 403
- [ ] Components have typed props interfaces
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(compliance): ...` format
- [ ] `.refactor-complete` sentinel created
