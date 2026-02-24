import { describe, expect, it } from 'vitest';

import { shouldStartEstimateFollowup } from './estimate-triggers';

describe('shouldStartEstimateFollowup', () => {
  it('starts when there is no active sequence', () => {
    expect(shouldStartEstimateFollowup(0, false)).toBe(true);
  });

  it('does not start when active sequence exists and force is false', () => {
    expect(shouldStartEstimateFollowup(3, false)).toBe(false);
  });

  it('starts when force is true even if active sequence exists', () => {
    expect(shouldStartEstimateFollowup(2, true)).toBe(true);
  });
});
