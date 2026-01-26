import { useState, useMemo, useCallback } from 'react';
import { useAppSelector } from '../hooks';
import Dialog from './Dialog';
import styles from './recipePicker.module.css';

interface RecipePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipeIds: string[]) => void;
}

const RecipePicker = ({ isOpen, onClose, onSelect }: RecipePickerProps) => {
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset state and close
  const handleClose = useCallback(() => {
    setSearchTerm('');
    setSelectedId(null);
    onClose();
  }, [onClose]);

  // Filter recipes by search term
  const filteredRecipes = useMemo(() => {
    if (!searchTerm.trim()) return recipes;
    const term = searchTerm.toLowerCase();
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term)
    );
  }, [recipes, searchTerm]);

  // Handle recipe selection - highlight briefly then add
  const handleSelect = useCallback((recipeId: string) => {
    setSelectedId(recipeId);
    // Brief highlight then add and close
    setTimeout(() => {
      onSelect([recipeId]);
      handleClose();
    }, 200);
  }, [onSelect, handleClose]);

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="Add Recipe" 
      maxWidth="md"
      toolbar={
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search recipes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      }
    >
      <div className={styles.recipeList}>
        {filteredRecipes.length === 0 && (
          <div className={styles.emptyState}>
            {searchTerm ? (
              <>
                <p>No recipes found</p>
                <p>Try a different search term</p>
              </>
            ) : (
              <>
                <p>No recipes yet</p>
                <p>Add recipes to your collection first</p>
              </>
            )}
          </div>
        )}

        {filteredRecipes.map((recipe) => (
          <div
            key={recipe.id}
            className={`${styles.recipeItem} ${
              selectedId === recipe.id ? styles.recipeItemSelected : ''
            }`}
            onClick={() => handleSelect(recipe.id)}
          >
            <div className={styles.recipeInfo}>
              <p className={styles.recipeTitle}>{recipe.title}</p>
              <p className={styles.recipeIngredients}>
                {recipe.ingredients?.length || 0} ingredients
              </p>
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
};

export default RecipePicker;
