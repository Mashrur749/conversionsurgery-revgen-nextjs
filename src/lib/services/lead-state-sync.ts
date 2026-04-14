import { getDb } from '@/db';
import { leads, leadContext } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Sync leads.status based on leadContext.stage changes.
 * Called after the orchestrator updates leadContext.stage.
 * Idempotent — safe to call multiple times.
 */
export async function syncLeadStatusFromStage(
  leadId: string,
  newStage: string,
): Promise<void> {
  const db = getDb();

  // Only sync in specific directions — don't downgrade status
  const stageToStatus: Record<string, string | null> = {
    booked: null,       // Don't change — could be contacted or estimate_sent, both valid
    lost: 'lost',       // Stage lost → status lost
    // All other stages: no automatic status change
  };

  const targetStatus = stageToStatus[newStage];
  if (targetStatus === undefined || targetStatus === null) return;

  // Only upgrade, never downgrade
  const [lead] = await db
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) return;

  // Don't overwrite terminal statuses
  const terminalStatuses = ['won', 'completed', 'opted_out'];
  if (terminalStatuses.includes(lead.status ?? '')) return;

  await db
    .update(leads)
    .set({ status: targetStatus, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
}

/**
 * Sync leadContext.stage based on leads.status changes.
 * Called after outcome commands (WON, LOST) update leads.status.
 * Idempotent — safe to call multiple times.
 */
export async function syncLeadStageFromStatus(
  leadId: string,
  newStatus: string,
): Promise<void> {
  const db = getDb();

  const statusToStage: Record<string, string | null> = {
    won: 'booked',        // Won → stage should be booked
    lost: 'lost',          // Lost → stage should be lost
    completed: 'booked',   // Completed → stage stays booked (or post_booking)
    opted_out: 'lost',     // Opted out → stage is effectively lost
    // contacted, estimate_sent, new, dormant: don't change stage
  };

  const targetStage = statusToStage[newStatus];
  if (targetStage === undefined || targetStage === null) return;

  const [ctx] = await db
    .select({ id: leadContext.id, stage: leadContext.stage })
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  if (!ctx) return;

  // Don't override if stage is already correct or more advanced
  if (ctx.stage === targetStage) return;

  await db
    .update(leadContext)
    .set({
      conversationStage: targetStage,
      updatedAt: new Date(),
    })
    .where(eq(leadContext.id, ctx.id));
}
