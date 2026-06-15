import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../common/store';
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
      viewMode: ((viewMode === 'simple' || viewMode === 'recipe-grouped') ? viewMode : 'simple') as 'simple' | 'recipe-grouped',
      selectedTagIds: tagIds ? JSON.parse(tagIds) : [],
    };
  } catch {
    return { viewMode: 'simple' as const, selectedTagIds: [] };
  }
};

const persisted = loadPersistedState();

interface ShoppingState {
  items: ShoppingItem[];
  /** IDs of optimistic items still being written to Firestore (not to be overwritten by subscription) */
  pendingOptimisticIds: string[];
  tags: Tag[];
  groups: ShoppingGroup[];
  loading: boolean;
  error: string | null;
  viewMode: 'simple' | 'recipe-grouped';
  selectedTagIds: string[];
}

const initialState: ShoppingState = {
  items: [],
  pendingOptimisticIds: [],
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
    /** Merge Firestore snapshot with pending optimistic items so they persist until write completes.
     *  When an incoming Firestore item's normalized name+unit matches a pending optimistic item,
     *  the optimistic item is considered resolved and dropped — preventing a duplicate during the
     *  window between Firestore's local-cache onSnapshot and the addDoc Promise resolving. */
    mergeShoppingItemsFromFirestore: (state, action: PayloadAction<ShoppingItem[]>) => {
      const firestoreItems = action.payload;

      // Build combining key (same logic as getItemKey in shopping-utils): normalized name + unit
      const makeKey = (item: ShoppingItem): string | null => {
        const name = item.name?.toLowerCase().trim();
        if (!name) return null;
        return `${name}:${item.unit ?? ''}`;
      };

      // Count available Firestore items per name+unit key so we can match 1-to-1
      const firestoreKeyCounts = new Map<string, number>();
      for (const fi of firestoreItems) {
        const key = makeKey(fi);
        if (key) firestoreKeyCounts.set(key, (firestoreKeyCounts.get(key) ?? 0) + 1);
      }

      const resolvedOptimisticIds = new Set<string>();
      for (const item of state.items) {
        if (!state.pendingOptimisticIds.includes(item.id)) continue;
        const key = makeKey(item);
        const available = key ? (firestoreKeyCounts.get(key) ?? 0) : 0;
        if (available > 0) {
          resolvedOptimisticIds.add(item.id);
          if (key) firestoreKeyCounts.set(key, available - 1);
        }
      }

      if (resolvedOptimisticIds.size > 0) {
        state.pendingOptimisticIds = state.pendingOptimisticIds.filter(
          (id) => !resolvedOptimisticIds.has(id)
        );
      }

      const stillPendingItems = state.items.filter(
        (i) => state.pendingOptimisticIds.includes(i.id)
      );
      state.items = [...firestoreItems, ...stillPendingItems];
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
  mergeShoppingItemsFromFirestore,
  addPendingOptimisticId,
  removePendingOptimisticId,
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

const selectShoppingState = (state: RootState) => state.shopping;

export const selectShoppingItems = createSelector(
  selectShoppingState,
  (shopping) => shopping?.items ?? []
);

export const selectShoppingTags = createSelector(
  selectShoppingState,
  (shopping) => shopping?.tags ?? []
);

export const selectShoppingGroups = createSelector(
  selectShoppingState,
  (shopping) => shopping?.groups ?? []
);

export const selectShoppingLoading = createSelector(
  selectShoppingState,
  (shopping) => shopping?.loading ?? true
);

export const selectShoppingViewMode = createSelector(
  selectShoppingState,
  (shopping) => shopping?.viewMode ?? 'simple'
);

export const selectShoppingSelectedTagIds = createSelector(
  selectShoppingState,
  (shopping) => shopping?.selectedTagIds ?? []
);
