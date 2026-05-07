/**
 * Pure-function derivation of CASL consent status for a lead.
 *
 * Inputs:
 *   - inquiryDate: original homeowner inquiry date (anchor for 6-month implied
 *     consent under CASL §10(1)). Null = legacy lead with no recorded date.
 *   - The most-recent consent record fields, if any.
 *
 * Output: a discriminated `kind` plus presentational `tone`, label text, and
 * supporting detail. The caller (consent-status-badge.tsx) is responsible for
 * rendering — this helper deliberately has zero React dependencies so it can
 * run in vitest without component-test infra.
 *
 * Resolution order (highest priority first):
 *   1. consentSource === 'existing_customer' → 24-month window from
 *      consentTimestamp (CASL §10(2)).
 *   2. consentType === 'express_written' (or 'express_oral') → "express on
 *      file" — overrides any implied-expired state.
 *   3. inquiryDate present → 6-month implied-consent window:
 *        valid (< 150d) | approaching (150-179d) | expired (>= 180d)
 *   4. inquiryDate null → "not recorded" (legacy).
 */
import { format, differenceInCalendarDays } from 'date-fns';

/** Subset of the consent_source enum we care about for the badge. */
export type ConsentBadgeSource =
  | 'inquiry'
  | 'web_form'
  | 'text_optin'
  | 'paper_form'
  | 'phone_recording'
  | 'existing_customer'
  | 'manual_entry'
  | 'api_import'
  | null
  | undefined;

/** Subset of the consent_type enum used here. */
export type ConsentBadgeType =
  | 'implied'
  | 'express_written'
  | 'express_oral'
  | 'transactional'
  | null
  | undefined;

export interface DeriveConsentBadgeInput {
  inquiryDate: Date | null;
  consentSource?: ConsentBadgeSource;
  consentTimestamp?: Date | null;
  consentType?: ConsentBadgeType;
  consentEvidence?: string | null;
  /** Override "now" for deterministic tests. */
  now?: Date;
}

/** Visual tone — maps to brand-palette utility classes in the renderer. */
export type ConsentBadgeTone = 'muted' | 'default' | 'success' | 'warning' | 'error';

export type ConsentBadgeKind =
  | 'not_recorded'
  | 'implied_valid'
  | 'implied_approaching'
  | 'implied_expired'
  | 'express_on_file'
  | 'customer_valid'
  | 'customer_expired';

export interface ConsentBadgeState {
  kind: ConsentBadgeKind;
  tone: ConsentBadgeTone;
  /** Short headline (badge label or muted line). */
  label: string;
  /** Optional second line (date, evidence excerpt, remaining time). */
  detail?: string;
}

const IMPLIED_WINDOW_DAYS = 180;
const APPROACHING_THRESHOLD_DAYS = 150;
const CUSTOMER_WINDOW_DAYS = 730; // 24 months
const EVIDENCE_TRUNCATE = 80;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatDate(d: Date): string {
  return format(d, 'MMM d, yyyy');
}

function monthsRemaining(daysRemaining: number): number {
  return Math.max(0, Math.round(daysRemaining / 30));
}

function monthsPast(daysOver: number): number {
  return Math.max(0, Math.round(daysOver / 30));
}

export function deriveConsentBadgeState(
  input: DeriveConsentBadgeInput
): ConsentBadgeState {
  const now = input.now ?? new Date();

  // (1) Existing customer — 24-month window anchored at consentTimestamp.
  if (
    input.consentSource === 'existing_customer' &&
    input.consentTimestamp instanceof Date
  ) {
    const daysSinceTransaction = differenceInCalendarDays(
      now,
      input.consentTimestamp
    );
    const transactionFormatted = formatDate(input.consentTimestamp);

    if (daysSinceTransaction > CUSTOMER_WINDOW_DAYS) {
      const past = monthsPast(daysSinceTransaction - CUSTOMER_WINDOW_DAYS);
      return {
        kind: 'customer_expired',
        tone: 'error',
        label: `Customer consent expired (${past} months past). Re-confirmation required.`,
        detail: `Transaction date: ${transactionFormatted}`,
      };
    }

    const remaining = monthsRemaining(CUSTOMER_WINDOW_DAYS - daysSinceTransaction);
    return {
      kind: 'customer_valid',
      tone: 'success',
      label: `Customer consent (transaction date: ${transactionFormatted})`,
      detail: `${remaining} months remaining`,
    };
  }

  // (2) Express written/oral consent — overrides implied expiry.
  if (
    input.consentType === 'express_written' ||
    input.consentType === 'express_oral'
  ) {
    const evidence = input.consentEvidence
      ? truncate(input.consentEvidence, EVIDENCE_TRUNCATE)
      : null;
    return {
      kind: 'express_on_file',
      tone: 'success',
      label: 'Express consent on file',
      detail: evidence ?? undefined,
    };
  }

  // (3) Implied consent — anchored at inquiryDate.
  if (input.inquiryDate instanceof Date) {
    const days = differenceInCalendarDays(now, input.inquiryDate);
    const inquiryFormatted = formatDate(input.inquiryDate);

    if (days >= IMPLIED_WINDOW_DAYS) {
      return {
        kind: 'implied_expired',
        tone: 'error',
        label: 'Implied consent expired. Express consent required for further outbound.',
        detail: `Inquiry received ${inquiryFormatted} (${days} days ago)`,
      };
    }

    if (days >= APPROACHING_THRESHOLD_DAYS) {
      const daysLeft = IMPLIED_WINDOW_DAYS - days;
      const expiresOn = new Date(input.inquiryDate);
      expiresOn.setDate(expiresOn.getDate() + IMPLIED_WINDOW_DAYS);
      return {
        kind: 'implied_approaching',
        tone: 'warning',
        label: `Approaching CASL window — ${daysLeft} days until consent expires`,
        detail: `Inquiry received ${inquiryFormatted} (${days} days ago) · expires ${formatDate(expiresOn)}`,
      };
    }

    const expiresOn = new Date(input.inquiryDate);
    expiresOn.setDate(expiresOn.getDate() + IMPLIED_WINDOW_DAYS);
    const ageLabel = days <= 0 ? 'today' : `${days} days ago`;
    return {
      kind: 'implied_valid',
      tone: 'default',
      label: `Inquiry received ${inquiryFormatted} (${ageLabel})`,
      detail: `Implied consent valid until ${formatDate(expiresOn)}`,
    };
  }

  // (4) Legacy lead — no inquiry date recorded.
  return {
    kind: 'not_recorded',
    tone: 'muted',
    label: 'Inquiry date not recorded',
  };
}

/**
 * Lightweight inline indicator state for lead lists. Only fires when the
 * implied-consent window is closing or expired AND no express/customer
 * consent overrides apply.
 *
 * Returns null when nothing should be shown.
 */
export interface InlineConsentIndicator {
  tone: 'warning' | 'error';
  tooltip: string;
}

export function deriveInlineConsentIndicator(
  input: DeriveConsentBadgeInput
): InlineConsentIndicator | null {
  const state = deriveConsentBadgeState(input);
  if (state.kind === 'implied_approaching') {
    const days = differenceInCalendarDays(
      input.now ?? new Date(),
      input.inquiryDate as Date
    );
    return {
      tone: 'warning',
      tooltip: `CASL window closing in ${IMPLIED_WINDOW_DAYS - days} days`,
    };
  }
  if (state.kind === 'implied_expired') {
    return {
      tone: 'error',
      tooltip: 'Implied consent expired',
    };
  }
  if (state.kind === 'customer_expired') {
    return {
      tone: 'error',
      tooltip: 'Customer consent expired (>24 months)',
    };
  }
  return null;
}
