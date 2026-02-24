import type { QuarterlyCampaignStatus } from '@/lib/constants/quarterly-campaigns';

export type QuarterlyCampaignAction =
  | 'approve_plan'
  | 'launch_campaign'
  | 'complete_campaign';

export interface TransitionContext {
  completedAssets: string[];
  requiredAssets: string[];
  outcomeSummary?: string | null;
}

export interface TransitionResult {
  ok: boolean;
  nextStatus?: QuarterlyCampaignStatus;
  error?: string;
}

const ACTION_TO_STATUS: Record<QuarterlyCampaignAction, QuarterlyCampaignStatus> = {
  approve_plan: 'scheduled',
  launch_campaign: 'launched',
  complete_campaign: 'completed',
};

export function validateQuarterlyCampaignTransition(
  currentStatus: QuarterlyCampaignStatus,
  action: QuarterlyCampaignAction,
  context: TransitionContext
): TransitionResult {
  if (action === 'approve_plan') {
    if (currentStatus !== 'planned') {
      return { ok: false, error: 'Only planned campaigns can be approved.' };
    }
    return { ok: true, nextStatus: ACTION_TO_STATUS[action] };
  }

  if (action === 'launch_campaign') {
    if (currentStatus !== 'scheduled') {
      return { ok: false, error: 'Campaign must be scheduled before launch.' };
    }
    const missing = context.requiredAssets.filter((asset) => !context.completedAssets.includes(asset));
    if (missing.length > 0) {
      return { ok: false, error: `Complete required assets before launch: ${missing.join(', ')}` };
    }
    return { ok: true, nextStatus: ACTION_TO_STATUS[action] };
  }

  if (action === 'complete_campaign') {
    if (currentStatus !== 'launched') {
      return { ok: false, error: 'Campaign must be launched before completion.' };
    }
    if (!context.outcomeSummary?.trim()) {
      return { ok: false, error: 'Outcome summary is required before completion.' };
    }
    return { ok: true, nextStatus: ACTION_TO_STATUS[action] };
  }

  return { ok: false, error: 'Unsupported transition action.' };
}
