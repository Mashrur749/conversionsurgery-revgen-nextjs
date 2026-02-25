import { describe, expect, it } from 'vitest';
import { parseBooleanSystemSetting } from '@/lib/services/ops-kill-switches';

describe('parseBooleanSystemSetting', () => {
  it('returns true for supported truthy values', () => {
    expect(parseBooleanSystemSetting('true')).toBe(true);
    expect(parseBooleanSystemSetting('1')).toBe(true);
    expect(parseBooleanSystemSetting('yes')).toBe(true);
    expect(parseBooleanSystemSetting('on')).toBe(true);
    expect(parseBooleanSystemSetting(' TRUE ')).toBe(true);
  });

  it('returns false for empty and non-truthy values', () => {
    expect(parseBooleanSystemSetting(undefined)).toBe(false);
    expect(parseBooleanSystemSetting(null)).toBe(false);
    expect(parseBooleanSystemSetting('')).toBe(false);
    expect(parseBooleanSystemSetting('false')).toBe(false);
    expect(parseBooleanSystemSetting('0')).toBe(false);
    expect(parseBooleanSystemSetting('off')).toBe(false);
    expect(parseBooleanSystemSetting('random')).toBe(false);
  });
});
