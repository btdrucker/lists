import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { MealPlanItem } from '../../types';

interface MealPlanState {
  items: MealPlanItem[];
  loading: boolean;
  error: string | null;
}

const initialState: MealPlanState = {
  items: [],
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
  addMealPlanItemToState,
  updateMealPlanItemInState,
  removeMealPlanItem,
  setLoading,
  setError,
} = mealPlanSlice.actions;

export default mealPlanSlice.reducer;
