import { describe, expect, it } from 'vitest';

import {
  resolveDeterministicLeadCandidates,
  shouldStartEstimateFollowup,
} from './estimate-triggers';

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

describe('resolveDeterministicLeadCandidates', () => {
  it('returns resolved when exactly one lead matches', () => {
    const result = resolveDeterministicLeadCandidates([
      { id: 'lead-1', name: 'Jane Doe', phone: '+14035550100' },
    ]);

    expect(result.status).toBe('resolved');
  });

  it('returns ambiguous when multiple leads match', () => {
    const result = resolveDeterministicLeadCandidates([
      { id: 'lead-1', name: 'Jane Doe', phone: '+14035550100' },
      { id: 'lead-2', name: 'Jane Doe', phone: '+14035550101' },
    ]);

    expect(result.status).toBe('ambiguous');
  });

  it('returns not_found for empty candidates', () => {
    const result = resolveDeterministicLeadCandidates([]);
    expect(result.status).toBe('not_found');
  });
});
