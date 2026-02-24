const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EstimateCommandTargetType = 'lead_id' | 'phone' | 'lead_name';

export interface ParsedEstimateCommand {
  matched: boolean;
  targetType?: EstimateCommandTargetType;
  target?: string;
  error?: 'missing_target';
}

/**
 * Parse contractor-side estimate trigger command:
 *   EST <lead-id|lead-name|phone>
 */
export function parseEstimateCommand(input: string): ParsedEstimateCommand {
  const trimmed = input.trim();
  const match = trimmed.match(/^EST(?:IMATE)?\b[:\s]*(.*)$/i);

  if (!match) {
    return { matched: false };
  }

  const target = (match[1] || '').trim();
  if (!target) {
    return { matched: true, error: 'missing_target' };
  }

  if (UUID_REGEX.test(target)) {
    return {
      matched: true,
      targetType: 'lead_id',
      target: target.toLowerCase(),
    };
  }

  const hasLetters = /[a-z]/i.test(target);
  const digitCount = target.replace(/\D/g, '').length;
  if (!hasLetters && digitCount >= 7) {
    return {
      matched: true,
      targetType: 'phone',
      target,
    };
  }

  return {
    matched: true,
    targetType: 'lead_name',
    target,
  };
}
