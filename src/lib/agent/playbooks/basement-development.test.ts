import { describe, expect, it } from 'vitest';
import { BASEMENT_DEVELOPMENT_PLAYBOOK } from './basement-development';

describe('BASEMENT_DEVELOPMENT_PLAYBOOK', () => {
  it('has a playbookId of basement_development', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.playbookId).toBe('basement_development');
  });

  it('vocabularyMapping has at least 10 entries', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.vocabularyMapping.length).toBeGreaterThanOrEqual(10);
  });

  it('vocabularyMapping entries all have homeownerTerm and contractorTerm', () => {
    for (const entry of BASEMENT_DEVELOPMENT_PLAYBOOK.vocabularyMapping) {
      expect(typeof entry.homeownerTerm).toBe('string');
      expect(entry.homeownerTerm.length).toBeGreaterThan(0);
      expect(typeof entry.contractorTerm).toBe('string');
      expect(entry.contractorTerm.length).toBeGreaterThan(0);
    }
  });

  it('objectionPatterns has at least 4 categories', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.objectionPatterns.length).toBeGreaterThanOrEqual(4);
  });

  it('objectionPatterns all have category, typicalPhrasing, handlingStrategy, and neverSay', () => {
    for (const pattern of BASEMENT_DEVELOPMENT_PLAYBOOK.objectionPatterns) {
      expect(typeof pattern.category).toBe('string');
      expect(pattern.typicalPhrasing.length).toBeGreaterThan(0);
      expect(typeof pattern.handlingStrategy).toBe('string');
      expect(pattern.neverSay.length).toBeGreaterThan(0);
    }
  });

  it('includes price_comparison objection pattern', () => {
    const categories = BASEMENT_DEVELOPMENT_PLAYBOOK.objectionPatterns.map((p) => p.category);
    expect(categories).toContain('price_comparison');
  });

  it('includes partner_approval objection pattern', () => {
    const categories = BASEMENT_DEVELOPMENT_PLAYBOOK.objectionPatterns.map((p) => p.category);
    expect(categories).toContain('partner_approval');
  });

  it('qualifyingSequence has at least 4 questions', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.qualifyingSequence.length).toBeGreaterThanOrEqual(4);
  });

  it('qualifyingSequence entries all have question, whyItMatters, and ifAnswered', () => {
    for (const entry of BASEMENT_DEVELOPMENT_PLAYBOOK.qualifyingSequence) {
      expect(typeof entry.question).toBe('string');
      expect(entry.question.length).toBeGreaterThan(0);
      expect(typeof entry.whyItMatters).toBe('string');
      expect(entry.whyItMatters.length).toBeGreaterThan(0);
      expect(typeof entry.ifAnswered).toBe('string');
      expect(entry.ifAnswered.length).toBeGreaterThan(0);
    }
  });

  it('emergencySignals.keywords has at least 5 keywords', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.emergencySignals.keywords.length).toBeGreaterThanOrEqual(5);
  });

  it('emergencySignals.urgencyFloor is 90', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.emergencySignals.urgencyFloor).toBe(90);
  });

  it('emergencySignals includes flooding keyword', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.emergencySignals.keywords).toContain('flooding');
  });

  it('emergencySignals includes water damage keyword', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.emergencySignals.keywords).toContain('water damage');
  });

  it('differentiators has at least 3 entries', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.differentiators.length).toBeGreaterThanOrEqual(3);
  });

  it('differentiators are all non-empty strings', () => {
    for (const d of BASEMENT_DEVELOPMENT_PLAYBOOK.differentiators) {
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);
    }
  });

  it('communicationStyle.purchaseType is considered', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.communicationStyle.purchaseType).toBe('considered');
  });

  it('exampleConversations has at least 2 examples', () => {
    expect(BASEMENT_DEVELOPMENT_PLAYBOOK.exampleConversations.length).toBeGreaterThanOrEqual(2);
  });

  it('exampleConversations each have turns with role and message', () => {
    for (const conversation of BASEMENT_DEVELOPMENT_PLAYBOOK.exampleConversations) {
      expect(typeof conversation.scenario).toBe('string');
      expect(conversation.turns.length).toBeGreaterThan(0);
      for (const turn of conversation.turns) {
        expect(['homeowner', 'agent']).toContain(turn.role);
        expect(typeof turn.message).toBe('string');
        expect(turn.message.length).toBeGreaterThan(0);
      }
      expect(conversation.annotations.length).toBeGreaterThan(0);
    }
  });

  it('projectSizingHeuristics has scope indicators', () => {
    expect(
      BASEMENT_DEVELOPMENT_PLAYBOOK.projectSizingHeuristics.scopeIndicators.length,
    ).toBeGreaterThanOrEqual(4);
  });

  it('complex scope indicators have 8-12 week timeline range', () => {
    const complexIndicators = BASEMENT_DEVELOPMENT_PLAYBOOK.projectSizingHeuristics.scopeIndicators.filter(
      (s) => s.impliedScope === 'complex',
    );
    expect(complexIndicators.length).toBeGreaterThanOrEqual(1);
    expect(complexIndicators[0].impliedTimeline).toMatch(/\d+-\d+ weeks/);
  });
});
