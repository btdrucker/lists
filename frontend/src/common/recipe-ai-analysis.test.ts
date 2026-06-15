import { describe, it, expect } from 'vitest';
import {
  getIngredientsNeedingAiIndices,
  analyzeRecipeForAiParsing,
  collectBatchParsingTargets,
} from './recipe-ai-analysis';
import type { RecipeWithAiMetadata } from './recipe-ai-analysis';
import type { Ingredient } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENT_VERSION = 1;

function ing(overrides: Partial<Ingredient> = {}): Ingredient {
  return { name: 'flour', originalText: '2 cups flour', ...overrides };
}

function aiIng(overrides: Partial<Ingredient> = {}): Ingredient {
  return { name: 'flour', originalText: '2 cups flour', aiName: 'all-purpose flour', aiAmount: 2, aiUnit: 'cups', ...overrides };
}

function recipe(overrides: Partial<RecipeWithAiMetadata> = {}): RecipeWithAiMetadata {
  return {
    id: 'r1',
    userId: 'u1',
    title: 'Test Recipe',
    ingredients: [aiIng(), aiIng()],
    instructions: [],
    isPublic: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastAiParsingVersion: CURRENT_VERSION,
    aiParsingStatus: 'done',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getIngredientsNeedingAiIndices
// ---------------------------------------------------------------------------

describe('getIngredientsNeedingAiIndices', () => {
  it('returns all indices when version is null (never parsed)', () => {
    const ingredients = [ing(), ing(), ing()];
    const result = getIngredientsNeedingAiIndices(ingredients, null, CURRENT_VERSION);
    expect(result).toEqual([0, 1, 2]);
  });

  it('returns all indices when version is undefined', () => {
    const result = getIngredientsNeedingAiIndices([ing(), ing()], undefined, CURRENT_VERSION);
    expect(result).toEqual([0, 1]);
  });

  it('returns all indices when stored version is older than current', () => {
    const result = getIngredientsNeedingAiIndices([ing(), aiIng()], 0, CURRENT_VERSION);
    expect(result).toEqual([0, 1]);
  });

  it('returns only missing indices when version is current', () => {
    const ingredients = [aiIng(), ing(), aiIng()];
    const result = getIngredientsNeedingAiIndices(ingredients, CURRENT_VERSION, CURRENT_VERSION);
    expect(result).toEqual([1]);
  });

  it('returns empty array when all ingredients are parsed and version is current', () => {
    const result = getIngredientsNeedingAiIndices([aiIng(), aiIng()], CURRENT_VERSION, CURRENT_VERSION);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// analyzeRecipeForAiParsing
// ---------------------------------------------------------------------------

describe('analyzeRecipeForAiParsing', () => {
  it('reports done with no indices when all ingredients are current', () => {
    const r = recipe();
    const { indicesToParse, aiParsingStatus, shouldReparseAll } = analyzeRecipeForAiParsing(r, CURRENT_VERSION);
    expect(indicesToParse).toEqual([]);
    expect(aiParsingStatus).toBe('done');
    expect(shouldReparseAll).toBe(false);
  });

  it('reports required and all indices when version is stale', () => {
    const r = recipe({ lastAiParsingVersion: 0, ingredients: [aiIng(), ing()] });
    const { indicesToParse, aiParsingStatus, shouldReparseAll } = analyzeRecipeForAiParsing(r, CURRENT_VERSION);
    expect(indicesToParse).toEqual([0, 1]);
    expect(aiParsingStatus).toBe('required');
    expect(shouldReparseAll).toBe(true);
  });

  it('reports required only for missing indices when version is current', () => {
    const r = recipe({
      ingredients: [aiIng(), ing(), aiIng()],
      lastAiParsingVersion: CURRENT_VERSION,
    });
    const { indicesToParse, aiParsingStatus } = analyzeRecipeForAiParsing(r, CURRENT_VERSION);
    expect(indicesToParse).toEqual([1]);
    expect(aiParsingStatus).toBe('required');
  });

  it('shouldReparseAll is false when version is current even with missing fields', () => {
    const r = recipe({ ingredients: [ing()], lastAiParsingVersion: CURRENT_VERSION });
    const { shouldReparseAll } = analyzeRecipeForAiParsing(r, CURRENT_VERSION);
    expect(shouldReparseAll).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collectBatchParsingTargets
// ---------------------------------------------------------------------------

describe('collectBatchParsingTargets', () => {
  it('returns empty when all recipes are fully parsed', () => {
    const r = recipe();
    expect(collectBatchParsingTargets([r], CURRENT_VERSION)).toEqual([]);
  });

  it('collects targets for every ingredient needing parsing', () => {
    const r = recipe({
      lastAiParsingVersion: null,
      ingredients: [
        ing({ originalText: '1 cup flour' }),
        ing({ originalText: '2 eggs' }),
      ],
    });
    const targets = collectBatchParsingTargets([r], CURRENT_VERSION);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({ recipeId: 'r1', ingredientIndex: 0, text: '1 cup flour' });
    expect(targets[1]).toMatchObject({ recipeId: 'r1', ingredientIndex: 1, text: '2 eggs' });
  });

  it('uses ingredient name as text when originalText is empty', () => {
    const r = recipe({
      lastAiParsingVersion: null,
      ingredients: [ing({ originalText: '', name: 'butter' })],
    });
    const targets = collectBatchParsingTargets([r], CURRENT_VERSION);
    expect(targets[0].text).toBe('butter');
  });

  it('skips ingredients with no usable text', () => {
    const r = recipe({
      lastAiParsingVersion: null,
      ingredients: [ing({ originalText: '', name: '' })],
    });
    const targets = collectBatchParsingTargets([r], CURRENT_VERSION);
    expect(targets).toHaveLength(0);
  });

  it('collects across multiple recipes', () => {
    const r1 = recipe({ id: 'r1', lastAiParsingVersion: null, ingredients: [ing()] });
    const r2 = recipe({ id: 'r2', lastAiParsingVersion: null, ingredients: [ing(), ing()] });
    const targets = collectBatchParsingTargets([r1, r2], CURRENT_VERSION);
    expect(targets).toHaveLength(3);
    expect(targets.map((t) => t.recipeId)).toEqual(['r1', 'r2', 'r2']);
  });
});
