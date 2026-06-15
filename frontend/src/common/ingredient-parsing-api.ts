import type { Ingredient } from '../types';
import { AI_PARSING_VERSION } from '../../../shared/aiPrompt.js';
import { getIdToken } from '../firebase/auth';
import {
  computeAiParsingStatus,
  getEffectiveIngredientValues,
  mergeParsedIngredients,
} from './ingredient-sanitization';
import {
  analyzeRecipeForAiParsing,
  collectBatchParsingTargets,
} from './recipe-ai-analysis';
import type { RecipeWithAiMetadata } from './recipe-ai-analysis';

/**
 * Parses a single ingredient text via the backend API.
 *
 * The /parse-ingredients endpoint runs:
 * 1. Regex parsing (parseIngredientTextForApi) - extracts amount, unit, name
 * 2. AI enrichment (enrichIngredientsWithAI) - improves/extends the parsed fields
 *
 * Used when adding or editing shopping items so amount/unit/name come from parsing,
 * not raw text. The display always uses originalText (what the user typed).
 *
 * On parse failure: caller should leave amount/unit/name blank. Retry behavior is TBD.
 */
export const parseShoppingItemText = async (
  text: string
): Promise<{ amount: number | null; unit: string | null; name: string }> => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { amount: null, unit: null, name: '' };
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${apiUrl}/parse-ingredients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ ingredientTexts: [trimmed] }),
  });

  const data = await response.json();
  if (!response.ok || data.status !== 'ok' || !Array.isArray(data.ingredients)) {
    throw new Error(data.error || 'Failed to parse ingredient');
  }

  const parsed = data.ingredients[0] as Ingredient;
  const { amount, unit, name } = getEffectiveIngredientValues(parsed);
  return {
    amount,
    unit,
    name: name?.trim() ?? '',
  };
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

export const ensureRecipeHasAiParsing = async (
  recipe: RecipeWithAiMetadata,
  currentVersion: number = AI_PARSING_VERSION
): Promise<{ ingredients: Ingredient[]; needsUpdate: boolean }> => {
  const analysis = analyzeRecipeForAiParsing(recipe, currentVersion);

  if (analysis.aiParsingStatus === 'done' || analysis.indicesToParse.length === 0) {
    return { ingredients: recipe.ingredients, needsUpdate: false };
  }

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const token = await getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const ingredientTexts = analysis.indicesToParse.map(
      (index) => recipe.ingredients[index].originalText?.trim() || recipe.ingredients[index].name.trim()
    );

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

    const updatedIngredients = mergeParsedIngredients(
      recipe.ingredients,
      analysis.indicesToParse,
      data.ingredients
    );

    return { ingredients: updatedIngredients, needsUpdate: true };
  } catch (error) {
    console.warn('AI parsing failed, using existing ingredient data:', error);
    return { ingredients: recipe.ingredients, needsUpdate: false };
  }
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
    const aiParsingStatus = computeAiParsingStatus(ingredients);
    return {
      ingredients,
      aiParsingStatus,
      lastAiParsingVersion: aiParsingStatus === 'done' ? currentVersion : null,
    };
  }

  return {
    ingredients: recipe.ingredients,
    ...(recipe.aiParsingStatus ? { aiParsingStatus: recipe.aiParsingStatus } : {}),
    ...(recipe.lastAiParsingVersion !== undefined ? { lastAiParsingVersion: recipe.lastAiParsingVersion ?? null } : {}),
  };
};
