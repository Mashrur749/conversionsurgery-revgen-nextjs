# Risk Acceptance: Pre-Legal Launch (Clients 1-5)

Date: 2026-04-01
Decision by: Mashrur Rahman (founder)
Status: Active until legal counsel is engaged (target: after client #5)

---

## Decision

Proceed with selling to the first 5 clients WITHOUT formal legal counsel review of the 4 items in `01-LEGAL-COUNSEL-BRIEF.md`. Engage counsel after reaching 5 paying clients to fund the review from revenue.

**Rationale:** The platform's compliance architecture (CASL consent tracking, CRTC quiet-hours enforcement, opt-out handling) is conservatively built. The first 5 clients are operator-managed with direct relationship oversight. The risk of a formal legal dispute at this scale is low, and the cost of delay (missing the spring sales window) outweighs the cost of operating with conservative interim language.

---

## Risk Mitigation (What We Do Instead)

### Item 1: Quiet Hours (CRTC Inbound-Reply Exemption)

**Risk**: Unknown whether inbound replies can be sent during 9 PM - 10 AM.
**Mitigation**: Keep `STRICT` mode active. Do NOT enable `INBOUND_REPLY_ALLOWED`. All outbound messages are queued during quiet hours, no exceptions. This is the most conservative possible position.
**In sales conversations**: Use ONLY the interim language from OFFER-CLIENT-FACING.md Section 6. Never promise or imply evening response capability. Frame the 10 AM delivery as "first in their inbox before any competitor."
**Documented in**: OFFER-CLIENT-FACING.md Section 6 (interim version only), SALES-OBJECTION-PLAYBOOK.md (quiet hours positioning).

### Item 2: Guarantee Enforceability

**Risk**: Guarantee terms may not be enforceable as drafted.
**Mitigation**: For clients 1-5, treat the guarantee as a goodwill commitment, not a legal obligation. The guarantee is designed to be generous (refund the month, keep all data), so disputes are unlikely. If a client triggers the guarantee, honor it immediately without argument.
**Operational rule**: If ANY ambiguity exists in attribution, default to refunding. The cost of one month's refund ($1,000) is far less than the cost of a dispute or negative word-of-mouth.
**Documented in**: OFFER-CLIENT-FACING.md Section 3 (attribution language is already log-based and objective).

### Item 3: Low-Volume Extension Formula

**Risk**: Formula may not be sufficiently clear for enforcement.
**Mitigation**: The Playbook now requires explicit verbal disclosure of adjusted windows for sub-15 lead volume prospects (added in Tier 2). The operator states the exact adjusted day count during the close. This creates mutual understanding before signing.
**Operational rule**: If a low-volume client disputes the extension, honor the shorter (standard) window. The $1,000 refund is not worth the argument.
**Documented in**: 02-MANAGED-SERVICE-PLAYBOOK.md Section 12 (guarantee volume disclosure script).

### Item 4: "Unlimited Messaging" Claim

**Risk**: "Unlimited" may be considered misleading if the contract has scope exclusions.
**Mitigation**: The contract clause in OFFER-CLIENT-FACING.md Section 5 already excludes mass broadcasting, personal messaging, and out-of-scope use. This is standard SaaS language. For clients 1-5, the operator manages all messaging directly — there is no scenario where a contractor could inadvertently trigger the exclusion.
**Operational rule**: If a contractor asks about blast messaging or cold outreach lists, explain that the system handles follow-up on their existing leads and inquiries, not cold outreach. Frame it as a CASL compliance benefit, not a limitation.

---

## What Changes at Client #5

1. Engage Canadian telecom/consumer-protection counsel using the prepared brief (`01-LEGAL-COUNSEL-BRIEF.md`)
2. Budget: $500-1,500 for a focused 1-hour review
3. Deliverable: Redline-ready clause text for all 4 items
4. If counsel confirms inbound-reply exemption: enable `INBOUND_REPLY_ALLOWED` mode and update offer copy to post-legal version
5. If counsel denies exemption: permanently update all materials to remove any aspirational evening-response language
6. Update service agreement with counsel-approved guarantee and unlimited messaging clauses
7. Archive this document as superseded

---

## What We Must NOT Do (Hard Rules for Clients 1-5)

1. **Never enable `INBOUND_REPLY_ALLOWED` mode** — keep STRICT quiet hours
2. **Never use the "Post-Legal-Review Version"** of quiet hours copy in any written material
3. **Never promise evening or overnight response** in writing, proposals, or emails
4. **Never argue a guarantee dispute** — if ambiguous, refund immediately
5. **Never send mass broadcasts** or allow contractors to use the system for cold outreach
6. **Always use the interim-safe language** marked in OFFER-CLIENT-FACING.md
7. **Always verbally disclose** the adjusted guarantee window for sub-15 lead volume prospects

---

## Residual Risk Assessment

| Item | Risk Level (1-5 clients) | Worst Case | Cost of Worst Case |
|------|-------------------------|------------|-------------------|
| Quiet hours | **Low** — we use strictest possible mode | Homeowner complains about a 10 AM text | Apology + note in conversation |
| Guarantee | **Low** — we honor all refunds generously | Client disputes attribution at Day 90 | $1,000 refund (budgeted) |
| Volume extension | **Low** — we disclose verbally + written | Client expects 30 days, gets 45 | Honor the 30-day window anyway |
| Unlimited messaging | **Very low** — operator controls all messaging | N/A at this scale | N/A |

**Overall assessment**: Acceptable risk for a managed service with direct operator oversight of 1-5 clients. The conservative technical posture (STRICT quiet hours, log-based attribution, CASL consent tracking) provides stronger compliance protection than most competitors in this market.
