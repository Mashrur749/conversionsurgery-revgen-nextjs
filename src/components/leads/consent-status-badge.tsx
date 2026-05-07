/**
 * Renders the CASL consent status for a lead. Pure presentation — all derivation
 * logic lives in `./consent-status-badge-state` so it is unit-testable without
 * React component test infra (vitest only includes `*.test.ts`).
 *
 * Brand palette only (sienna for warnings, sage/forest for success). No raw
 * Tailwind colors.
 */
import { cn } from '@/lib/utils';
import {
  deriveConsentBadgeState,
  type ConsentBadgeSource,
  type ConsentBadgeType,
  type ConsentBadgeTone,
} from './consent-status-badge-state';

export interface ConsentStatusBadgeProps {
  inquiryDate: Date | null;
  consentSource?: ConsentBadgeSource;
  consentTimestamp?: Date | null;
  consentType?: ConsentBadgeType;
  consentEvidence?: string | null;
  /** Optional override for testing / SSR determinism. */
  now?: Date;
  className?: string;
}

const TONE_CLASSES: Record<ConsentBadgeTone, string> = {
  // Muted = legacy / not recorded
  muted: 'border-muted-foreground/20 bg-muted text-muted-foreground',
  // Default = implied still valid
  default: 'border-forest-light/30 bg-sage-light text-forest',
  // Success = express on file, customer consent valid
  success: 'border-[#3D7A50]/30 bg-[#E8F5E9] text-[#3D7A50]',
  // Warning = approaching CASL window
  warning: 'border-sienna/30 bg-[#FFF3E0] text-sienna',
  // Error = expired (implied or customer)
  error: 'border-[#C15B2E]/40 bg-[#FDEAE4] text-[#C15B2E]',
};

export function ConsentStatusBadge(props: ConsentStatusBadgeProps) {
  const state = deriveConsentBadgeState({
    inquiryDate: props.inquiryDate,
    consentSource: props.consentSource,
    consentTimestamp: props.consentTimestamp,
    consentType: props.consentType,
    consentEvidence: props.consentEvidence,
    now: props.now,
  });

  return (
    <div
      data-testid="consent-status-badge"
      data-kind={state.kind}
      className={cn(
        'inline-flex flex-col rounded-md border px-3 py-2 text-xs',
        TONE_CLASSES[state.tone],
        props.className
      )}
    >
      <span className="font-medium leading-snug">{state.label}</span>
      {state.detail && (
        <span className="mt-0.5 text-[11px] opacity-90 leading-snug">
          {state.detail}
        </span>
      )}
    </div>
  );
}
