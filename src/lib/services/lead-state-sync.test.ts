import { describe, it, expect } from 'vitest';

describe('lead-state-sync', () => {
  it('module exports expected functions', async () => {
    const mod = await import('./lead-state-sync');
    expect(typeof mod.syncLeadStatusFromStage).toBe('function');
    expect(typeof mod.syncLeadStageFromStatus).toBe('function');
  });
});
