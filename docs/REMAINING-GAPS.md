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

#### 1. Identity migration not run
- **Category:** Operations
- **Description:** The SPEC-06 identity migration (`migrate-identities.ts` + `verify-migration.ts`) has been built and tested but not yet executed in production. Until run, all users rely on the legacy auth bridge which grants full permissions.
- **Recommendation:** Schedule a maintenance window. Run on staging first, verify with `verify-migration.ts`, then run in production.
- **Files:** `src/scripts/migrate-identities.ts`, `src/scripts/verify-migration.ts`

#### 2. Legacy tables still exist
- **Category:** Schema
- **Description:** After the identity migration, these tables/columns become dead weight:
  - `admin_users` table — fully replaced by `agency_memberships`
  - `team_members` table — runtime code uses `team-bridge.ts`, but table still exists
  - `users.isAdmin` column — replaced by `agency_memberships`
  - `users.clientId` column — replaced by `client_memberships`
- **Recommendation:** After migration is verified in production, create a Drizzle migration to: (1) drop `admin_users`, (2) drop `team_members`, (3) remove `isAdmin` and `clientId` columns from `users`.
- **Dependencies:** Requires identity migration (item 1) to be complete and verified.

### Medium Priority

#### 3. Missing `updatedAt` columns
- **Category:** Schema
- **Description:** 5 tables lack `updatedAt` timestamps, making it impossible to track when records were last modified:
  - `conversations`
  - `coupons`
  - `reviews`
  - `voice_calls`
  - `support_messages`
- **Recommendation:** Add `updatedAt` columns via Drizzle migration. Set default to `now()` for existing rows. Update relevant service code to set `updatedAt` on mutations.

#### 4. No automated test suite
- **Category:** Infrastructure
- **Description:** The codebase has zero automated tests. All verification is manual (typecheck + build).
- **Recommendation:** Start with API route integration tests using Vitest + supertest. Priority order:
  1. Auth flows (OTP send/verify, session management)
  2. Billing (subscription lifecycle, webhook handlers)
  3. Permission system (role resolution, escalation prevention)
  4. Webhook handlers (Twilio signature validation, Stripe event processing)
- **Note:** The permission system (`resolvePermissions`, `hasPermission`, `preventEscalation`) is particularly well-suited for unit tests.

#### 5. No CI/CD pipeline
- **Category:** Infrastructure
- **Description:** No GitHub Actions or equivalent CI pipeline. PRs are not automatically checked.
- **Recommendation:** Minimal pipeline:
  ```yaml
  # .github/workflows/ci.yml
  - npm run typecheck
  - npm run build
  - npm audit --audit-level=moderate
  ```
  Add to run on every PR to `main`.

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
```
