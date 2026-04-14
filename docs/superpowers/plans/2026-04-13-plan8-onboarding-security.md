# Onboarding + Security Pre-Launch Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 high-priority issues — AI progression regression detection, Jobber webhook auth bypass, escalation orphaning on team member removal — before first client onboards.

**Architecture:** Surgical fixes to existing files. One new exported function in `escalation.ts`. No new services or tables. No schema migrations.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest

**Source specs:**
- `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` (XDOM-04, XDOM-19, XDOM-24)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/automations/ai-mode-progression.ts` | XDOM-04: Re-check quality gates on assist->autonomous; add regression detection |
| Modify | `src/app/api/webhooks/jobber/route.ts` | XDOM-24: Make webhook signature verification mandatory |
| Modify | `src/lib/services/escalation.ts` | XDOM-19: Add `reassignEscalations` function |
| Modify | `src/app/api/client/team/[id]/route.ts` | XDOM-19: Call reassignment on team member deactivation/removal |

---

### Task 1: Re-evaluate Quality Gates on AI Progression + Regression Detection (XDOM-04)

**Files:**
- Modify: `src/lib/automations/ai-mode-progression.ts`

**Problem:** Quality gates are only checked for the `off -> assist` transition (line 132-143). The `assist -> autonomous` transition only checks flagged conversations (line 146-165), NOT quality gates. A contractor who deletes all KB entries after reaching `assist` mode gets promoted to `autonomous` with zero knowledge. Additionally, there is no regression path — if quality degrades while in `autonomous`, the system stays there.

**Fix:**
1. Add quality gate check to the `assist -> autonomous` transition (Gate 3 must apply to ALL transitions, not just `off -> assist`)
2. Add a separate regression detection pass: query clients already in `autonomous` mode, re-check quality gates, and regress to `assist` if critical gates fail

- [ ] **Step 1: Read the file to confirm current structure**

Run: Read `src/lib/automations/ai-mode-progression.ts` full file.

Confirmed structure:
- Lines 84-100: Query eligible clients (`ne(clients.aiAgentMode, 'autonomous')`)
- Lines 109-117: Gate 1 — time threshold check
- Lines 119-129: Gate 2 — no manual override
- Lines 131-143: Gate 3 — quality gates (only for `targetMode === 'assist'`)
- Lines 145-165: Gate 4 — no flagged conversations (only for `targetMode === 'autonomous'`)
- Lines 167-234: Advance mode + audit + notifications

- [ ] **Step 2: Extend Gate 3 to apply to ALL transitions**

Replace the Gate 3 block (lines 131-143):

```typescript
// Old (lines 131-143):
      // ── Gate 3: onboarding quality (required for off→assist) ─────────────
      if (targetMode === 'assist') {
        const evaluation = await evaluateOnboardingQualityForClient({
          clientId: client.id,
          source: 'ai_mode_progression_cron',
          persistSnapshot: false,
        });

        if (!evaluation.passedCritical) {
          skipped++;
          continue;
        }
      }

// New:
      // ── Gate 3: onboarding quality (required for ALL transitions) ───────
      // XDOM-04: Quality gates must pass for both off→assist AND assist→autonomous.
      // A contractor who deletes KB entries after reaching assist mode should NOT
      // be promoted to autonomous with zero knowledge.
      const evaluation = await evaluateOnboardingQualityForClient({
        clientId: client.id,
        source: 'ai_mode_progression_cron',
        persistSnapshot: false,
      });

      if (!evaluation.passedCritical) {
        skipped++;
        continue;
      }
```

This removes the `if (targetMode === 'assist')` guard so quality gates are checked for both transitions.

- [ ] **Step 3: Add regression detection for autonomous clients**

After the main `for` loop (after line 234, before the final `console.log` at line 237), add a regression detection pass:

```typescript
  // ── Regression detection (XDOM-04) ──────────────────────────────────
  // Check clients already in 'autonomous' mode — if quality gates fail,
  // regress to 'assist' and alert the operator. This prevents a client
  // from staying in autonomous mode with degraded KB or missing config.
  const autonomousClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      aiAgentMode: clients.aiAgentMode,
      phone: clients.phone,
      twilioNumber: clients.twilioNumber,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        eq(clients.aiAgentMode, 'autonomous')
      )
    );

  for (const client of autonomousClients) {
    try {
      const evaluation = await evaluateOnboardingQualityForClient({
        clientId: client.id,
        source: 'ai_mode_regression_check',
        persistSnapshot: false,
      });

      if (!evaluation.passedCritical) {
        // Regress to assist mode
        await db
          .update(clients)
          .set({
            aiAgentMode: 'assist',
            updatedAt: now,
          })
          .where(eq(clients.id, client.id));

        // Audit log
        await db.insert(auditLog).values({
          personId: null,
          clientId: client.id,
          action: 'ai_mode_auto_regressed',
          resourceType: 'client',
          resourceId: client.id,
          metadata: {
            previousMode: 'autonomous',
            newMode: 'assist',
            reason: 'Quality gates no longer passing',
            criticalFailures: evaluation.criticalFailures,
            triggeredBy: 'ai_mode_regression_check',
          },
          createdAt: now,
        });

        // Alert operator
        await sendAlert({
          clientId: client.id,
          message: `AI mode for ${client.businessName} has been regressed from autonomous to assist. Reason: quality gates no longer passing (${evaluation.criticalFailures.join(', ')}). Review their knowledge base and configuration.`,
          isUrgent: true,
        });

        details.push({
          clientId: client.id,
          businessName: client.businessName,
          previousMode: 'autonomous',
          newMode: 'assist',
          reason: `Regression — critical gates failed: ${evaluation.criticalFailures.join(', ')}`,
        });

        advanced++; // Count regressions in the advanced counter for visibility
        console.log(
          `[AiModeProgression] REGRESSED ${client.businessName} (${client.id}): autonomous → assist (quality gates failed)`
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Regression check ${client.id}: ${reason}`);
      logSanitizedConsoleError('[AiModeProgression] Regression check error:', error, {
        clientId: client.id,
      });
    }
  }
```

- [ ] **Step 4: Verify imports**

Check that `sendAlert` is already imported (line 24 confirms: `import { sendAlert } from '@/lib/services/agency-communication';`). No new imports needed.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — `evaluateOnboardingQualityForClient` returns `OnboardingQualityEvaluation` which has `passedCritical: boolean` and `criticalFailures: OnboardingQualityGateKey[]`.

- [ ] **Step 6: Run full tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/automations/ai-mode-progression.ts
git commit -m "fix: re-check quality gates on assist->autonomous + add regression detection (XDOM-04)"
```

---

### Task 2: Make Jobber Webhook Signature Verification Required (XDOM-24)

**Files:**
- Modify: `src/app/api/webhooks/jobber/route.ts`

**Problem:** The signature verification at line 84 is conditional: `if (webhookRow.secretKey)`. If no secret key is configured for the webhook, ANY payload is accepted without authentication. An attacker could trigger review automations for arbitrary leads.

**Fix:** Remove the conditional. Always require signature verification. If no `secretKey` is configured on the webhook row, return 401 immediately — the integration is misconfigured and should not accept payloads.

- [ ] **Step 1: Read the file to confirm exact code block**

Run: Read `src/app/api/webhooks/jobber/route.ts` lines 80-90.

Confirmed current code (lines 83-89):
```typescript
  // Verify HMAC-SHA256 signature
  if (webhookRow.secretKey) {
    const expectedSignature = computeWebhookSignature(body, webhookRow.secretKey);
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }
```

- [ ] **Step 2: Replace conditional signature check with mandatory check**

```typescript
// Old (lines 83-89):
  // Verify HMAC-SHA256 signature
  if (webhookRow.secretKey) {
    const expectedSignature = computeWebhookSignature(body, webhookRow.secretKey);
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

// New:
  // Verify HMAC-SHA256 signature (XDOM-24: always required — never accept unauthenticated payloads)
  if (!webhookRow.secretKey) {
    return NextResponse.json(
      { error: 'Webhook secret key not configured — integration setup incomplete' },
      { status: 401 }
    );
  }

  const expectedSignature = computeWebhookSignature(body, webhookRow.secretKey);
  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type changes

- [ ] **Step 4: Run full tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/jobber/route.ts
git commit -m "fix: make Jobber webhook signature verification mandatory (XDOM-24)"
```

---

### Task 3: Reassign Escalations on Team Member Removal (XDOM-19)

**Files:**
- Modify: `src/lib/services/escalation.ts` (add `reassignPendingEscalations` function)
- Modify: `src/app/api/client/team/[id]/route.ts` (call reassignment on deactivation/removal)

**Problem:** When a team member is deactivated (PATCH with `isActive: false`) or removed (DELETE), their pending/assigned escalations remain assigned to them. The SLA clock keeps ticking with no one to act.

**Fix:**
1. Add a `reassignPendingEscalations(clientId, removedMembershipId)` function to `escalation.ts`
2. Call it from both the PATCH handler (when `isActive === false`) and the DELETE handler

#### Part A: Add reassignment function to escalation.ts

- [ ] **Step 1: Read escalation.ts to understand existing patterns**

Run: Read `src/lib/services/escalation.ts` full file.

Confirmed patterns:
- Round-robin assignment at lines 146-164 (used in `createEscalationInternal`)
- `getTeamMembers` imported from `team-bridge` (line 16)
- `escalationQueue` table has `assignedTo`, `assignedAt`, `status` fields
- Status values: `'pending'`, `'assigned'`, `'in_progress'`, `'resolved'`

- [ ] **Step 2: Add the reassignPendingEscalations function**

Add before the "FROZEN EXPORTS" section (before line 540):

```typescript
/**
 * Reassign all pending/assigned escalations from a removed team member.
 * Uses round-robin to distribute to the next available member.
 * Falls back to the client owner if no other active members exist.
 *
 * Called when a team member is deactivated or removed (XDOM-19).
 */
export async function reassignPendingEscalations(
  clientId: string,
  removedMembershipId: string
): Promise<{ reassigned: number; fallbackToOwner: boolean }> {
  const db = getDb();

  // Find all pending/assigned escalations for this member
  const orphaned = await db
    .select({ id: escalationQueue.id })
    .from(escalationQueue)
    .where(
      and(
        eq(escalationQueue.clientId, clientId),
        eq(escalationQueue.assignedTo, removedMembershipId),
        or(
          eq(escalationQueue.status, 'pending'),
          eq(escalationQueue.status, 'assigned')
        )
      )
    );

  if (orphaned.length === 0) {
    return { reassigned: 0, fallbackToOwner: false };
  }

  // Find active team members who can receive escalations (excluding the removed one)
  const activeMembers = await getTeamMembers(clientId).then((m) =>
    m.filter((x) => x.isActive && x.id !== removedMembershipId)
  );

  let fallbackToOwner = false;
  let targetMemberId: string | null = null;

  if (activeMembers.length > 0) {
    // Round-robin: assign to member with fewest pending escalations
    const withCounts: TeamMemberWithCount[] = await Promise.all(
      activeMembers.map(async (m) => {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(escalationQueue)
          .where(
            and(
              eq(escalationQueue.assignedTo, m.id),
              or(
                eq(escalationQueue.status, 'pending'),
                eq(escalationQueue.status, 'assigned')
              )
            )
          );
        return { id: m.id, name: m.name, pendingCount: Number(result?.count) || 0 };
      })
    );

    withCounts.sort((a, b) => a.pendingCount - b.pendingCount);
    targetMemberId = withCounts[0]?.id || null;
  }

  if (!targetMemberId) {
    // Fallback: find the client owner's membership
    const [ownerMembership] = await db
      .select({ id: clientMemberships.id })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.clientId, clientId),
          eq(clientMemberships.isOwner, true),
          eq(clientMemberships.isActive, true)
        )
      )
      .limit(1);

    targetMemberId = ownerMembership?.id || null;
    fallbackToOwner = true;
  }

  // Reassign all orphaned escalations
  let reassigned = 0;
  for (const esc of orphaned) {
    if (targetMemberId) {
      await db
        .update(escalationQueue)
        .set({
          assignedTo: targetMemberId,
          assignedAt: new Date(),
          status: 'assigned',
          updatedAt: new Date(),
        })
        .where(eq(escalationQueue.id, esc.id));
    } else {
      // No one to assign to — set to pending (unassigned)
      await db
        .update(escalationQueue)
        .set({
          assignedTo: null,
          assignedAt: null,
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(escalationQueue.id, esc.id));
    }
    reassigned++;
  }

  // Notify the new assignee about the reassigned escalations
  if (targetMemberId && reassigned > 0) {
    await notifyEscalation(orphaned[0].id, targetMemberId, ['sms', 'email']);
  }

  return { reassigned, fallbackToOwner };
}
```

- [ ] **Step 3: Verify the `or` import exists**

Check line 11 of `escalation.ts`: `import { eq, and, desc, sql, or } from 'drizzle-orm';`

Confirmed: `or` IS already imported.

- [ ] **Step 4: Run typecheck on escalation.ts**

Run: `npm run typecheck`
Expected: PASS — all types are already available. `TeamMemberWithCount` is defined at line 60. `clientMemberships` is imported at line 8.

#### Part B: Call reassignment from team member route handlers

- [ ] **Step 5: Read the team member route to confirm insertion points**

Run: Read `src/app/api/client/team/[id]/route.ts` full file.

Confirmed:
- PATCH handler: `isActive === false` check at line 146. Audit log at line 151. The reassignment should go after `isActive` is set but before the audit log — or right after the DB update at line 143.
- DELETE handler: Deactivation at lines 222-225. Session invalidation at line 228. The reassignment should go after deactivation.

- [ ] **Step 6: Add import for reassignPendingEscalations**

```typescript
// Add after existing imports (after line 11):
import { reassignPendingEscalations } from '@/lib/services/escalation';
```

- [ ] **Step 7: Add reassignment to PATCH handler (deactivation case)**

After the DB update (line 143) and before the session invalidation check (line 146), add:

```typescript
      await db
        .update(clientMemberships)
        .set(updateData)
        .where(eq(clientMemberships.id, id));

      // XDOM-19: Reassign pending escalations when deactivating a team member
      if (isActive === false) {
        try {
          const { reassigned, fallbackToOwner } = await reassignPendingEscalations(clientId, id);
          if (reassigned > 0) {
            console.log(
              `[ClientTeam] Reassigned ${reassigned} escalations from deactivated member ${id}${fallbackToOwner ? ' (to owner)' : ''}`
            );
          }
        } catch (reassignErr) {
          // Non-fatal — member is already deactivated, log and continue
          console.error('[ClientTeam] Failed to reassign escalations:', reassignErr);
        }
      }

      // Invalidate the target user's session so they get fresh permissions
```

- [ ] **Step 8: Add reassignment to DELETE handler**

After the deactivation (line 225) and before the session invalidation (line 228), add:

```typescript
      // Deactivate (soft delete)
      await db
        .update(clientMemberships)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(clientMemberships.id, id));

      // XDOM-19: Reassign pending escalations when removing a team member
      try {
        const { reassigned, fallbackToOwner } = await reassignPendingEscalations(clientId, id);
        if (reassigned > 0) {
          console.log(
            `[ClientTeam] Reassigned ${reassigned} escalations from removed member ${id}${fallbackToOwner ? ' (to owner)' : ''}`
          );
        }
      } catch (reassignErr) {
        // Non-fatal — member is already deactivated, log and continue
        console.error('[ClientTeam] Failed to reassign escalations:', reassignErr);
      }

      // Invalidate session
      await invalidateClientSession(id);
```

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 10: Run full tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/services/escalation.ts src/app/api/client/team/[id]/route.ts
git commit -m "fix: reassign pending escalations when team member is deactivated or removed (XDOM-19)"
```

---

## Post-Implementation Verification

- [ ] **Run full quality gate**

```bash
npm run quality:no-regressions
```

Expected: All green.

- [ ] **Manual verification checklist**

| Check | Expected |
|-------|----------|
| `grep -n "targetMode === 'assist'" src/lib/automations/ai-mode-progression.ts` | Should NOT appear in Gate 3 — quality gates apply to ALL transitions |
| `grep -n "ai_mode_auto_regressed" src/lib/automations/ai-mode-progression.ts` | Regression audit log present |
| `grep -n "if (webhookRow.secretKey)" src/app/api/webhooks/jobber/route.ts` | Should NOT appear — replaced with `if (!webhookRow.secretKey)` guard |
| `grep -n "reassignPendingEscalations" src/app/api/client/team/[id]/route.ts` | Called in both PATCH and DELETE handlers |
| `grep -n "reassignPendingEscalations" src/lib/services/escalation.ts` | Exported function present |

---

## Doc Updates Required

Per CLAUDE.md Change-to-Doc mapping:

| Change | Doc to Update | What to Add |
|--------|--------------|-------------|
| AI mode regression detection | `docs/product/PLATFORM-CAPABILITIES.md` (Section 9: Onboarding) | Add: "Regression detection: if quality gates fail while in autonomous mode, AI automatically regresses to assist mode and alerts operator" |
| Quality gates checked on all transitions | `docs/product/PLATFORM-CAPABILITIES.md` (Section 9: Onboarding) | Update progression description: "Quality gates verified on EVERY progression check, not just initial activation" |
| Jobber webhook signature mandatory | `docs/engineering/01-TESTING-GUIDE.md` | Add test step: "Verify Jobber webhook rejects payloads when no secret key is configured (expect 401)" |
| Escalation reassignment on team removal | `docs/product/PLATFORM-CAPABILITIES.md` (Section 4: Communication Hub) | Add: "When a team member is deactivated, their pending escalations are automatically reassigned to the next available member (or owner as fallback)" |
| Permission-relevant changes (team deactivation side effect) | `docs/engineering/02-ACCESS-MANAGEMENT.md` | Note: "Team member deactivation now triggers escalation reassignment before session invalidation" |
