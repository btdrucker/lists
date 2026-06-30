import type { Tag } from '../../types';

export const COLOR_PALETTE = [
  '#0066CC',
  '#D32F2F',
  '#388E3C',
  '#FF8C00',
  '#7B1FA2',
  '#00838F',
  '#EC407A',
  '#607D8B',
] as const;

/**
 * Derives a 1–2 character abbreviation from a tag display name.
 * Two-word names use the initials of the first two words.
 * Single-word names use the first two characters.
 */
export function deriveAbbreviation(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Returns the least-used color from COLOR_PALETTE for a new tag.
 * Prefers colors not yet used at all, then falls back to the least-used one.
 */
export function getDefaultColor(tags: Tag[]): string {
  const usedColors = new Set(tags.map((t) => t.color));
  const firstUnused = COLOR_PALETTE.find((c) => !usedColors.has(c));
  if (firstUnused) return firstUnused;

  const usedCounts = COLOR_PALETTE.reduce<Record<string, number>>((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {});
  tags.forEach((t) => {
    if (usedCounts[t.color] !== undefined) usedCounts[t.color]++;
  });
  return COLOR_PALETTE.reduce((least, c) =>
    usedCounts[c] < usedCounts[least] ? c : least
  );
}
