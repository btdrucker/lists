import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { setRecipes, setLoading, removeRecipe } from '../../common/slices/recipes';
import { clearAuth } from '../auth/slice';
import { getAllRecipes, deleteRecipe } from '../../firebase/firestore';
import { signOut } from '../../firebase/auth';
import styles from './recipe-list.module.css';

const RecipeList = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { recipes, loading } = useAppSelector((state) => state.recipes || { recipes: [], loading: false, error: null });
  const user = useAppSelector((state) => state.auth?.user);
  const hasLoadedRef = useRef(false);

  const handleSignOut = async () => {
    await signOut();
    dispatch(clearAuth());
  };

  const handleDelete = async (recipeId: string, recipeTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation
    
    const confirmed = window.confirm(`Are you sure you want to delete "${recipeTitle}"?`);
    if (!confirmed) return;

    try {
      await deleteRecipe(recipeId);
      dispatch(removeRecipe(recipeId));
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Failed to delete recipe');
    }
  };

  useEffect(() => {
    const loadRecipes = async () => {
      // Only load once on mount
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        dispatch(setLoading(true));
        try {
          const allRecipes = await getAllRecipes();
          dispatch(setRecipes(allRecipes));
        } catch (error) {
          console.error('Error loading recipes:', error);
          dispatch(setLoading(false));
        }
      }
    };

    loadRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  if (loading && recipes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading recipes...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>My Recipes</h1>
        <div className={styles.headerButtons}>
          <button
            onClick={() => navigate('/recipe/new')}
            className={styles.addButton}
          >
            + Add Recipe
          </button>
          <button
            onClick={handleSignOut}
            className={styles.signOutButton}
          >
            Sign Out
          </button>
        </div>
      </header>

      {recipes.length === 0 ? (
        <div className={styles.empty}>
          <p>No recipes yet!</p>
          <p>Click "Add Recipe" to get started.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {recipes.map((recipe: any) => (
            <div 
              key={recipe.id} 
              className={styles.card}
              onClick={() => navigate(`/recipe/${recipe.id}`)}
            >
              <button
                className={styles.deleteButton}
                onClick={(e) => handleDelete(recipe.id, recipe.title, e)}
                title="Delete recipe"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
              {recipe.imageUrl && (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className={styles.image}
                />
              )}
              <div className={styles.content}>
                <h3 className={styles.title}>{recipe.title}</h3>
                {recipe.description && (
                  <p className={styles.description}>{recipe.description}</p>
                )}
                <div className={styles.meta}>
                  <span>{recipe.ingredients.length} ingredients</span>
                  <span>•</span>
                  <span>{recipe.instructions.length} steps</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className={styles.footer}>
        <p>Logged in as {user?.email}</p>
      </footer>
    </div>
  );
};

export default RecipeList;

