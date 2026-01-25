import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppSelector } from '../hooks';
import styles from './recipePicker.module.css';

interface RecipePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (recipeIds: string[]) => void;
}

const RecipePicker = ({ isOpen, onClose, onSelect }: RecipePickerProps) => {
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset state and close
  const handleClose = useCallback(() => {
    setSearchTerm('');
    setSelectedIds([]);
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

  // Toggle recipe selection
  const handleToggle = useCallback((recipeId: string) => {
    setSelectedIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (selectedIds.length > 0) {
      onSelect(selectedIds);
    }
    handleClose();
  }, [selectedIds, onSelect, handleClose]);

  // Handle click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2>Add Recipes</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </header>

        <div className={styles.searchSection}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search recipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

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
            <label
              key={recipe.id}
              className={`${styles.recipeItem} ${
                selectedIds.includes(recipe.id) ? styles.recipeItemSelected : ''
              }`}
            >
              <input
                type="checkbox"
                className={styles.recipeCheckbox}
                checked={selectedIds.includes(recipe.id)}
                onChange={() => handleToggle(recipe.id)}
              />
              <div className={styles.recipeInfo}>
                <p className={styles.recipeTitle}>{recipe.title}</p>
                <p className={styles.recipeIngredients}>
                  {recipe.ingredients?.length || 0} ingredients
                </p>
              </div>
            </label>
          ))}
        </div>

        <footer className={styles.footer}>
          <span className={styles.selectedCount}>
            {selectedIds.length} recipe{selectedIds.length !== 1 ? 's' : ''}{' '}
            selected
          </span>
          <button
            className={styles.addButton}
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
          >
            Add to List
          </button>
        </footer>
      </div>
    </div>
  );
};

export default RecipePicker;
