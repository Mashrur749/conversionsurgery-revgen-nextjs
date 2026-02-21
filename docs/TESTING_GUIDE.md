# Testing Guide

Last updated: 2026-02-21
Audience: Engineering + Operations

## 1. Fast Validation (Required)

```bash
npm test
npm run build
```

Current baseline:
- Unit tests: 46 passing
- Build: must pass before merge/release

## 2. Core Regression Areas

### Access + Tenant Isolation
1. Agency assigned-scope user can only see assigned clients.
2. Unassigned client access attempts are rejected by API.
3. Portal page permission guard redirects unauthorized users.

### Team Management
1. Adding/reactivating team member respects plan team-member limit.
2. Non-owner role assignment cannot escalate permissions.

### Onboarding
1. Admin create-client creates owner identity + client membership.
2. Wizard blocks progression on team step API failures.
3. Review step business edits persist via API.

### Messaging/Escalation
1. Escalation fallback notifies owner when no team escalation recipients.
2. Agency communication actions only mark executed after successful execution.

### Cron Security
1. `/api/cron` returns 401 without bearer secret.
2. `/api/cron` succeeds with `Authorization: Bearer $CRON_SECRET`.

## 3. Manual Smoke Run (Pre-Release)
1. Create or select a test client.
2. Send inbound lead message path and verify response/logs.
3. Trigger escalation path and validate assignment/fallback.
4. Validate one cron run and inspect returned job results.
5. Validate client portal page permissions across at least 2 roles.

## 4. Useful Commands

```bash
# Run all tests
npm test

# Build for production
npm run build

# Run one file
npx vitest run src/lib/permissions/resolve.test.ts

# Cron auth sanity check
curl -i -X POST http://localhost:3000/api/cron
curl -i -X POST http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

## 5. Release Gate
Release only if all pass:
1. `npm test`
2. `npm run build`
3. Manual smoke run complete
4. No open P1 items in `docs/REMAINING-GAPS.md`
