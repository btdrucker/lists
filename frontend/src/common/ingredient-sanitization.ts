import type { Ingredient } from '../types';

export const getIngredientText = (ingredient: Ingredient) =>
  ingredient.originalText?.trim() || ingredient.name.trim();

export const hasAnyAiFields = (ingredient: Ingredient) => {
  const aiAmount = ingredient.aiAmount ?? null;
  const aiUnit = ingredient.aiUnit ?? null;
  const aiName = ingredient.aiName?.trim() || null;
  return aiAmount !== null || aiUnit !== null || aiName !== null;
};

export const hasMissingAiFields = (ingredient: Ingredient) => {
  return !hasAnyAiFields(ingredient);
};

/**
 * Gets the effective ingredient values to use.
 * If the ingredient has ANY AI fields, uses all AI fields.
 * Otherwise, uses the original parsed fields.
 * This ensures we never mix AI and non-AI data.
 */
export const getEffectiveIngredientValues = (ingredient: Ingredient) => {
  const useAi = hasAnyAiFields(ingredient);

  if (useAi) {
    return {
      amount: ingredient.aiAmount ?? null,
      unit: ingredient.aiUnit ?? null,
      name: ingredient.aiName ?? ingredient.name,
    };
  }

  return {
    amount: ingredient.amount ?? null,
    unit: ingredient.unit ?? null,
    name: ingredient.name,
  };
};

export const computeAiParsingStatus = (ingredients: Ingredient[]) =>
  ingredients.some((ingredient) => hasMissingAiFields(ingredient)) ? 'required' : 'done';

export const sanitizeIngredientForSave = (ingredient: Ingredient): Ingredient => {
  const sanitized: Ingredient = {
    amount: ingredient.amount ?? null,
    unit: ingredient.unit ?? null,
    name: ingredient.name ?? '',
    originalText: ingredient.originalText ?? '',
  };

  if (ingredient.amountMax !== undefined) {
    sanitized.amountMax = ingredient.amountMax ?? null;
  }
  if (ingredient.section !== undefined) {
    sanitized.section = ingredient.section;
  }
  if (ingredient.optional !== undefined) {
    sanitized.optional = ingredient.optional;
  }
  if (ingredient.parseConfidence !== undefined) {
    sanitized.parseConfidence = ingredient.parseConfidence;
  }

  sanitized.aiAmount = ingredient.aiAmount ?? null;
  sanitized.aiUnit = ingredient.aiUnit ?? null;
  sanitized.aiName = ingredient.aiName ?? null;

  return sanitized;
};

export const mergeParsedIngredients = (
  ingredients: Ingredient[],
  indices: number[],
  parsedResults: Ingredient[]
) => {
  const updatedIngredients = [...ingredients];

  indices.forEach((index, resultIndex) => {
    const parsed = parsedResults[resultIndex];
    if (!parsed) return;
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      ...parsed,
      section: updatedIngredients[index].section,
      optional: updatedIngredients[index].optional,
    };
  });

  return updatedIngredients.map((ingredient) => sanitizeIngredientForSave(ingredient));
};
