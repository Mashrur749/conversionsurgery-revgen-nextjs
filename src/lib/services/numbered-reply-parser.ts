/**
 * Parses compact contractor replies against numbered option lists.
 *
 * Patterns:
 *   "1"         → select option 1
 *   "W1"        → mark option 1 as won
 *   "L2"        → mark option 2 as lost
 *   "W13 L2"    → mark 1,3 as won; 2 as lost
 *   "W13L2"     → same (no space required)
 *   "W"         → all won
 *   "L"         → all lost
 *   "0"         → skip all
 *   "W1,3 L2"   → comma-separated also works
 *
 * Case-insensitive. Whitespace-tolerant.
 */

export type SelectionAction = 'select' | 'won' | 'lost';

export interface NumberedSelection {
  index: number;
  action: SelectionAction;
}

export interface ParsedNumberedReply {
  matched: boolean;
  skipAll: boolean;
  selections: NumberedSelection[];
}

const NOT_MATCHED: ParsedNumberedReply = { matched: false, skipAll: false, selections: [] };
const SKIP_ALL: ParsedNumberedReply = { matched: true, skipAll: true, selections: [] };

/**
 * Check whether a message looks like it could be a numbered reply.
 * Quick pre-filter before full parsing — avoids parsing natural language.
 */
export function isNumberedReply(message: string): boolean {
  const trimmed = message.trim();
  // Must be short (under 20 chars) and contain only digits, W, L, commas, spaces
  return trimmed.length > 0 && trimmed.length <= 20 && /^[0-9wlWL,\s]+$/.test(trimmed);
}

/**
 * Parse a contractor's reply into numbered selections.
 *
 * @param message  Raw SMS body
 * @param maxIndex Highest valid option number (e.g., 5 if there are 5 options)
 */
export function parseNumberedReply(
  message: string,
  maxIndex: number
): ParsedNumberedReply {
  const trimmed = message.trim().toUpperCase();

  if (!trimmed || maxIndex < 1) return NOT_MATCHED;

  // "0" = skip all
  if (trimmed === '0') return SKIP_ALL;

  // Bare digit: "1", "2", "3" → select that option
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n < 1 || n > maxIndex) return NOT_MATCHED;
    return { matched: true, skipAll: false, selections: [{ index: n, action: 'select' }] };
  }

  // Bare "W" or "L" = all won / all lost
  if (trimmed === 'W') {
    const selections: NumberedSelection[] = [];
    for (let i = 1; i <= maxIndex; i++) {
      selections.push({ index: i, action: 'won' });
    }
    return { matched: true, skipAll: false, selections };
  }
  if (trimmed === 'L') {
    const selections: NumberedSelection[] = [];
    for (let i = 1; i <= maxIndex; i++) {
      selections.push({ index: i, action: 'lost' });
    }
    return { matched: true, skipAll: false, selections };
  }

  // Compound pattern: W and/or L followed by digit groups
  // e.g., "W13 L2", "W1,3L2", "W 1 3 L 2", "L2W1"
  const selections: NumberedSelection[] = [];
  const seen = new Set<number>();

  // Split into W-group and L-group tokens
  // Strategy: scan for W or L, then collect all digits until the next W or L
  const tokens = trimmed.replace(/,/g, '').split(/(?=[WL])/);

  for (const token of tokens) {
    const cleaned = token.trim();
    if (!cleaned) continue;

    const prefix = cleaned[0];
    if (prefix !== 'W' && prefix !== 'L') return NOT_MATCHED;

    const action: SelectionAction = prefix === 'W' ? 'won' : 'lost';
    const digits = cleaned.slice(1).replace(/\s/g, '');

    if (!digits) {
      // Bare W or L after split — means "all" for this action
      // But only if this is the only token (handled above for bare W/L)
      // In compound context, bare W/L without digits is invalid
      return NOT_MATCHED;
    }

    // Each character should be a digit 1-maxIndex
    for (const ch of digits) {
      if (!/\d/.test(ch)) return NOT_MATCHED;
      const n = parseInt(ch, 10);
      if (n < 1 || n > maxIndex) return NOT_MATCHED;
      if (seen.has(n)) continue; // deduplicate
      seen.add(n);
      selections.push({ index: n, action });
    }
  }

  if (selections.length === 0) return NOT_MATCHED;

  // Sort by index for consistent ordering
  selections.sort((a, b) => a.index - b.index);

  return { matched: true, skipAll: false, selections };
}
