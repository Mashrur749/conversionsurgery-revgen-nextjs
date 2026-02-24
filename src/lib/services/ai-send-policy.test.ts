import { describe, expect, it } from 'vitest';

import {
  AI_ASSIST_CATEGORY,
  getSmartAssistDelayMinutes,
  resolveAiSendPolicy,
} from './ai-send-policy';

describe('getSmartAssistDelayMinutes', () => {
  it('defaults to 5 when value is invalid', () => {
    expect(getSmartAssistDelayMinutes(undefined)).toBe(5);
    expect(getSmartAssistDelayMinutes(Number.NaN)).toBe(5);
  });

  it('clamps to minimum and maximum bounds', () => {
    expect(getSmartAssistDelayMinutes(0)).toBe(1);
    expect(getSmartAssistDelayMinutes(75)).toBe(60);
  });
});

describe('resolveAiSendPolicy', () => {
  it('returns delayed auto-send for assist mode safe categories', () => {
    const policy = resolveAiSendPolicy(
      {
        aiResponseEnabled: true,
        aiAgentMode: 'assist',
        smartAssistEnabled: true,
        smartAssistDelayMinutes: 5,
        smartAssistManualCategories: [
          AI_ASSIST_CATEGORY.ESTIMATE_FOLLOWUP,
          AI_ASSIST_CATEGORY.PAYMENT,
        ],
      },
      AI_ASSIST_CATEGORY.FIRST_RESPONSE
    );

    expect(policy.mode).toBe('delayed_auto_send');
    expect(policy.delayMinutes).toBe(5);
  });

  it('returns manual mode for sensitive categories', () => {
    const policy = resolveAiSendPolicy(
      {
        aiResponseEnabled: true,
        aiAgentMode: 'assist',
        smartAssistEnabled: true,
        smartAssistDelayMinutes: 5,
        smartAssistManualCategories: [AI_ASSIST_CATEGORY.PAYMENT],
      },
      AI_ASSIST_CATEGORY.PAYMENT
    );

    expect(policy.mode).toBe('pending_manual');
    expect(policy.requiresManualApproval).toBe(true);
  });

  it('returns immediate for non-assist mode', () => {
    const policy = resolveAiSendPolicy(
      {
        aiResponseEnabled: true,
        aiAgentMode: 'autonomous',
        smartAssistEnabled: true,
      },
      AI_ASSIST_CATEGORY.FOLLOW_UP
    );

    expect(policy.mode).toBe('immediate');
  });
});
