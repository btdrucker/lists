import type { AiParsingMetadata, Ingredient, Recipe } from '../types';
import { AI_PARSING_VERSION } from '../../../shared/aiPrompt.js';
import { getIngredientText, hasMissingAiFields } from './ingredient-sanitization';

export type RecipeWithAiMetadata = Recipe & AiParsingMetadata;

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
