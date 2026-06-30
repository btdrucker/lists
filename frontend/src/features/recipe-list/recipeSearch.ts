import type { Recipe } from '../../types';

/**
 * Client-side search across title, ingredients, category, cuisine, and keywords.
 * Returns all recipes when the query is empty.
 */
export function filterRecipes(recipes: Recipe[], query: string): Recipe[] {
  const trimmed = query.trim();
  if (!trimmed) return recipes;
  const lower = trimmed.toLowerCase();

  return recipes.filter((recipe) => {
    if (recipe.title.toLowerCase().includes(lower)) return true;
    if (recipe.ingredients.some((i) => i.name.toLowerCase().includes(lower))) return true;
    if (recipe.category?.some((c) => c.toLowerCase().includes(lower))) return true;
    if (recipe.cuisine?.some((c) => c.toLowerCase().includes(lower))) return true;
    if (recipe.keywords?.some((k) => k.toLowerCase().includes(lower))) return true;
    return false;
  });
}
