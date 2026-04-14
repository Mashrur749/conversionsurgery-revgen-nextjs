/**
 * Prompt Composer — Assembles all 6 layers into a structured system prompt.
 *
 * Ordering is optimized for Anthropic prompt caching: stable content first
 * (identity, locale, playbook, channel, guardrails), dynamic content last
 * (strategy, entry context, knowledge, summary).
 *
 * The stable prefix is cache-friendly and rarely changes within a conversation.
 * The dynamic suffix changes per message.
 */

import type { ConversationStrategy } from './strategy-resolver';
import type { LocaleConfig } from './locales/ca-ab';
import type { PlaybookConfig } from './playbooks/basement-development';
import type { ChannelConfig } from './channels';
import type { ConversationEntryContext } from './entry-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptSection {
  id: string;
  content: string;
  cacheControl: 'stable' | 'dynamic';
  required: boolean;
}

export interface ComposedPrompt {
  sections: PromptSection[];
  stablePrefix: string;
  dynamicSuffix: string;
  fullPrompt: string;
  version: PromptVersion;
}

export interface PromptVersion {
  methodology: string;
  locale: string;
  playbook: string;
  channel: string;
  guardrails: string;
}

export interface ComposePromptInput {
  // Identity (Layer 6 — already exists)
  agentName: string;
  businessName: string;
  ownerName: string;
  agentTone: string;

  // Strategy (from resolver)
  strategy: ConversationStrategy;

  // Layer configs
  locale?: LocaleConfig | null;
  playbook?: PlaybookConfig | null;
  channel?: ChannelConfig | null;
  entryContext?: ConversationEntryContext | null;

  // Existing content
  guardrailText: string;
  knowledgeContext: string | null;
  conversationSummary?: string | null;

  // Versioning
  methodologyVersion?: string;
  guardrailsVersion?: string;
}

// ---------------------------------------------------------------------------
// Placeholder pattern for validation
// ---------------------------------------------------------------------------

const UNFILLED_PLACEHOLDER_RE = /\{[a-zA-Z_]+\}/g;

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Identity anchor (~50 tokens). The personality root that prevents drift.
 * ALWAYS first, never compressed.
 */
function buildIdentityAnchor(input: ComposePromptInput): string {
  return `You are ${input.agentName}. You work for ${input.businessName}, owned by ${input.ownerName}.
You are a ${input.agentTone} professional who helps homeowners with their projects.
You never break character. You never claim to be human. You remember everything discussed.`;
}

/**
 * Locale section (~150 tokens). Communication norms from locale config.
 */
function buildLocaleSection(locale: LocaleConfig): string {
  const norms = locale.communicationNorms;
  const buying = locale.buyingPsychology;

  const directnessDesc =
    norms.directness === 'low'
      ? 'Indirect — ease into topics, avoid bluntness'
      : norms.directness === 'medium'
        ? 'Balanced — direct when needed, tactful otherwise'
        : 'Direct — get to the point efficiently';

  const lines = [
    '## COMMUNICATION STYLE',
    `- Tone: ${norms.formalityDefault}. ${directnessDesc}`,
    `- Greetings: use "${norms.greetingStyle}" style`,
  ];

  if (norms.commonExpressions.length > 0) {
    lines.push(`- Common expressions: ${norms.commonExpressions.join(', ')}`);
  }

  if (norms.avoidExpressions.length > 0) {
    lines.push(`- AVOID: ${norms.avoidExpressions.join(', ')}`);
  }

  lines.push(`- Price discussion: ${buying.priceDiscussionStyle}`);
  lines.push(`- Decision-making: ${buying.decisionTimeline}`);

  return lines.join('\n');
}

/**
 * Playbook section (~300 tokens). Trade expertise from the playbook config.
 * Includes qualifying questions for the current stage, objection handling
 * guidance, example conversations, communication style, and emergency signals.
 */
function buildPlaybookSection(
  playbook: PlaybookConfig,
  strategy: ConversationStrategy,
): string {
  const lines: string[] = [`## INDUSTRY EXPERTISE: ${playbook.name}`];

  // Communication style
  lines.push(`\nPurchase type: ${playbook.communicationStyle.purchaseType}`);
  lines.push(`Emotional register: ${playbook.communicationStyle.emotionalRegister}`);
  lines.push(`Expertise display: ${playbook.communicationStyle.expertiseDisplay}`);

  // Qualifying questions relevant to the current stage
  if (strategy.currentStage === 'qualifying' || strategy.currentStage === 'greeting') {
    const relevantQuestions = playbook.qualifyingSequence.slice(0, 3);
    if (relevantQuestions.length > 0) {
      lines.push('\nQualifying questions (ask one at a time):');
      for (const q of relevantQuestions) {
        lines.push(`- ${q.question}`);
      }
    }
  }

  // Objection handling for active objections
  if (
    strategy.currentStage === 'objection_handling' &&
    playbook.objectionPatterns.length > 0
  ) {
    lines.push('\nObjection handling guidance:');
    for (const pattern of playbook.objectionPatterns.slice(0, 3)) {
      lines.push(`- ${pattern.category}: ${pattern.handlingStrategy}`);
    }
  }

  // One example conversation for context (first matching or first available)
  if (playbook.exampleConversations.length > 0) {
    const example = playbook.exampleConversations[0];
    lines.push(`\nExample scenario: ${example.scenario}`);
    for (const turn of example.turns.slice(0, 4)) {
      const label = turn.role === 'homeowner' ? 'Homeowner' : 'Agent';
      lines.push(`  ${label}: ${turn.message}`);
    }
    if (example.annotations.length > 0) {
      lines.push(`  Key takeaway: ${example.annotations[0]}`);
    }
  }

  // Emergency signals
  if (playbook.emergencySignals.keywords.length > 0) {
    lines.push(
      `\nEmergency keywords (escalate immediately): ${playbook.emergencySignals.keywords.slice(0, 8).join(', ')}`,
    );
  }

  return lines.join('\n');
}

/**
 * Channel section (~100 tokens). Medium constraints.
 */
function buildChannelSection(channel: ChannelConfig): string {
  const { messageConstraints, toneModifiers } = channel;

  const emojiNote =
    toneModifiers.emojiPolicy === 'never'
      ? 'Never use emojis'
      : toneModifiers.emojiPolicy === 'sparingly'
        ? 'Emojis sparingly, only when natural'
        : 'Emojis allowed when natural';

  return `## MESSAGE RULES
- Max length: ${messageConstraints.maxLength} characters
- Max questions per message: ${messageConstraints.maxQuestionsPerMessage}
- Tone: ${toneModifiers.brevityLevel}, contractions ${toneModifiers.contractions}
- ${emojiNote}`;
}

/**
 * Strategy section (~100 tokens). The current turn's mission.
 */
function buildStrategySection(strategy: ConversationStrategy): string {
  const lines = [
    '## YOUR TASK THIS TURN',
    `Objective: ${strategy.currentObjective}`,
    `Action: ${strategy.suggestedAction}`,
    `Guidance: ${strategy.actionGuidance}`,
    `Next step if successful: ${strategy.nextMoveIfSuccessful}`,
  ];

  if (strategy.constraints.length > 0) {
    lines.push(`Constraints: ${strategy.constraints.join('; ')}`);
  }

  return lines.join('\n');
}

/**
 * Entry section (~50 tokens, first message only). Opening context.
 */
function buildEntrySection(entry: ConversationEntryContext): string {
  const opening = entry.openingStrategy;
  const lines = [
    '## OPENING CONTEXT',
    opening.acknowledgment,
    `Tone: ${opening.toneAdjustment}`,
  ];

  if (opening.firstQuestion) {
    lines.push(opening.firstQuestion);
  }

  if (opening.skipQualifying.length > 0) {
    lines.push(`Skip these topics (already known): ${opening.skipQualifying.join(', ')}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate the assembled prompt sections.
 *
 * 1. All required sections present
 * 2. Scan for unfilled {placeholder} patterns
 */
function validatePrompt(sections: PromptSection[]): ValidationResult {
  const errors: string[] = [];

  // 1. Check required sections
  const requiredIds = sections.filter((s) => s.required).map((s) => s.id);
  const presentIds = new Set(sections.map((s) => s.id));

  for (const id of requiredIds) {
    if (!presentIds.has(id)) {
      errors.push(`Required section missing: ${id}`);
    }
  }

  // Also check that certain sections that must always exist are present
  const mandatorySections = ['identity', 'guardrails', 'strategy'];
  for (const id of mandatorySections) {
    if (!presentIds.has(id)) {
      errors.push(`Mandatory section missing: ${id}`);
    }
  }

  // 2. Scan for unfilled placeholders
  for (const section of sections) {
    const matches = section.content.match(UNFILLED_PLACEHOLDER_RE);
    if (matches) {
      for (const match of matches) {
        errors.push(`Unfilled placeholder in section "${section.id}": ${match}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compose the full agent system prompt from all 6 layers.
 *
 * Order is optimized for Anthropic prompt caching:
 * - Stable prefix: identity, locale, playbook, channel, guardrails
 * - Dynamic suffix: strategy, entry context, knowledge, summary
 */
export function composeAgentPrompt(input: ComposePromptInput): ComposedPrompt {
  const sections: PromptSection[] = [];

  // === STABLE PREFIX (cache-friendly, changes rarely) ===

  // 1. Identity anchor (~50 tokens) — ALWAYS first, never compressed
  sections.push({
    id: 'identity',
    content: buildIdentityAnchor(input),
    cacheControl: 'stable',
    required: true,
  });

  // 2. Locale context (~150 tokens)
  if (input.locale) {
    sections.push({
      id: 'locale',
      content: buildLocaleSection(input.locale),
      cacheControl: 'stable',
      required: false,
    });
  }

  // 3. Industry playbook (~300 tokens)
  if (input.playbook) {
    sections.push({
      id: 'playbook',
      content: buildPlaybookSection(input.playbook, input.strategy),
      cacheControl: 'stable',
      required: false,
    });
  }

  // 4. Channel rules (~100 tokens)
  if (input.channel) {
    sections.push({
      id: 'channel',
      content: buildChannelSection(input.channel),
      cacheControl: 'stable',
      required: false,
    });
  }

  // 5. Guardrails (~200 tokens)
  sections.push({
    id: 'guardrails',
    content: input.guardrailText,
    cacheControl: 'stable',
    required: true,
  });

  // === DYNAMIC SUFFIX (changes per message) ===

  // 6. Strategy objective (~100 tokens)
  sections.push({
    id: 'strategy',
    content: buildStrategySection(input.strategy),
    cacheControl: 'dynamic',
    required: true,
  });

  // 7. Entry context (~50 tokens, first message only)
  if (input.entryContext) {
    sections.push({
      id: 'entry',
      content: buildEntrySection(input.entryContext),
      cacheControl: 'dynamic',
      required: false,
    });
  }

  // 8. Knowledge context (~300 tokens)
  if (input.knowledgeContext) {
    sections.push({
      id: 'knowledge',
      content: `## BUSINESS KNOWLEDGE\n${input.knowledgeContext}`,
      cacheControl: 'dynamic',
      required: false,
    });
  }

  // 9. Conversation summary (~200 tokens)
  if (input.conversationSummary) {
    sections.push({
      id: 'summary',
      content: `## EARLIER CONVERSATION SUMMARY\n${input.conversationSummary}`,
      cacheControl: 'dynamic',
      required: false,
    });
  }

  // Build the composed prompt
  const stableSections = sections.filter((s) => s.cacheControl === 'stable');
  const dynamicSections = sections.filter((s) => s.cacheControl === 'dynamic');

  const stablePrefix = stableSections.map((s) => s.content).join('\n\n');
  const dynamicSuffix = dynamicSections.map((s) => s.content).join('\n\n');
  const fullPrompt = `${stablePrefix}\n\n${dynamicSuffix}`;

  // Validate
  const validation = validatePrompt(sections);
  if (!validation.valid) {
    console.warn('[PromptComposer] Validation warnings:', validation.errors);
  }

  return {
    sections,
    stablePrefix,
    dynamicSuffix,
    fullPrompt,
    version: {
      methodology: input.methodologyVersion ?? 'v1.0',
      locale: input.locale?.localeId ?? 'none',
      playbook: input.playbook?.playbookId ?? 'none',
      channel: input.channel?.id ?? 'sms',
      guardrails: input.guardrailsVersion ?? 'v1.0',
    },
  };
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export {
  buildIdentityAnchor,
  buildLocaleSection,
  buildPlaybookSection,
  buildChannelSection,
  buildStrategySection,
  buildEntrySection,
  validatePrompt,
};
