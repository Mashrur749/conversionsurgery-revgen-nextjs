/**
 * Layer 5: Conversation Entry Context Resolver
 *
 * Pure function — deterministic, no DB calls, fully testable.
 * Computes the opening strategy based on how the lead arrived and their current state.
 */

export interface ConversationEntryContext {
  source:
    | 'missed_call'
    | 'form_submission'
    | 'google_ads'
    | 'homeStars'
    | 'referral'
    | 'dormant_reactivation'
    | 'inbound_sms'
    | 'voice_call'
    | 'unknown';
  isReturningLead: boolean;
  daysSinceLastContact: number | null;
  timeOfDay: 'business_hours' | 'evening' | 'weekend' | 'late_night';
  existingProjectInfo: Record<string, unknown> | null;
  openingStrategy: {
    acknowledgment: string;
    firstQuestion: string | null;
    toneAdjustment: string;
    skipQualifying: string[];
  };
}

type EntrySource = ConversationEntryContext['source'];
type TimeOfDay = ConversationEntryContext['timeOfDay'];

interface ResolveEntryContextInput {
  leadSource: string | null;
  isReturningLead: boolean;
  daysSinceLastContact: number | null;
  existingProjectInfo: Record<string, unknown> | null;
  formData?: Record<string, string> | null;
  referrerName?: string | null;
  timezone?: string;
}

interface ComputeOpeningStrategyInput {
  source: EntrySource;
  isReturningLead: boolean;
  daysSinceLastContact: number | null;
  formData?: Record<string, string> | null;
  referrerName?: string | null;
  existingProjectInfo: Record<string, unknown> | null;
  timeOfDay: TimeOfDay;
}

// ---------------------------------------------------------------------------
// Source mapping
// ---------------------------------------------------------------------------

function mapSource(
  leadSource: string | null | undefined,
  daysSinceLastContact: number | null,
): EntrySource {
  if (leadSource == null || leadSource === '') {
    return 'inbound_sms';
  }

  const raw = leadSource.toLowerCase().trim();

  if (raw === 'missed_call') return 'missed_call';
  if (raw === 'form' || raw === 'web_form' || raw === 'form_submission') return 'form_submission';
  if (raw === 'google' || raw === 'google_ads') return 'google_ads';
  if (raw === 'homestars' || raw === 'homstars') return 'homeStars';
  // Preserve canonical casing from input when it matches the enum value
  if (leadSource === 'homeStars') return 'homeStars';
  if (raw === 'referral') return 'referral';
  if (raw === 'csv_import') {
    return daysSinceLastContact !== null && daysSinceLastContact > 180
      ? 'dormant_reactivation'
      : 'unknown';
  }
  if (raw === 'voice' || raw === 'voice_call') return 'voice_call';

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Time-of-day detection
// ---------------------------------------------------------------------------

function getTimeOfDay(timezone: string): TimeOfDay {
  const now = new Date();

  // Use Intl.DateTimeFormat to extract the local hour and weekday
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);

  let hour = 0;
  let weekday = '';

  for (const part of parts) {
    if (part.type === 'hour') {
      hour = parseInt(part.value, 10);
    } else if (part.type === 'weekday') {
      weekday = part.value;
    }
  }

  // Weekend check first — takes precedence over hour ranges
  if (weekday === 'Sat' || weekday === 'Sun') {
    return 'weekend';
  }

  // Late night: 21:00–07:59 (inclusive of midnight)
  if (hour >= 21 || hour < 8) {
    return 'late_night';
  }

  // Evening: 17:00–20:59
  if (hour >= 17) {
    return 'evening';
  }

  // Business hours: 08:00–16:59
  return 'business_hours';
}

// ---------------------------------------------------------------------------
// Opening strategy computation
// ---------------------------------------------------------------------------

/** Fields in formData that map to qualifying skip slots. */
const FORM_QUALIFYING_KEYS: Record<string, string> = {
  projectType: 'projectType',
  project_type: 'projectType',
  timeline: 'timeline',
  size: 'size',
  sqft: 'size',
  square_feet: 'size',
};

function buildFormSkipQualifying(formData: Record<string, string> | null | undefined): string[] {
  if (!formData) return [];

  const skipped = new Set<string>();
  for (const key of Object.keys(formData)) {
    const normalized = FORM_QUALIFYING_KEYS[key];
    if (normalized) {
      skipped.add(normalized);
    }
  }
  return Array.from(skipped);
}

function buildFormAcknowledgment(formData: Record<string, string> | null | undefined): string {
  if (!formData || Object.keys(formData).length === 0) {
    return "Thanks for submitting the form!";
  }

  const project = formData['projectType'] ?? formData['project_type'];
  if (project) {
    return `Thanks for reaching out about your ${project} project!`;
  }

  return "Thanks for submitting your request — we have your details!";
}

function computeOpeningStrategy(input: ComputeOpeningStrategyInput): ConversationEntryContext['openingStrategy'] {
  const { source, isReturningLead, daysSinceLastContact, formData, referrerName, timeOfDay } = input;

  // Returning lead after > 7 days always overrides acknowledgment
  if (isReturningLead && daysSinceLastContact !== null && daysSinceLastContact > 7) {
    const skipQualifying =
      input.existingProjectInfo ? Object.keys(input.existingProjectInfo) : [];

    const base = {
      acknowledgment: "Hey, welcome back!",
      firstQuestion: null,
      toneAdjustment: timeOfDay === 'late_night'
        ? 'familiar — calm, they&apos;re planning not urgent'
        : 'familiar — they know us',
      skipQualifying,
    };

    // Late night adjustments don't change acknowledgment but adjust tone
    return base;
  }

  // Source-specific strategies
  switch (source) {
    case 'missed_call':
      return {
        acknowledgment: "Sorry we missed your call!",
        firstQuestion: "What can we help you with?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'empathetic — calm, they&apos;re planning not urgent'
          : 'empathetic — they tried to reach a human',
        skipQualifying: [],
      };

    case 'form_submission':
      return {
        acknowledgment: buildFormAcknowledgment(formData),
        firstQuestion: null,
        toneAdjustment: 'direct — they gave us info',
        skipQualifying: buildFormSkipQualifying(formData),
      };

    case 'google_ads':
      return {
        acknowledgment: "Thanks for reaching out!",
        firstQuestion: "What kind of project are you thinking about?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'efficient — calm, they&apos;re planning not urgent'
          : 'efficient — they&apos;re shopping',
        skipQualifying: [],
      };

    case 'homeStars':
      return {
        acknowledgment: "Thanks for finding us on HomeStars!",
        firstQuestion: "What project are you looking to get done?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'warm — calm, they&apos;re planning not urgent'
          : 'warm',
        skipQualifying: [],
      };

    case 'referral': {
      const name = referrerName ?? 'someone';
      return {
        acknowledgment: `Hey! ${name} mentioned you`,
        firstQuestion: "What project are you working on?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'warm — calm, trust is pre-built'
          : 'warm — trust is pre-built',
        skipQualifying: [],
      };
    }

    case 'dormant_reactivation': {
      const priorSkip = input.existingProjectInfo ? Object.keys(input.existingProjectInfo) : [];
      return {
        acknowledgment: "Hey! Been a while...",
        firstQuestion: "Are you still thinking about that project?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'gentle — calm, they&apos;re planning not urgent'
          : 'gentle — don&apos;t be pushy',
        skipQualifying: priorSkip,
      };
    }

    case 'voice_call':
      return {
        acknowledgment: "Thanks for calling in!",
        firstQuestion: "How can we help you today?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'professional — calm, they&apos;re planning not urgent'
          : 'professional',
        skipQualifying: [],
      };

    case 'inbound_sms': {
      // Returning via inbound SMS
      if (isReturningLead) {
        const priorSkip = input.existingProjectInfo ? Object.keys(input.existingProjectInfo) : [];
        return {
          acknowledgment: "Hey, good to hear from you again!",
          firstQuestion: null,
          toneAdjustment: timeOfDay === 'late_night'
            ? 'familiar — calm, they&apos;re planning not urgent'
            : 'familiar — they know us',
          skipQualifying: priorSkip,
        };
      }
      // New inbound SMS
      return {
        acknowledgment: "Hey! Thanks for reaching out",
        firstQuestion: "What can we help you with?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'friendly — calm, they&apos;re planning not urgent'
          : 'friendly',
        skipQualifying: [],
      };
    }

    case 'unknown':
    default:
      return {
        acknowledgment: "Thanks for reaching out!",
        firstQuestion: "How can we help you today?",
        toneAdjustment: timeOfDay === 'late_night'
          ? 'neutral — calm, they&apos;re planning not urgent'
          : 'neutral',
        skipQualifying: [],
      };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute conversation entry context from lead data.
 * Pure function — deterministic, no DB calls, fully testable.
 */
export function resolveEntryContext(input: ResolveEntryContextInput): ConversationEntryContext {
  const source = mapSource(input.leadSource, input.daysSinceLastContact);
  const timeOfDay = getTimeOfDay(input.timezone ?? 'America/Edmonton');

  const openingStrategy = computeOpeningStrategy({
    source,
    isReturningLead: input.isReturningLead,
    daysSinceLastContact: input.daysSinceLastContact,
    formData: input.formData,
    referrerName: input.referrerName,
    existingProjectInfo: input.existingProjectInfo,
    timeOfDay,
  });

  return {
    source,
    isReturningLead: input.isReturningLead,
    daysSinceLastContact: input.daysSinceLastContact,
    timeOfDay,
    existingProjectInfo: input.existingProjectInfo,
    openingStrategy,
  };
}
