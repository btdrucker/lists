import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../common/store';
import type { Recipe } from '../../types';
import { getAllRecipes, getRecipesByUserId, updateRecipe } from '../../firebase/firestore';
import { ensureRecipeHasAiParsing } from '../../common/ingredient-parsing-api';
import { AI_PARSING_VERSION } from '../../../../shared/aiPrompt.js';
import type { RecipeWithAiMetadata } from '../../common/recipe-ai-analysis';

export const loadAllRecipes = createAsyncThunk<Recipe[]>(
  'recipes/loadAll',
  async () => getAllRecipes(),
);

export const loadRecipesByUser = createAsyncThunk<Recipe[], string>(
  'recipes/loadByUser',
  async (userId) => getRecipesByUserId(userId),
);

/**
 * Ensures a recipe has up-to-date AI-parsed ingredients.
 * Runs the parse-ingredients API if needed, then writes back to Firestore and Redux.
 * Returns the recipe with updated ingredients (unchanged if already current).
 */
export const ensureRecipeAiParsing = createAsyncThunk<RecipeWithAiMetadata, RecipeWithAiMetadata>(
  'recipes/ensureAiParsing',
  async (recipe, { dispatch }) => {
    const { ingredients, needsUpdate } = await ensureRecipeHasAiParsing(recipe);

    if (!needsUpdate) {
      return recipe;
    }

    const updatedRecipe: RecipeWithAiMetadata = {
      ...recipe,
      ingredients,
      lastAiParsingVersion: AI_PARSING_VERSION,
      aiParsingStatus: 'done',
    };

    await updateRecipe(recipe.id, updatedRecipe);
    dispatch(updateRecipeInState(updatedRecipe));
    return updatedRecipe;
  }
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
