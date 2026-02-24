export const SMART_ASSIST_SEQUENCE_TYPE = 'smart_assist' as const;

export const SMART_ASSIST_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  AUTO_SENT: 'auto_sent',
  APPROVED_SENT: 'approved_sent',
  CANCELLED: 'cancelled',
} as const;

export const SMART_ASSIST_STATUSES = [
  SMART_ASSIST_STATUS.PENDING_APPROVAL,
  SMART_ASSIST_STATUS.AUTO_SENT,
  SMART_ASSIST_STATUS.APPROVED_SENT,
  SMART_ASSIST_STATUS.CANCELLED,
] as const;

export type SmartAssistStatus = typeof SMART_ASSIST_STATUSES[number];

export type SmartAssistTransitionAction =
  | 'auto_send'
  | 'approve_send'
  | 'cancel';

const TRANSITIONS: Record<
  SmartAssistStatus,
  Partial<Record<SmartAssistTransitionAction, SmartAssistStatus>>
> = {
  [SMART_ASSIST_STATUS.PENDING_APPROVAL]: {
    auto_send: SMART_ASSIST_STATUS.AUTO_SENT,
    approve_send: SMART_ASSIST_STATUS.APPROVED_SENT,
    cancel: SMART_ASSIST_STATUS.CANCELLED,
  },
  [SMART_ASSIST_STATUS.AUTO_SENT]: {},
  [SMART_ASSIST_STATUS.APPROVED_SENT]: {},
  [SMART_ASSIST_STATUS.CANCELLED]: {},
};

export function resolveSmartAssistTransition(
  current: SmartAssistStatus,
  action: SmartAssistTransitionAction
): SmartAssistStatus | null {
  return TRANSITIONS[current][action] ?? null;
}
