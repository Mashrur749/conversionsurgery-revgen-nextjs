export const DAY_ONE_MILESTONE_KEYS = {
  NUMBER_LIVE: 'number_live',
  MISSED_CALL_TEXT_BACK_LIVE: 'missed_call_text_back_live',
  CALL_YOUR_NUMBER_PROOF: 'call_your_number_proof',
  REVENUE_LEAK_AUDIT_DELIVERED: 'revenue_leak_audit_delivered',
} as const;

export type DayOneMilestoneKey =
  (typeof DAY_ONE_MILESTONE_KEYS)[keyof typeof DAY_ONE_MILESTONE_KEYS];

export const DAY_ONE_MILESTONE_TITLES: Record<DayOneMilestoneKey, string> = {
  [DAY_ONE_MILESTONE_KEYS.NUMBER_LIVE]: 'Phone number provisioned',
  [DAY_ONE_MILESTONE_KEYS.MISSED_CALL_TEXT_BACK_LIVE]:
    'Missed-call text-back live',
  [DAY_ONE_MILESTONE_KEYS.CALL_YOUR_NUMBER_PROOF]:
    'Call-your-own-number proof completed',
  [DAY_ONE_MILESTONE_KEYS.REVENUE_LEAK_AUDIT_DELIVERED]:
    'Revenue Leak Audit delivered',
};

export const DAY_ONE_SLA_POLICY: Record<
  DayOneMilestoneKey,
  { targetHours: number }
> = {
  [DAY_ONE_MILESTONE_KEYS.NUMBER_LIVE]: { targetHours: 24 },
  [DAY_ONE_MILESTONE_KEYS.MISSED_CALL_TEXT_BACK_LIVE]: { targetHours: 24 },
  [DAY_ONE_MILESTONE_KEYS.CALL_YOUR_NUMBER_PROOF]: { targetHours: 48 },
  [DAY_ONE_MILESTONE_KEYS.REVENUE_LEAK_AUDIT_DELIVERED]: { targetHours: 48 },
};

export function computeDayOneMilestoneTargetAt(
  clientCreatedAt: Date,
  milestoneKey: DayOneMilestoneKey
): Date {
  return new Date(
    clientCreatedAt.getTime() +
      DAY_ONE_SLA_POLICY[milestoneKey].targetHours * 60 * 60 * 1000
  );
}

export function listDayOneMilestoneDefinitions(clientCreatedAt: Date): Array<{
  key: DayOneMilestoneKey;
  title: string;
  targetAt: Date;
}> {
  return (Object.values(DAY_ONE_MILESTONE_KEYS) as DayOneMilestoneKey[]).map(
    (key) => ({
      key,
      title: DAY_ONE_MILESTONE_TITLES[key],
      targetAt: computeDayOneMilestoneTargetAt(clientCreatedAt, key),
    })
  );
}
