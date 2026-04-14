/**
 * Classify the reason for opt-out from the message text.
 * Uses regex patterns — no LLM call.
 */
export function classifyOptOutReason(messageText: string): string {
  const lower = messageText.toLowerCase();

  // Competitor chosen
  if (/found\s+(someone|another|a\s+different)|went\s+with\s+(someone|another)|chose\s+(another|a\s+different)|using\s+(someone|another)/i.test(lower)) {
    return 'competitor_chosen';
  }

  // Project cancelled
  if (/not\s+doing|cancel(led)?\s+(the\s+)?project|changed\s+(our|my)\s+mind|don.t\s+need|no\s+longer\s+need/i.test(lower)) {
    return 'project_cancelled';
  }

  // Bad experience / too many messages
  if (/too\s+many\s+(message|text|notification)|stop\s+texting|annoying|spam|harass/i.test(lower)) {
    return 'bad_experience';
  }

  // Cost
  if (/too\s+expensive|can.t\s+afford|over\s+(our|my)\s+budget|too\s+much\s+money/i.test(lower)) {
    return 'cost';
  }

  // Not interested
  if (/not\s+interested|no\s+thanks|don.t\s+want|no\s+longer\s+interested/i.test(lower)) {
    return 'not_interested';
  }

  return 'unknown';
}
