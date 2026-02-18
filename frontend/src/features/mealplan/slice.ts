import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { MealPlanItem } from '../../types';

interface MealPlanState {
  items: MealPlanItem[];
  /** IDs of optimistic items still being written to Firestore (not to be overwritten by subscription) */
  pendingOptimisticIds: string[];
  loading: boolean;
  error: string | null;
}

const initialState: MealPlanState = {
  items: [],
  pendingOptimisticIds: [],
  loading: true,
  error: null,
};

const mealPlanSlice = createSlice({
  name: 'mealplan',
  initialState,
  reducers: {
    setMealPlanItems: (state, action: PayloadAction<MealPlanItem[]>) => {
      state.items = action.payload;
      state.loading = false;
    },
    /** Merge Firestore snapshot with pending optimistic items so they persist until write completes */
    mergeMealPlanItemsFromFirestore: (state, action: PayloadAction<MealPlanItem[]>) => {
      const pendingItems = state.items.filter((i) =>
        state.pendingOptimisticIds.includes(i.id)
      );
      state.items = [...action.payload, ...pendingItems];
      state.loading = false;
    },
    addPendingOptimisticId: (state, action: PayloadAction<string>) => {
      if (!state.pendingOptimisticIds.includes(action.payload)) {
        state.pendingOptimisticIds.push(action.payload);
      }
    },
    removePendingOptimisticId: (state, action: PayloadAction<string>) => {
      state.pendingOptimisticIds = state.pendingOptimisticIds.filter(
        (id) => id !== action.payload
      );
    },
    addMealPlanItemToState: (state, action: PayloadAction<MealPlanItem>) => {
      state.items.push(action.payload);
    },
    updateMealPlanItemInState: (state, action: PayloadAction<MealPlanItem>) => {
      const index = state.items.findIndex((i) => i.id === action.payload.id);
      if (index !== -1) state.items[index] = action.payload;
    },
    removeMealPlanItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setMealPlanItems,
  mergeMealPlanItemsFromFirestore,
  addPendingOptimisticId,
  removePendingOptimisticId,
  addMealPlanItemToState,
  updateMealPlanItemInState,
  removeMealPlanItem,
  setLoading,
  setError,
} = mealPlanSlice.actions;

export default mealPlanSlice.reducer;
