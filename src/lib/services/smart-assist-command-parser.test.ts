import { describe, expect, it } from 'vitest';

import { parseSmartAssistCommand } from './smart-assist-command-parser';

describe('parseSmartAssistCommand', () => {
  it('parses approve command', () => {
    const parsed = parseSmartAssistCommand('SEND AB12CD34');

    expect(parsed.matched).toBe(true);
    if (!parsed.matched) return;
    expect(parsed.action).toBe('approve');
    expect(parsed.referenceCode).toBe('AB12CD34');
  });

  it('parses edit command', () => {
    const parsed = parseSmartAssistCommand('EDIT AB12CD34: Sounds good, we can book Tuesday');

    expect(parsed.matched).toBe(true);
    if (!parsed.matched) return;
    expect(parsed.action).toBe('edit');
    expect(parsed.referenceCode).toBe('AB12CD34');
    if (parsed.action !== 'edit') return;
    expect(parsed.editedContent).toContain('book Tuesday');
  });

  it('parses cancel command', () => {
    const parsed = parseSmartAssistCommand('CANCEL AB12CD34');

    expect(parsed.matched).toBe(true);
    if (!parsed.matched) return;
    expect(parsed.action).toBe('cancel');
  });

  it('ignores non-command messages', () => {
    const parsed = parseSmartAssistCommand('hello there');
    expect(parsed.matched).toBe(false);
  });
});
