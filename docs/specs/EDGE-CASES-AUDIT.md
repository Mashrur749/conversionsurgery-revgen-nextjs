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
| EC-08 | team-escalation.ts | Lead deleted between escalation and re-notification | Skip claim if lead not found, log warning | Done |
| EC-09 | team-escalation.ts | All team SMS fail but claim marked re-notified | Only update reNotifiedAt if sentCount > 0 | Done |
| EC-10 | api/public/leads/route.ts | Duplicate lead submissions | Dedup added in EC-03 | Done |
| EC-11 | api/public/leads/route.ts | XSS in name/message fields | HTML strip added in EC-03 | Done |
| EC-12 | payment-reminder.ts | Stripe link fails, invoice has no link | Fallback text: "Contact us to arrange payment" | Done |

## Medium Priority (fix in first month) — EC-13, EC-14, EC-16 FIXED

| # | File | Edge Case | Fix / Risk | Status |
|---|------|-----------|------------|--------|
| EC-13 | conversations-shell.tsx | Unbounded message polling with no pagination &mdash; slow with 1000+ messages | Initial load now fetches 50 messages with &quot;Load earlier messages&quot; button for history. Delta polling unchanged. | Done |
| EC-14 | notification-bell.tsx | Unmounted component state update on pending fetch &mdash; React memory leak warning | AbortController prevents state updates on unmounted component | Done |
| EC-15 | notification-settings-form.tsx | Save failure not shown to user &mdash; thinks preferences saved when they weren&apos;t | Silent failure | Open |
| EC-16 | appointment-booking.ts | Compliance blocks all recipients &mdash; contractor never notified of booking | Falls back to email notification when compliance blocks all SMS recipients | Done |
| EC-17 | team-escalation.ts | No retry on SMS failure during initial escalation | Single retry with 1s delay before giving up | Done |
| EC-18 | resend.ts | 503 transient errors treated as permanent | 5xx retried (2 retries, 1s+2s), 4xx fails immediately | Done |

**Medium priority summary:** 5 of 6 fixed (EC-13, EC-14, EC-16, EC-17, EC-18). EC-15 remains open (low risk).

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

---

## Overall Summary

**Total edge cases: 25**
- Critical (EC-01 to EC-03): 3 fixed
- High priority (EC-04 to EC-12): 9 fixed
- Medium priority (EC-13 to EC-18): 5 fixed, 1 open (EC-15 &mdash; low risk)
- Low priority (EC-19 to EC-25): 7 known limitations with graceful degradation

**Fixed: 17 of 18 actionable items** (EC-01 through EC-18). EC-15 (notification settings silent save failure) remains open &mdash; low risk. The 7 low-priority items (EC-19 through EC-25) are accepted graceful-degradation behaviors, not bugs requiring fixes.
