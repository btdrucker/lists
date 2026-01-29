import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { setRecipes, setLoading, removeRecipe } from './slice.ts';
import { clearAuth } from '../auth/slice';
import { getAllRecipes, deleteRecipe } from '../../firebase/firestore';
import { signOut } from '../../firebase/auth';
import { InstallButton } from '../../common/components/InstallButton';
import RecipeStart from '../recipe/RecipeStart';
import RecipeListItem from './RecipeListItem';
import RecipeListItemCompact from './RecipeListItemCompact';
import styles from './recipe-list.module.css';

// Toggle between RecipeListItem and RecipeListItemCompact
const ItemComponent = RecipeListItemCompact;

const RecipeList = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { recipes, loading } = useAppSelector((state) => state.recipes || { recipes: [], loading: false, error: null });
  const user = useAppSelector((state) => state.auth?.user);
  const hasLoadedRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);

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

  // Filter recipes based on search query (client-side)
  const filteredRecipes = recipes.filter((recipe: any) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    // Search in title
    if (recipe.title.toLowerCase().includes(query)) {
      return true;
    }

    // Search in ingredient names
    const matchesIngredient = recipe.ingredients.some((ingredient: any) =>
      ingredient.name.toLowerCase().includes(query)
    );
    if (matchesIngredient) {
      return true;
    }

    // Search in category
    if (recipe.category && recipe.category.length > 0) {
      const matchesCategory = recipe.category.some((cat: string) =>
        cat.toLowerCase().includes(query)
      );
      if (matchesCategory) {
        return true;
      }
    }

    // Search in cuisine
    if (recipe.cuisine && recipe.cuisine.length > 0) {
      const matchesCuisine = recipe.cuisine.some((cui: string) =>
        cui.toLowerCase().includes(query)
      );
      if (matchesCuisine) {
        return true;
      }
    }

    // Search in keywords
    if (recipe.keywords && recipe.keywords.length > 0) {
      const matchesKeyword = recipe.keywords.some((keyword: string) =>
        keyword.toLowerCase().includes(query)
      );
      if (matchesKeyword) {
        return true;
      }
    }

    return false;
  });

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
      <div className={styles.stickyHeader}>
        <header className={styles.header}>
          <h1>My Recipes</h1>
          <div className={styles.headerButtons}>
            <InstallButton />
            
            {/* Desktop: Plus button */}
            <button
              className={styles.addButtonDesktop}
              onClick={() => setShowAddRecipe(true)}
              title="Add Recipe"
            >
              <i className="fa-solid fa-plus" />
            </button>

            {/* Mobile: Menu */}
            <div className={styles.menuContainer}>
              <button
                className={styles.menuButton}
                onClick={() => setShowMenu(!showMenu)}
                aria-label="Menu"
              >
                <i className="fa-solid fa-ellipsis-vertical" />
              </button>
              {showMenu && (
                <div className={styles.menuDropdown}>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      setShowAddRecipe(true);
                      setShowMenu(false);
                    }}
                  >
                    <i className="fa-solid fa-plus" /> Add Recipe
                  </button>
                  <div className={styles.menuDivider} />
                  <button
                    className={styles.menuItem}
                    onClick={async () => {
                      try {
                        await handleSignOut();
                        setShowMenu(false);
                      } catch (error) {
                        console.error('Error signing out:', error);
                      }
                    }}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.searchSection}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes, ingredients, category, cuisine, or keywords..."
            className={styles.searchInput}
          />
        </div>
      </div>

      {filteredRecipes.length === 0 ? (
        <div className={styles.empty}>
          {searchQuery ? (
            <>
              <p>No recipes found</p>
              <p>Try a different search term</p>
            </>
          ) : (
            <>
              <p>No recipes yet!</p>
              <p>Click "Add Recipe" to get started.</p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredRecipes.map((recipe: any) => (
            <ItemComponent
              key={recipe.id}
              recipe={recipe}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <footer className={styles.footer}>
        <p>Logged in as {user?.email}</p>
      </footer>

      {/* Backdrop for menu */}
      {showMenu && (
        <div
          className={styles.menuBackdrop}
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Add Recipe Modal */}
      {showAddRecipe && (
        <RecipeStart
          isModal={true}
          onClose={() => setShowAddRecipe(false)}
        />
      )}
    </div>
  );
};

export default RecipeList;
