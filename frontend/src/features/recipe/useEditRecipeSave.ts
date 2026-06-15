import { useState } from 'react';
import { useAppSelector, useAppDispatch, useNavigateWithDebug } from '../../common/hooks';
import { addRecipe, updateRecipeInState } from '../recipe-list/slice.ts';
import { addRecipe as saveRecipe, updateRecipe } from '../../firebase/firestore';
import { ensureRecipeHasAiParsingForSave } from '../../common/ingredient-parsing-api';
import { getIngredientText, sanitizeIngredientForSave } from '../../common/ingredient-sanitization';
import type { RecipeWithAiMetadata } from '../../common/recipe-ai-analysis';
import type { Ingredient, Recipe } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

interface RecipeSaveData {
  title: string;
  ingredients: Ingredient[];
  instructions: string[];
  userId?: string;
  isPublic?: boolean;
  sourceUrl?: string;
  description?: string;
  notes?: string;
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  category?: string[];
  cuisine?: string[];
  keywords?: string[];
  aiParsingStatus?: 'done' | 'required';
  lastAiParsingVersion?: number | null;
}

interface UseEditRecipeSaveParams {
  title: string;
  description: string;
  notes: string;
  imageUrl: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  category: string[];
  cuisine: string[];
  keywords: string[];
  ingredients: Ingredient[];
  instructions: string[];
  existingRecipe: RecipeWithAiMetadata | null;
  isNewRecipe: boolean;
  id: string | undefined;
  setIngredients: Dispatch<SetStateAction<Ingredient[]>>;
  setError: (error: string | null) => void;
}

export interface UseEditRecipeSaveReturn {
  handleSave: () => Promise<void>;
  isSaving: boolean;
}

export function useEditRecipeSave({
  title,
  description,
  notes,
  imageUrl,
  servings,
  prepTime,
  cookTime,
  category,
  cuisine,
  keywords,
  ingredients,
  instructions,
  existingRecipe,
  isNewRecipe,
  id,
  setIngredients,
  setError,
}: UseEditRecipeSaveParams): UseEditRecipeSaveReturn {
  const dispatch = useAppDispatch();
  const navigate = useNavigateWithDebug();
  const user = useAppSelector((state) => state.auth?.user);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (ingredients.filter((i) => getIngredientText(i)).length === 0) {
      setError('At least one ingredient is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const recipeData: RecipeSaveData = {
        title: title.trim(),
        ingredients: ingredients
          .filter((i) => getIngredientText(i))
          .map((ingredient) => sanitizeIngredientForSave(ingredient)),
        instructions: instructions.filter((i) => i.trim()),
      };

      const recipeForAnalysis: RecipeWithAiMetadata = {
        ...(existingRecipe || {
          id: 'new',
          userId: user!.uid,
          isPublic: true,
          createdAt: '',
          updatedAt: '',
          title: recipeData.title,
          instructions: recipeData.instructions,
        }),
        title: recipeData.title,
        instructions: recipeData.instructions,
        ingredients: recipeData.ingredients,
        lastAiParsingVersion: existingRecipe?.lastAiParsingVersion ?? null,
      };

      try {
        const aiParsingResult = await ensureRecipeHasAiParsingForSave(recipeForAnalysis);
        recipeData.ingredients = aiParsingResult.ingredients;
        if (aiParsingResult.aiParsingStatus) {
          recipeData.aiParsingStatus = aiParsingResult.aiParsingStatus;
        }
        if (aiParsingResult.lastAiParsingVersion !== undefined) {
          recipeData.lastAiParsingVersion = aiParsingResult.lastAiParsingVersion;
        }
        setIngredients(aiParsingResult.ingredients);
      } catch (aiError) {
        setError(`Failed to parse ingredients: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`);
        return;
      }

      if (description.trim()) recipeData.description = description.trim();
      if (notes.trim()) recipeData.notes = notes.trim();
      if (imageUrl.trim()) recipeData.imageUrl = imageUrl.trim();

      if (servings.trim()) {
        const n = parseInt(servings.trim(), 10);
        if (!isNaN(n) && n > 0) recipeData.servings = n;
      }
      if (prepTime.trim()) {
        const n = parseInt(prepTime.trim(), 10);
        if (!isNaN(n) && n > 0) recipeData.prepTime = n;
      }
      if (cookTime.trim()) {
        const n = parseInt(cookTime.trim(), 10);
        if (!isNaN(n) && n > 0) recipeData.cookTime = n;
      }

      const filteredCategory = category.filter(c => c.trim());
      if (filteredCategory.length > 0) recipeData.category = filteredCategory;
      const filteredCuisine = cuisine.filter(c => c.trim());
      if (filteredCuisine.length > 0) recipeData.cuisine = filteredCuisine;
      const filteredKeywords = keywords.filter(k => k.trim());
      if (filteredKeywords.length > 0) recipeData.keywords = filteredKeywords;

      // sourceUrl is only set by the backend scrape endpoint; preserve it on update
      if (!isNewRecipe && existingRecipe?.sourceUrl) {
        recipeData.sourceUrl = existingRecipe.sourceUrl;
      }

      if (!isNewRecipe && id) {
        await updateRecipe(id, recipeData);
        dispatch(updateRecipeInState({ ...existingRecipe!, ...recipeData, id }));
        navigate(`/recipe/${id}`);
      } else {
        recipeData.userId = user!.uid;
        recipeData.isPublic = true;
        const recipe = await saveRecipe(recipeData as Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>);
        dispatch(addRecipe(recipe));
        navigate(`/recipe/${recipe.id}`);
      }
    } catch (err) {
      setError('Failed to save recipe');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return { handleSave, isSaving };
}
