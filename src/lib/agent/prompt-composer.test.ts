import { describe, it, expect, vi } from 'vitest';
import {
  composeAgentPrompt,
  buildIdentityAnchor,
  buildLocaleSection,
  buildPlaybookSection,
  buildChannelSection,
  buildStrategySection,
  buildEntrySection,
  validatePrompt,
  type ComposePromptInput,
  type PromptSection,
} from './prompt-composer';
import { CA_AB_LOCALE } from './locales/ca-ab';
import { BASEMENT_DEVELOPMENT_PLAYBOOK } from './playbooks/basement-development';
import { CHANNEL_CONFIGS } from './channels';
import type { ConversationStrategy } from './strategy-resolver';
import type { ConversationEntryContext } from './entry-context';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function baseStrategy(overrides: Partial<ConversationStrategy> = {}): ConversationStrategy {
  return {
    currentStage: 'qualifying',
    currentObjective: 'Understand project scope',
    requiredInfo: ['projectType'],
    suggestedAction: 'ask_project_type',
    actionGuidance: 'Ask about their project type',
    nextMoveIfSuccessful: 'educating',
    constraints: ['Max 1 question per message'],
    escalationTriggers: [],
    maxTurnsRemaining: 4,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ComposePromptInput> = {}): ComposePromptInput {
  return {
    agentName: 'Alex',
    businessName: 'Calgary Reno Co',
    ownerName: 'Mike',
    agentTone: 'friendly',
    strategy: baseStrategy(),
    locale: CA_AB_LOCALE,
    playbook: BASEMENT_DEVELOPMENT_PLAYBOOK,
    channel: CHANNEL_CONFIGS['sms'],
    guardrailText: '## ABSOLUTE RULES\nNever break these rules.',
    knowledgeContext: 'We specialize in basement development.',
    conversationSummary: null,
    ...overrides,
  };
}

function baseEntryContext(
  overrides: Partial<ConversationEntryContext> = {},
): ConversationEntryContext {
  return {
    source: 'google_ads',
    isReturningLead: false,
    daysSinceLastContact: null,
    timeOfDay: 'business_hours',
    existingProjectInfo: null,
    openingStrategy: {
      acknowledgment: 'Thanks for reaching out!',
      firstQuestion: 'What kind of project are you thinking about?',
      toneAdjustment: 'efficient',
      skipQualifying: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Full prompt with all layers includes all section headers
// ---------------------------------------------------------------------------

describe('composeAgentPrompt', () => {
  it('includes all section headers when all layers provided', () => {
    const result = composeAgentPrompt(
      baseInput({
        entryContext: baseEntryContext(),
        knowledgeContext: 'We do basements.',
        conversationSummary: 'Homeowner asked about basement development.',
      }),
    );

    expect(result.fullPrompt).toContain('You are Alex');
    expect(result.fullPrompt).toContain('## COMMUNICATION STYLE');
    expect(result.fullPrompt).toContain('## INDUSTRY EXPERTISE');
    expect(result.fullPrompt).toContain('## MESSAGE RULES');
    expect(result.fullPrompt).toContain('## ABSOLUTE RULES');
    expect(result.fullPrompt).toContain('## YOUR TASK THIS TURN');
    expect(result.fullPrompt).toContain('## OPENING CONTEXT');
    expect(result.fullPrompt).toContain('## BUSINESS KNOWLEDGE');
    expect(result.fullPrompt).toContain('## EARLIER CONVERSATION SUMMARY');
  });

  // ---------------------------------------------------------------------------
  // 2. Missing locale degrades gracefully
  // ---------------------------------------------------------------------------

  it('degrades gracefully when locale is missing', () => {
    const result = composeAgentPrompt(baseInput({ locale: null }));

    expect(result.fullPrompt).not.toContain('## COMMUNICATION STYLE');
    expect(result.sections.find((s) => s.id === 'locale')).toBeUndefined();
    // Should still have identity, guardrails, strategy
    expect(result.fullPrompt).toContain('You are Alex');
    expect(result.fullPrompt).toContain('## ABSOLUTE RULES');
    expect(result.fullPrompt).toContain('## YOUR TASK THIS TURN');
  });

  // ---------------------------------------------------------------------------
  // 3. Missing playbook degrades gracefully
  // ---------------------------------------------------------------------------

  it('degrades gracefully when playbook is missing', () => {
    const result = composeAgentPrompt(baseInput({ playbook: null }));

    expect(result.fullPrompt).not.toContain('## INDUSTRY EXPERTISE');
    expect(result.sections.find((s) => s.id === 'playbook')).toBeUndefined();
    // Should still have identity, guardrails, strategy
    expect(result.fullPrompt).toContain('You are Alex');
    expect(result.fullPrompt).toContain('## ABSOLUTE RULES');
    expect(result.fullPrompt).toContain('## YOUR TASK THIS TURN');
  });

  // ---------------------------------------------------------------------------
  // 4. Identity anchor is always present and first
  // ---------------------------------------------------------------------------

  it('always includes identity anchor as the first section', () => {
    const result = composeAgentPrompt(baseInput());

    expect(result.sections[0].id).toBe('identity');
    expect(result.sections[0].required).toBe(true);
    expect(result.sections[0].cacheControl).toBe('stable');
    expect(result.fullPrompt.indexOf('You are Alex')).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 5. Strategy section always present
  // ---------------------------------------------------------------------------

  it('always includes strategy section', () => {
    const result = composeAgentPrompt(baseInput());

    const strategySection = result.sections.find((s) => s.id === 'strategy');
    expect(strategySection).toBeDefined();
    expect(strategySection?.required).toBe(true);
    expect(result.fullPrompt).toContain('## YOUR TASK THIS TURN');
    expect(result.fullPrompt).toContain('Objective: Understand project scope');
  });

  // ---------------------------------------------------------------------------
  // 6. Guardrails always present
  // ---------------------------------------------------------------------------

  it('always includes guardrails section', () => {
    const result = composeAgentPrompt(baseInput());

    const guardrailSection = result.sections.find((s) => s.id === 'guardrails');
    expect(guardrailSection).toBeDefined();
    expect(guardrailSection?.required).toBe(true);
    expect(result.fullPrompt).toContain('## ABSOLUTE RULES');
  });

  // ---------------------------------------------------------------------------
  // 7. Stable prefix contains identity + locale + playbook + channel + guardrails
  // ---------------------------------------------------------------------------

  it('stable prefix contains all stable sections', () => {
    const result = composeAgentPrompt(baseInput());

    expect(result.stablePrefix).toContain('You are Alex');
    expect(result.stablePrefix).toContain('## COMMUNICATION STYLE');
    expect(result.stablePrefix).toContain('## INDUSTRY EXPERTISE');
    expect(result.stablePrefix).toContain('## MESSAGE RULES');
    expect(result.stablePrefix).toContain('## ABSOLUTE RULES');

    // Dynamic content should NOT be in stable prefix
    expect(result.stablePrefix).not.toContain('## YOUR TASK THIS TURN');
    expect(result.stablePrefix).not.toContain('## BUSINESS KNOWLEDGE');
  });

  // ---------------------------------------------------------------------------
  // 8. Dynamic suffix contains strategy + entry + knowledge + summary
  // ---------------------------------------------------------------------------

  it('dynamic suffix contains all dynamic sections', () => {
    const result = composeAgentPrompt(
      baseInput({
        entryContext: baseEntryContext(),
        knowledgeContext: 'We do basements.',
        conversationSummary: 'Prior conversation about a project.',
      }),
    );

    expect(result.dynamicSuffix).toContain('## YOUR TASK THIS TURN');
    expect(result.dynamicSuffix).toContain('## OPENING CONTEXT');
    expect(result.dynamicSuffix).toContain('## BUSINESS KNOWLEDGE');
    expect(result.dynamicSuffix).toContain('## EARLIER CONVERSATION SUMMARY');

    // Stable content should NOT be in dynamic suffix
    expect(result.dynamicSuffix).not.toContain('You are Alex');
    expect(result.dynamicSuffix).not.toContain('## COMMUNICATION STYLE');
  });

  // ---------------------------------------------------------------------------
  // 9. Version tracks all layer versions
  // ---------------------------------------------------------------------------

  it('version tracks all layer versions', () => {
    const result = composeAgentPrompt(
      baseInput({
        methodologyVersion: 'v2.0',
        guardrailsVersion: 'v1.3',
      }),
    );

    expect(result.version).toEqual({
      methodology: 'v2.0',
      locale: 'ca-ab',
      playbook: 'basement_development',
      channel: 'sms',
      guardrails: 'v1.3',
    });
  });

  it('version defaults when versions not provided', () => {
    const result = composeAgentPrompt(baseInput());

    expect(result.version.methodology).toBe('v1.0');
    expect(result.version.guardrails).toBe('v1.0');
  });

  it('version shows "none" for missing optional layers', () => {
    const result = composeAgentPrompt(
      baseInput({ locale: null, playbook: null, channel: null }),
    );

    expect(result.version.locale).toBe('none');
    expect(result.version.playbook).toBe('none');
    // channel defaults to 'sms' when null
    expect(result.version.channel).toBe('sms');
  });

  // ---------------------------------------------------------------------------
  // 10. Validation catches unfilled placeholders
  // ---------------------------------------------------------------------------

  it('validation catches unfilled placeholders', () => {
    const sections: PromptSection[] = [
      {
        id: 'identity',
        content: 'You are {agentName}. You work for {businessName}.',
        cacheControl: 'stable',
        required: true,
      },
      {
        id: 'guardrails',
        content: '## RULES\nClean content here.',
        cacheControl: 'stable',
        required: true,
      },
      {
        id: 'strategy',
        content: '## YOUR TASK\nObjective: {currentObjective}',
        cacheControl: 'dynamic',
        required: true,
      },
    ];

    const result = validatePrompt(sections);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('{agentName}'))).toBe(true);
    expect(result.errors.some((e) => e.includes('{businessName}'))).toBe(true);
    expect(result.errors.some((e) => e.includes('{currentObjective}'))).toBe(true);
  });

  it('validation passes when no placeholders remain', () => {
    const sections: PromptSection[] = [
      {
        id: 'identity',
        content: 'You are Alex. You work for Calgary Reno Co.',
        cacheControl: 'stable',
        required: true,
      },
      {
        id: 'guardrails',
        content: '## RULES\nNever break character.',
        cacheControl: 'stable',
        required: true,
      },
      {
        id: 'strategy',
        content: '## YOUR TASK\nObjective: Qualify the lead.',
        cacheControl: 'dynamic',
        required: true,
      },
    ];

    const result = validatePrompt(sections);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // 11. Prompt order is correct (stable before dynamic)
  // ---------------------------------------------------------------------------

  it('maintains correct ordering: stable sections before dynamic sections', () => {
    const result = composeAgentPrompt(
      baseInput({
        entryContext: baseEntryContext(),
        knowledgeContext: 'Knowledge here.',
        conversationSummary: 'Summary here.',
      }),
    );

    // Find the boundary: all stable sections should come before all dynamic sections
    let lastStableIndex = -1;
    let firstDynamicIndex = result.sections.length;

    for (let i = 0; i < result.sections.length; i++) {
      if (result.sections[i].cacheControl === 'stable') {
        lastStableIndex = i;
      }
      if (result.sections[i].cacheControl === 'dynamic' && i < firstDynamicIndex) {
        firstDynamicIndex = i;
      }
    }

    expect(lastStableIndex).toBeLessThan(firstDynamicIndex);
  });

  it('fullPrompt has stable content before dynamic content', () => {
    const result = composeAgentPrompt(
      baseInput({
        entryContext: baseEntryContext(),
      }),
    );

    const identityPos = result.fullPrompt.indexOf('You are Alex');
    const guardrailPos = result.fullPrompt.indexOf('## ABSOLUTE RULES');
    const strategyPos = result.fullPrompt.indexOf('## YOUR TASK THIS TURN');
    const entryPos = result.fullPrompt.indexOf('## OPENING CONTEXT');

    // Stable content before dynamic
    expect(identityPos).toBeLessThan(strategyPos);
    expect(guardrailPos).toBeLessThan(strategyPos);
    expect(strategyPos).toBeLessThan(entryPos);
  });

  // ---------------------------------------------------------------------------
  // 12. Entry context only included when provided
  // ---------------------------------------------------------------------------

  it('entry context is only included when provided', () => {
    const withoutEntry = composeAgentPrompt(baseInput({ entryContext: null }));
    expect(withoutEntry.fullPrompt).not.toContain('## OPENING CONTEXT');
    expect(withoutEntry.sections.find((s) => s.id === 'entry')).toBeUndefined();

    const withEntry = composeAgentPrompt(
      baseInput({ entryContext: baseEntryContext() }),
    );
    expect(withEntry.fullPrompt).toContain('## OPENING CONTEXT');
    expect(withEntry.sections.find((s) => s.id === 'entry')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Section builder unit tests
// ---------------------------------------------------------------------------

describe('buildIdentityAnchor', () => {
  it('includes agent name, business name, and owner name', () => {
    const result = buildIdentityAnchor(baseInput());

    expect(result).toContain('You are Alex');
    expect(result).toContain('Calgary Reno Co');
    expect(result).toContain('Mike');
    expect(result).toContain('friendly');
    expect(result).toContain('You never break character');
    expect(result).toContain('You never claim to be human');
  });
});

describe('buildLocaleSection', () => {
  it('includes communication norms from locale', () => {
    const result = buildLocaleSection(CA_AB_LOCALE);

    expect(result).toContain('## COMMUNICATION STYLE');
    expect(result).toContain('friendly');
    expect(result).toContain('Indirect');
    expect(result).toContain('Hey! or Hi there!');
    expect(result).toContain('no worries');
    expect(result).toContain("y'all");
    expect(result).toContain('indirect');
  });
});

describe('buildPlaybookSection', () => {
  it('includes trade expertise header and communication style', () => {
    const result = buildPlaybookSection(
      BASEMENT_DEVELOPMENT_PLAYBOOK,
      baseStrategy(),
    );

    expect(result).toContain('## INDUSTRY EXPERTISE: Basement Development');
    expect(result).toContain('considered');
    expect(result).toContain('Reassuring');
    expect(result).toContain('subtle');
  });

  it('includes qualifying questions when in qualifying stage', () => {
    const result = buildPlaybookSection(
      BASEMENT_DEVELOPMENT_PLAYBOOK,
      baseStrategy({ currentStage: 'qualifying' }),
    );

    expect(result).toContain('Qualifying questions');
  });

  it('includes objection handling when in objection_handling stage', () => {
    const result = buildPlaybookSection(
      BASEMENT_DEVELOPMENT_PLAYBOOK,
      baseStrategy({ currentStage: 'objection_handling' }),
    );

    expect(result).toContain('Objection handling guidance');
  });

  it('includes example conversation', () => {
    const result = buildPlaybookSection(
      BASEMENT_DEVELOPMENT_PLAYBOOK,
      baseStrategy(),
    );

    expect(result).toContain('Example scenario');
    expect(result).toContain('Key takeaway');
  });

  it('includes emergency keywords', () => {
    const result = buildPlaybookSection(
      BASEMENT_DEVELOPMENT_PLAYBOOK,
      baseStrategy(),
    );

    expect(result).toContain('Emergency keywords');
    expect(result).toContain('flooding');
  });
});

describe('buildChannelSection', () => {
  it('includes SMS constraints', () => {
    const result = buildChannelSection(CHANNEL_CONFIGS['sms']);

    expect(result).toContain('## MESSAGE RULES');
    expect(result).toContain('300');
    expect(result).toContain('1');
    expect(result).toContain('concise');
    expect(result).toContain('always');
    expect(result).toContain('Never use emojis');
  });

  it('shows sparingly policy for web chat', () => {
    const result = buildChannelSection(CHANNEL_CONFIGS['web_chat']);

    expect(result).toContain('sparingly');
    expect(result).toContain('800');
  });
});

describe('buildStrategySection', () => {
  it('includes strategy fields', () => {
    const strategy = baseStrategy();
    const result = buildStrategySection(strategy);

    expect(result).toContain('## YOUR TASK THIS TURN');
    expect(result).toContain('Objective: Understand project scope');
    expect(result).toContain('Action: ask_project_type');
    expect(result).toContain('Guidance: Ask about their project type');
    expect(result).toContain('Next step if successful: educating');
    expect(result).toContain('Max 1 question per message');
  });

  it('omits constraints line when empty', () => {
    const strategy = baseStrategy({ constraints: [] });
    const result = buildStrategySection(strategy);

    expect(result).not.toContain('Constraints:');
  });
});

describe('buildEntrySection', () => {
  it('includes opening context', () => {
    const entry = baseEntryContext();
    const result = buildEntrySection(entry);

    expect(result).toContain('## OPENING CONTEXT');
    expect(result).toContain('Thanks for reaching out!');
    expect(result).toContain('Tone: efficient');
    expect(result).toContain('What kind of project');
  });

  it('includes skip qualifying when present', () => {
    const entry = baseEntryContext({
      openingStrategy: {
        acknowledgment: 'Welcome back!',
        firstQuestion: null,
        toneAdjustment: 'familiar',
        skipQualifying: ['projectType', 'timeline'],
      },
    });
    const result = buildEntrySection(entry);

    expect(result).toContain('Skip these topics (already known): projectType, timeline');
  });

  it('omits first question when null', () => {
    const entry = baseEntryContext({
      openingStrategy: {
        acknowledgment: 'Hey!',
        firstQuestion: null,
        toneAdjustment: 'friendly',
        skipQualifying: [],
      },
    });
    const result = buildEntrySection(entry);

    // Should NOT have the question line between acknowledgment and other content
    const lines = result.split('\n');
    expect(lines).toHaveLength(3); // header, ack, tone
  });

  it('omits skip qualifying line when empty', () => {
    const entry = baseEntryContext();
    const result = buildEntrySection(entry);

    expect(result).not.toContain('Skip these topics');
  });
});

describe('validatePrompt', () => {
  it('reports missing mandatory sections', () => {
    const sections: PromptSection[] = [
      {
        id: 'identity',
        content: 'You are Alex.',
        cacheControl: 'stable',
        required: true,
      },
      // Missing guardrails and strategy
    ];

    const result = validatePrompt(sections);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('guardrails'))).toBe(true);
    expect(result.errors.some((e) => e.includes('strategy'))).toBe(true);
  });

  it('validation warns on console when prompt has issues', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    composeAgentPrompt(
      baseInput({
        guardrailText: '## RULES\nDo not share {sensitiveData} with anyone.',
      }),
    );

    expect(warnSpy).toHaveBeenCalledWith(
      '[PromptComposer] Validation warnings:',
      expect.arrayContaining([
        expect.stringContaining('{sensitiveData}'),
      ]),
    );

    warnSpy.mockRestore();
  });
});
