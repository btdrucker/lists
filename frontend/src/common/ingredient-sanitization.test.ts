import { describe, it, expect } from 'vitest';
import {
  getIngredientText,
  hasAnyAiFields,
  hasMissingAiFields,
  getEffectiveIngredientValues,
  computeAiParsingStatus,
  sanitizeIngredientForSave,
  mergeParsedIngredients,
} from './ingredient-sanitization';
import type { Ingredient } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ing(overrides: Partial<Ingredient> = {}): Ingredient {
  return { name: 'flour', originalText: '2 cups flour', amount: 2, unit: 'cups', ...overrides };
}

function aiIng(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    name: 'flour',
    originalText: '2 cups flour',
    amount: 2,
    unit: 'cups',
    aiName: 'all-purpose flour',
    aiAmount: 2,
    aiUnit: 'cups',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getIngredientText
// ---------------------------------------------------------------------------

describe('getIngredientText', () => {
  it('returns originalText when present', () => {
    expect(getIngredientText(ing({ originalText: '  2 cups flour  ' }))).toBe('2 cups flour');
  });

  it('falls back to name when originalText is absent', () => {
    expect(getIngredientText({ name: 'flour', originalText: '' })).toBe('flour');
  });

  it('falls back to name when originalText is whitespace-only', () => {
    expect(getIngredientText({ name: 'flour', originalText: '   ' })).toBe('flour');
  });
});

// ---------------------------------------------------------------------------
// hasAnyAiFields / hasMissingAiFields
// ---------------------------------------------------------------------------

describe('hasAnyAiFields', () => {
  it('returns false when no AI fields are set', () => {
    expect(hasAnyAiFields(ing())).toBe(false);
  });

  it('returns true when only aiName is set', () => {
    expect(hasAnyAiFields(ing({ aiName: 'all-purpose flour' }))).toBe(true);
  });

  it('returns true when only aiAmount is set', () => {
    expect(hasAnyAiFields(ing({ aiAmount: 2 }))).toBe(true);
  });

  it('returns true when only aiUnit is set', () => {
    expect(hasAnyAiFields(ing({ aiUnit: 'cups' }))).toBe(true);
  });

  it('treats aiName of empty string as absent', () => {
    expect(hasAnyAiFields(ing({ aiName: '  ' }))).toBe(false);
  });

  it('treats aiAmount of 0 as present', () => {
    expect(hasAnyAiFields(ing({ aiAmount: 0 }))).toBe(true);
  });
});

describe('hasMissingAiFields', () => {
  it('is the inverse of hasAnyAiFields', () => {
    expect(hasMissingAiFields(ing())).toBe(true);
    expect(hasMissingAiFields(aiIng())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveIngredientValues — the "never mix AI and non-AI" invariant
// ---------------------------------------------------------------------------

describe('getEffectiveIngredientValues', () => {
  it('uses original fields when no AI fields are present', () => {
    expect(getEffectiveIngredientValues(ing())).toEqual({ amount: 2, unit: 'cups', name: 'flour' });
  });

  it('uses ALL AI fields when any AI field is set — never mixes', () => {
    // Only aiName is set; aiAmount and aiUnit are null — result should still use the nulls
    const result = getEffectiveIngredientValues(
      ing({ aiName: 'all-purpose flour', aiAmount: null, aiUnit: null })
    );
    expect(result).toEqual({ amount: null, unit: null, name: 'all-purpose flour' });
  });

  it('uses full AI fields when all three are set', () => {
    expect(getEffectiveIngredientValues(aiIng())).toEqual({
      amount: 2,
      unit: 'cups',
      name: 'all-purpose flour',
    });
  });

  it('falls back to original name when aiName is null but other AI fields exist', () => {
    const result = getEffectiveIngredientValues(ing({ aiAmount: 2, aiUnit: 'cups', aiName: null }));
    expect(result.name).toBe('flour');
  });

  it('handles missing amount/unit on original ingredient', () => {
    const result = getEffectiveIngredientValues({ name: 'salt', originalText: 'salt' });
    expect(result).toEqual({ amount: null, unit: null, name: 'salt' });
  });
});

// ---------------------------------------------------------------------------
// computeAiParsingStatus
// ---------------------------------------------------------------------------

describe('computeAiParsingStatus', () => {
  it('returns "done" when all ingredients have AI fields', () => {
    expect(computeAiParsingStatus([aiIng(), aiIng()])).toBe('done');
  });

  it('returns "required" when any ingredient is missing AI fields', () => {
    expect(computeAiParsingStatus([aiIng(), ing()])).toBe('required');
  });

  it('returns "done" for an empty list', () => {
    expect(computeAiParsingStatus([])).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// sanitizeIngredientForSave
// ---------------------------------------------------------------------------

describe('sanitizeIngredientForSave', () => {
  it('always includes core fields', () => {
    const result = sanitizeIngredientForSave({ name: 'butter', originalText: 'butter' });
    expect(result).toMatchObject({ name: 'butter', originalText: 'butter', amount: null, unit: null });
  });

  it('includes optional fields only when present on the input', () => {
    const withSection = sanitizeIngredientForSave(ing({ section: 'Frosting' }));
    expect(withSection.section).toBe('Frosting');

    const without = sanitizeIngredientForSave(ing());
    expect(without.section).toBeUndefined();
  });

  it('always includes AI fields (even when null)', () => {
    const result = sanitizeIngredientForSave(ing());
    expect(result).toMatchObject({ aiAmount: null, aiUnit: null, aiName: null });
  });

  it('preserves AI fields when set', () => {
    const result = sanitizeIngredientForSave(aiIng());
    expect(result).toMatchObject({ aiName: 'all-purpose flour', aiAmount: 2, aiUnit: 'cups' });
  });
});

// ---------------------------------------------------------------------------
// mergeParsedIngredients
// ---------------------------------------------------------------------------

describe('mergeParsedIngredients', () => {
  it('merges parsed results only at the specified indices', () => {
    const original = [ing({ name: 'flour' }), ing({ name: 'sugar' })];
    const parsed = [aiIng({ name: 'sugar', aiName: 'cane sugar' })];
    const result = mergeParsedIngredients(original, [1], parsed);
    expect(result[0].name).toBe('flour');
    expect(result[1].aiName).toBe('cane sugar');
  });

  it('preserves section and optional from the original ingredient', () => {
    const original = [ing({ section: 'Frosting', optional: true })];
    const parsed = [aiIng({ section: 'ShouldBeIgnored', optional: false })];
    const result = mergeParsedIngredients(original, [0], parsed);
    expect(result[0].section).toBe('Frosting');
    expect(result[0].optional).toBe(true);
  });

  it('skips an index if the parsed result is missing', () => {
    const original = [ing(), ing()];
    // indices [0, 1] but only one parsed result — index 1 should be left unchanged
    const result = mergeParsedIngredients(original, [0, 1], [aiIng()]);
    expect(result[0].aiName).toBe('all-purpose flour');
    expect(result[1].aiName).toBeNull(); // sanitized from original (no AI fields)
  });

  it('returns all ingredients sanitized', () => {
    const original = [ing()];
    const result = mergeParsedIngredients(original, [], []);
    expect(result[0]).toMatchObject({ aiAmount: null, aiUnit: null, aiName: null });
  });
});
