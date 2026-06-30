import { describe, it, expect } from 'vitest';
import { filterRecipes } from './recipeSearch';
import type { Recipe } from '../../types';

function makeRecipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'r1',
    userId: 'u1',
    title: 'Pasta',
    description: '',
    ingredients: [],
    instructions: [],
    isPublic: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function ing(name: string) {
  return { name, originalText: name, amount: null, unit: null };
}

const recipes: Recipe[] = [
  makeRecipe({ id: 'r1', title: 'Pasta Carbonara', ingredients: [ing('bacon'), ing('eggs')], category: ['Dinner'], cuisine: ['Italian'], keywords: ['quick'] }),
  makeRecipe({ id: 'r2', title: 'Chicken Soup', ingredients: [ing('chicken'), ing('carrots')], category: ['Lunch'], cuisine: ['American'], keywords: ['comfort'] }),
  makeRecipe({ id: 'r3', title: 'Salad', ingredients: [ing('lettuce'), ing('tomato')], category: ['Lunch'], cuisine: ['Mediterranean'], keywords: ['healthy', 'quick'] }),
];

describe('filterRecipes', () => {
  it('returns all recipes for an empty query', () => {
    expect(filterRecipes(recipes, '')).toHaveLength(3);
  });

  it('returns all recipes for a whitespace-only query', () => {
    expect(filterRecipes(recipes, '   ')).toHaveLength(3);
  });

  it('filters by title (case-insensitive)', () => {
    const result = filterRecipes(recipes, 'pasta');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('filters by ingredient name', () => {
    const result = filterRecipes(recipes, 'carrots');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r2');
  });

  it('filters by category', () => {
    const result = filterRecipes(recipes, 'lunch');
    expect(result.map((r) => r.id).sort()).toEqual(['r2', 'r3']);
  });

  it('filters by cuisine', () => {
    const result = filterRecipes(recipes, 'italian');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('filters by keyword', () => {
    const result = filterRecipes(recipes, 'quick');
    expect(result.map((r) => r.id).sort()).toEqual(['r1', 'r3']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterRecipes(recipes, 'sushi')).toHaveLength(0);
  });

  it('handles recipes with no optional fields', () => {
    const bare = [makeRecipe({ id: 'bare', title: 'Toast' })];
    expect(filterRecipes(bare, 'toast')).toHaveLength(1);
    expect(filterRecipes(bare, 'pasta')).toHaveLength(0);
  });
});
