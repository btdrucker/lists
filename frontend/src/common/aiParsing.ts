import type { AiParsingMetadata, Ingredient, Recipe } from '../types';
import { AI_PARSING_VERSION } from '../../../shared/aiPrompt.js';

export type RecipeWithAiMetadata = Recipe & AiParsingMetadata;

export const getIngredientText = (ingredient: Ingredient) =>
  ingredient.originalText?.trim() || ingredient.name.trim();

export const hasMissingAiFields = (ingredient: Ingredient) => {
  const aiAmount = ingredient.aiAmount ?? null;
  const aiUnit = ingredient.aiUnit ?? null;
  const aiName = ingredient.aiName?.trim() || null;
  return aiAmount === null && aiUnit === null && aiName === null;
};

export const computeAiParsingStatus = (ingredients: Ingredient[]) =>
  ingredients.some((ingredient) => hasMissingAiFields(ingredient)) ? 'required' : 'done';

export const getIngredientsNeedingAiIndices = (
  ingredients: Ingredient[],
  lastAiParsingVersion: number | null | undefined,
  currentVersion: number = AI_PARSING_VERSION
) => {
  const versionIsStale =
    lastAiParsingVersion === null ||
    lastAiParsingVersion === undefined ||
    lastAiParsingVersion < currentVersion;

  if (versionIsStale) {
    return ingredients.map((_, index) => index);
  }

  return ingredients
    .map((ingredient, index) => (hasMissingAiFields(ingredient) ? index : -1))
    .filter((index) => index >= 0);
};

export const analyzeRecipeForAiParsing = (
  recipe: RecipeWithAiMetadata,
  currentVersion: number = AI_PARSING_VERSION
) => {
  const indicesToParse = getIngredientsNeedingAiIndices(
    recipe.ingredients,
    recipe.lastAiParsingVersion,
    currentVersion
  );
  const shouldReparseAll =
    recipe.lastAiParsingVersion === null ||
    recipe.lastAiParsingVersion === undefined ||
    recipe.lastAiParsingVersion < currentVersion;
  const aiParsingStatus = indicesToParse.length === 0 ? 'done' : 'required';

  return {
    indicesToParse,
    aiParsingStatus,
    shouldReparseAll,
  };
};

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

export const collectBatchParsingTargets = (
  recipes: RecipeWithAiMetadata[],
  currentVersion: number = AI_PARSING_VERSION
) => {
  const targets: Array<{ recipeId: string; ingredientIndex: number; text: string }> = [];

  recipes.forEach((recipe) => {
    const { indicesToParse } = analyzeRecipeForAiParsing(recipe, currentVersion);
    indicesToParse.forEach((index) => {
      const ingredient = recipe.ingredients[index];
      if (!ingredient) return;
      const text = getIngredientText(ingredient);
      if (!text) return;
      targets.push({ recipeId: recipe.id, ingredientIndex: index, text });
    });
  });

  return targets;
};

export const parseAllPendingIngredients = async (
  recipes: RecipeWithAiMetadata[],
  apiUrl: string,
  token: string,
  currentVersion: number = AI_PARSING_VERSION
) => {
  const targets = collectBatchParsingTargets(recipes, currentVersion);
  if (targets.length === 0) {
    return [];
  }

  const ingredientTexts = targets.map((target) => target.text);
  const response = await fetch(`${apiUrl}/parse-ingredients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ingredientTexts }),
  });

  const data = await response.json();
  if (!response.ok || data.status !== 'ok' || !Array.isArray(data.ingredients)) {
    throw new Error(data.error || 'Failed to parse ingredients');
  }

  return targets.map((target, index) => ({
    ...target,
    parsed: data.ingredients[index],
  }));
};
