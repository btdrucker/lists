import { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../../common/hooks';
import type { Recipe } from '../../types';
import Dialog from '../../common/components/Dialog';
import styles from './mealplan.module.css';

interface AddRecipeDialogProps {
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
}

const AddRecipeDialog = ({ onSelect, onClose }: AddRecipeDialogProps) => {
  const { recipes } = useAppSelector((state) => state.recipes || { recipes: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredRecipes = recipes.filter((recipe: Recipe) => {
    if (!searchQuery.trim()) return true;
    return recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog isOpen={true} title="Add Recipe" onClose={onClose} maxWidth="md">
      <div className={styles.dialogSearch}>
        <input
          ref={searchInputRef}
          className={styles.dialogSearchInput}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search recipes..."
        />
      </div>

      <div className={styles.dialogList}>
        {filteredRecipes.length === 0 ? (
          <div className={styles.dialogEmpty}>
            {searchQuery ? 'No recipes found' : 'No recipes available'}
          </div>
        ) : (
          filteredRecipes.map((recipe: Recipe) => (
            <button
              key={recipe.id}
              className={styles.dialogRecipeItem}
              onClick={() => onSelect(recipe)}
              type="button"
            >
              <i className={`fa-solid fa-utensils ${styles.dialogRecipeIcon}`} />
              <span className={styles.dialogRecipeTitle}>{recipe.title}</span>
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
};

export default AddRecipeDialog;
