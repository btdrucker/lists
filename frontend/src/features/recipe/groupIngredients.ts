import type { Ingredient } from '../../types';

export interface IngredientSection {
  sectionName: string | null;
  ingredients: Ingredient[];
}

export function groupIngredients(ingredients: Ingredient[]): IngredientSection[] {
  const sectionMap = new Map<string | null, Ingredient[]>();

  for (const ingredient of ingredients) {
    const key = ingredient.section ?? null;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, []);
    }
    sectionMap.get(key)!.push(ingredient);
  }

  return Array.from(sectionMap.entries()).map(([sectionName, items]) => ({
    sectionName,
    ingredients: items,
  }));
}
