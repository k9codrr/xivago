/**
 * Rules for user-written tags (anything not in the category workbook).
 * Shared by the tag picker and the demands API so both agree.
 */

export const CUSTOM_TAG_MIN = 2;
export const CUSTOM_TAG_MAX = 30;
export const CUSTOM_TAG_MAX_WORDS = 4;

/** Same normalisation as the workbook tags (lowercase, "-" → space, single spaces). */
export function normalizeTagInput(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
}

/** Returns why a custom tag isn't allowed, or null when it's fine. Expects a normalised tag. */
export function customTagError(tag: string): string | null {
  if (tag.length < CUSTOM_TAG_MIN) return `Tags need at least ${CUSTOM_TAG_MIN} characters`;
  if (tag.length > CUSTOM_TAG_MAX) return `Keep tags to ${CUSTOM_TAG_MAX} characters`;
  if (tag.split(" ").length > CUSTOM_TAG_MAX_WORDS) return `Keep tags to ${CUSTOM_TAG_MAX_WORDS} words`;
  // Letters (any script), digits and a few symbols used in skill names: c++, c#, node.js, r&d.
  // \p{M} keeps vowel signs in scripts like Devanagari ("गृह प्रवेश").
  if (!/^[\p{L}\p{M}\p{N} &+.#']+$/u.test(tag)) return "Use letters, numbers and & + . # only";
  if (!/\p{L}/u.test(tag)) return "Tags need at least one letter";
  // Keep contact details and links out of tags.
  if (/(https?|www\.|\.com\b|\.in\b|@)/.test(tag)) return "Links aren't allowed in tags";
  if ((tag.match(/\d/g) ?? []).length > 6) return "Phone numbers aren't allowed in tags";
  return null;
}
