import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import store, { persistor } from './common/store';
import { useAppDispatch, useAppSelector } from './common/hooks';
import { setUser } from './features/auth/slice';
import { onAuthStateChange } from './firebase/auth';
import AuthScreen from './features/auth/AuthScreen';
import RecipeList from './features/recipe-list/RecipeList';
import ViewRecipe from './features/recipe/ViewRecipe';
import RecipeStart from './features/recipe/RecipeStart';
import Recipe from './features/recipe/Recipe';

function AppContent() {
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector((state) => state.auth || { user: null, loading: true, error: null });

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      dispatch(setUser(firebaseUser));
    });

    return () => unsubscribe();
  }, [dispatch]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {!user ? (
          <>
            <Route path="/auth" element={<AuthScreen />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </>
        ) : (
          <>
            <Route path="/recipe-list" element={<RecipeList />} />
            <Route path="/recipe/:id" element={<ViewRecipe />} />
            <Route path="/recipe-start" element={<RecipeStart />} />
            <Route path="/edit-recipe/:id" element={<Recipe />} />
            <Route path="/" element={<Navigate to="/recipe-list" replace />} />
            <Route path="*" element={<Navigate to="/recipe-list" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppContent />
      </PersistGate>
    </Provider>
  );
}

export default App;
