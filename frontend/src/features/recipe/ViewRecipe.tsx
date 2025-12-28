import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch, useAutoHeight } from '../../common/hooks';
import { updateRecipeInState } from '../../common/slices/recipes';
import { updateRecipe } from '../../firebase/firestore';
import IconButton from '../../common/IconButton';
import styles from './viewRecipe.module.css';

const ViewRecipe = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  
  const recipe = recipes.find((r: any) => r.id === id);
  
  const [notes, setNotes] = useState(recipe?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const notesRef = useAutoHeight<HTMLTextAreaElement>(notes);

  // Update local notes when recipe changes
  useEffect(() => {
    if (recipe) {
      setNotes(recipe.notes || '');
    }
  }, [recipe]);

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
    await saveNotes();
    navigate(`/edit-recipe/${id}`);
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
        <button
          onClick={handleEditClick}
          className={styles.floatingEditButton}
          aria-label="Edit recipe"
        >
          <i className="fa-solid fa-pen"></i>
        </button>
      </div>

      <div className={styles.content}>
        {recipe.sourceUrl && (
          <div className={styles.sourceUrl}>
            <label>Source:</label>
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              {recipe.sourceUrl}
            </a>
          </div>
        )}

        {recipe.description && (
          <div className={styles.description}>
            {recipe.description}
          </div>
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
          <ul className={styles.ingredientList}>
            {recipe.ingredients.map((ingredient: any, index: number) => (
              <li key={index}>
                {ingredient.originalText || ingredient.name}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2>Instructions</h2>
          <ol className={styles.instructionList}>
            {recipe.instructions.map((instruction: string, index: number) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </section>

        {(recipe.servings || recipe.prepTime || recipe.cookTime) && (
          <section className={styles.meta}>
            {recipe.servings && <div><strong>Servings:</strong> {recipe.servings}</div>}
            {recipe.prepTime && <div><strong>Prep time:</strong> {recipe.prepTime} min</div>}
            {recipe.cookTime && <div><strong>Cook time:</strong> {recipe.cookTime} min</div>}
          </section>
        )}
      </div>
    </div>
  );
};

export default ViewRecipe;

