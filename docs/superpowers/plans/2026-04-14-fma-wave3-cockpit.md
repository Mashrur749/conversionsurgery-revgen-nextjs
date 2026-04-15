# FMA Wave 3: Operator Cockpit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform operator workflow from reactive checking to proactive action queue. Surface engagement signals, auto-generate call prep, suggest KB-gap resolutions, and enable SMS-reply KB entries.

**Architecture:** Extend existing triage dashboard with aggregated operator actions service. Build engagement signals on top of existing `engagement-health.ts`. Leverage existing call-prep page (`/admin/clients/[id]/call-prep/`) by linking it from the cockpit. Add auto-resolve service using semantic search from `knowledge-base.ts`. Wire daily digest KB gap replies through `executeNumberedReply()`.

**Tech Stack:** Drizzle ORM queries, Next.js API routes + RSC pages, React components, existing semantic search (pgvector), existing numbered-reply-parser.

**Prerequisites:** Wave 1 (digest, feature flags), Wave 2 (gates provide data). All complete.

**Key codebase findings:**
- Triage dashboard exists at `/admin/triage/` with health status per client
- Call prep page exists at `/admin/clients/[id]/call-prep/` with 14-day rolling data
- Engagement health service exists (`engagement-health.ts`) — signals computed but not surfaced in triage
- `executeNumberedReply()` in `agency-communication.ts` has NO handler for `daily_digest` interactionType — KB gap replies fall through
- Escalation page at `/admin/escalations/` supports assign only — no resolve/close action
- KB gaps schema already has `kbEntryId` FK column for linking resolved entries

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/services/operator-actions.ts` | Aggregates all pending actions from all sources into unified list |
| Create | `src/lib/services/engagement-signals.ts` | 5 deterministic engagement indicators per client |
| Create | `src/lib/services/auto-resolve.ts` | KB-gap escalation resolution suggestions via semantic search |
| Create | `src/app/api/admin/operator-actions/route.ts` | GET endpoint returning aggregated operator actions |
| Create | `src/app/api/admin/clients/[id]/engagement-signals/route.ts` | GET endpoint for per-client signals |
| Create | `src/app/api/admin/clients/[id]/auto-resolve/[gapId]/route.ts` | GET suggestion + POST to apply |
| Modify | `src/app/(dashboard)/admin/triage/page.tsx` | Extend with operator action queue, engagement signals, call prep links |
| Modify | `src/lib/services/agency-communication.ts` | Add `daily_digest` branch to `executeNumberedReply()` for KB gap replies |
| Modify | `src/lib/services/contractor-digest.ts` | Ensure KB gaps have correct numbering and reply instructions |
| Modify | `src/app/(dashboard)/admin/escalations/page.tsx` | Add auto-resolve suggestion + resolve action |
| Modify | `src/app/api/cron/route.ts` | Register engagement signals weekly cron |
| Modify | `src/lib/features/check-feature.ts` | No changes — `engagementSignals`, `autoResolve`, `callPrep` already in SystemFeatureFlag |

---

### Task 1: Operator actions aggregation service

**Intent:** Single service that collects all pending actions across all clients into a unified, urgency-sorted list. This is the data backbone of the cockpit.

**What to build — `src/lib/services/operator-actions.ts`:**

`getOperatorActions()` function that returns `OperatorAction[]` sorted by urgency.

**Action types to aggregate:**

| Type | Source | Urgency | Detail |
|------|--------|---------|--------|
| `escalation_pending` | `escalationQueue` where status IN ('pending', 'assigned') | Red if > 24h old, yellow otherwise | Count + oldest age |
| `onboarding_gate_pending` | Clients created < 30 days ago where onboarding checklist has blocking items incomplete | Yellow | Which gates are blocking |
| `forwarding_failed` | Clients where `forwardingVerificationStatus = 'failed'` | Yellow | Last attempt date |
| `kb_gaps_accumulating` | Clients with 5+ open KB gaps (status = 'new') | Yellow | Gap count |
| `guarantee_approaching` | Clients where guarantee window ends in < 20 days AND pipeline insufficient | Red if < 10 days, yellow if < 20 | Days remaining |
| `engagement_flagged` | Clients where 4/5 engagement signals are yellow/red for 14+ days | Yellow | Signal summary |
| `call_prep_due` | Clients active 14+ days with no call-prep view in last 14 days | Yellow (low priority) | Days since last prep |

**Return type:**
```typescript
interface OperatorAction {
  id: string;                    // deterministic: `${type}_${clientId}`
  type: string;                  // action type from table above
  clientId: string;
  clientName: string;
  urgency: 'red' | 'yellow' | 'green';
  title: string;                 // e.g. "3 pending escalations"
  detail: string;                // e.g. "Oldest: 26 hours ago"
  actionUrl: string;             // link to the relevant page
  createdAt: Date;               // when the condition first became true
}
```

**Implementation pattern:**
- Run all source queries in parallel with `Promise.all`
- Build unified list, sort by urgency (red first), then by age (oldest first)
- Active clients only (status = 'active')
- This is a read-only aggregation — no side effects

**API endpoint:** `GET /api/admin/operator-actions` — uses `adminRoute` with `CLIENTS_VIEW` permission. Returns `{ actions: OperatorAction[], summary: { red: number, yellow: number, total: number } }`

**Steps:**
- [ ] **Step 1:** Create `src/lib/services/operator-actions.ts` with all 7 action type queries
- [ ] **Step 2:** Create `src/app/api/admin/operator-actions/route.ts`
- [ ] **Step 3:** Run typecheck
- [ ] **Step 4:** Commit: `feat: operator actions aggregation service (FMA 5.1)`

---

### Task 2: Engagement signals service

**Intent:** 5 deterministic engagement indicators per client. Each independently green/yellow/red. Surfaces in cockpit when 4/5 are yellow/red for 14+ days.

**What to build — `src/lib/services/engagement-signals.ts`:**

`getEngagementSignals(clientId: string)` function returning 5 signals.

**5 signals (from spec Section 2.2):**

| Signal | Green | Yellow | Red | Data source |
|--------|-------|--------|-----|-------------|
| EST trigger recency | < 7 days | 7-14 days | > 14 days | `leads` table: most recent lead with status in ('estimate_sent', 'appointment_set', 'won') — days since |
| WON/LOST recency | < 14 days | 14-21 days | > 21 days | `leads` table: most recent with status in ('won', 'lost') — days since |
| KB gap response rate | > 70% | 30-70% | < 30% | `knowledgeGaps` table: resolved / total for this client |
| Nudge response rate | > 50% | 20-50% | < 20% | `agencyMessages` where `promptType` in probable_wins types: actioned / total for last 30 days |
| Last contractor contact | < 7 days | 7-14 days | > 14 days | `messages` or `agencyMessages` where direction = 'inbound' and channel = 'sms' — most recent from contractor |

**Return type:**
```typescript
interface EngagementSignal {
  key: string;
  label: string;
  status: 'green' | 'yellow' | 'red';
  value: string;              // human-readable, e.g. "12 days ago"
  threshold: string;          // e.g. "< 7 days = green"
}

interface EngagementSignalsResult {
  signals: EngagementSignal[];
  flagged: boolean;           // true if 4/5 are yellow/red
  greenCount: number;
  yellowCount: number;
  redCount: number;
}
```

**Feature flag:** `resolveFeatureFlag(clientId, 'engagementSignals')` — skip if disabled.

**Relationship to existing `engagement-health.ts`:** This is a NEW service, not a replacement. `engagement-health.ts` computes `healthy/at_risk/disengaged` for weekly alerts. This service computes 5 independent signals for real-time cockpit display. They can coexist.

**API endpoint:** `GET /api/admin/clients/[id]/engagement-signals` — returns the signals result.

**Steps:**
- [ ] **Step 1:** Create `src/lib/services/engagement-signals.ts` with 5 signal calculations
- [ ] **Step 2:** Create API route `src/app/api/admin/clients/[id]/engagement-signals/route.ts`
- [ ] **Step 3:** Run typecheck
- [ ] **Step 4:** Commit: `feat: 5 deterministic engagement signals per client (FMA 5.2)`

---

### Task 3: Auto-resolve escalations service

**Intent:** For KB-gap escalations, suggest an answer sourced from the contractor's existing KB. Operator always approves before sending. Never graduates past supervised.

**What to build — `src/lib/services/auto-resolve.ts`:**

**Function 1: `getSuggestion(clientId: string, gapId: string)`**
1. Load the knowledge gap from `knowledgeGaps` table
2. Use `semanticSearch(clientId, gap.question)` from `knowledge-base.ts` to find matching KB entries
3. If match found with similarity > 0.7 (or ILIKE fallback):
   - Return `{ found: true, source: 'kb', entry: matchedEntry, confidence: similarity, requiresContractorConfirmation: false }`
4. If no KB match, check if client has `googleBusinessUrl` set. If so, return `{ found: false, source: null, note: 'No KB match. Consider checking contractor website.' }` — website scraping is Wave 4+ scope
5. If nothing: `{ found: false }`

**Function 2: `applyResolution(clientId: string, gapId: string, kbEntryId: string, answer: string, operatorPersonId: string)`**
1. Create new KB entry via `addKnowledgeEntry(clientId, { category: 'faq', title: gap.question, content: answer })` — or link to existing entry
2. Update knowledge gap: `status = 'resolved'`, `kbEntryId`, `resolvedByPersonId`, `resolvedAt`
3. Write audit_log entry: action `'kb_gap_auto_resolved'`
4. Return the updated gap

**Trust gates (from spec Section 2.3):**
- First 5 auto-resolves per client: require "I confirmed with contractor" (track count in audit_log, action = 'kb_gap_auto_resolved' for that client)
- Source shown verbatim to operator
- External data flagged (not implemented yet — KB-only for now)
- Operator must click "I verified this is accurate" (UI concern, Task 5)

**API endpoints:**
- `GET /api/admin/clients/[id]/auto-resolve/[gapId]` — returns suggestion
- `POST /api/admin/clients/[id]/auto-resolve/[gapId]` — applies resolution with body `{ answer, kbEntryId? }`

**Feature flag:** `resolveFeatureFlag(clientId, 'autoResolve')`

**Steps:**
- [ ] **Step 1:** Create `src/lib/services/auto-resolve.ts`
- [ ] **Step 2:** Create API routes at `src/app/api/admin/clients/[id]/auto-resolve/[gapId]/route.ts`
- [ ] **Step 3:** Run typecheck
- [ ] **Step 4:** Commit: `feat: auto-resolve KB-gap escalations via semantic search (FMA 5.4)`

---

### Task 4: SMS-reply KB entry pipeline

**Intent:** When a contractor replies to a KB gap question in the daily digest, parse the reply and create a draft KB entry. This is the critical missing pipeline — `executeNumberedReply()` currently has no handler for `daily_digest` interactionType.

**What to modify — `src/lib/services/agency-communication.ts`:**

Add a `daily_digest` branch to `executeNumberedReply()`. The daily digest numbering uses three item types:
- `estimate_prompt` — reply `N=YES` selects estimate follow-up (digit + "=YES")
- `won_lost_prompt` — reply `WN` or `LN` marks won/lost
- `kb_gap` — reply with plain text is the KB answer (digit only, then follow-up text)

**The problem:** KB gap replies are two-message flows:
1. Contractor sends the digit (e.g., `3`) — this selects the KB gap
2. Contractor sends the answer text as a follow-up message

**Solution approach:** When a numbered reply selects a KB gap item (type `kb_gap`):
1. Mark the `agencyMessages` row as `actionStatus = 'pending_answer'`
2. Store the selected gap ID in the action payload metadata
3. On the NEXT inbound message from the contractor to that client's agency number:
   - Check if there's a recent `pending_answer` action
   - If yes, treat the message as the KB answer
   - Create a KB entry via `addKnowledgeEntry()` with `category: 'faq'`, `title: gap.question`, `content: reply text`
   - Update the knowledge gap: `status = 'resolved'`, link `kbEntryId`
   - Reply to contractor: "Got it, thanks! Added to your knowledge base."
   - Clear the pending_answer state

**Actually — simpler approach:** The numbered reply parser already handles free-text. For KB gaps, the format is `3. "question?" Reply with answer`. If the contractor replies `3 Yes we offer financing options`, the `3` is the digit selection and `Yes we offer financing options` is the answer in the same message. Check if `parseNumberedReply` already captures trailing text. If not, add a simpler path:

Look at the inbound SMS handler. When a reply to an agency prompt comes in with `interactionType: 'daily_digest'`:
- If the selection is for a `kb_gap` type item AND the full message has text beyond the digit (e.g., `3 Yes we do financing`), treat the text after the digit as the KB answer
- If only a digit is sent (e.g., `3`), set a pending state and wait for the follow-up

**Implementation — add to `executeNumberedReply()`:**

```
case 'daily_digest':
  for each selection:
    find the matching option in actionPayload.options
    if option.type === 'estimate_prompt' and action === 'select':
      trigger estimate follow-up (reuse existing logic)
    if option.type === 'won_lost_prompt':
      handle won/lost (reuse existing outcome command logic)
    if option.type === 'kb_gap' and action === 'select':
      // Check if there's trailing text in the original message after the digit
      // If yes: create KB entry immediately
      // If no: mark as pending_answer, handle in next message
```

**Constraints:**
- Feature flag: part of `dailyDigestEnabled` (no separate flag)
- KB entries created from SMS replies should be `reviewRequired: true` on the knowledge gap (operator verifies before it goes live)
- Auto-approve if reply is > 10 words (per spec)
- Reply to contractor with confirmation message via `sendActionPrompt`

**Steps:**
- [ ] **Step 1:** Read `executeNumberedReply()` in `agency-communication.ts` to understand current structure
- [ ] **Step 2:** Add `daily_digest` branch handling all 3 item types
- [ ] **Step 3:** Handle KB gap reply — create entry, update gap, send confirmation
- [ ] **Step 4:** Run typecheck + tests
- [ ] **Step 5:** Commit: `feat: SMS-reply KB entry pipeline for daily digest (FMA 5.5)`

---

### Task 5: Triage dashboard enhancements

**Intent:** Extend the existing triage page to show operator action queue, engagement signal badges, and call prep links. This is the primary UX change.

**What to modify — `src/app/(dashboard)/admin/triage/page.tsx`:**

1. **Top KPI row** — Add summary cards above the client list:
   - "Actions Due" (red count from operator-actions API)
   - "Clients Needing Attention" (yellow + red client count)
   - "Automation Health" (green badge if no errors, yellow if warnings)
   - Use existing Card components with compact stat display

2. **Operator actions section** — Add a new section ABOVE the client health list:
   - Fetch from `GET /api/admin/operator-actions`
   - Show as a list sorted by urgency (red items first)
   - Each row: `border-l-4` with urgency color, client name, action title, detail, time, action button
   - Action button links to `actionUrl` (escalation page, client detail, call prep, etc.)
   - Red = `border-l-4 border-[#C15B2E]`, Yellow = `border-l-4 border-[#D4754A]`
   - Collapsible — default expanded if any red items, collapsed if all yellow/green

3. **Call prep link per client** — Add "Prep Call" button on each client row that links to `/admin/clients/${clientId}/call-prep`

4. **Engagement signal badges** — For clients with engagement signals enabled, show small colored dots (green/yellow/red) next to client name indicating signal health. Tooltip shows signal details on hover.

**Constraints:**
- This is an RSC page — fetch data server-side where possible, use client components for interactivity
- Mobile: card layout below 640px (existing pattern)
- Don't break existing health status display — add to it
- Polling: 15s refresh for lists (per UX standards)
- Brand colors only

**Steps:**
- [ ] **Step 1:** Add KPI summary cards at top of triage page
- [ ] **Step 2:** Add operator actions section with urgency-sorted list
- [ ] **Step 3:** Add call prep links per client row
- [ ] **Step 4:** Add engagement signal badges on client rows
- [ ] **Step 5:** Test at desktop + 375px mobile
- [ ] **Step 6:** Run typecheck
- [ ] **Step 7:** Commit: `feat: operator cockpit enhancements on triage dashboard (FMA 5.1)`

---

### Task 6: Auto-resolve UI on escalation/KB gaps page

**Intent:** Show auto-resolve suggestions on the escalations page. When an escalation is a KB-gap type, show the suggested answer with source and approval buttons.

**What to modify — `src/app/(dashboard)/admin/escalations/page.tsx` or create a new component:**

1. For each escalation row, check if it has an associated KB gap
2. If so, fetch auto-resolve suggestion from `GET /api/admin/clients/${clientId}/auto-resolve/${gapId}`
3. If suggestion found, show inline:
   - "Suggested answer from KB:" + the matched entry content
   - Source: "From knowledge base entry: [title]"
   - Trust gate: If < 5 auto-resolves for this client, show: "First auto-resolves require contractor confirmation"
   - Two buttons: "Send & Add to KB" (calls POST auto-resolve) | "Skip"
   - "I verified this is accurate" checkbox required before Send button is enabled

**Constraints:**
- Feature flag: `autoResolve` — only show suggestions when enabled
- Never auto-send — operator must click
- Source shown verbatim
- First 5 per client require extra confirmation

**Steps:**
- [ ] **Step 1:** Add auto-resolve suggestion fetch to escalation rows with KB gaps
- [ ] **Step 2:** Render suggestion card with source + approval buttons
- [ ] **Step 3:** Wire POST auto-resolve on "Send & Add to KB" click
- [ ] **Step 4:** Run typecheck
- [ ] **Step 5:** Commit: `feat: auto-resolve suggestions on escalation page (FMA 5.4)`

---

### Task 7: Documentation updates

**Intent:** Update all relevant docs for Wave 3 features.

**Docs to update:**
1. **`docs/product/PLATFORM-CAPABILITIES.md`** — Section 11 (Agency Operations): add operator action queue, engagement signals, call prep link. Section 4 (Communication Hub): add SMS-reply KB entry.
2. **`docs/engineering/01-TESTING-GUIDE.md`** — Add test steps for operator actions API, engagement signals API, auto-resolve API, KB gap SMS reply pipeline.
3. **`docs/operations/01-OPERATIONS-GUIDE.md`** — Add: using the operator cockpit, interpreting engagement signals, using auto-resolve suggestions.
4. **`docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md`** — Update daily operator workflow to reference cockpit, add auto-resolve procedure.
5. **`docs/product/FEATURE-BACKLOG.md`** — Mark Wave 3 items as shipped.

**Steps:**
- [ ] **Step 1:** Update each doc
- [ ] **Step 2:** Commit: `docs: update platform docs for FMA Wave 3 operator cockpit`

---

### Task 8: Quality gate

**Steps:**
- [ ] **Step 1:** Run `npm run typecheck`
- [ ] **Step 2:** Run `npm test`
- [ ] **Step 3:** Run `npm run build`
- [ ] **Step 4:** Run `npm run quality:no-regressions`
