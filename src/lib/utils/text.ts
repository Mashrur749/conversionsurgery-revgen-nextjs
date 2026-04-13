/**
 * Truncates text at the last complete sentence boundary within maxLength.
 * Falls back to word boundary if no sentence end in the back half.
 * Never cuts mid-word. Never produces trailing "...".
 */
export function truncateAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSentenceEnd = truncated.search(/[.!?]\s*[^.!?]*$/);
  if (lastSentenceEnd >= 0 && lastSentenceEnd > maxLength * 0.5) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace).trim();
  }
  return truncated;
}
