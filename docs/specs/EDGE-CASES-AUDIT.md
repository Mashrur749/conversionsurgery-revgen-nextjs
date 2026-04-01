# Edge Cases Audit

Date: 2026-04-01
Scope: Runtime edge cases across all code modified/created in UX session
Method: File-by-file code review of error paths, race conditions, and boundary conditions

---

## Critical (must fix before first client) — ALL FIXED

| # | File | Edge Case | Fix | Status |
|---|------|-----------|-----|--------|
| EC-01 | notification-bell.tsx | localStorage access not wrapped in try-catch | Wrapped in try-catch, defaults to epoch on failure | Done |
| EC-02 | appointment-booking.ts | No unique constraint on (clientId, date, time) | Added partial unique index + catch for 23505 violation | Done |
| EC-03 | api/public/leads/route.ts | No rate limiting on public endpoint | 10 req/min IP rate limit + phone dedup + HTML tag stripping | Done |

## High Priority (fix before launch) — EC-04 thru EC-07 FIXED

| # | File | Edge Case | Fix | Status |
|---|------|-----------|-----|--------|
| EC-04 | conversations-shell.tsx | Race condition on rapid switching | AbortController cancels stale fetches | Done |
| EC-05 | conversations-shell.tsx | Lead deleted while viewing — frozen loading | 5s timeout + error state with "Back to list" | Done |
| EC-06 | conversations-shell.tsx | Polling errors silently swallowed | 3-failure counter + "Connection lost" banner | Done |
| EC-07 | client/page.tsx + admin/clients/[id]/page.tsx | Promise.all crashes on single failure | Promise.allSettled with typed defaults | Done |
| EC-08 | team-escalation.ts | Lead deleted between escalation and re-notification — SMS sent with empty name | Bad SMS |
| EC-09 | team-escalation.ts | All team SMS fail but claim marked as "re-notified" — no one actually notified | Silent failure |
| EC-10 | api/public/leads/route.ts | No deduplication — same phone submits twice in 1 second, two leads created | Duplicate leads |
| EC-11 | api/public/leads/route.ts | No input sanitization for XSS in name/message fields | XSS risk |
| EC-12 | payment-reminder.ts | Stripe link creation fails but invoice created without link | Broken payment flow |

## Medium Priority (fix in first month)

| # | File | Edge Case | Risk |
|---|------|-----------|------|
| EC-13 | conversations-shell.tsx | Unbounded message polling with no pagination — slow with 1000+ messages | Performance |
| EC-14 | notification-bell.tsx | Unmounted component state update on pending fetch — React memory leak warning | Console noise |
| EC-15 | notification-settings-form.tsx | Save failure not shown to user — thinks preferences saved when they weren't | Silent failure |
| EC-16 | appointment-booking.ts | Compliance blocks all recipients — contractor never notified of booking | Missed booking |
| EC-17 | team-escalation.ts | No retry on SMS failure during initial escalation — primary recipient misses alert | Missed alert |
| EC-18 | resend.ts | 503 transient errors treated as permanent — email lost on temp failure | Lost emails |

## Low Priority (known limitations)

| # | File | Edge Case | Current Behavior |
|---|------|-----------|-----------------|
| EC-19 | conversations-shell.tsx | localStorage unavailable | Graceful degradation — defaults to unread |
| EC-20 | notification-bell.tsx | API 500 on feed | Silently degrades, stale count |
| EC-21 | notification-bell.tsx | 0 clients / new account | Empty state renders correctly |
| EC-22 | client-detail-tabs.tsx | Invalid ?tab= param | Falls back to default tab |
| EC-23 | admin/clients/[id]/page.tsx | Day-one summary fails | Shows "temporarily unavailable" |
| EC-24 | lead-navigation.tsx | Stored lead list stale | Arrows hidden, no crash |
| EC-25 | api/public/leads/route.ts | Invalid clientId | Generic error, no info leak |
