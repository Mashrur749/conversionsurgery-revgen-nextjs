import { describe, expect, it } from 'vitest';

import { validateQuarterlyCampaignTransition } from './quarterly-campaign-transition-guard';

describe('validateQuarterlyCampaignTransition', () => {
  it('allows approve from planned to scheduled', () => {
    const result = validateQuarterlyCampaignTransition('planned', 'approve_plan', {
      completedAssets: [],
      requiredAssets: [],
      outcomeSummary: null,
    });
    expect(result.ok).toBe(true);
    expect(result.nextStatus).toBe('scheduled');
  });

  it('blocks launch when required assets are missing', () => {
    const result = validateQuarterlyCampaignTransition('scheduled', 'launch_campaign', {
      completedAssets: [],
      requiredAssets: ['customer_list_extracted'],
      outcomeSummary: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Complete required assets');
  });

  it('allows launch when required assets are complete', () => {
    const result = validateQuarterlyCampaignTransition('scheduled', 'launch_campaign', {
      completedAssets: ['customer_list_extracted'],
      requiredAssets: ['customer_list_extracted'],
      outcomeSummary: null,
    });
    expect(result.ok).toBe(true);
    expect(result.nextStatus).toBe('launched');
  });

  it('blocks completion without outcome summary', () => {
    const result = validateQuarterlyCampaignTransition('launched', 'complete_campaign', {
      completedAssets: [],
      requiredAssets: [],
      outcomeSummary: '   ',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Outcome summary');
  });

  it('allows completion with outcome summary', () => {
    const result = validateQuarterlyCampaignTransition('launched', 'complete_campaign', {
      completedAssets: [],
      requiredAssets: [],
      outcomeSummary: 'Reactivated 5 dormant clients.',
    });
    expect(result.ok).toBe(true);
    expect(result.nextStatus).toBe('completed');
  });
});
