/**
 * AI Mode Progression Automation
 *
 * Checks all active clients and auto-advances AI mode based on:
 * - Days since client creation
 * - Onboarding quality gate scores (critical gates must pass)
 * - No flagged AI conversations in past 7 days
 *
 * Progression:
 * - Day 0-6:  aiAgentMode = 'off' (missed call text-back only)
 * - Day 7+,  IF critical quality gates pass: aiAgentMode = 'assist', smartAssistEnabled = true
 * - Day 14+, IF still no flags in past 7 days: aiAgentMode = 'autonomous'
 *
 * Only auto-advances — never downgrades. If an operator manually set a mode
 * ahead of schedule (e.g. 'autonomous' on day 3), this job will not override it.
 *
 * Runs daily at 10am UTC via the cron orchestrator.
 */

import { getDb } from '@/db';
import { auditLog, clients, conversations } from '@/db/schema';
import { and, count, eq, gte, ne } from 'drizzle-orm';
import { evaluateOnboardingQualityForClient } from '@/lib/services/onboarding-quality';
import { sendAlert } from '@/lib/services/agency-communication';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const ASSIST_MIN_DAYS = 7;
const AUTONOMOUS_MIN_DAYS = 14;
const FLAG_LOOKBACK_DAYS = 7;

// ── Types ─────────────────────────────────────────────────────────────────────

type AiAgentMode = 'off' | 'assist' | 'autonomous';

export interface AiModeProgressionResult {
  processed: number;
  advanced: number;
  skipped: number;
  errors: string[];
  details: Array<{
    clientId: string;
    businessName: string;
    previousMode: string;
    newMode: string;
    reason: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

/**
 * Returns the numeric rank of an AI mode for comparison.
 * Higher rank = more advanced mode.
 */
function modeRank(mode: string): number {
  if (mode === 'autonomous') return 2;
  if (mode === 'assist') return 1;
  return 0; // 'off' or unknown
}

// ── Main runner ───────────────────────────────────────────────────────────────

/**
 * Iterates all active clients and advances AI mode where eligibility conditions
 * are met. Only auto-advances — never downgrades.
 */
export async function runAiModeProgression(): Promise<AiModeProgressionResult> {
  const db = getDb();
  const now = new Date();
  const errors: string[] = [];
  const details: AiModeProgressionResult['details'] = [];
  let processed = 0;
  let advanced = 0;
  let skipped = 0;

  // Fetch all active clients that are not yet at the top tier
  const eligibleClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      aiAgentMode: clients.aiAgentMode,
      createdAt: clients.createdAt,
      phone: clients.phone,
      twilioNumber: clients.twilioNumber,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        ne(clients.aiAgentMode, 'autonomous')
      )
    );

  processed = eligibleClients.length;

  for (const client of eligibleClients) {
    try {
      const currentMode = (client.aiAgentMode ?? 'off') as AiAgentMode;
      const ageDays = daysSince(client.createdAt, now);

      // ── Gate 1: time thresholds ──────────────────────────────────────────
      // If the client hasn't reached the minimum age for the next mode, skip.
      const targetMode = currentMode === 'off' ? 'assist' : 'autonomous';
      const minDays = targetMode === 'assist' ? ASSIST_MIN_DAYS : AUTONOMOUS_MIN_DAYS;

      if (ageDays < minDays) {
        skipped++;
        continue;
      }

      // ── Gate 2: no manual override ahead of schedule ─────────────────────
      // If the operator has already advanced the client beyond what the timer
      // would give (e.g. mode='autonomous' before day 14), we skip entirely.
      // This is already handled by the WHERE clause (ne 'autonomous'), but
      // for the off→assist transition, if they're already on 'assist' we
      // check whether we need to advance them to 'autonomous' instead.
      // The modeRank check ensures we only advance, never downgrade.
      if (modeRank(targetMode) <= modeRank(currentMode)) {
        skipped++;
        continue;
      }

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

      // ── Gate 4: no AI quality flags in past 7 days (required for autonomous) ──
      if (targetMode === 'autonomous') {
        const flagCutoff = new Date(now.getTime() - FLAG_LOOKBACK_DAYS * DAY_MS);

        const [flagRow] = await db
          .select({ total: count() })
          .from(conversations)
          .where(
            and(
              eq(conversations.clientId, client.id),
              eq(conversations.flagged, true),
              gte(conversations.flaggedAt, flagCutoff)
            )
          );

        const recentFlags = Number(flagRow?.total ?? 0);
        if (recentFlags > 0) {
          skipped++;
          continue;
        }
      }

      // ── Advance the mode ─────────────────────────────────────────────────
      const updateValues =
        targetMode === 'assist'
          ? { aiAgentMode: 'assist', smartAssistEnabled: true, updatedAt: now }
          : { aiAgentMode: 'autonomous', updatedAt: now };

      await db
        .update(clients)
        .set(updateValues)
        .where(eq(clients.id, client.id));

      // ── Audit log ────────────────────────────────────────────────────────
      await db.insert(auditLog).values({
        personId: null, // system action
        clientId: client.id,
        action: 'ai_mode_auto_advanced',
        resourceType: 'client',
        resourceId: client.id,
        metadata: {
          previousMode: currentMode,
          newMode: targetMode,
          ageDays,
          triggeredBy: 'ai_mode_progression_cron',
        },
        createdAt: now,
      });

      // ── SMS notification to contractor ───────────────────────────────────
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

      if (targetMode === 'assist') {
        await sendAlert({
          clientId: client.id,
          message: `Your AI for ${client.businessName} is now active. It will draft responses to leads and auto-send after 5 minutes — giving you a window to review or edit. Check drafts in your portal: ${appUrl}/client/conversations`,
        });
      } else if (client.phone && client.twilioNumber) {
        // Autonomous activation — send via sendCompliantMessage so the contractor
        // knows they can reply PAUSE to this same number to stop automation.
        await sendCompliantMessage({
          clientId: client.id,
          to: client.phone,
          from: client.twilioNumber,
          body: 'Your system is now fully automated. It responds to leads, follows up on estimates, and requests reviews — all on its own. To pause automation at any time, reply PAUSE to this number.',
          messageClassification: 'proactive_outreach',
          messageCategory: 'transactional',
          metadata: { source: 'ai_mode_progression_autonomous_activation' },
        });
      }

      details.push({
        clientId: client.id,
        businessName: client.businessName,
        previousMode: currentMode,
        newMode: targetMode,
        reason: `Day ${ageDays} — all gates passed`,
      });

      advanced++;
      console.log(
        `[AiModeProgression] Advanced ${client.businessName} (${client.id}): ${currentMode} → ${targetMode} (day ${ageDays})`
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Client ${client.id}: ${reason}`);
      logSanitizedConsoleError('[AiModeProgression] Error processing client:', error, {
        clientId: client.id,
      });
    }
  }

  console.log(
    `[AiModeProgression] Done — processed: ${processed}, advanced: ${advanced}, skipped: ${skipped}, errors: ${errors.length}`
  );

  return { processed, advanced, skipped, errors, details };
}
