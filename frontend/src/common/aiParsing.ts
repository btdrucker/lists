import type { AiParsingMetadata, Ingredient, Recipe } from '../types';
import { AI_PARSING_VERSION } from '../../../shared/aiPrompt.js';
import { getIdToken } from '../firebase/auth';
import { updateRecipe } from '../firebase/firestore';
import type { Dispatch } from '@reduxjs/toolkit';
import { updateRecipeInState } from '../features/recipe-list/slice';

export type RecipeWithAiMetadata = Recipe & AiParsingMetadata;

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

/**
 * Ensures a recipe has AI-parsed ingredients, running AI parsing if needed.
 * Returns updated ingredients with AI data merged.
 * Handles authentication and API URL internally.
 * 
 * @param recipe - The recipe to check and potentially parse
 * @param currentVersion - Current AI parsing version (defaults to AI_PARSING_VERSION)
 * @returns Updated ingredients array with AI parsing applied, or original if parsing fails/not needed
 * @throws Error if authentication fails or API call fails
 */
export const ensureRecipeHasAiParsing = async (
  recipe: RecipeWithAiMetadata,
  currentVersion: number = AI_PARSING_VERSION
): Promise<{ ingredients: Ingredient[]; needsUpdate: boolean }> => {
  const analysis = analyzeRecipeForAiParsing(recipe, currentVersion);
  
  // If no AI parsing needed, return original ingredients
  if (analysis.aiParsingStatus === 'done' || analysis.indicesToParse.length === 0) {
    return { ingredients: recipe.ingredients, needsUpdate: false };
  }
  
  try {
    // Get API URL and auth token
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const token = await getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Get ingredient texts that need parsing
    const ingredientTexts = analysis.indicesToParse.map(
      (index) => getIngredientText(recipe.ingredients[index])
    );
    
    // Call AI parsing endpoint
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
    
    if (data.ingredients.length !== ingredientTexts.length) {
      throw new Error('Ingredient count mismatch from AI parsing');
    }
    
    // Merge parsed results back into ingredients
    const updatedIngredients = mergeParsedIngredients(
      recipe.ingredients,
      analysis.indicesToParse,
      data.ingredients
    );
    
    return { ingredients: updatedIngredients, needsUpdate: true };
  } catch (error) {
    console.warn('AI parsing failed, using existing ingredient data:', error);
    // Return original ingredients if AI parsing fails
    return { ingredients: recipe.ingredients, needsUpdate: false };
  }
};

/**
 * Ensures a recipe has AI-parsed ingredients and automatically updates Firestore + Redux if parsing was performed.
 * This is a convenience wrapper around ensureRecipeHasAiParsing that handles the full update flow.
 * 
 * @param recipe - The recipe to check and potentially parse
 * @param dispatch - Redux dispatch function for updating state
 * @param currentVersion - Current AI parsing version (defaults to AI_PARSING_VERSION)
 * @returns Ingredients array with AI parsing applied (suitable for immediate use)
 */
export const ensureRecipeHasAiParsingAndUpdate = async (
  recipe: RecipeWithAiMetadata,
  dispatch: Dispatch,
  currentVersion: number = AI_PARSING_VERSION
): Promise<Ingredient[]> => {
  const { ingredients, needsUpdate } = await ensureRecipeHasAiParsing(recipe, currentVersion);
  
  // If AI parsing was performed, update the recipe in Firestore and Redux
  if (needsUpdate) {
    const updatedRecipe = {
      ...recipe,
      ingredients,
      lastAiParsingVersion: currentVersion,
      aiParsingStatus: 'done' as const,
    };
    
    await updateRecipe(recipe.id, updatedRecipe);
    dispatch(updateRecipeInState(updatedRecipe));
  }
  
  return ingredients;
};

/**
 * Ensures a recipe has AI-parsed ingredients and returns the updated recipe data ready for saving.
 * This is useful when building a recipe object before saving (e.g., in a form).
 * 
 * @param recipe - The recipe to check and potentially parse
 * @param currentVersion - Current AI parsing version (defaults to AI_PARSING_VERSION)
 * @returns Object with parsed ingredients and AI metadata fields to merge into recipe data
 */
export const ensureRecipeHasAiParsingForSave = async (
  recipe: RecipeWithAiMetadata,
  currentVersion: number = AI_PARSING_VERSION
): Promise<{
  ingredients: Ingredient[];
  aiParsingStatus?: 'done' | 'required';
  lastAiParsingVersion?: number | null;
}> => {
  const { ingredients, needsUpdate } = await ensureRecipeHasAiParsing(recipe, currentVersion);
  
  if (needsUpdate) {
    // AI parsing was performed, return updated ingredients with metadata
    const aiParsingStatus = computeAiParsingStatus(ingredients);
    return {
      ingredients,
      aiParsingStatus,
      lastAiParsingVersion: aiParsingStatus === 'done' ? currentVersion : null,
    };
  }
  
  // No AI parsing needed, return original ingredients and preserve existing metadata
  return {
    ingredients: recipe.ingredients,
    ...(recipe.aiParsingStatus ? { aiParsingStatus: recipe.aiParsingStatus } : {}),
    ...(recipe.lastAiParsingVersion !== undefined ? { lastAiParsingVersion: recipe.lastAiParsingVersion ?? null } : {}),
  };
};
