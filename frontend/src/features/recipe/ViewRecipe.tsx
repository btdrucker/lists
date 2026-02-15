import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch, useAutoHeight, useDebugMode, useWakeLock, useNavigateWithDebug } from '../../common/hooks';
import { updateRecipeInState } from '../recipe-list/slice';
import { updateRecipe, addShoppingItem } from '../../firebase/firestore';
import IconButton from '../../common/components/IconButton';
import { ensureRecipeHasAiParsingAndUpdate, getEffectiveIngredientValues, getIngredientText } from '../../common/aiParsing';
import ParsedFieldsDebug from '../../common/components/ParsedFieldsDebug';
import type { RecipeWithAiMetadata } from '../../common/aiParsing';
import styles from './viewRecipe.module.css';

// Helper function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

const ViewRecipe = () => {
  const navigate = useNavigateWithDebug();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  
  const recipe = recipes.find((r: any) => r.id === id);
  
  const [notes, setNotes] = useState(recipe?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const notesRef = useAutoHeight<HTMLTextAreaElement>(notes);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isSupported: wakeLockSupported, isActive: cookModeActive, toggle: toggleCookMode } = useWakeLock();
  const debugMode = useDebugMode();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [id]);

  // Update local notes when recipe changes
  useEffect(() => {
    if (recipe) {
      setNotes(recipe.notes || '');
    }
  }, [recipe]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const saveNotes = async () => {
    if (!recipe || !id) return;
    
    // Only save if notes have changed
    if (notes === (recipe.notes || '')) return;

    setIsSavingNotes(true);
    try {
      const updates: any = {};
      if (notes.trim()) {
        updates.notes = notes.trim();
      } else {
        // If notes are empty, we still need to update to remove them
        updates.notes = '';
      }

      await updateRecipe(id, updates);
      dispatch(updateRecipeInState({
        ...recipe,
        ...updates,
        id
      }));
    } catch (error) {
      console.error('Error saving notes:', error);
      // Revert to original notes on error
      setNotes(recipe.notes || '');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Save notes on component unmount (browser back, etc)
  useEffect(() => {
    return () => {
      // Check if notes have changed before unmounting
      if (recipe && notes !== (recipe.notes || '')) {
        // Fire-and-forget save on unmount
        const updates: any = {};
        if (notes.trim()) {
          updates.notes = notes.trim();
        } else {
          updates.notes = '';
        }
        updateRecipe(id!, updates).catch(err => 
          console.error('Error saving notes on unmount:', err)
        );
      }
    };
  }, [recipe, notes, id]);

  // Try to save on tab close (best effort)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (recipe && notes !== (recipe.notes || '')) {
        const updates: any = {};
        if (notes.trim()) {
          updates.notes = notes.trim();
        } else {
          updates.notes = '';
        }
        // Best effort - may not complete in time
        updateRecipe(id!, updates).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [recipe, notes, id]);

  const handleBackClick = async () => {
    await saveNotes();
    navigate('/recipe-list');
  };

  const handleEditClick = async () => {
    setShowMenu(false);
    await saveNotes();
    navigate(`/edit-recipe/${id}`);
  };

  const handleShareClick = async () => {
    setShowMenu(false);
    if (!recipe || !id) return;

    const shareUrl = `${window.location.origin}/view-recipe/${id}`;
    const shareData = {
      title: recipe.title,
      text: `Check out this recipe: ${recipe.title}`,
      url: shareUrl,
    };

    try {
      // Try Web Share API first (mobile)
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        // Could show a toast notification here
        alert('Recipe link copied to clipboard!');
      }
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleCookModeClick = async () => {
    const wasActive = cookModeActive;
    
    if (wasActive) {
      // Turning OFF - animate out first
      setIsAnimatingOut(true);
      setTimeout(async () => {
        await toggleCookMode();
        setIsAnimatingOut(false);
        setShowMenu(false);
      }, 300);
    } else {
      // Turning ON - animate in
      setIsAnimatingIn(true);
      await toggleCookMode();
      setTimeout(() => {
        setIsAnimatingIn(false);
        setShowMenu(false);
      }, 400);
    }
  };

  const handleAddToShoppingList = async () => {
    if (!recipe) return;
    setShowMenu(false);

    try {
      const familyId = 'default-family';
      
      // Ensure AI parsing is done before adding to shopping list
      const recipeWithMetadata = recipe as RecipeWithAiMetadata;
      const ingredientsToAdd = await ensureRecipeHasAiParsingAndUpdate(
        recipeWithMetadata,
        dispatch
      );

      // Create shopping item for each ingredient
      for (const ingredient of ingredientsToAdd) {
        const { amount, unit, name } = getEffectiveIngredientValues(ingredient);
        const originalText = getIngredientText(ingredient);

        await addShoppingItem({
          familyId,
          originalText,
          amount,
          unit,
          name,
          isChecked: false,
          tagIds: [],
          sourceRecipeId: recipe.id,
        });
      }

      // Show success feedback
      alert(`Added ${ingredientsToAdd.length} items to shopping list`);
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      alert('Failed to add items to shopping list');
    }
  };

  if (!recipe) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <IconButton
            onClick={() => navigate('/recipe-list')}
            icon="fa-angle-left"
            hideTextOnMobile={true}
            className={styles.backButton}
          >
            All recipes
          </IconButton>
        </header>
        <div className={styles.content}>
          <div className={styles.notFound}>
            Recipe not found
          </div>
        </div>
      </div>
    );
  }

  const category = recipe.category || [];
  const cuisine = recipe.cuisine || [];
  const keywords = recipe.keywords || [];
  const hasMetadata = category.length + cuisine.length + keywords.length > 0;

  return (
    <div className={styles.container}>
      {/* Hero section with image, title overlay, and floating buttons */}
      <div className={`${styles.heroSection} ${!recipe.imageUrl ? styles.heroSectionNoImage : ''}`}>
        {recipe.imageUrl ? (
          <>
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className={styles.heroImage}
            />
            <div className={styles.heroGradient}></div>
            <h1 className={styles.heroTitle}>{recipe.title}</h1>
          </>
        ) : (
          <div className={styles.heroNoImage}>
            <h1>{recipe.title}</h1>
          </div>
        )}
        
        {/* Floating buttons over hero */}
        <button
          onClick={handleBackClick}
          className={styles.floatingBackButton}
          aria-label="Back to all recipes"
        >
          <i className="fa-solid fa-angle-left"></i>
        </button>
        <div className={styles.menuContainer} ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={styles.floatingMenuButton}
            aria-label="Recipe options"
            aria-expanded={showMenu}
          >
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
          {showMenu && (
            <div className={styles.contextMenu}>
              <button onClick={handleAddToShoppingList} className={styles.menuItem}>
                <i className="fa-solid fa-cart-shopping"></i>
                <span>Add to Shopping List</span>
              </button>
              <button onClick={handleShareClick} className={styles.menuItem}>
                <i className="fa-solid fa-share-nodes"></i>
                <span>Share</span>
              </button>
              {wakeLockSupported && (
                <button onClick={handleCookModeClick} className={styles.menuItem}>
                  <i className={`fa-solid fa-mobile-screen ${cookModeActive || isAnimatingOut ? styles.activeIcon : ''}`}></i>
                  <span>Cook Mode</span>
                  {(cookModeActive || isAnimatingOut) && (
                    <i className={`fa-solid fa-check ${isAnimatingIn ? styles.checkmarkIn : ''} ${isAnimatingOut ? styles.checkmarkOut : ''}`}></i>
                  )}
                </button>
              )}
              <button onClick={handleEditClick} className={styles.menuItem}>
                <i className="fa-solid fa-pen"></i>
                <span>Edit</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {recipe.sourceUrl && (
          <div className={styles.sourceUrl}>
            From{' '}
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              {extractDomain(recipe.sourceUrl)}
            </a>
          </div>
        )}

        {recipe.description && (
          <div className={styles.description}>
            {recipe.description}
          </div>
        )}

        {hasMetadata && (
          <div className={styles.badges}>
            {category.map((item: string, index: number) => (
              <span key={`category-${index}`} className={`${styles.badge} ${styles.badgeCategory}`}>
                {item}
              </span>
            ))}
            {cuisine.map((item: string, index: number) => (
              <span key={`cuisine-${index}`} className={`${styles.badge} ${styles.badgeCuisine}`}>
                {item}
              </span>
            ))}
            {keywords.slice(0, 3).map((item: string, index: number) => (
              <span key={`keyword-${index}`} className={`${styles.badge} ${styles.badgeKeyword}`}>
                {item}
              </span>
            ))}
            {keywords.length > 3 && (
              <span className={`${styles.badge} ${styles.badgeKeyword}`}>
                +{keywords.length - 3} more
              </span>
            )}
          </div>
        )}

        {(recipe.servings || recipe.prepTime || recipe.cookTime) && (
          <section className={styles.meta}>
            {recipe.servings && (
              <div className={styles.metaServings}>
                <strong><span className={styles.metaLabelFull}>Servings:</span><span className={styles.metaLabelShort}>Servings:</span></strong> {recipe.servings}
              </div>
            )}
            {recipe.prepTime && (
              <div className={styles.metaPrepTime}>
                <strong><span className={styles.metaLabelFull}>Prep time:</span><span className={styles.metaLabelShort}>Prep:</span></strong> {recipe.prepTime} min
              </div>
            )}
            {recipe.cookTime && (
              <div className={styles.metaCookTime}>
                <strong><span className={styles.metaLabelFull}>Cook time:</span><span className={styles.metaLabelShort}>Cook:</span></strong> {recipe.cookTime} min
              </div>
            )}
          </section>
        )}

        <section className={styles.notesSection}>
          <h2>Notes</h2>
          <textarea
            ref={notesRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add personal notes, modifications, tips..."
            className={styles.notesTextarea}
            disabled={isSavingNotes}
          />
          {isSavingNotes && <span className={styles.savingIndicator}>Saving...</span>}
        </section>

        <section className={styles.section}>
          <h2>Ingredients</h2>
          {(() => {
            // Group ingredients by section
            const sections = new Map<string | null, any[]>();
            recipe.ingredients.forEach((ingredient: any) => {
              const section = ingredient.section || null;
              if (!sections.has(section)) {
                sections.set(section, []);
              }
              sections.get(section)!.push(ingredient);
            });

            // Render each section
            return Array.from(sections.entries()).map(([sectionName, ingredients], sectionIndex) => (
              <div key={sectionIndex} className={styles.ingredientSection}>
                {sectionName && <h3 className={styles.ingredientSectionTitle}>{sectionName}</h3>}
                <ul className={styles.ingredientList}>
                  {ingredients.map((ingredient: any, index: number) => {
                    const { amount, unit, name } = getEffectiveIngredientValues(ingredient);
                    return (
                      <li key={index}>
                        {ingredient.originalText ||
                          ingredient.aiName ||
                          ingredient.name}
                        {debugMode && (
                          <ParsedFieldsDebug
                            amount={amount}
                            unit={unit}
                            name={name ?? ''}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ));
          })()}
        </section>

        <section className={styles.section}>
          <h2>Instructions</h2>
          <ol className={styles.instructionList}>
            {recipe.instructions.map((instruction: string, index: number) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};

export default ViewRecipe;

