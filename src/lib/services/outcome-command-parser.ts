/**
 * Parses WON/LOST/WINS SMS commands from contractors.
 *
 * Patterns:
 *   WON <refCode>           → mark lead as won, use client avg project value
 *   WON <refCode> <amount>  → mark lead as won with explicit revenue (dollars)
 *   LOST <refCode>          → mark lead as lost
 *   WINS                    → list recent leads with pending outcomes
 *
 * Case-insensitive. Whitespace-tolerant.
 */

export type OutcomeCommand =
  | { matched: false }
  | { matched: true; action: 'won'; refCode: string; revenueDollars?: number }
  | { matched: true; action: 'lost'; refCode: string }
  | { matched: true; action: 'wins' };

const WON_PATTERN = /^\s*won\s+([a-z0-9]+)(?:\s+(\d+))?\s*$/i;
const LOST_PATTERN = /^\s*lost\s+([a-z0-9]+)\s*$/i;
const WINS_PATTERN = /^\s*wins\s*$/i;

export function parseOutcomeCommand(messageBody: string): OutcomeCommand {
  const trimmed = messageBody.trim();

  // Check WINS first (no args)
  if (WINS_PATTERN.test(trimmed)) {
    return { matched: true, action: 'wins' };
  }

  // Check WON <ref> [amount]
  const wonMatch = trimmed.match(WON_PATTERN);
  if (wonMatch) {
    const refCode = wonMatch[1].toUpperCase();
    const amountStr = wonMatch[2];

    if (amountStr) {
      const amount = parseInt(amountStr, 10);
      if (amount <= 0) {
        return { matched: false }; // Zero or negative revenue is invalid
      }
      return { matched: true, action: 'won', refCode, revenueDollars: amount };
    }

    return { matched: true, action: 'won', refCode };
  }

  // Check LOST <ref>
  const lostMatch = trimmed.match(LOST_PATTERN);
  if (lostMatch) {
    const refCode = lostMatch[1].toUpperCase();
    return { matched: true, action: 'lost', refCode };
  }

  return { matched: false };
}
