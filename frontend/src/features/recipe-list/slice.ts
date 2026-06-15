import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../common/store';
import type { Recipe } from '../../types';
import { getAllRecipes, getRecipesByUserId } from '../../firebase/firestore';

export const loadAllRecipes = createAsyncThunk<Recipe[]>(
  'recipes/loadAll',
  async () => getAllRecipes(),
);

export const loadRecipesByUser = createAsyncThunk<Recipe[], string>(
  'recipes/loadByUser',
  async (userId) => getRecipesByUserId(userId),
);

interface RecipesState {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
}

const initialState: RecipesState = {
  recipes: [],
  loading: false,
  error: null,
};

const recipesSlice = createSlice({
  name: 'recipes',
  initialState,
  extraReducers: (builder) => {
    const handlePending = (state: RecipesState) => {
      state.loading = true;
      state.error = null;
    };
    const handleFulfilled = (state: RecipesState, action: { payload: Recipe[] }) => {
      state.recipes = action.payload;
      state.loading = false;
      state.error = null;
    };
    const handleRejected = (state: RecipesState, action: { error: { message?: string } }) => {
      state.loading = false;
      state.error = action.error.message ?? 'Failed to load recipes';
    };

    builder
      .addCase(loadAllRecipes.pending, handlePending)
      .addCase(loadAllRecipes.fulfilled, handleFulfilled)
      .addCase(loadAllRecipes.rejected, handleRejected)
      .addCase(loadRecipesByUser.pending, handlePending)
      .addCase(loadRecipesByUser.fulfilled, handleFulfilled)
      .addCase(loadRecipesByUser.rejected, handleRejected);
  },
  reducers: {
    setRecipes: (state, action: PayloadAction<Recipe[]>) => {
      state.recipes = action.payload;
      state.loading = false;
      state.error = null;
    },
    addRecipe: (state, action: PayloadAction<Recipe>) => {
      state.recipes.push(action.payload);
    },
    updateRecipeInState: (state, action: PayloadAction<Recipe>) => {
      const index = state.recipes.findIndex((r) => r.id === action.payload.id);
      if (index !== -1) {
        state.recipes[index] = action.payload;
      }
    },
    removeRecipe: (state, action: PayloadAction<string>) => {
      state.recipes = state.recipes.filter((r) => r.id !== action.payload);
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
  setRecipes,
  addRecipe,
  updateRecipeInState,
  removeRecipe,
  setLoading,
  setError,
} = recipesSlice.actions;

export default recipesSlice.reducer;

const selectRecipesState = (state: RootState) => state.recipes;

export const selectRecipes = createSelector(
  selectRecipesState,
  (recipes) => recipes?.recipes ?? [],
);

export const selectRecipesLoading = createSelector(
  selectRecipesState,
  (recipes) => recipes?.loading ?? false,
);

export const selectRecipesError = createSelector(
  selectRecipesState,
  (recipes) => recipes?.error ?? null,
);

export const selectRecipeById = (id: string | undefined) =>
  createSelector(selectRecipes, (recipes) =>
    id ? (recipes.find((r) => r.id === id) ?? null) : null,
  );
