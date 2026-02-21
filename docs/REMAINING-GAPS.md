# Remaining Gaps — ConversionSurgery RevGen

**Last updated:** 2026-02-20

This document catalogs all known gaps after completing the security audit hardening and system blockers remediation. All security findings (M1-M6, L1-L2) have been resolved. The remaining gaps are operational, architectural, and infrastructure items.

---

## Security Gaps — All Resolved

| ID | Finding | Status | Commit |
|----|---------|--------|--------|
| M1 | Twilio webhook signature validation | Already fixed (all 11 routes verified) | — |
| M2 | Error messages leaking internal details | Fixed — safeErrorResponse() across 96 files | 20fc409 |
| M3 | `as any` type casts in admin routes | Fixed — .$type<T>() on jsonb columns | 56ba31a |
| M4 | No rate limiting on API routes | Fixed — middleware with per-IP limits | 52016b0 |
| M5 | No CSRF protection | Already fixed (httpOnly, secure, sameSite:lax) | — |
| M6 | No middleware-level route protection | Fixed — auth guards + security headers | 52016b0 |
| L1 | Cron route auth | Already fixed (all 13 sub-routes verified) | — |
| L2 | Self-demotion protection | Fixed — userId check on admin update | 29640f8 |

**Full details:** See `docs/SECURITY-AUDIT.md`

---

## Non-Security Gaps

### High Priority

#### 1. ~~Identity migration not run~~ — Resolved
- **Category:** Operations
- **Status:** Resolved — database reset to zero state; legacy migration scripts (`migrate-identities.ts`, `verify-migration.ts`) deleted. New seed script creates all identity records directly using the new schema.

#### 2. ~~Legacy tables still exist~~ — Resolved
- **Category:** Schema
- **Status:** Resolved — `admin_users` table dropped, `team_members` table dropped, `users.isAdmin` and `users.clientId` columns removed from schema. All runtime code updated to use `people` + `client_memberships` + `agency_memberships`. FKs retargeted from `team_members` to `client_memberships`. Run `db:push` or `db:generate` to apply to database.

### Medium Priority

#### 3. ~~Missing `updatedAt` columns~~ — Resolved
- **Category:** Schema
- **Status:** Resolved (commit 8021c8c, migration applied via `db:push`)
- **Description:** `updatedAt` columns added to `conversations`, `coupons`, `reviews`, `voice_calls`, and `support_messages`. All `db.update().set()` calls for these tables now include `updatedAt: new Date()`. Drizzle migration: `0020_rainy_nemesis.sql` (applied).

#### 4. ~~No automated test suite~~ — Resolved
- **Category:** Infrastructure
- **Status:** Resolved (commit ab9606d)
- **Description:** Vitest test suite established with 46 tests across 4 test files:
  - `src/lib/utils/route-handler.test.ts` — 11 tests (wrapper auth, error handling, params)
  - `src/lib/permissions/resolve.test.ts` — 15 tests (resolvePermissions, hasPermission variants)
  - `src/lib/permissions/escalation-guard.test.ts` — 9 tests (preventEscalation, validateOverrides)
  - `src/lib/utils/phone.test.ts` — 11 tests (normalize, format, validate)
- **Next steps:** Expand to integration tests for auth flows, billing, and webhook handlers.

#### 5. ~~No CI/CD pipeline~~ — Resolved
- **Category:** Infrastructure
- **Status:** Resolved (commit 0ac2af7)
- **Description:** GitHub Actions CI pipeline at `.github/workflows/ci.yml`. Runs on push to main and all PRs. Steps: `npm ci` → `typecheck` → `lint` → `test` → `build` → `npm audit`. Concurrency groups cancel stale runs.

### Low Priority

#### 6. Feature stubs (monitoring)
- **Category:** Product
- **Description:** Review monitoring features (Yelp, Facebook) and agency communication are partially stubbed. The UI exists but some integrations are incomplete.
- **Recommendation:** These are roadmap items, not bugs. Complete when prioritized by product.

#### 7. Cloudflare WAF rate limiting
- **Category:** Infrastructure
- **Description:** The in-memory middleware rate limiter works per-isolate but doesn't share state across Cloudflare Workers instances. Under high traffic, the effective limit is higher than configured.
- **Recommendation:** Configure production-grade rate limiting rules in Cloudflare dashboard (WAF custom rules or Rate Limiting Rules) for true global enforcement. The middleware limiter remains as a defense-in-depth layer.

---

## System Blockers — All Resolved

All 45 system blockers across 4 phases have been remediated. See `docs/SYSTEM-BLOCKERS.md` for details.

| Phase | Items | Status |
|-------|-------|--------|
| Phase 1 (Critical) | 10 | All resolved |
| Phase 2 (High) | 13 | All resolved |
| Phase 3 (Medium) | 16 | All resolved |
| Phase 4 (Low) | 6 | All resolved |

---

## Verification

```bash
# Security: zero error message leaks
grep -rn "error instanceof Error ? error.message" src/app/api/
# Expected: 0 results

# Security: zero as-any in target routes
grep -rn "as any" src/app/api/admin/reports/ src/app/api/admin/ab-tests/ src/app/api/admin/templates/performance/
# Expected: 0 results

# Security: middleware exists
test -f src/middleware.ts && echo "OK" || echo "MISSING"
# Expected: OK

# Build passes clean
npm run build
# Expected: 0 errors

# Route handler wrappers: no direct requireAgencyPermission in admin routes
grep -rn "requireAgencyPermission" src/app/api/admin/ --include="*.ts"
# Expected: 0 results (all go through adminRoute/adminClientRoute)

# Route handler wrappers: no direct requirePortalPermission in client routes
grep -rn "requirePortalPermission" src/app/api/client/ --include="*.ts"
# Expected: 0 results (all go through portalRoute)

# Tests pass
npm test
# Expected: 46 tests passing

# CI pipeline exists
test -f .github/workflows/ci.yml && echo "OK" || echo "MISSING"
# Expected: OK
```
