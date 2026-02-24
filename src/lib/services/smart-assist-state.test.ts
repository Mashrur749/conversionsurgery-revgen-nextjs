import { describe, expect, it } from 'vitest';

import {
  resolveSmartAssistTransition,
  SMART_ASSIST_STATUS,
} from './smart-assist-state';

describe('resolveSmartAssistTransition', () => {
  it('auto-sends from pending approval', () => {
    const next = resolveSmartAssistTransition(
      SMART_ASSIST_STATUS.PENDING_APPROVAL,
      'auto_send'
    );
    expect(next).toBe(SMART_ASSIST_STATUS.AUTO_SENT);
  });

  it('approves from pending approval', () => {
    const next = resolveSmartAssistTransition(
      SMART_ASSIST_STATUS.PENDING_APPROVAL,
      'approve_send'
    );
    expect(next).toBe(SMART_ASSIST_STATUS.APPROVED_SENT);
  });

  it('cancels from pending approval', () => {
    const next = resolveSmartAssistTransition(
      SMART_ASSIST_STATUS.PENDING_APPROVAL,
      'cancel'
    );
    expect(next).toBe(SMART_ASSIST_STATUS.CANCELLED);
  });

  it('does not transition once resolved', () => {
    const next = resolveSmartAssistTransition(
      SMART_ASSIST_STATUS.AUTO_SENT,
      'approve_send'
    );
    expect(next).toBeNull();
  });
});
