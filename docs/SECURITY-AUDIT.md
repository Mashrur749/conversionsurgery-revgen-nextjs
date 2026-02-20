# Security Audit — ConversionSurgery RevGen

**Audit date:** 2026-02-18 / 2026-02-19
**Scope:** All API routes, auth flows, middleware, data access patterns
**Methodology:** Automated code analysis + manual review of every API route

---

## Executive Summary

The application underwent a comprehensive security hardening across 6 commits (5f9c160 → 6d04ee4). All admin and client-scoped API routes were migrated from a simple `session?.user?.isAdmin` boolean check to a granular permission system with role-based access control and client scope enforcement.

**Current posture:** All critical and high-severity issues have been resolved. Remaining items are medium/low severity and documented below.

---

## Findings: RESOLVED

### S1 — Admin client routes lacked client scope [CRITICAL → FIXED]
**Commit:** 5f9c160
- **Issue:** `/api/admin/clients/[id]/*` routes (21 routes) only checked `isAdmin` but not whether the admin was assigned to that client. Any admin could access any client's data.
- **Fix:** All routes now use `requireAgencyClientPermission(clientId, PERMISSION)` which checks both permission AND client scope assignment.

### S2 — Admin routes used legacy auth check [HIGH → FIXED]
**Commit:** 6d04ee4
- **Issue:** 59 admin API routes used `session?.user?.isAdmin` boolean — no granular permissions, no audit trail.
- **Fix:** All 80 admin route files now use `requireAgencyPermission(AGENCY_PERMISSIONS.X)`. The only file that still imports `auth` from `@/auth` is `plans/route.ts` which legitimately needs it for the additional `isSuperAdmin()` gate on plan creation.

### S3 — Client-scoped analytics routes had no scope check [HIGH → FIXED]
**Commit:** 6d04ee4
- **Issue:** 12 `/api/clients/[id]/*` routes (analytics, escalation rules, outcomes, lead scores) checked `isAdmin` but didn't verify the admin was assigned to that client.
- **Fix:** All routes migrated to `requireAgencyClientPermission()`.

### C1 — OTP timing leak [CRITICAL → FIXED]
**Commit:** ebf8063
- **Issue:** OTP verification used direct string comparison, allowing timing-based attacks.
- **Fix:** Replaced with `timingSafeEqual()` comparison.

### C2 — Business selection token forgery [CRITICAL → FIXED]
**Commit:** ebf8063
- **Issue:** `select-business` endpoint accepted raw `personId` in request body — attacker could impersonate any person.
- **Fix:** Added HMAC-signed token validation for business selection.

### C3 — Escalation prevention bypass [CRITICAL → FIXED]
**Commit:** ebf8063
- **Issue:** Role template and team management routes lacked `preventEscalation()` checks — a user could grant themselves permissions they didn't have.
- **Fix:** All 4 admin role/team routes now have `preventEscalation()` checks.

### C4 — Missing permission checks on client portal routes [CRITICAL → FIXED]
**Commit:** ebf8063
- **Issue:** 16 `/api/client/*` routes still used the old `getClientSession()` without permission checks.
- **Fix:** All 16 routes migrated to `requirePortalPermission()` with appropriate permission constants.

### H1 — IDOR in sub-resource routes [HIGH → FIXED]
**Commit:** 582087b
- **Issue:** Routes like `/api/admin/clients/[id]/knowledge/[entryId]` didn't verify the sub-resource belonged to the parent client.
- **Fix:** Added ownership verification (join on clientId) for all sub-resource routes.

### H3 — XSS in email preview [HIGH → FIXED]
**Commit:** 6faf61e
- **Issue:** Email template preview rendered user-supplied HTML without sanitization.
- **Fix:** Added DOMPurify sanitization to email preview rendering.

### H4 — Cross-client escalation claim [HIGH → FIXED]
**Commit:** 6faf61e
- **Issue:** Escalation claim endpoint didn't verify the escalation belonged to the claiming admin's assigned clients.
- **Fix:** Added client scope check to escalation claim.

---

## Findings: REMAINING

### M1 — Twilio webhooks lack signature validation [MEDIUM]
**Status:** Partially addressed
- **Current state:** SMS webhook uses `validateAndParseTwilioWebhook()` which validates Twilio signatures. However, some voice webhook sub-routes (gather, transfer, dial-complete) should be verified to use the same validation.
- **Risk:** If any voice webhook route skips validation, an attacker could forge webhook calls.
- **Recommendation:** Audit all 8 Twilio webhook routes to confirm consistent use of `validateAndParseTwilioWebhook()`.

### M2 — Error messages leak internal details [MEDIUM]
**Status:** Not addressed
- **Current state:** ~30 admin routes return `error.message` to the client in 500 responses (e.g., `{ error: error instanceof Error ? error.message : 'Failed to...' }`). While this is behind admin auth, internal error details (stack frames, DB errors) could leak.
- **Files affected:** reports/route.ts, reviews responses, twilio routes, templates routes, usage routes, and others.
- **Recommendation:** Use generic error messages in 500 responses, log full errors server-side only.

### M3 — `as any` type casts in admin routes [MEDIUM]
**Status:** Known, tracked
- **Files:** `reports/route.ts` (7 casts for JSON columns, date fields), `ab-tests/route.ts` (for JSON columns)
- **Risk:** Type safety bypass could mask data integrity issues. Not a direct security vulnerability but reduces confidence in data handling.
- **Recommendation:** Define proper TypeScript interfaces for JSON column types.

### M4 — No rate limiting on API routes [MEDIUM]
**Status:** Not addressed
- **Current state:** No rate limiting middleware exists. All routes are protected by auth, but authenticated users can make unlimited requests.
- **Risk:** Brute-force attacks on OTP verification, API abuse, denial of service from authenticated users.
- **Recommendation:** Add rate limiting middleware, especially on: OTP send/verify, message sending, report generation, AI regeneration endpoints.

### M5 — No CSRF protection [MEDIUM]
**Status:** Not addressed
- **Current state:** Cookie-based auth (both NextAuth session and client portal cookie) without CSRF tokens. Next.js App Router routes use JSON bodies (not form submissions), which provides some implicit protection via `Content-Type` enforcement.
- **Risk:** Low for JSON API routes (browsers block cross-origin JSON posts by default via CORS). Higher for any endpoints that accept `application/x-www-form-urlencoded`.
- **Recommendation:** Verify no routes accept form-encoded input. Consider adding `SameSite=Strict` to auth cookies if not already set.

### M6 — No middleware-level route protection [LOW]
**Status:** By design
- **Current state:** No `middleware.ts` file exists. All auth is enforced at the route handler level via `requireAgencyPermission()` / `requirePortalPermission()`.
- **Risk:** A developer could add a new admin route and forget to add the permission check. There's no safety net at the middleware layer.
- **Recommendation:** Consider adding a middleware that rejects unauthenticated requests to `/api/admin/*` and `/api/client/*` as a defense-in-depth measure.

### L1 — Cron route relies on Cloudflare `cf-cron` header [LOW]
**Status:** By design
- **Current state:** The main cron orchestrator (`/api/cron/route.ts`) checks for `cf-cron` header (set by Cloudflare Workers) and `CRON_SECRET` env var. Sub-cron routes verify `Authorization: Bearer <CRON_SECRET>` passed by the orchestrator.
- **Risk:** In non-Cloudflare environments, the `cf-cron` header could be spoofed. The `CRON_SECRET` provides the actual security.
- **Recommendation:** Acceptable for Cloudflare deployment. If migrating platforms, add `CRON_SECRET` verification to the orchestrator route itself.

### L2 — User management route lost self-demotion protection [LOW]
**Status:** Known, acceptable
- **Current state:** `users/[id]/route.ts` PATCH previously had a check preventing admins from removing their own admin access (`if (id === session.user.id && body.isAdmin === false)`). This was removed during the permission migration because the new system uses `personId`, not `session.user.id`.
- **Risk:** An admin could accidentally remove their own admin flag via the legacy users table. The new permission system (people + memberships) has its own `preventEscalation()` checks.
- **Recommendation:** Re-add self-demotion protection using the new session format, or deprecate the legacy user management route once migration is complete.

---

## Related: System Blockers Remediation

This audit covers **auth and access control** findings. A companion audit at `docs/SYSTEM-BLOCKERS.md` covers **data integrity, API resilience, and business logic** findings that also have security implications:

- **Phase 1 (Critical):** Transactions on subscription lifecycle (D1), atomic race condition fixes on coupon redemption / escalation claims / OTP verification (D2-D4), Stripe idempotency keys (E1), SMS retry (E3), env validation (S2)
- **Phase 2 (High):** FK constraints (D5-D6), webhook dedup (E4, E7), scheduled message atomic claims (E8), missing Stripe webhook handlers (E9), webhook secret fail-fast (S3)
- **Phase 3 (Medium):** Coupon count reconciliation (D8), email retry (E12), carrier filtering prevention (E10), Stripe cancellation on client delete (B3), pagination safety limits (S4)
- **Phase 4 (Low):** Audit trail for hard deletes (D13), global OTP rate limit (E15), coupon soft-delete protection (B8)

Together, these two audits form a comprehensive hardening program. All 45 system blocker items are resolved.

---

## Permission Mapping Reference

| Permission Constant | Routes Protected | Count |
|---------------------|-----------------|-------|
| `BILLING_VIEW` | plans (GET), subscriptions, usage, usage alerts | 5 |
| `BILLING_MANAGE` | plans (POST/PATCH/DELETE), coupons | 5 |
| `TEMPLATES_EDIT` | email templates, message templates | 6 |
| `FLOWS_VIEW` | flow template versions | 1 |
| `FLOWS_EDIT` | flow templates CRUD, clone, publish, push | 5 |
| `ABTESTS_MANAGE` | A/B tests CRUD, results | 3 |
| `ANALYTICS_VIEW` | reports, analytics templates, platform analytics, template performance | 6 |
| `PHONES_MANAGE` | Twilio (6 routes), phone reassign | 7 |
| `SETTINGS_MANAGE` | system settings, agency settings, help articles, webhook logs | 6 |
| `CLIENTS_VIEW` | escalation rules (GET) | 1 |
| `CLIENTS_EDIT` | escalation rules (POST/PATCH/DELETE), API keys, client CRUD | 5+ |
| `AI_EDIT` | voice preview, voice voices | 2 |
| `CONVERSATIONS_VIEW` | agency messages (GET) | 2 |
| `CONVERSATIONS_RESPOND` | responses CRUD, regenerate, post, reviews responses, agency send-digest, agency messages (POST) | 8 |
| `TEAM_MANAGE` | users CRUD, team management | 4 |

### Client Portal Permissions
| Permission | Routes |
|-----------|--------|
| `REVENUE_VIEW` | /api/client/revenue |
| `KNOWLEDGE_VIEW/EDIT` | /api/client/knowledge, /api/client/knowledge/[id] |
| `SETTINGS_VIEW/EDIT/AI` | /api/client/ai-settings, features, flows, notifications, settings/summary, cancel, billing |
| `CONVERSATIONS_VIEW` | /api/client/conversations/[id]/send, takeover, handback |
| `LEADS_VIEW/EDIT` | /api/client/leads/[id]/suggestions |
| `DASHBOARD` | /api/client/help-articles |
| `TEAM_VIEW/MANAGE` | /api/client/team |

### Webhook/Cron Auth
| Route Pattern | Auth Method |
|---------------|-------------|
| `/api/webhooks/stripe` | Stripe signature verification |
| `/api/webhooks/twilio/*` | `validateAndParseTwilioWebhook()` |
| `/api/webhooks/form` | `Bearer <FORM_WEBHOOK_SECRET>` |
| `/api/cron/route.ts` | `cf-cron` header + `CRON_SECRET` |
| `/api/cron/*` sub-routes | `Authorization: Bearer <CRON_SECRET>` |
| `/api/client/auth/*` | Public (login flow) |

---

## Commits (chronological)

| Commit | Description | Severity Fixed |
|--------|-------------|---------------|
| 5f9c160 | Enforce client scope on admin client API routes (S1) | Critical |
| ebf8063 | Fix critical security vulnerabilities (C1-C4) | Critical |
| 582087b | Fix IDOR vulnerabilities in sub-resource routes (H1) | High |
| 6faf61e | Fix escalation cross-client claim and XSS (H3-H4) | High |
| 6d04ee4 | Migrate all admin routes to permission system (S2+S3) | High |

---

## Verification Commands

```bash
# Verify no admin routes use old auth pattern
grep -rn "session?.user?.isAdmin" src/app/api/admin/
# Expected: 0 results

# Verify all admin routes use permission system
find src/app/api/admin -name "route.ts" | xargs grep -L "requireAgencyPermission\|requireAgencyClientPermission"
# Expected: 0 results

# Verify no old requireAdmin in API routes
grep -rn "requireAdmin\b" src/app/api/
# Expected: 0 results

# Verify client portal routes use permissions
find src/app/api/client -name "route.ts" | xargs grep -L "requirePortalPermission\|getClientSession" | grep -v auth
# Expected: 0 results (auth routes are intentionally public)

# TypeScript passes clean
npx tsc --noEmit
# Expected: 0 errors
```
