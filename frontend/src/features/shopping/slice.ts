import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ShoppingItem, Tag, ShoppingGroup } from '../../types';

// localStorage keys for persisted state
const STORAGE_KEY_VIEW_MODE = 'shopping_viewMode';
const STORAGE_KEY_TAG_IDS = 'shopping_selectedTagIds';

// Load persisted state from localStorage
const loadPersistedState = () => {
  try {
    const viewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
    const tagIds = localStorage.getItem(STORAGE_KEY_TAG_IDS);
    return {
      viewMode: (viewMode === 'simple' || viewMode === 'recipe-grouped') ? viewMode : 'simple',
      selectedTagIds: tagIds ? JSON.parse(tagIds) : [],
    };
  } catch {
    return { viewMode: 'simple' as const, selectedTagIds: [] };
  }
};

const persisted = loadPersistedState();

interface ShoppingState {
  items: ShoppingItem[];
  tags: Tag[];
  groups: ShoppingGroup[];
  loading: boolean;
  error: string | null;
  viewMode: 'simple' | 'recipe-grouped';
  selectedTagIds: string[];
}

const initialState: ShoppingState = {
  items: [],
  tags: [],
  groups: [],
  loading: true,
  error: null,
  viewMode: persisted.viewMode,
  selectedTagIds: persisted.selectedTagIds,
};

const shoppingSlice = createSlice({
  name: 'shopping',
  initialState,
  reducers: {
    setShoppingItems: (state, action: PayloadAction<ShoppingItem[]>) => {
      state.items = action.payload;
      state.loading = false;
    },
    setTags: (state, action: PayloadAction<Tag[]>) => {
      state.tags = action.payload;
    },
    setShoppingGroups: (state, action: PayloadAction<ShoppingGroup[]>) => {
      state.groups = action.payload;
    },
    addShoppingGroupToState: (state, action: PayloadAction<ShoppingGroup>) => {
      state.groups.push(action.payload);
    },
    updateShoppingGroupInState: (state, action: PayloadAction<ShoppingGroup>) => {
      const index = state.groups.findIndex((g) => g.id === action.payload.id);
      if (index !== -1) state.groups[index] = action.payload;
    },
    removeShoppingGroup: (state, action: PayloadAction<string>) => {
      state.groups = state.groups.filter((g) => g.id !== action.payload);
    },
    addShoppingItemToState: (state, action: PayloadAction<ShoppingItem>) => {
      state.items.push(action.payload);
    },
    updateShoppingItemInState: (state, action: PayloadAction<ShoppingItem>) => {
      const index = state.items.findIndex((i) => i.id === action.payload.id);
      if (index !== -1) state.items[index] = action.payload;
    },
    removeShoppingItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    removeShoppingItems: (state, action: PayloadAction<string[]>) => {
      const idsToRemove = new Set(action.payload);
      state.items = state.items.filter((i) => !idsToRemove.has(i.id));
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    setViewMode: (state, action: PayloadAction<'simple' | 'recipe-grouped'>) => {
      state.viewMode = action.payload;
      try {
        localStorage.setItem(STORAGE_KEY_VIEW_MODE, action.payload);
      } catch {
        // Ignore localStorage errors
      }
    },
    setSelectedTagIds: (state, action: PayloadAction<string[]>) => {
      state.selectedTagIds = action.payload;
      try {
        localStorage.setItem(STORAGE_KEY_TAG_IDS, JSON.stringify(action.payload));
      } catch {
        // Ignore localStorage errors
      }
    },
  },
});

export const {
  setShoppingItems,
  setTags,
  setShoppingGroups,
  addShoppingGroupToState,
  updateShoppingGroupInState,
  removeShoppingGroup,
  addShoppingItemToState,
  updateShoppingItemInState,
  removeShoppingItem,
  removeShoppingItems,
  setLoading,
  setError,
  setViewMode,
  setSelectedTagIds,
} = shoppingSlice.actions;

export default shoppingSlice.reducer;
