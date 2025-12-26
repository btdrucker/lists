import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore, createTransform } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from '../features/auth/slice';
import recipesReducer from './slices/recipes';

const rootReducer = combineReducers({
  auth: authReducer,
  recipes: recipesReducer,
});

// Transform to exclude loading and error states from persistence
const recipesTransform = createTransform(
  // transform state on its way to being serialized and persisted
  (inboundState: any) => {
    return {
      ...inboundState,
      loading: false, // Never persist loading state
      error: null, // Never persist error state
    };
  },
  // transform state being rehydrated
  (outboundState: any) => {
    return {
      ...outboundState,
      loading: false, // Always start with loading false on rehydration
      error: null,
    };
  },
  { whitelist: ['recipes'] }
);

// Persist configuration - cache recipes to avoid redundant Firestore reads
const persistConfig = {
  key: 'root',
  storage,
  version: 1,
  // Persist recipes to reduce Firestore reads and improve load times
  whitelist: ['recipes'],
  transforms: [recipesTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these actions because they contain non-serializable values
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'auth/setUser', // Firebase User is converted to SerializableUser in the reducer
        ],
      },
    }),
});

export default store;

export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

