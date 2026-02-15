/**
 * Simple English pluralization for ingredient names.
 * Assumes input is singular (e.g. "carrot", "potato").
 * Collective nouns (lentils, flour) are typically left as-is by the parser.
 */

const IRREGULAR_PLURALS: Record<string, string> = {
  potato: 'potatoes',
  tomato: 'tomatoes',
  onion: 'onions', // regular but often mistaken
  leaf: 'leaves',
  loaf: 'loaves',
  half: 'halves',
  knife: 'knives',
  life: 'lives',
  berry: 'berries',
  cherry: 'cherries',
  strawberry: 'strawberries',
  raspberry: 'raspberries',
  blackberry: 'blackberries',
  blueberry: 'blueberries',
  cranberry: 'cranberries',
  person: 'people',
  child: 'children',
};

/**
 * Returns plural form when count > 1, otherwise singular.
 * Count is used for the grammatical check; we don't prepend it to the result.
 */
export function pluralize(singular: string, count: number): string {
  const trimmed = singular.trim();
  if (!trimmed || count <= 1) return trimmed;

  const lower = trimmed.toLowerCase();
  const irregular = IRREGULAR_PLURALS[lower];
  if (irregular) {
    return preserveCase(trimmed, irregular);
  }

  // consonant + y -> ies (berry -> berries)
  if (/[bcdfghjklmnpqrstvwxz]y$/i.test(trimmed)) {
    return trimmed.slice(0, -1) + 'ies';
  }

  // s, x, z, ch, sh -> es
  if (/[sxz]$/i.test(trimmed) || /(?:ch|sh)$/i.test(trimmed)) {
    return trimmed + 'es';
  }

  // default: add s
  return trimmed + 's';
}

function preserveCase(original: string, result: string): string {
  if (original === original.toUpperCase()) return result.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return result[0].toUpperCase() + result.slice(1);
  }
  return result;
}
