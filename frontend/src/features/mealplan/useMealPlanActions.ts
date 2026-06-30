import { useCallback } from 'react';
import { useAppDispatch } from '../../common/hooks';
import {
  addMealPlanItem,
  updateMealPlanItem,
  deleteMealPlanItem,
} from '../../firebase/firestore';
import {
  addMealPlanItemToState,
  addPendingOptimisticId,
  removePendingOptimisticId,
  removeMealPlanItem,
} from './slice';
import type { MealPlanItem, Recipe } from '../../types';
import { IDEAS_KEY, nextSortOrder } from './mealplan-utils';

const FAMILY_ID = 'default-family';

function buildOptimisticItem(
  base: Omit<MealPlanItem, 'id' | 'familyId' | 'createdAt' | 'updatedAt'>,
  optimisticId: string,
  now: string,
): MealPlanItem {
  return {
    id: optimisticId,
    familyId: FAMILY_ID,
    createdAt: now,
    updatedAt: now,
    ...base,
  };
}

export function useMealPlanActions(itemsByDate: Map<string, MealPlanItem[]>) {
  const dispatch = useAppDispatch();

  const handleSaveNote = useCallback(
    (text: string, dateKey: string) => {
      if (!text || !dateKey) return;

      const sortOrder = nextSortOrder(itemsByDate, dateKey);
      const optimisticId = `opt-${Date.now()}`;
      const now = new Date().toISOString();

      dispatch(addMealPlanItemToState(
        buildOptimisticItem(
          { type: 'note', text, date: dateKey === IDEAS_KEY ? null : dateKey, sortOrder },
          optimisticId,
          now,
        )
      ));
      dispatch(addPendingOptimisticId(optimisticId));

      addMealPlanItem({
        familyId: FAMILY_ID,
        type: 'note',
        text,
        date: dateKey === IDEAS_KEY ? null : dateKey,
        sortOrder,
      }).then(() => {
        dispatch(removePendingOptimisticId(optimisticId));
        dispatch(removeMealPlanItem(optimisticId));
      }).catch((error) => {
        console.error('Error adding note:', error);
      });
    },
    [itemsByDate, dispatch],
  );

  const handleAddRecipe = useCallback(
    (recipe: Recipe, dateKey: string) => {
      const sortOrder = nextSortOrder(itemsByDate, dateKey);
      const optimisticId = `opt-${Date.now()}`;
      const now = new Date().toISOString();

      dispatch(addMealPlanItemToState(
        buildOptimisticItem(
          {
            type: 'recipe',
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            date: dateKey === IDEAS_KEY ? null : dateKey,
            sortOrder,
          },
          optimisticId,
          now,
        )
      ));
      dispatch(addPendingOptimisticId(optimisticId));

      addMealPlanItem({
        familyId: FAMILY_ID,
        type: 'recipe',
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        date: dateKey === IDEAS_KEY ? null : dateKey,
        sortOrder,
      }).then(() => {
        dispatch(removePendingOptimisticId(optimisticId));
        dispatch(removeMealPlanItem(optimisticId));
      }).catch((error) => {
        console.error('Error adding recipe:', error);
      });
    },
    [itemsByDate, dispatch],
  );

  const handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      await deleteMealPlanItem(itemId);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }, []);

  const handleNoteSave = useCallback(async (itemId: string, text: string) => {
    try {
      await updateMealPlanItem(itemId, { text });
    } catch (error) {
      console.error('Error updating note:', error);
    }
  }, []);

  return { handleSaveNote, handleAddRecipe, handleDeleteItem, handleNoteSave };
}
