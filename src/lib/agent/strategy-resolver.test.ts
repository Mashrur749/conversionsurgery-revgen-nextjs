import { describe, it, expect } from 'vitest';
import { resolveStrategy, type ResolveStrategyInput } from './strategy-resolver';
import { resolveEntryContext } from './entry-context';
import { DEFAULT_METHODOLOGY } from './methodology';
import { BASEMENT_DEVELOPMENT_PLAYBOOK } from './playbooks/basement-development';
import type { ConversationEntryContext } from './entry-context';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Base input with sensible defaults — override per test. */
function baseInput(overrides: Partial<ResolveStrategyInput> = {}): ResolveStrategyInput {
  return {
    currentStage: 'greeting',
    stageTurnCount: 0,
    signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'neutral' },
    extractedInfo: {},
    objections: [],
    bookingAttempts: 0,
    isFirstMessage: false,
    methodology: DEFAULT_METHODOLOGY,
    playbook: BASEMENT_DEVELOPMENT_PLAYBOOK,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Stage resolution: greeting → qualifying when info provided
// ---------------------------------------------------------------------------

describe('stage resolution', () => {
  it('advances greeting → qualifying when any project info is provided', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'greeting',
        stageTurnCount: 1,
        extractedInfo: { projectType: 'basement development' },
      }),
    );

    expect(strategy.currentStage).toBe('qualifying');
  });

  // ---------------------------------------------------------------------------
  // 2. Stage resolution: qualifying → educating when all required info collected
  // ---------------------------------------------------------------------------

  it('advances qualifying → educating when all required info is collected', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 2,
        extractedInfo: {
          projectType: 'full development',
          projectSize: '1000 sq ft',
          preferredTimeframe: 'before winter',
        },
      }),
    );

    expect(strategy.currentStage).toBe('educating');
  });

  it('stays in qualifying when some info is still missing', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 2,
        extractedInfo: {
          projectType: 'full development',
          // projectSize missing
          // preferredTimeframe missing
        },
      }),
    );

    expect(strategy.currentStage).toBe('qualifying');
  });
});

// ---------------------------------------------------------------------------
// 3. Max turns: qualifying at max turns → proposing
// ---------------------------------------------------------------------------

describe('max turns exceeded', () => {
  it('advances qualifying → proposing when max turns exhausted', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 5, // maxTurnsInStage for qualifying is 5
        extractedInfo: { projectType: 'basement' },
      }),
    );

    expect(strategy.currentStage).toBe('proposing');
  });

  it('advances greeting → qualifying when max turns exhausted', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'greeting',
        stageTurnCount: 2, // maxTurnsInStage for greeting is 2
      }),
    );

    expect(strategy.currentStage).toBe('qualifying');
  });

  it('advances proposing → nurturing when max turns exhausted', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'proposing',
        stageTurnCount: 3, // maxTurnsInStage for proposing is 3
      }),
    );

    expect(strategy.currentStage).toBe('nurturing');
  });

  it('advances objection_handling → nurturing when max turns exhausted', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'objection_handling',
        stageTurnCount: 3, // maxTurnsInStage is 3
        objections: ['price_comparison'],
      }),
    );

    expect(strategy.currentStage).toBe('nurturing');
  });

  it('reports 0 max turns remaining when at the limit', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'nurturing',
        stageTurnCount: 999, // nurturing has maxTurnsInStage: 999
      }),
    );

    expect(strategy.maxTurnsRemaining).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Emergency bypass: urgency 95 → emergency strategy
// ---------------------------------------------------------------------------

describe('emergency bypass', () => {
  it('produces emergency strategy when urgency >= threshold', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        signals: { urgency: 95, budget: 50, intent: 50, sentiment: 'neutral' },
      }),
    );

    expect(strategy.currentStage).toBe('emergency');
    expect(strategy.suggestedAction).toBe('immediate_human_notification');
    expect(strategy.constraints).toContain('Do NOT ask qualifying questions');
    expect(strategy.constraints).toContain('Do NOT attempt booking');
    expect(strategy.constraints).toContain('Acknowledge urgency immediately');
    expect(strategy.escalationTriggers).toContain('Emergency urgency detected');
  });

  it('emergency uses methodology acknowledgment template', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'greeting',
        signals: { urgency: 90, budget: 50, intent: 50, sentiment: 'neutral' },
      }),
    );

    expect(strategy.actionGuidance).toBe(DEFAULT_METHODOLOGY.emergencyBypass.acknowledgmentTemplate);
  });

  it('emergency bypass at exactly the threshold value', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'educating',
        signals: { urgency: 90, budget: 50, intent: 50, sentiment: 'neutral' },
      }),
    );

    expect(strategy.currentStage).toBe('emergency');
  });
});

// ---------------------------------------------------------------------------
// 5. Frustrated override: frustrated sentiment → empathy-first strategy
// ---------------------------------------------------------------------------

describe('frustrated sentiment override', () => {
  it('produces empathy-first strategy when sentiment is frustrated', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 1,
        signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'frustrated' },
      }),
    );

    expect(strategy.currentObjective).toContain('frustration');
    expect(strategy.suggestedAction).toBe('empathize_then_address');
    expect(strategy.constraints).toContain('No questions until frustration is acknowledged');
    expect(strategy.constraints).toContain('No booking attempts');
    expect(strategy.constraints).toContain('No positive spin');
  });

  it('frustrated strategy preserves the effective stage', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'proposing',
        stageTurnCount: 1,
        signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'frustrated' },
      }),
    );

    expect(strategy.currentStage).toBe('proposing');
    expect(strategy.nextMoveIfSuccessful).toBe('proposing');
  });
});

// ---------------------------------------------------------------------------
// 6. Objection handling: price_comparison → playbook-specific guidance
// ---------------------------------------------------------------------------

describe('objection handling', () => {
  it('routes to objection_handling with playbook-specific guidance', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'proposing',
        stageTurnCount: 1,
        objections: ['price_comparison'],
      }),
    );

    expect(strategy.currentStage).toBe('objection_handling');
    expect(strategy.suggestedAction).toBe('handle_objection');
    expect(strategy.actionGuidance).toContain('Acknowledge');
    expect(strategy.actionGuidance).toContain(
      BASEMENT_DEVELOPMENT_PLAYBOOK.objectionPatterns[0].handlingStrategy,
    );
    // Check neverSay constraints are included
    expect(strategy.constraints.some((c) => c.includes('We can match that price'))).toBe(true);
  });

  it('handles unknown objection categories gracefully without playbook', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'educating',
        stageTurnCount: 1,
        objections: ['unknown_category'],
        playbook: null,
      }),
    );

    expect(strategy.currentStage).toBe('objection_handling');
    expect(strategy.suggestedAction).toBe('handle_objection');
    expect(strategy.actionGuidance).toContain('empathetically');
  });

  it('uses the latest objection when multiple exist', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 1,
        objections: ['price_comparison', 'timeline_concern'],
      }),
    );

    expect(strategy.currentStage).toBe('objection_handling');
    // Should use timeline_concern (last in the array) for guidance
    expect(strategy.actionGuidance).toContain(
      BASEMENT_DEVELOPMENT_PLAYBOOK.objectionPatterns[1].handlingStrategy,
    );
  });

  it('does not re-route to objection_handling when already in that stage', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'objection_handling',
        stageTurnCount: 1,
        objections: ['price_comparison'],
      }),
    );

    // Should stay in objection_handling as normal stage strategy, not re-enter via override
    expect(strategy.currentStage).toBe('objection_handling');
  });
});

// ---------------------------------------------------------------------------
// 7. First message: missed_call source → empathetic opening
// ---------------------------------------------------------------------------

describe('first message strategy', () => {
  it('produces opening strategy for missed_call with empathetic tone', () => {
    const entryContext: ConversationEntryContext = {
      source: 'missed_call',
      isReturningLead: false,
      daysSinceLastContact: null,
      timeOfDay: 'business_hours',
      existingProjectInfo: null,
      openingStrategy: {
        acknowledgment: 'Sorry we missed your call!',
        firstQuestion: 'What can we help you with?',
        toneAdjustment: 'empathetic — they tried to reach a human',
        skipQualifying: [],
      },
    };

    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'greeting',
        isFirstMessage: true,
        entryContext,
      }),
    );

    expect(strategy.suggestedAction).toBe('opening_message');
    expect(strategy.actionGuidance).toContain('Sorry we missed your call!');
    expect(strategy.actionGuidance).toContain('What can we help you with?');
    expect(strategy.actionGuidance).toContain('empathetic');
  });

  // ---------------------------------------------------------------------------
  // 8. First message: form with all data → skip to proposing
  // ---------------------------------------------------------------------------

  it('skips to proposing when form provides all qualifying data', () => {
    const entryContext: ConversationEntryContext = {
      source: 'form_submission',
      isReturningLead: false,
      daysSinceLastContact: null,
      timeOfDay: 'business_hours',
      existingProjectInfo: null,
      openingStrategy: {
        acknowledgment: 'Thanks for reaching out about your basement project!',
        firstQuestion: null,
        toneAdjustment: 'direct — they gave us info',
        skipQualifying: ['projectType', 'size', 'timeline'],
      },
    };

    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'greeting',
        isFirstMessage: true,
        entryContext,
      }),
    );

    expect(strategy.currentStage).toBe('proposing');
    expect(strategy.actionGuidance).toContain('Skip qualifying');
    expect(strategy.nextMoveIfSuccessful).toBe('closing');
  });

  it('stays at greeting when form provides partial data', () => {
    const entryContext: ConversationEntryContext = {
      source: 'form_submission',
      isReturningLead: false,
      daysSinceLastContact: null,
      timeOfDay: 'business_hours',
      existingProjectInfo: null,
      openingStrategy: {
        acknowledgment: 'Thanks for your request!',
        firstQuestion: null,
        toneAdjustment: 'direct',
        skipQualifying: ['projectType'],
      },
    };

    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'greeting',
        isFirstMessage: true,
        entryContext,
      }),
    );

    expect(strategy.currentStage).toBe('greeting');
    expect(strategy.nextMoveIfSuccessful).toBe('qualifying');
  });
});

// ---------------------------------------------------------------------------
// 9. Default methodology: works without explicit methodology passed
// ---------------------------------------------------------------------------

describe('default configuration', () => {
  it('uses DEFAULT_METHODOLOGY when none is provided', () => {
    const strategy = resolveStrategy({
      currentStage: 'greeting',
      stageTurnCount: 0,
      signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'neutral' },
      extractedInfo: {},
      objections: [],
      bookingAttempts: 0,
      isFirstMessage: false,
    });

    expect(strategy.currentStage).toBe('greeting');
    expect(strategy.currentObjective).toBe(DEFAULT_METHODOLOGY.stages[0].objective);
  });

  // ---------------------------------------------------------------------------
  // 10. No playbook: works without playbook (graceful degradation)
  // ---------------------------------------------------------------------------

  it('works without a playbook — graceful degradation', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 1,
        playbook: null,
        extractedInfo: { projectType: 'roofing' },
      }),
    );

    expect(strategy.currentStage).toBe('qualifying');
    expect(strategy.currentObjective).toBeTruthy();
    expect(strategy.suggestedAction).toBeTruthy();
  });

  it('objection handling without playbook uses generic guidance', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'educating',
        stageTurnCount: 1,
        playbook: null,
        objections: ['some_objection'],
      }),
    );

    expect(strategy.currentStage).toBe('objection_handling');
    expect(strategy.actionGuidance).toContain('empathetically');
    // Should NOT include any neverSay constraints from a playbook
    const neverSayConstraints = strategy.constraints.filter((c) => c.startsWith('Never say:'));
    expect(neverSayConstraints).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Partner approval objection: doesn't count as booking rejection
// ---------------------------------------------------------------------------

describe('partner approval handling', () => {
  it('partner_approval objection does not prevent future booking attempts', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'proposing',
        stageTurnCount: 1,
        objections: ['partner_approval'],
        bookingAttempts: 0,
      }),
    );

    expect(strategy.currentStage).toBe('objection_handling');
    // Should use the partner_approval playbook guidance
    const partnerPattern = BASEMENT_DEVELOPMENT_PLAYBOOK.objectionPatterns.find(
      (p) => p.category === 'partner_approval',
    );
    expect(partnerPattern).toBeDefined();
    expect(strategy.actionGuidance).toContain(partnerPattern!.handlingStrategy);
    // Constraints should include partner-specific neverSay
    expect(strategy.constraints.some((c) => c.includes("Can't you just decide"))).toBe(true);
    // Should NOT include "max booking attempts reached" since it was never rejected
    expect(strategy.escalationTriggers).not.toContain(
      'Max booking attempts reached — do not push further',
    );
  });
});

// ---------------------------------------------------------------------------
// 12. Nurturing stage: no aggressive actions suggested
// ---------------------------------------------------------------------------

describe('nurturing stage', () => {
  it('suggests non-aggressive actions in nurturing', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'nurturing',
        stageTurnCount: 5,
      }),
    );

    expect(strategy.currentStage).toBe('nurturing');
    expect(strategy.currentObjective).toContain('without pressure');
    // Should NOT suggest booking or proposing actions
    expect(strategy.suggestedAction).not.toContain('propose_estimate');
    expect(strategy.suggestedAction).not.toContain('booking');
  });

  it('nurturing has high maxTurnsRemaining', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'nurturing',
        stageTurnCount: 10,
      }),
    );

    // nurturing maxTurnsInStage is 999
    expect(strategy.maxTurnsRemaining).toBe(989);
  });

  it('nurturing can transition back to qualifying on re-engagement', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'nurturing',
        stageTurnCount: 10,
        signals: { urgency: 50, budget: 50, intent: 65, sentiment: 'neutral' },
      }),
    );

    // Exit condition: "homeowner re-engages with intent signals" → qualifying
    expect(strategy.currentStage).toBe('qualifying');
  });
});

// ---------------------------------------------------------------------------
// 13. Post_booking stage: confirmation and expectation-setting actions
// ---------------------------------------------------------------------------

describe('post_booking stage', () => {
  it('suggests confirmation actions in post_booking', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'post_booking',
        stageTurnCount: 0,
        bookingAttempts: 1,
      }),
    );

    expect(strategy.currentStage).toBe('post_booking');
    expect(strategy.currentObjective).toContain('Confirm');
    // post_booking has no exit conditions
    expect(strategy.maxTurnsRemaining).toBe(2);
  });

  it('post_booking with no booking attempts still provides guidance', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'post_booking',
        stageTurnCount: 0,
        bookingAttempts: 0,
      }),
    );

    expect(strategy.currentStage).toBe('post_booking');
    expect(strategy.suggestedAction).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Additional edge case coverage
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles unknown stage gracefully', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'nonexistent_stage',
        stageTurnCount: 0,
      }),
    );

    expect(strategy.currentStage).toBe('nonexistent_stage');
    expect(strategy.suggestedAction).toBe('respond_naturally');
    expect(strategy.constraints.length).toBeGreaterThan(0);
  });

  it('emergency bypass takes precedence over frustrated sentiment', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        signals: { urgency: 95, budget: 50, intent: 50, sentiment: 'frustrated' },
      }),
    );

    // Emergency should win
    expect(strategy.currentStage).toBe('emergency');
    expect(strategy.suggestedAction).toBe('immediate_human_notification');
  });

  it('emergency bypass takes precedence over objections', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'proposing',
        signals: { urgency: 92, budget: 50, intent: 50, sentiment: 'neutral' },
        objections: ['price_comparison'],
      }),
    );

    expect(strategy.currentStage).toBe('emergency');
  });

  it('max booking attempts adds escalation trigger', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'proposing',
        stageTurnCount: 1,
        bookingAttempts: 3,
        maxBookingAttempts: 3,
      }),
    );

    expect(strategy.escalationTriggers).toContain(
      'Max booking attempts reached — do not push further',
    );
  });

  it('qualifying → proposing when homeowner asks to book early', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 1,
        bookingAttempts: 1,
        extractedInfo: { projectType: 'basement' },
      }),
    );

    expect(strategy.currentStage).toBe('proposing');
  });

  it('educating → objection_handling when objection raised during educating', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'educating',
        stageTurnCount: 1,
        objections: ['trust_deficit'],
      }),
    );

    expect(strategy.currentStage).toBe('objection_handling');
  });

  it('requiredInfo filters out already-collected fields', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 1,
        extractedInfo: { projectType: 'basement development' },
      }),
    );

    expect(strategy.requiredInfo).not.toContain('projectType');
    // Should still contain approximateSize and timeline
    expect(strategy.requiredInfo).toContain('approximateSize');
    expect(strategy.requiredInfo).toContain('timeline');
  });

  it('constraints include global rules', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'qualifying',
        stageTurnCount: 1,
      }),
    );

    // Global rules from DEFAULT_METHODOLOGY should be in constraints
    expect(strategy.constraints).toContain(DEFAULT_METHODOLOGY.globalRules[0]);
  });

  it('closing stage with high intent advances to post_booking when maxed', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'closing',
        stageTurnCount: 2, // maxTurnsInStage for closing is 2
        signals: { urgency: 50, budget: 50, intent: 70, sentiment: 'neutral' },
        bookingAttempts: 1,
      }),
    );

    // High intent + booking attempt → should advance to post_booking
    expect(strategy.currentStage).toBe('post_booking');
  });

  // ---------------------------------------------------------------------------
  // Returning lead via resolveEntryContext: welcome back acknowledgment
  // ---------------------------------------------------------------------------

  it('returning lead (daysSinceLastContact > 7) produces welcome-back opening strategy', () => {
    const entryContext = resolveEntryContext({
      leadSource: 'missed_call',
      isReturningLead: true,
      daysSinceLastContact: 14,
      existingProjectInfo: { projectType: 'basement' },
    });

    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'greeting',
        isFirstMessage: true,
        entryContext,
      }),
    );

    // Opening strategy should acknowledge the returning lead
    expect(strategy.suggestedAction).toBe('opening_message');
    expect(strategy.actionGuidance).toContain('back');
  });

  // ---------------------------------------------------------------------------
  // Booking attempt limit: suggestedAction must NOT be book_appointment when at limit
  // ---------------------------------------------------------------------------

  it('does not suggest book_appointment when booking attempts >= maxBookingAttempts', () => {
    const strategy = resolveStrategy(
      baseInput({
        currentStage: 'proposing',
        stageTurnCount: 1,
        bookingAttempts: 3,
        maxBookingAttempts: 3,
      }),
    );

    // Escalation trigger must be present
    expect(strategy.escalationTriggers).toContain(
      'Max booking attempts reached — do not push further',
    );
    // Suggested action must NOT push for a booking
    expect(strategy.suggestedAction).not.toBe('book_appointment');
  });
});
