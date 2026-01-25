import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ShoppingItem, Store } from '../../types';

interface ShoppingState {
  items: ShoppingItem[];
  stores: Store[];
  loading: boolean;
  error: string | null;
}

const initialState: ShoppingState = {
  items: [],
  stores: [],
  loading: true,
  error: null,
};

const shoppingSlice = createSlice({
  name: 'shopping',
  initialState,
  reducers: {
    setShoppingItems: (state, action: PayloadAction<ShoppingItem[]>) => {
      state.items = action.payload;
      state.loading = false;
    },
    setStores: (state, action: PayloadAction<Store[]>) => {
      state.stores = action.payload;
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
  },
});

export const {
  setShoppingItems,
  setStores,
  addShoppingItemToState,
  updateShoppingItemInState,
  removeShoppingItem,
  removeShoppingItems,
  setLoading,
  setError,
} = shoppingSlice.actions;

export default shoppingSlice.reducer;
