import { describe, expect, it } from 'vitest';

import { parseEstimateCommand } from './estimate-command-parser';

describe('parseEstimateCommand', () => {
  it('parses lead id target', () => {
    const result = parseEstimateCommand(
      'EST 123e4567-e89b-12d3-a456-426614174000'
    );

    expect(result.matched).toBe(true);
    expect(result.targetType).toBe('lead_id');
  });

  it('parses phone target', () => {
    const result = parseEstimateCommand('EST +1 (403) 555-0188');

    expect(result.matched).toBe(true);
    expect(result.targetType).toBe('phone');
  });

  it('parses lead name target', () => {
    const result = parseEstimateCommand('EST Jane Doe');

    expect(result.matched).toBe(true);
    expect(result.targetType).toBe('lead_name');
    expect(result.target).toBe('Jane Doe');
  });

  it('handles missing target', () => {
    const result = parseEstimateCommand('EST');

    expect(result.matched).toBe(true);
    expect(result.error).toBe('missing_target');
  });

  it('ignores non-command text', () => {
    const result = parseEstimateCommand('Hello there');

    expect(result.matched).toBe(false);
  });
});
