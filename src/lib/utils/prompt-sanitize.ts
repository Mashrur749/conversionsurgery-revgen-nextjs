/**
 * Sanitizes a user-provided string before interpolation into an AI system prompt.
 *
 * Prevents prompt injection via business names, owner names, or agent names that
 * may contain newlines (which break prompt structure) or template placeholder syntax
 * (which can hijack variable substitution).
 */
export function sanitizeForPrompt(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')          // newlines → spaces (prevent structure breaks)
    .replace(/\{[^}]*\}/g, '')         // remove {placeholder} syntax
    .replace(/  +/g, ' ')              // collapse multiple spaces
    .trim()
    .slice(0, 200);                    // cap at 200 characters
}
