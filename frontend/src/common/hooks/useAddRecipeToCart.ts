import { useCallback } from 'react';
import { useAppSelector, useAppDispatch } from './index';
import { addShoppingItem } from '../../firebase/firestore';
import { ensureRecipeHasAiParsingAndUpdate, getEffectiveIngredientValues, getIngredientText } from '../aiParsing';
import type { RecipeWithAiMetadata } from '../aiParsing';

const FAMILY_ID = 'default-family';

const PANTRY_ITEMS = new Set([
  'water',
  'salt',
  'pepper',
  'black pepper',
]);

function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
}

function isPantryItem(ingredientName: string): boolean {
  return PANTRY_ITEMS.has(normalizeItemName(ingredientName));
}

export interface AddRecipeToCartResult {
  addedCount: number;
  skippedCount: number;
  totalCount: number;
}

export function useAddRecipeToCart() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.shopping?.items || []);

  const addRecipeToCart = useCallback(
    async (recipe: any): Promise<AddRecipeToCartResult> => {
      // Check Redux first — if all ingredients are already on the list, bail out early
      const existingRecipeItems = items.filter(
        (item) => item.sourceRecipeId === recipe.id
      );

      if (existingRecipeItems.length > 0) {
        const existingNames = new Set(
          existingRecipeItems.map((item) => normalizeItemName(item.name))
        );
        const allPresent = recipe.ingredients.every((ingredient: any) => {
          const name = ingredient.aiName || ingredient.name || ingredient.text || '';
          return isPantryItem(name) || existingNames.has(normalizeItemName(name));
        });

        if (allPresent) {
          return {
            addedCount: 0,
            skippedCount: recipe.ingredients.length,
            totalCount: recipe.ingredients.length,
          };
        }
      }

      const recipeWithMetadata = recipe as RecipeWithAiMetadata;
      const ingredientsToAdd = await ensureRecipeHasAiParsingAndUpdate(
        recipeWithMetadata,
        dispatch
      );

      const existingNames = new Set(
        existingRecipeItems.map((item) => normalizeItemName(item.name))
      );

      let addedCount = 0;
      let skippedCount = 0;

      for (const ingredient of ingredientsToAdd) {
        const { amount, unit, name } = getEffectiveIngredientValues(ingredient);
        const originalText = getIngredientText(ingredient);

        if (isPantryItem(name)) {
          skippedCount++;
          continue;
        }

        if (existingNames.has(normalizeItemName(name))) {
          skippedCount++;
          continue;
        }

        await addShoppingItem({
          familyId: FAMILY_ID,
          originalText,
          name,
          amount,
          unit,
          isChecked: false,
          tagIds: [],
          sourceRecipeId: recipe.id,
        });
        addedCount++;
      }

      return {
        addedCount,
        skippedCount,
        totalCount: ingredientsToAdd.length,
      };
    },
    [dispatch, items]
  );

  return addRecipeToCart;
}
