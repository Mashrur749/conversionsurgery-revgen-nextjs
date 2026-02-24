# MS-04: Smart Assist Auto-Send Parity

## Goal
Implement smart assist mode with default 5-minute auto-send window:
- contractor can approve/edit before send
- if no response in window, AI response auto-sends
- sensitive categories can require manual approval

## Why This Matters
Assist-only approval can break speed-to-lead during onboarding, which directly hurts perceived value.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- `aiAgentMode` model in `src/db/schema/clients.ts`.
- Existing inbound AI response pipeline in `src/lib/automations/incoming-sms.ts`.
- Prompt/notification patterns in `src/lib/services/agency-communication.ts`.

### Misaligned behavior to change
- No timed approval window with auto-send fallback.
- No category-level sensitivity policy for assist mode.

## Target State
Smart assist is operational for onboarding and ongoing managed service:
- safe categories auto-send after delay
- sensitive categories remain manual unless explicitly enabled

## Work Units (Tiny, Executable)
### Milestone A: Smart assist config model
1. Add client config fields:
- `smartAssistEnabled`
- `smartAssistDelayMinutes` (default 5)
- `smartAssistManualCategories` (array)
2. Add admin/client settings API exposure for these fields.

Refactor checkpoint A:
- Centralize AI send-policy resolution in `src/lib/services/ai-send-policy.ts`.

### Milestone B: Deferred-send pipeline
1. For smart-assist eligible messages, create pending outbound artifact with `sendAt=now+delay`.
2. Notify contractor with approve/edit/cancel options.
3. If user edits/approves before timeout, send edited version and cancel pending item.
4. If timeout reached without action, auto-send original response.

Refactor checkpoint B:
- Extract pending-outbound lifecycle manager service.

### Milestone C: Sensitive category controls
1. Define category mapping (`first_response`, `estimate_followup`, `payment`, etc.).
2. Enforce manual-only behavior for configured sensitive categories.
3. Add clear operator visibility of why a message waited for manual action.

Refactor checkpoint C:
- Replace string literals with shared category enum/constants.

### Milestone D: Failure handling and observability
1. Add status states: `pending_approval`, `auto_sent`, `approved_sent`, `cancelled`.
2. Add retry-safe send execution path.
3. Add simple metrics counters for assist outcomes.

Refactor checkpoint D:
- Consolidate status transition logic into a small state-transition helper.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove any docs/copy claiming smart assist if it is not live in current branch.
- Remove legacy assist assumptions from onboarding docs once smart assist is live.
- Remove unused approval artifacts if superseded by new model.

## Testing & Acceptance
### Automated
1. Auto-send after delay test.
2. Approve-before-delay test.
3. Edit-before-delay test.
4. Manual-only category test.

### Manual
1. New lead message in smart assist mode sends within configured delay when untouched.
2. Contractor edit path overrides auto-send correctly.
3. Sensitive category remains manual as configured.

## Definition of Done
- Smart assist behavior matches offer description and is configurable per client.
- Speed is preserved without losing control.
