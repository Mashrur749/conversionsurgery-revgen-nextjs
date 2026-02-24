export const AI_ASSIST_CATEGORY = {
  FIRST_RESPONSE: 'first_response',
  FOLLOW_UP: 'follow_up',
  ESTIMATE_FOLLOWUP: 'estimate_followup',
  PAYMENT: 'payment',
  APPOINTMENT: 'appointment',
  REVIEW: 'review',
  GENERAL: 'general',
} as const;

export const AI_ASSIST_CATEGORIES = [
  AI_ASSIST_CATEGORY.FIRST_RESPONSE,
  AI_ASSIST_CATEGORY.FOLLOW_UP,
  AI_ASSIST_CATEGORY.ESTIMATE_FOLLOWUP,
  AI_ASSIST_CATEGORY.PAYMENT,
  AI_ASSIST_CATEGORY.APPOINTMENT,
  AI_ASSIST_CATEGORY.REVIEW,
  AI_ASSIST_CATEGORY.GENERAL,
] as const;

export type AiAssistCategory = typeof AI_ASSIST_CATEGORIES[number];

export const DEFAULT_SMART_ASSIST_DELAY_MINUTES = 5;
export const MIN_SMART_ASSIST_DELAY_MINUTES = 1;
export const MAX_SMART_ASSIST_DELAY_MINUTES = 60;

export const DEFAULT_SMART_ASSIST_MANUAL_CATEGORIES: readonly AiAssistCategory[] = [
  AI_ASSIST_CATEGORY.ESTIMATE_FOLLOWUP,
  AI_ASSIST_CATEGORY.PAYMENT,
];

export type AiSendPolicy =
  | {
      mode: 'disabled';
      reason: 'ai_response_disabled' | 'agent_mode_off';
      delayMinutes: 0;
      requiresManualApproval: false;
      category: AiAssistCategory;
      manualCategories: AiAssistCategory[];
    }
  | {
      mode: 'immediate';
      reason: 'non_assist_mode' | 'smart_assist_disabled';
      delayMinutes: 0;
      requiresManualApproval: false;
      category: AiAssistCategory;
      manualCategories: AiAssistCategory[];
    }
  | {
      mode: 'pending_manual';
      reason: 'manual_category';
      delayMinutes: 0;
      requiresManualApproval: true;
      category: AiAssistCategory;
      manualCategories: AiAssistCategory[];
    }
  | {
      mode: 'delayed_auto_send';
      reason: 'smart_assist_delay';
      delayMinutes: number;
      requiresManualApproval: false;
      category: AiAssistCategory;
      manualCategories: AiAssistCategory[];
    };

interface AiSendPolicyInput {
  aiResponseEnabled?: boolean | null;
  aiAgentMode?: string | null;
  smartAssistEnabled?: boolean | null;
  smartAssistDelayMinutes?: number | null;
  smartAssistManualCategories?: unknown;
}

export function getSmartAssistDelayMinutes(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SMART_ASSIST_DELAY_MINUTES;
  }

  const rounded = Math.round(value);
  if (rounded < MIN_SMART_ASSIST_DELAY_MINUTES) {
    return MIN_SMART_ASSIST_DELAY_MINUTES;
  }
  if (rounded > MAX_SMART_ASSIST_DELAY_MINUTES) {
    return MAX_SMART_ASSIST_DELAY_MINUTES;
  }
  return rounded;
}

function isAiAssistCategory(value: string): value is AiAssistCategory {
  return (AI_ASSIST_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeSmartAssistManualCategories(
  value: unknown
): AiAssistCategory[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_SMART_ASSIST_MANUAL_CATEGORIES];
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item): item is AiAssistCategory => isAiAssistCategory(item));

  if (normalized.length === 0) {
    return [...DEFAULT_SMART_ASSIST_MANUAL_CATEGORIES];
  }

  return Array.from(new Set(normalized));
}

export function resolveAiSendPolicy(
  input: AiSendPolicyInput,
  category: AiAssistCategory
): AiSendPolicy {
  const manualCategories = normalizeSmartAssistManualCategories(
    input.smartAssistManualCategories
  );

  if (input.aiResponseEnabled === false) {
    return {
      mode: 'disabled',
      reason: 'ai_response_disabled',
      delayMinutes: 0,
      requiresManualApproval: false,
      category,
      manualCategories,
    };
  }

  if (input.aiAgentMode === 'off') {
    return {
      mode: 'disabled',
      reason: 'agent_mode_off',
      delayMinutes: 0,
      requiresManualApproval: false,
      category,
      manualCategories,
    };
  }

  if (input.aiAgentMode !== 'assist') {
    return {
      mode: 'immediate',
      reason: 'non_assist_mode',
      delayMinutes: 0,
      requiresManualApproval: false,
      category,
      manualCategories,
    };
  }

  if (input.smartAssistEnabled === false) {
    return {
      mode: 'immediate',
      reason: 'smart_assist_disabled',
      delayMinutes: 0,
      requiresManualApproval: false,
      category,
      manualCategories,
    };
  }

  if (manualCategories.includes(category)) {
    return {
      mode: 'pending_manual',
      reason: 'manual_category',
      delayMinutes: 0,
      requiresManualApproval: true,
      category,
      manualCategories,
    };
  }

  return {
    mode: 'delayed_auto_send',
    reason: 'smart_assist_delay',
    delayMinutes: getSmartAssistDelayMinutes(input.smartAssistDelayMinutes),
    requiresManualApproval: false,
    category,
    manualCategories,
  };
}
