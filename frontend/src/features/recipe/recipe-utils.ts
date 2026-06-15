import type { Ingredient } from '../../types';

export const applyAiIngredientDefaults = (items: Ingredient[]): Ingredient[] =>
  items.map((ingredient) => {
    const aiAmount = ingredient.aiAmount ?? null;
    const aiUnit = ingredient.aiUnit ?? null;
    const aiName = ingredient.aiName?.trim() || null;
    const hasAnyAi = aiAmount !== null || aiUnit !== null || aiName !== null;

    if (!hasAnyAi) return ingredient;

    return {
      ...ingredient,
      amount: aiAmount,
      unit: aiUnit,
      name: aiName ?? '',
    };
  });
