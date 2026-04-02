# Legal Counsel Brief (Pre-Client Signoff)

Last updated: 2026-02-24
Owner: ConversionSurgery leadership
Status: Required before first paid client contract
Source references:
- `docs/GRAND-SLAM-OFFER.md` (Part 10)
- `docs/product/02-OFFER-PARITY-GAPS.md`

## Objective
Obtain written legal guidance from a licensed Canadian lawyer on four must-have items that directly affect client-facing promises and contract exposure.

## Business Context
- Company: ConversionSurgery
- Offer: Managed service for renovation contractors in Alberta/Canada
- Primary channel: SMS + phone + workflow automation
- Contract model: month-to-month, cancellation with 30-day notice
- Planned launch timing: immediate sales start; legal signoff required before first paid signature

## Must-Have Questions (Counsel Decision Required)

1. Quiet-hours response classification
- Question: Can direct replies to inbound inquiries (missed call text-back, form-submission reply, inbound SMS reply) be sent during CRTC quiet hours while proactive outreach remains queued?
- Why it matters: core response-time claim language and compliance posture.
- Needed output: permitted / not permitted / conditionally permitted, with exact conditions and required disclosure language.

2. Guarantee enforceability
- Question: Are the 30-Day Proof-of-Life and 90-Day Revenue Recovery guarantees enforceable as drafted?
- Definitions to validate:
  - Qualified Lead Engagement
  - Attributed Project Opportunity
- Needed output: enforceability edits and exact contract-safe wording.

3. Low-volume extension formula enforceability
- Formula: `Adjusted window = Base window × (15 ÷ actual monthly volume)`
- Question: Is this formula enforceable and sufficiently clear in service agreement form?
- Needed output: required definitions for "actual monthly volume", averaging window, rounding, and dispute handling.

4. "Unlimited messaging" claim safety
- Sales phrase: "Unlimited. No caps. No overages."
- Contract qualifier: in-scope business use; excludes mass broadcasting/personal/out-of-scope use.
- Question: Is this claim + qualifier pair legally safe and not misleading under applicable law?
- Needed output: approved claim language and final clause text.

## Requested Deliverable from Counsel
Please provide:
1. Redline-ready clause text for all four items.
2. Approved/forbidden claim language list for written sales materials.
3. Any additional must-have contract terms to reduce dispute risk.
4. Confirmation whether items 1-4 are sufficient for first-client launch.

## Evidence Package to Share with Counsel
Attach:
1. Current offer source:
- `docs/GRAND-SLAM-OFFER.md`
2. Proposed legal redlines draft:
- `docs/legal/02-LEGAL-CLAUSE-REDLINES.md`
3. Current launch/parity status:
- `docs/product/01-LAUNCH-READINESS.md`
- `docs/product/02-OFFER-PARITY-GAPS.md`

## Internal Go/No-Go Rule

**Updated 2026-04-01:** Legal counsel deferred until after client #5. See `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` for the full risk mitigation plan and hard rules.

- ~~No paid client signatures until written counsel signoff on items 1-4 above.~~ **Superseded** — proceeding with conservative interim posture for clients 1-5.
- Until counsel signoff, all written materials must use interim-safe language:
  - "near-instant response during compliant hours"
  - no absolute guarantee language beyond defined contract terms
  - STRICT quiet hours mode only (no `INBOUND_REPLY_ALLOWED`)
  - guarantee disputes default to refund (no argument)
- **Trigger for counsel engagement:** 5 paying clients or first guarantee dispute, whichever comes first.

## Session Prep Template (Send to Lawyer)
Use this exact intro:

"We are launching a managed SMS/AI follow-up service in Canada for home-service contractors. We need a focused legal review of four items before first paid clients: quiet-hours handling for inbound replies, guarantee clause enforceability, low-volume guarantee extension formula enforceability, and unlimited messaging claim language. Please provide contract-ready wording and claim guardrails. We are attaching our current offer document and draft clause redlines."

## Notes
- This document is operational/legal prep only and not legal advice.
