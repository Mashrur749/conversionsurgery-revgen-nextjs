/**
 * Post-generation output guard.
 *
 * Fast deterministic check applied to every AI-generated message before it is
 * sent to a customer. Catches three critical guardrail violations that prompt
 * instructions alone cannot guarantee:
 *
 *  1. pricing_leak    — dollar amounts / pricing language when pricing is gated
 *  2. opt_out_retention — persuasion attempt after customer requests opt-out
 *  3. identity_denial   — claiming to be human when customer asks
 *
 * Check order: pricing → opt_out → identity (first violation wins).
 */

export interface GuardResult {
  passed: boolean;
  violation?: 'pricing_leak' | 'opt_out_retention' | 'identity_denial';
  detail?: string;
}

export interface OutputGuardConfig {
  canDiscussPricing: boolean;
}

// ---------------------------------------------------------------------------
// Pattern banks
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate the response contains pricing information.
 * Matches: $150, $1,500, 150 dollars, prices start from, costs around, etc.
 */
const PRICING_PATTERNS: RegExp[] = [
  /\$\s*\d[\d,.]*/i,                          // $150, $1,500, $ 99
  /\d[\d,.]*\s*dollars?\b/i,                  // 150 dollars, 1,500 dollar
  /prices?\s+(start|from|begin|range)/i,      // prices start from, price range
  /costs?\s+(start|from|around|about|only)/i, // costs start at, cost around
  /\bstarting\s+(?:at|from)\s+\$?\d/i,       // starting at $99, starting from 200
  /\bonly\s+\$\s*\d/i,                        // only $99
  /\bfee\s+(?:is|of|starts)\s+\$?\d/i,      // fee is $50
];

/**
 * Inbound phrases that signal a customer opt-out request.
 */
const OPT_OUT_INBOUND: RegExp[] = [
  /\bstop\b/i,
  /\bunsubscribe\b/i,
  /leave\s+me\s+alone\b/i,
  /stop\s+texting\b/i,
  /stop\s+contacting\b/i,
  /don'?t\s+(text|contact|message|call)\s+me\b/i,
  /not\s+interested\b/i,
  /remove\s+me\b/i,
  /opt\s*out\b/i,
];

/**
 * Outbound phrases that try to retain or persuade someone who opted out.
 */
const RETENTION_PATTERNS: RegExp[] = [
  /before\s+you\s+go\b/i,
  /are\s+you\s+sure\b/i,
  /just\s+one\s+more\b/i,
  /one\s+last\s+thing\b/i,
  /\bwait\b.*\bbefore\b/i,
  /\bhold\s+on\b/i,
  /give\s+us\s+(another|one\s+more)\s+chance\b/i,
  /don'?t\s+(?:go|leave)\b/i,
  /before\s+(?:i|we)\s+let\s+you\s+go\b/i,
  /reconsider\b/i,
];

/**
 * Inbound phrases that ask about AI / bot identity.
 */
const IDENTITY_QUESTION_INBOUND: RegExp[] = [
  /are\s+you\s+(a\s+)?(bot|robot|ai|automated|machine|computer)\b/i,
  /is\s+this\s+(a\s+)?(bot|robot|ai|automated|machine|computer)\b/i,
  /am\s+i\s+(talking|speaking)\s+to\s+a?\s*(bot|robot|ai|human|person|real)/i,
  /who\s+am\s+i\s+(talking|speaking)\s+to\b/i,
  /is\s+this\s+(a\s+)?real\s+person\b/i,
  /are\s+you\s+(a\s+)?real\s+(person|human)\b/i,
  /is\s+this\s+automated\b/i,
  /are\s+you\s+automated\b/i,
  /are\s+you\s+human\b/i,
];

/**
 * Outbound phrases that falsely claim to be human.
 * Checked only when an identity question was detected in the inbound message.
 */
const IDENTITY_DENIAL_PATTERNS: RegExp[] = [
  /\bi'?m?\s*(am\s+)?a\s+real\s+person\b/i,
  /\bi\s+am\s+a\s+real\s+person\b/i,
  /\bi'?m\s+not\s+a\s+(bot|robot|ai|machine|automated|computer)\b/i,
  /\bi\s+am\s+not\s+a\s+(bot|robot|ai|machine|automated|computer)\b/i,
  /\bi'?m?\s+(am\s+)?human\b/i,
  /\bi\s+am\s+human\b/i,
  /just\s+a\s+(member|part)\s+of\s+the\s+team\b/i,
  /i'?m\s+(?:just\s+)?(?:here|helping)\s+(?:as\s+a\s+)?(?:a\s+)?(?:real\s+)?(?:person|human)\b/i,
];

// ---------------------------------------------------------------------------
// Guard checks
// ---------------------------------------------------------------------------

function checkPricingLeak(response: string, config: OutputGuardConfig): GuardResult | null {
  if (config.canDiscussPricing) return null;

  for (const pattern of PRICING_PATTERNS) {
    if (pattern.test(response)) {
      return {
        passed: false,
        violation: 'pricing_leak',
        detail: `Response contains pricing information but canDiscussPricing is false. Pattern matched: ${pattern.source}`,
      };
    }
  }

  return null;
}

function checkOptOutRetention(response: string, inboundMessage: string): GuardResult | null {
  const isOptOut = OPT_OUT_INBOUND.some((p) => p.test(inboundMessage));
  if (!isOptOut) return null;

  for (const pattern of RETENTION_PATTERNS) {
    if (pattern.test(response)) {
      return {
        passed: false,
        violation: 'opt_out_retention',
        detail: `Customer requested opt-out but response contains a retention/persuasion attempt. Pattern matched: ${pattern.source}`,
      };
    }
  }

  return null;
}

function checkIdentityDenial(response: string, inboundMessage: string): GuardResult | null {
  const isIdentityQuestion = IDENTITY_QUESTION_INBOUND.some((p) => p.test(inboundMessage));
  if (!isIdentityQuestion) return null;

  for (const pattern of IDENTITY_DENIAL_PATTERNS) {
    if (pattern.test(response)) {
      return {
        passed: false,
        violation: 'identity_denial',
        detail: `Customer asked about AI identity but response falsely claims to be human. Pattern matched: ${pattern.source}`,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check an AI-generated response for critical guardrail violations before
 * it is delivered to the customer.
 *
 * Returns `{ passed: true }` when no violations are found, or a failing
 * `GuardResult` with `violation` and `detail` set on the first violation
 * detected (priority: pricing_leak → opt_out_retention → identity_denial).
 */
export function checkOutputGuardrails(
  response: string,
  inboundMessage: string,
  config: OutputGuardConfig,
): GuardResult {
  const pricingResult = checkPricingLeak(response, config);
  if (pricingResult) return pricingResult;

  const optOutResult = checkOptOutRetention(response, inboundMessage);
  if (optOutResult) return optOutResult;

  const identityResult = checkIdentityDenial(response, inboundMessage);
  if (identityResult) return identityResult;

  return { passed: true };
}
