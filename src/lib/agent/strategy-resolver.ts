/**
 * Layer 4.2: Strategy Resolver — Deterministic Conversation Strategy
 *
 * Pure function — no DB calls, no LLM calls, fully unit-testable.
 * Takes current conversation state and returns a specific strategy for this turn.
 *
 * This is the core of the 6-layer architecture: it replaces open-ended LLM
 * decision-making with rule-based conversation strategy. The LLM generates
 * language, but this file decides what the conversation should do next.
 */

import { DEFAULT_METHODOLOGY, type SalesMethodologyConfig, type StageDefinition, type SuggestedAction } from './methodology';
import type { PlaybookConfig } from './playbooks/basement-development';
import type { ConversationEntryContext } from './entry-context';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ConversationStrategy {
  currentStage: string;
  currentObjective: string;
  requiredInfo: string[];
  suggestedAction: string;
  actionGuidance: string;
  nextMoveIfSuccessful: string;
  constraints: string[];
  escalationTriggers: string[];
  maxTurnsRemaining: number;
}

export interface ResolveStrategyInput {
  // Current conversation state
  currentStage: string;
  stageTurnCount: number;
  signals: {
    urgency: number;
    budget: number;
    intent: number;
    sentiment: string;
  };
  extractedInfo: {
    projectType?: string | null;
    projectSize?: string | null;
    preferredTimeframe?: string | null;
    estimatedValue?: number | null;
  };
  objections: string[];
  bookingAttempts: number;

  // Context
  entryContext?: ConversationEntryContext;
  isFirstMessage: boolean;

  // Configuration
  methodology?: SalesMethodologyConfig;
  playbook?: PlaybookConfig | null;
  maxBookingAttempts?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a stage definition by id from the methodology. */
function findStage(methodology: SalesMethodologyConfig, stageId: string): StageDefinition | undefined {
  return methodology.stages.find((s) => s.id === stageId);
}

/** Return the stage id that comes next in the methodology sequence. */
function nextStageInSequence(methodology: SalesMethodologyConfig, currentStageId: string): string {
  const idx = methodology.stages.findIndex((s) => s.id === currentStageId);
  if (idx === -1 || idx >= methodology.stages.length - 1) {
    return currentStageId; // stay put if unknown or already at the end
  }
  return methodology.stages[idx + 1].id;
}

/** Check whether all three qualifying info fields are collected. */
function hasAllQualifyingInfo(info: ResolveStrategyInput['extractedInfo']): boolean {
  return !!(info.projectType && info.projectSize && info.preferredTimeframe);
}

/** Check whether any qualifying info has been provided. */
function hasAnyInfo(info: ResolveStrategyInput['extractedInfo']): boolean {
  return !!(info.projectType || info.projectSize || info.preferredTimeframe || info.estimatedValue);
}

// ---------------------------------------------------------------------------
// Exit condition evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate exit conditions for the current stage against the input.
 * Returns the next stage id if any exit condition is met, or null.
 *
 * Uses simple string matching on condition descriptions rather than a full
 * expression parser. Each stage has known, finite conditions.
 */
function checkExitConditions(stageDef: StageDefinition, input: ResolveStrategyInput): string | null {
  for (const exit of stageDef.exitConditions) {
    const condLower = exit.condition.toLowerCase();

    switch (stageDef.id) {
      case 'greeting':
        // "homeowner responds with any project information"
        if (condLower.includes('project information') && hasAnyInfo(input.extractedInfo)) {
          return exit.nextStage;
        }
        break;

      case 'qualifying':
        // "projectType, approximateSize, and timeline are all collected"
        if (condLower.includes('all collected') && hasAllQualifyingInfo(input.extractedInfo)) {
          return exit.nextStage;
        }
        // "homeowner asks to book a visit before qualifying is complete"
        if (condLower.includes('book') && input.bookingAttempts > 0) {
          return exit.nextStage;
        }
        break;

      case 'educating':
        // "homeowner expresses interest in moving forward"
        if (condLower.includes('interest') && (input.signals.intent > 70 || input.bookingAttempts > 0)) {
          return exit.nextStage;
        }
        // "homeowner raises a specific objection"
        if (condLower.includes('objection') && input.objections.length > 0) {
          return exit.nextStage;
        }
        break;

      case 'proposing':
        // "homeowner agrees to a specific time or says yes"
        if (condLower.includes('agrees') && input.signals.intent > 70) {
          return exit.nextStage;
        }
        // "homeowner raises a concern or objection"
        if (condLower.includes('objection') && input.objections.length > 0) {
          return exit.nextStage;
        }
        break;

      case 'objection_handling':
        // "objection addressed and homeowner open to proceeding"
        if (condLower.includes('addressed') && input.objections.length === 0) {
          return exit.nextStage;
        }
        // "two or more objection handling attempts without resolution"
        if (condLower.includes('two or more') && input.stageTurnCount >= 2 && input.objections.length > 0) {
          return exit.nextStage;
        }
        break;

      case 'closing':
        // "appointment confirmed with date, time, and address"
        if (condLower.includes('confirmed') && input.bookingAttempts > 0 && input.signals.intent > 70) {
          return exit.nextStage;
        }
        break;

      case 'nurturing':
        // "homeowner re-engages with intent signals"
        if (condLower.includes('re-engages') && input.signals.intent > 60) {
          return exit.nextStage;
        }
        break;

      default:
        break;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Max turns exceeded resolution
// ---------------------------------------------------------------------------

/** Decide the next stage when the current stage has exhausted its turn limit. */
function resolveMaxTurnsExceeded(stageDef: StageDefinition, input: ResolveStrategyInput): string {
  switch (stageDef.id) {
    case 'qualifying':
      // Don't keep asking — just propose
      return 'proposing';

    case 'proposing':
      // No response to proposals → nurture
      return 'nurturing';

    case 'objection_handling':
      // Objections unresolved after max turns → nurture
      return 'nurturing';

    case 'greeting':
      // Move to qualifying
      return 'qualifying';

    case 'educating':
      // Move to proposing
      return 'proposing';

    case 'closing':
      // If closing stalls, move to post_booking or nurturing depending on intent
      return input.signals.intent > 50 ? 'post_booking' : 'nurturing';

    default: {
      // Default: advance to the next stage in sequence
      const methodology = input.methodology ?? DEFAULT_METHODOLOGY;
      return nextStageInSequence(methodology, stageDef.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Action matching
// ---------------------------------------------------------------------------

/** Check whether a suggested action's `when` condition is met by the input. */
function isActionConditionMet(action: SuggestedAction, input: ResolveStrategyInput): boolean {
  const when = action.when.toLowerCase();

  // Project type checks
  if (when.includes('projecttype is unknown') && !input.extractedInfo.projectType) return true;
  if (when.includes('projecttype is known') && input.extractedInfo.projectType) return true;

  // Scope / size checks
  if (when.includes('approximatesize is unknown') && !input.extractedInfo.projectSize) return true;

  // Timeline checks
  if (when.includes('timeline is unknown') && !input.extractedInfo.preferredTimeframe) return true;

  // General conditions
  if (when.includes('homeowner has mentioned a project type') && input.extractedInfo.projectType) return true;
  if (when.includes('after acknowledging')) return true;
  if (when.includes('homeowner seems to expect an immediate quote') && input.signals.intent > 60) return true;
  if (when.includes('all required info collected') && hasAllQualifyingInfo(input.extractedInfo)) return true;
  if (when.includes('any objection is raised') && input.objections.length > 0) return true;
  if (when.includes('no active objections') && input.objections.length === 0) return true;
  if (when.includes('homeowner has said yes') && input.bookingAttempts > 0) return true;
  if (when.includes('homeowner has agreed to a time') && input.bookingAttempts > 0) return true;
  if (when.includes('homeowner hesitates')) return true; // fallback action
  if (when.includes('appointment is confirmed') && input.bookingAttempts > 0) return true;
  if (when.includes('address has not been provided')) return true; // conservative default
  if (when.includes('homeowner has shared project scope') && input.extractedInfo.projectType) return true;
  if (when.includes('homeowner mentions a specific challenge')) return true;
  if (when.includes('homeowner mentions timeline pressure') && input.signals.urgency > 50) return true;
  if (when.includes('homeowner seems engaged') && input.signals.intent > 40 && input.objections.length === 0) return true;
  if (when.includes('objection is price-related') || when.includes('comparison-shopping')) return true;
  if (when.includes('homeowner is stuck on timing')) return true;
  if (when.includes('objection is technical')) return true;
  if (when.includes('it has been a week')) return true; // nurturing fallback
  if (when.includes('seasonal anchor')) return true;
  if (when.includes('homeowner mentioned a reason')) return true;
  if (when.includes('immediately after closing') && input.bookingAttempts > 0) return true;
  if (when.includes('sending confirmation') && input.bookingAttempts > 0) return true;
  if (when.includes('24 hours before')) return true;
  if (when.includes('decision-makers unclear')) return true;
  if (when.includes('says they need partner')) return true;

  return false;
}

/** Find the first matching suggested action for the current stage. */
function findMatchingAction(stageDef: StageDefinition, input: ResolveStrategyInput): SuggestedAction | null {
  for (const action of stageDef.suggestedActions) {
    if (isActionConditionMet(action, input)) {
      return action;
    }
  }
  return stageDef.suggestedActions[0] ?? null; // fallback to first action
}

// ---------------------------------------------------------------------------
// Strategy builders
// ---------------------------------------------------------------------------

/** Build the action guidance string from an action, with optional playbook enrichment. */
function buildActionGuidance(
  action: SuggestedAction,
  playbook: PlaybookConfig | null | undefined,
  activeObjections: string[],
): string {
  const parts: string[] = [];

  parts.push(`Action: ${action.action}`);
  parts.push(`Constraint: ${action.constraint}`);

  if (action.example) {
    parts.push(`Example: ${action.example}`);
  }

  // Add playbook-specific guidance for active objections
  if (playbook && activeObjections.length > 0) {
    const latestObjection = activeObjections[activeObjections.length - 1];
    const match = playbook.objectionPatterns.find((p) => p.category === latestObjection);
    if (match) {
      parts.push(`Playbook guidance: ${match.handlingStrategy}`);
    }
  }

  return parts.join('\n');
}

/** Collect constraints from methodology global rules and active playbook neverSay lists. */
function buildConstraints(
  methodology: SalesMethodologyConfig,
  playbook: PlaybookConfig | null | undefined,
  activeObjections: string[],
): string[] {
  const constraints = [...methodology.globalRules];

  if (playbook && activeObjections.length > 0) {
    for (const objection of activeObjections) {
      const match = playbook.objectionPatterns.find((p) => p.category === objection);
      if (match) {
        for (const neverSay of match.neverSay) {
          constraints.push(`Never say: "${neverSay}"`);
        }
      }
    }
  }

  return constraints;
}

/** Compute remaining required info for the current stage. */
function computeRemainingInfo(stageDef: StageDefinition, input: ResolveStrategyInput): string[] {
  const collected = new Set<string>();

  if (input.extractedInfo.projectType) collected.add('projectType');
  if (input.extractedInfo.projectSize) {
    collected.add('projectSize');
    collected.add('approximateSize');
  }
  if (input.extractedInfo.preferredTimeframe) {
    collected.add('preferredTimeframe');
    collected.add('timeline');
  }

  return stageDef.requiredInfoBeforeAdvancing.filter((info) => !collected.has(info));
}

/** Build escalation triggers for the current strategy. */
function buildEscalationTriggers(input: ResolveStrategyInput, methodology: SalesMethodologyConfig): string[] {
  const triggers: string[] = [];

  if (input.signals.urgency >= methodology.emergencyBypass.urgencyThreshold) {
    triggers.push('Emergency urgency detected');
  }
  if (input.signals.sentiment === 'frustrated') {
    triggers.push('Frustrated sentiment — empathize first');
  }
  if (input.bookingAttempts >= (input.maxBookingAttempts ?? 3)) {
    triggers.push('Max booking attempts reached — do not push further');
  }

  return triggers;
}

// ---------------------------------------------------------------------------
// Strategy builder: normal stage-based
// ---------------------------------------------------------------------------

function buildStageStrategy(
  stageId: string,
  input: ResolveStrategyInput,
  methodology: SalesMethodologyConfig,
  playbook: PlaybookConfig | null | undefined,
): ConversationStrategy {
  const stageDef = findStage(methodology, stageId);

  // If stage not found, return a safe fallback
  if (!stageDef) {
    return {
      currentStage: stageId,
      currentObjective: 'Continue the conversation professionally',
      requiredInfo: [],
      suggestedAction: 'respond_naturally',
      actionGuidance: 'Respond helpfully and professionally. Follow the conversation flow.',
      nextMoveIfSuccessful: 'qualifying',
      constraints: [...methodology.globalRules],
      escalationTriggers: buildEscalationTriggers(input, methodology),
      maxTurnsRemaining: 5,
    };
  }

  const matchingAction = findMatchingAction(stageDef, input);
  const remainingInfo = computeRemainingInfo(stageDef, input);

  // Determine next move if this stage succeeds
  let nextMoveIfSuccessful = 'continue';
  if (stageDef.exitConditions.length > 0) {
    nextMoveIfSuccessful = stageDef.exitConditions[0].nextStage;
  }

  return {
    currentStage: stageId,
    currentObjective: stageDef.objective,
    requiredInfo: remainingInfo,
    suggestedAction: matchingAction?.action ?? 'respond_naturally',
    actionGuidance: matchingAction
      ? buildActionGuidance(matchingAction, playbook, input.objections)
      : 'Respond helpfully and follow the conversation flow.',
    nextMoveIfSuccessful,
    constraints: buildConstraints(methodology, playbook, input.objections),
    escalationTriggers: buildEscalationTriggers(input, methodology),
    maxTurnsRemaining: Math.max(0, stageDef.maxTurnsInStage - input.stageTurnCount),
  };
}

// ---------------------------------------------------------------------------
// Strategy builder: first message
// ---------------------------------------------------------------------------

function buildFirstMessageStrategy(
  effectiveStage: string,
  entryContext: ConversationEntryContext,
  methodology: SalesMethodologyConfig,
  playbook: PlaybookConfig | null | undefined,
): ConversationStrategy {
  const skipItems = entryContext.openingStrategy.skipQualifying;

  // If all qualifying info is covered by skipQualifying, skip to proposing
  const qualifyingFields = ['projectType', 'size', 'timeline'];
  const allCovered = qualifyingFields.every((f) => skipItems.includes(f));
  const targetStage = allCovered ? 'proposing' : effectiveStage;

  const stageDef = findStage(methodology, targetStage);
  const objective = stageDef?.objective ?? 'Welcome the homeowner and begin qualifying';

  const guidanceParts: string[] = [];
  guidanceParts.push(`Opening: ${entryContext.openingStrategy.acknowledgment}`);
  if (entryContext.openingStrategy.firstQuestion) {
    guidanceParts.push(`First question: ${entryContext.openingStrategy.firstQuestion}`);
  }
  guidanceParts.push(`Tone: ${entryContext.openingStrategy.toneAdjustment}`);

  if (skipItems.length > 0) {
    guidanceParts.push(`Skip qualifying for: ${skipItems.join(', ')} (already provided)`);
  }

  return {
    currentStage: targetStage,
    currentObjective: objective,
    requiredInfo: stageDef
      ? computeRemainingInfo(stageDef, { ...defaultInputForStage(), extractedInfo: {} } as ResolveStrategyInput)
      : [],
    suggestedAction: 'opening_message',
    actionGuidance: guidanceParts.join('\n'),
    nextMoveIfSuccessful: allCovered ? 'closing' : 'qualifying',
    constraints: [...methodology.globalRules],
    escalationTriggers: [],
    maxTurnsRemaining: stageDef?.maxTurnsInStage ?? 2,
  };
}

/** Minimal input scaffold used for computing remaining info in first-message context. */
function defaultInputForStage(): Partial<ResolveStrategyInput> {
  return {
    extractedInfo: {},
    objections: [],
    bookingAttempts: 0,
    stageTurnCount: 0,
    signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'neutral' },
  };
}

// ---------------------------------------------------------------------------
// Strategy builder: frustrated
// ---------------------------------------------------------------------------

function buildFrustratedStrategy(
  effectiveStage: string,
  input: ResolveStrategyInput,
  methodology: SalesMethodologyConfig,
): ConversationStrategy {
  return {
    currentStage: effectiveStage,
    currentObjective: 'Acknowledge frustration empathetically before anything else',
    requiredInfo: [],
    suggestedAction: 'empathize_then_address',
    actionGuidance:
      'Acknowledge their frustration first. Do NOT ask questions or push agenda. After empathizing, ask how you can help make it right.',
    nextMoveIfSuccessful: effectiveStage,
    constraints: [
      'No questions until frustration is acknowledged',
      'No booking attempts',
      'No positive spin',
    ],
    escalationTriggers: buildEscalationTriggers(input, methodology),
    maxTurnsRemaining: 2,
  };
}

// ---------------------------------------------------------------------------
// Strategy builder: objection
// ---------------------------------------------------------------------------

function buildObjectionStrategy(
  latestObjection: string,
  input: ResolveStrategyInput,
  methodology: SalesMethodologyConfig,
  playbook: PlaybookConfig | null | undefined,
): ConversationStrategy {
  const objectionStageDef = findStage(methodology, 'objection_handling');

  // Try to match the objection in the playbook
  const playbookMatch = playbook?.objectionPatterns.find((p) => p.category === latestObjection);

  const guidanceParts: string[] = [];
  guidanceParts.push('Acknowledge the concern before addressing it.');

  if (playbookMatch) {
    guidanceParts.push(`Strategy: ${playbookMatch.handlingStrategy}`);
    if (playbookMatch.neverSay.length > 0) {
      guidanceParts.push(`Never say: ${playbookMatch.neverSay.join('; ')}`);
    }
  } else {
    guidanceParts.push('Acknowledge their concern empathetically, then address it directly without being defensive.');
  }

  // SIM-03: For partner/spouse approval objections, add explicit inclusion guidance
  if (latestObjection === 'partner_approval') {
    guidanceParts.push('Offer to include the partner: suggest a joint estimate visit or offer to text them a summary.');
  }

  const constraints = buildConstraints(methodology, playbook, input.objections);

  return {
    currentStage: 'objection_handling',
    currentObjective: objectionStageDef?.objective ?? 'Address the objection directly and without pressure',
    requiredInfo: [],
    suggestedAction: 'handle_objection',
    actionGuidance: guidanceParts.join('\n'),
    nextMoveIfSuccessful: 'proposing',
    constraints,
    escalationTriggers: buildEscalationTriggers(input, methodology),
    maxTurnsRemaining: objectionStageDef?.maxTurnsInStage ?? 3,
  };
}

// ---------------------------------------------------------------------------
// Strategy builder: emergency
// ---------------------------------------------------------------------------

function buildEmergencyStrategy(
  methodology: SalesMethodologyConfig,
  playbook: PlaybookConfig | null | undefined,
): ConversationStrategy {
  return {
    currentStage: 'emergency',
    currentObjective: 'Get them immediate help — this is urgent',
    requiredInfo: [],
    suggestedAction: 'immediate_human_notification',
    actionGuidance: methodology.emergencyBypass.acknowledgmentTemplate,
    nextMoveIfSuccessful: 'closing',
    constraints: [
      'Do NOT ask qualifying questions',
      'Do NOT attempt booking',
      'Acknowledge urgency immediately',
    ],
    escalationTriggers: ['Emergency urgency detected'],
    maxTurnsRemaining: 1,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the conversation strategy for this turn.
 *
 * Pure function — deterministic, no DB calls, no LLM calls, fully unit-testable.
 * Takes current conversation state and returns a specific strategy.
 */
export function resolveStrategy(input: ResolveStrategyInput): ConversationStrategy {
  const methodology = input.methodology ?? DEFAULT_METHODOLOGY;

  // Emergency bypass check
  if (input.signals.urgency >= methodology.emergencyBypass.urgencyThreshold) {
    return buildEmergencyStrategy(methodology, input.playbook);
  }

  // Check if stage should advance
  let effectiveStage = input.currentStage;
  const originalStage = input.currentStage;
  const currentStageDef = findStage(methodology, effectiveStage);
  let advancedFromObjectionHandling = false;

  if (currentStageDef) {
    // Check max turns exceeded
    if (input.stageTurnCount >= currentStageDef.maxTurnsInStage) {
      effectiveStage = resolveMaxTurnsExceeded(currentStageDef, input);
      if (originalStage === 'objection_handling') {
        advancedFromObjectionHandling = true;
      }
    }

    // Check exit conditions (only if max turns didn't already advance)
    if (effectiveStage === originalStage) {
      const nextStage = checkExitConditions(currentStageDef, input);
      if (nextStage) {
        effectiveStage = nextStage;
      }
    }
  }

  // First message override: use entry context
  if (input.isFirstMessage && input.entryContext) {
    return buildFirstMessageStrategy(effectiveStage, input.entryContext, methodology, input.playbook);
  }

  // Frustrated sentiment override
  if (input.signals.sentiment === 'frustrated') {
    return buildFrustratedStrategy(effectiveStage, input, methodology);
  }

  // Objection override: route through the objection builder when objections are active.
  //
  // Three cases:
  // (a) Already in objection_handling from the start → use normal stage strategy (methodology actions)
  // (b) Advanced OUT of objection_handling (max turns) → skip override, use the new stage strategy
  // (c) All other cases with active objections → use objection builder for playbook-specific guidance
  if (input.objections.length > 0 && !advancedFromObjectionHandling) {
    // Case (a): already in objection_handling, no stage change → normal stage strategy
    if (effectiveStage === 'objection_handling' && originalStage === 'objection_handling') {
      return buildStageStrategy(effectiveStage, input, methodology, input.playbook);
    }
    // Case (c): objections active + not already handling them → objection builder
    const latestObjection = input.objections[input.objections.length - 1];
    return buildObjectionStrategy(latestObjection, input, methodology, input.playbook);
  }

  // Normal stage-based strategy
  return buildStageStrategy(effectiveStage, input, methodology, input.playbook);
}
