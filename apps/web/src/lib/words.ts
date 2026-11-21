/**
 * Counts words the same way on client and server: split on whitespace,
 * drop empty tokens. Used for the 60-word demand summary cap (§3.3a) —
 * client and server MUST agree exactly, or a summary that passes the live
 * counter could still get rejected on submit.
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;
}
