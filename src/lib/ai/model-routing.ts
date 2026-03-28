import type { ModelTier } from './types';
import type { LeadSignals } from '@/lib/types/agent';

/**
 * Thresholds for routing to quality model tier.
 * A lead qualifies for quality-tier response generation when ANY of:
 * - composite lead score >= 70 (high-value lead)
 * - intent score >= 80 (strong buying signal)
 * - sentiment is frustrated AND urgency >= 60 (angry + urgent = high risk of losing)
 * - decision confidence < 60 (AI is uncertain — escalate to smarter model)
 */
const QUALITY_THRESHOLDS = {
  leadScore: 70,
  intentScore: 80,
  frustrationUrgency: 60,
  lowConfidence: 60,
} as const;

export interface RoutingInput {
  /** Composite lead score (0-100) from the leads table */
  leadScore: number;
  /** AI-computed signal scores from analyze-and-decide */
  signals: LeadSignals;
  /** AI-computed decision confidence (0-100) from analyze-and-decide */
  decisionConfidence: number;
}

export interface RoutingDecision {
  tier: ModelTier;
  reason: string;
}

/**
 * Determines whether to use fast or quality model tier for response generation.
 *
 * The analyze-and-decide node always runs on fast tier (structured output,
 * classification task — doesn't benefit from quality). The respond node
 * benefits from quality tier for nuanced, empathetic, high-stakes replies.
 */
export function selectModelTier(input: RoutingInput): RoutingDecision {
  const { leadScore, signals, decisionConfidence } = input;

  // Low confidence — AI is uncertain, use quality for better reasoning
  if (decisionConfidence < QUALITY_THRESHOLDS.lowConfidence) {
    return {
      tier: 'quality',
      reason: `low_confidence:${decisionConfidence}`,
    };
  }

  // High-value lead
  if (leadScore >= QUALITY_THRESHOLDS.leadScore) {
    return {
      tier: 'quality',
      reason: `high_value_lead:${leadScore}`,
    };
  }

  // Strong buying intent
  if (signals.intent >= QUALITY_THRESHOLDS.intentScore) {
    return {
      tier: 'quality',
      reason: `high_intent:${signals.intent}`,
    };
  }

  // Frustrated + urgent — high risk of losing the lead
  if (
    signals.sentiment === 'frustrated' &&
    signals.urgency >= QUALITY_THRESHOLDS.frustrationUrgency
  ) {
    return {
      tier: 'quality',
      reason: `frustrated_urgent:${signals.urgency}`,
    };
  }

  // Default: fast tier for routine conversations
  return {
    tier: 'fast',
    reason: 'standard',
  };
}
