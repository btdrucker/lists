import { describe, it, expect } from 'vitest';
import { deriveAbbreviation, getDefaultColor, COLOR_PALETTE } from './tag-utils';
import type { Tag } from '../../types';

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 't1',
    familyId: 'fam',
    displayName: 'Produce',
    abbreviation: 'PR',
    color: COLOR_PALETTE[0],
    sortOrder: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deriveAbbreviation
// ---------------------------------------------------------------------------

describe('deriveAbbreviation', () => {
  it('returns empty string for an empty input', () => {
    expect(deriveAbbreviation('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(deriveAbbreviation('   ')).toBe('');
  });

  it('uses first two characters of a single word', () => {
    expect(deriveAbbreviation('Produce')).toBe('PR');
  });

  it('uses initials of first two words', () => {
    expect(deriveAbbreviation('Dairy Free')).toBe('DF');
  });

  it('ignores extra words beyond the first two', () => {
    expect(deriveAbbreviation('Gluten Free Vegan')).toBe('GF');
  });

  it('uppercases the result', () => {
    expect(deriveAbbreviation('frozen foods')).toBe('FF');
  });

  it('handles a single-character name', () => {
    expect(deriveAbbreviation('X')).toBe('X');
  });
});

// ---------------------------------------------------------------------------
// getDefaultColor
// ---------------------------------------------------------------------------

describe('getDefaultColor', () => {
  it('returns the first palette color when no tags exist', () => {
    expect(getDefaultColor([])).toBe(COLOR_PALETTE[0]);
  });

  it('returns the first unused color when some colors are taken', () => {
    const tags = [makeTag({ color: COLOR_PALETTE[0] }), makeTag({ color: COLOR_PALETTE[1] })];
    expect(getDefaultColor(tags)).toBe(COLOR_PALETTE[2]);
  });

  it('returns the least-used color when all palette colors are used', () => {
    // Fill all palette colors once each, then double-up the first one
    const tags = [
      ...COLOR_PALETTE.map((c) => makeTag({ color: c })),
      makeTag({ color: COLOR_PALETTE[0] }), // first color used twice
    ];
    // The least-used should be any color other than COLOR_PALETTE[0]
    const result = getDefaultColor(tags);
    expect(result).not.toBe(COLOR_PALETTE[0]);
    expect(COLOR_PALETTE).toContain(result);
  });

  it('is deterministic — returns same color for same input', () => {
    const tags = COLOR_PALETTE.map((c) => makeTag({ color: c }));
    expect(getDefaultColor(tags)).toBe(getDefaultColor(tags));
  });
});
