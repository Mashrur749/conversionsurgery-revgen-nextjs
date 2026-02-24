import { describe, expect, it } from 'vitest';
import {
  DAY_ONE_MILESTONE_KEYS,
  DAY_ONE_SLA_POLICY,
  computeDayOneMilestoneTargetAt,
  listDayOneMilestoneDefinitions,
} from './day-one-policy';

describe('day-one-policy', () => {
  it('computes deterministic target timestamps from client createdAt', () => {
    const createdAt = new Date('2026-02-24T12:00:00.000Z');

    const numberLiveTarget = computeDayOneMilestoneTargetAt(
      createdAt,
      DAY_ONE_MILESTONE_KEYS.NUMBER_LIVE
    );
    const callProofTarget = computeDayOneMilestoneTargetAt(
      createdAt,
      DAY_ONE_MILESTONE_KEYS.CALL_YOUR_NUMBER_PROOF
    );

    expect(numberLiveTarget.toISOString()).toBe('2026-02-25T12:00:00.000Z');
    expect(callProofTarget.toISOString()).toBe('2026-02-26T12:00:00.000Z');
  });

  it('returns the full milestone set with policy-backed deadlines', () => {
    const createdAt = new Date('2026-02-24T00:00:00.000Z');
    const definitions = listDayOneMilestoneDefinitions(createdAt);

    expect(definitions).toHaveLength(4);
    expect(definitions.map((item) => item.key)).toEqual(
      Object.values(DAY_ONE_MILESTONE_KEYS)
    );

    for (const definition of definitions) {
      const expectedHours = DAY_ONE_SLA_POLICY[definition.key].targetHours;
      const elapsedHours =
        (definition.targetAt.getTime() - createdAt.getTime()) / (60 * 60 * 1000);
      expect(elapsedHours).toBe(expectedHours);
    }
  });
});
