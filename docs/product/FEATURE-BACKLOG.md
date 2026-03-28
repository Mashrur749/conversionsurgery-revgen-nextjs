# Feature Backlog

Planned features not yet implemented. Each entry includes context, current behavior, and desired behavior so implementation can start without re-discovery.

---

## FB-01: Owner/team call rejection → SMS fallback

**Priority:** Medium
**Area:** Voice / Escalation

### Context

When a lead triggers a hot transfer (via Voice AI or ring group), the system dials team members. If nobody answers, the existing `handleNoAnswer()` path in `ring-group.ts` sends an SMS to team members ("Missed hot transfer!") and an SMS to the lead ("Sorry we missed you!").

However, this only fires when the **dial times out** (30s). If the owner or team member **actively rejects** the call (presses decline while busy with other work), the Twilio `DialCallStatus` returns `busy` — and the current code treats it the same as a generic no-answer: plays a TwiML message to the lead and hangs up. No SMS notification is sent to the person who rejected.

### Current behavior

| Scenario | What happens |
|---|---|
| Ring group — no answer (timeout) | `ring-result` webhook → `handleNoAnswer()` → SMS to team + SMS to lead |
| Ring group — actively rejected | `ring-result` webhook → call marked `no-answer` → `handleNoAnswer()` fires (same as timeout) |
| Voice AI transfer — no answer/busy | `dial-complete` webhook → call marked `dropped` → TwiML "We&apos;ll call you back" → hangup. **No SMS sent.** |
| Voice AI transfer — actively rejected | Same as above — no SMS sent |

### Desired behavior

1. When a transfer is **rejected** (`busy`) or **unanswered** (`no-answer`), send an SMS to the person who missed it:
   - "You missed a call from [lead name/phone]. They were asking about: [last message context]. Call them back or reply here for details."
   - Send via the agency number (#5), not the business line.

2. If **all** team members reject/miss, escalate:
   - Create an escalation queue entry (existing `notifyTeamForEscalation()` path).
   - Send the lead an SMS: "We&apos;re finding someone to help you right now. You&apos;ll hear back within [SLA window]."

3. Log a `call_rejected` or `call_missed_with_sms` event in `audit_log` for ops visibility.

### Key files

- `src/lib/services/ring-group.ts` — `handleNoAnswer()` (ring group path)
- `src/app/api/webhooks/twilio/voice/ai/dial-complete/route.ts` — Voice AI transfer completion
- `src/app/api/webhooks/twilio/ring-result/route.ts` — ring group dial result
- `src/lib/services/hot-transfer.ts` — routing logic
- `src/lib/services/agency-communication.ts` — `sendAgencySMS()` for owner/team notifications
- `src/lib/services/team-escalation.ts` — `notifyTeamForEscalation()`

### Notes

- The `ring-status` statusCallback URL referenced in `ring-group.ts:64` points to `/api/webhooks/twilio/ring-status` which does not exist. This should be created or consolidated with `ring-result` as part of this work.
- Twilio `statusCallbackEvent` already includes `['initiated', 'ringing', 'answered', 'completed']` — may need to add `busy` and `no-answer` explicitly depending on Twilio&apos;s default behavior for `<Dial>` vs outbound calls.
- Consider debounce: if the same lead triggers multiple transfers in quick succession, avoid spamming the owner with duplicate SMS.
