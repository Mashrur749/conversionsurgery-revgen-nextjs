import { describe, it, expect } from 'vitest';
import { DEFAULT_METHODOLOGY } from './methodology';
import type { StageDefinition } from './methodology';

const EXPECTED_STAGE_IDS = [
  'greeting',
  'qualifying',
  'educating',
  'proposing',
  'objection_handling',
  'closing',
  'nurturing',
  'post_booking',
];

describe('DEFAULT_METHODOLOGY', () => {
  describe('stages', () => {
    it('defines all 8 required stages', () => {
      const ids = DEFAULT_METHODOLOGY.stages.map((s) => s.id);
      expect(ids).toHaveLength(8);
      for (const expected of EXPECTED_STAGE_IDS) {
        expect(ids).toContain(expected);
      }
    });

    it('every stage has at least one exit condition (except post_booking)', () => {
      const nonTerminalStages = DEFAULT_METHODOLOGY.stages.filter(
        (s) => s.id !== 'post_booking',
      );
      for (const stage of nonTerminalStages) {
        expect(
          stage.exitConditions.length,
          `Stage '${stage.id}' must have at least one exit condition`,
        ).toBeGreaterThan(0);
      }
    });

    it('post_booking is the terminal stage with no exit conditions', () => {
      const postBooking = DEFAULT_METHODOLOGY.stages.find(
        (s) => s.id === 'post_booking',
      );
      expect(postBooking).toBeDefined();
      expect(postBooking!.exitConditions).toHaveLength(0);
    });

    it('every stage has at least one suggested action', () => {
      for (const stage of DEFAULT_METHODOLOGY.stages) {
        expect(
          stage.suggestedActions.length,
          `Stage '${stage.id}' must have at least one suggested action`,
        ).toBeGreaterThan(0);
      }
    });

    it('every suggested action has required fields', () => {
      for (const stage of DEFAULT_METHODOLOGY.stages) {
        for (const action of stage.suggestedActions) {
          expect(
            action.action,
            `Stage '${stage.id}': action must have 'action' field`,
          ).toBeTruthy();
          expect(
            action.when,
            `Stage '${stage.id}': action must have 'when' field`,
          ).toBeTruthy();
          expect(
            action.constraint,
            `Stage '${stage.id}': action must have 'constraint' field`,
          ).toBeTruthy();
        }
      }
    });

    it('every exit condition has a condition and nextStage', () => {
      for (const stage of DEFAULT_METHODOLOGY.stages) {
        for (const exit of stage.exitConditions) {
          expect(
            exit.condition,
            `Stage '${stage.id}': exit must have 'condition'`,
          ).toBeTruthy();
          expect(
            exit.nextStage,
            `Stage '${stage.id}': exit must have 'nextStage'`,
          ).toBeTruthy();
        }
      }
    });

    it('every stage has a maxTurnsInStage greater than zero', () => {
      for (const stage of DEFAULT_METHODOLOGY.stages) {
        expect(
          stage.maxTurnsInStage,
          `Stage '${stage.id}' must have maxTurnsInStage > 0`,
        ).toBeGreaterThan(0);
      }
    });

    it('every stage has an objective', () => {
      for (const stage of DEFAULT_METHODOLOGY.stages) {
        expect(
          stage.objective,
          `Stage '${stage.id}' must have an objective`,
        ).toBeTruthy();
      }
    });

    it('qualifying stage requires projectType, approximateSize, and timeline', () => {
      const qualifying = DEFAULT_METHODOLOGY.stages.find(
        (s) => s.id === 'qualifying',
      ) as StageDefinition;
      expect(qualifying.requiredInfoBeforeAdvancing).toContain('projectType');
      expect(qualifying.requiredInfoBeforeAdvancing).toContain('approximateSize');
      expect(qualifying.requiredInfoBeforeAdvancing).toContain('timeline');
    });
  });

  describe('globalRules', () => {
    it('has at least 5 global rules', () => {
      expect(DEFAULT_METHODOLOGY.globalRules.length).toBeGreaterThanOrEqual(5);
    });

    it('every global rule is a non-empty string', () => {
      for (const rule of DEFAULT_METHODOLOGY.globalRules) {
        expect(typeof rule).toBe('string');
        expect(rule.length).toBeGreaterThan(0);
      }
    });
  });

  describe('emergencyBypass', () => {
    it('defines an urgency threshold', () => {
      expect(DEFAULT_METHODOLOGY.emergencyBypass.urgencyThreshold).toBeDefined();
      expect(
        typeof DEFAULT_METHODOLOGY.emergencyBypass.urgencyThreshold,
      ).toBe('number');
    });

    it('urgency threshold is 90', () => {
      expect(DEFAULT_METHODOLOGY.emergencyBypass.urgencyThreshold).toBe(90);
    });

    it('defines an acknowledgment template', () => {
      expect(
        DEFAULT_METHODOLOGY.emergencyBypass.acknowledgmentTemplate,
      ).toBeTruthy();
    });
  });
});
