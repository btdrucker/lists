import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch, useAutoHeight } from '../../common/hooks';
import { addRecipe, updateRecipeInState } from '../recipe-list/slice.ts';
import { addRecipe as saveRecipe, updateRecipe, deleteRecipe } from '../../firebase/firestore';
import { getIdToken } from '../../firebase/auth';
import IconButton from '../../common/components/IconButton.tsx';
import type {Ingredient, Recipe} from '../../types';
import styles from './recipe.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const IS_DEV = import.meta.env.DEV;

// Instruction row component with auto-height textarea
const InstructionRow = ({
  index,
  value,
  onChange,
  onRemove
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) => {
  const textareaRef = useAutoHeight<HTMLTextAreaElement>(value);

  return (
    <div className={styles.instructionRow}>
      <span className={styles.stepNumber}>{index + 1}.</span>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe this step"
        className={styles.instructionInput}
      />
      <button onClick={onRemove} className={styles.removeButton}>
        ×
      </button>
    </div>
  );
};

const EditRecipe = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const user = useAppSelector((state) => state.auth?.user);
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);

  const isNewRecipe = id === 'new';
  const existingRecipe = !isNewRecipe && id ? recipes.find((r: Recipe) => r.id === id) : null;

  const [isSaving, setIsSaving] = useState(false);
  const [isRescraping, setIsRescraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EditRecipe form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: null, unit: null, name: '', originalText: '' },
  ]);
  const [instructions, setInstructions] = useState<string[]>(['']);

  // Track original state for deep comparison
  const [originalState, setOriginalState] = useState<{
    title: string;
    description: string;
    notes: string;
    servings: string;
    prepTime: string;
    cookTime: string;
    ingredients: Ingredient[];
    instructions: string[];
  } | null>(null);

  // Auto-height refs for text areas
  const descriptionRef = useAutoHeight<HTMLTextAreaElement>(description);
  const notesRef = useAutoHeight<HTMLTextAreaElement>(notes);

  // Deep comparison to detect actual changes
  const hasActualChanges = (): boolean => {
    if (!originalState) return true; // New recipe always has changes

    // Compare scalar fields (trimmed, since save trims them)
    if (title.trim() !== originalState.title) return true;
    if (description.trim() !== (originalState.description || '')) return true;
    if (notes.trim() !== (originalState.notes || '')) return true;
    if (servings.trim() !== originalState.servings) return true;
    if (prepTime.trim() !== originalState.prepTime) return true;
    if (cookTime.trim() !== originalState.cookTime) return true;

    // Compare ingredients (filter out empty ones like save does)
    const currIngredients = ingredients.filter(i => i.name.trim());
    const origIngredients = originalState.ingredients.filter(i => i.name.trim());
    if (currIngredients.length !== origIngredients.length) return true;

    for (let i = 0; i < currIngredients.length; i++) {
      if (currIngredients[i].name.trim() !== origIngredients[i].name.trim()) return true;
      if (currIngredients[i].originalText?.trim() !== origIngredients[i].originalText?.trim()) return true;
    }

    // Compare instructions (filter out empty ones like save does)
    const currInstructions = instructions.filter(i => i.trim());
    const origInstructions = originalState.instructions.filter(i => i.trim());
    if (currInstructions.length !== origInstructions.length) return true;

    for (let i = 0; i < currInstructions.length; i++) {
      if (currInstructions[i].trim() !== origInstructions[i].trim()) return true;
    }

    return false; // No changes detected
  };

  // Load initial title from navigation state (for manual create flow)
  useEffect(() => {
    const state = location.state as { initialTitle?: string } | null;
    if (state?.initialTitle && isNewRecipe) {
      setTitle(state.initialTitle);
      // For new recipes, set original state to null (no saved state to compare against)
      setOriginalState(null);
    }
  }, [id, location, isNewRecipe]);

  // Load existing recipe when editing
  useEffect(() => {
    if (existingRecipe) {
      const initialState = {
        title: existingRecipe.title,
        description: existingRecipe.description || '',
        notes: existingRecipe.notes || '',
        servings: existingRecipe.servings?.toString() || '',
        prepTime: existingRecipe.prepTime?.toString() || '',
        cookTime: existingRecipe.cookTime?.toString() || '',
        ingredients: existingRecipe.ingredients.length > 0
          ? existingRecipe.ingredients
          : [{ amount: null, unit: null, name: '', originalText: '' }],
        instructions: existingRecipe.instructions.length > 0
          ? existingRecipe.instructions
          : ['']
      };

      setTitle(initialState.title);
      setDescription(initialState.description);
      setNotes(initialState.notes);
      setServings(initialState.servings);
      setPrepTime(initialState.prepTime);
      setCookTime(initialState.cookTime);
      setIngredients(initialState.ingredients);
      setInstructions(initialState.instructions);
      setOriginalState(initialState); // Store original for comparison
    }
  }, [existingRecipe]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (ingredients.filter((i) => i.name.trim()).length === 0) {
      setError('At least one ingredient is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const recipeData: any = {
        title: title.trim(),
        ingredients: ingredients.filter((i) => i.name.trim()),
        instructions: instructions.filter((i) => i.trim()),
      };

      // Only add optional fields if they're not empty
      if (description.trim()) {
        recipeData.description = description.trim();
      }
      if (notes.trim()) {
        recipeData.notes = notes.trim();
      }
      if (servings.trim()) {
        const servingsNum = parseInt(servings.trim(), 10);
        if (!isNaN(servingsNum) && servingsNum > 0) {
          recipeData.servings = servingsNum;
        }
      }
      if (prepTime.trim()) {
        const prepTimeNum = parseInt(prepTime.trim(), 10);
        if (!isNaN(prepTimeNum) && prepTimeNum > 0) {
          recipeData.prepTime = prepTimeNum;
        }
      }
      if (cookTime.trim()) {
        const cookTimeNum = parseInt(cookTime.trim(), 10);
        if (!isNaN(cookTimeNum) && cookTimeNum > 0) {
          recipeData.cookTime = cookTimeNum;
        }
      }

      // Note: sourceUrl is NOT saved here - it's only set by the backend scrape endpoint
      // If updating a recipe with existing sourceUrl, preserve it
      if (!isNewRecipe && existingRecipe?.sourceUrl) {
        recipeData.sourceUrl = existingRecipe.sourceUrl;
      }

      if (!isNewRecipe && id) {
        // Update existing recipe
        await updateRecipe(id, recipeData);
        dispatch(updateRecipeInState({
          ...existingRecipe,
          ...recipeData,
          id
        }));
        // Navigate to view the updated recipe
        navigate(`/recipe/${id}`);
      } else {
        // Create new recipe
        recipeData.userId = user!.uid;
        recipeData.isPublic = true;
        const recipe = await saveRecipe(recipeData);
        dispatch(addRecipe(recipe));
        // Navigate to view the new recipe
        navigate(`/recipe/${recipe.id}`);
      }
    } catch (err) {
      setError(`Failed to save recipe`);
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRescrape = async () => {
    if (!existingRecipe?.sourceUrl || !id) return;

    const confirmRescrape = window.confirm(
      'This will re-scrape the recipe from the source URL and replace all data except Notes. Continue?'
    );
    if (!confirmRescrape) return;

    setIsRescraping(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Bypass cache by adding cache: 'no-store' and a timestamp query param
      const response = await fetch(`${API_URL}/scrape?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: existingRecipe.sourceUrl }),
        cache: 'no-store',
      });

      const data = await response.json();

      if (data.success && data.recipe) {
        const scrapedRecipe = data.recipe;
        
        // Delete the duplicate recipe created by the scrape endpoint
        // (we only want to update the existing recipe, not create a new one)
        if (scrapedRecipe.id && scrapedRecipe.id !== id) {
          try {
            await deleteRecipe(scrapedRecipe.id);
          } catch (err) {
            console.error('Failed to delete duplicate recipe:', err);
          }
        }
        
        // Preserve current notes, update everything else from scraped data
        setTitle(scrapedRecipe.title || '');
        setDescription(scrapedRecipe.description || '');
        setServings(scrapedRecipe.servings?.toString() || '');
        setPrepTime(scrapedRecipe.prepTime?.toString() || '');
        setCookTime(scrapedRecipe.cookTime?.toString() || '');
        setIngredients(
          scrapedRecipe.ingredients.length > 0
            ? scrapedRecipe.ingredients
            : [{ amount: null, unit: null, name: '', originalText: '' }]
        );
        setInstructions(
          scrapedRecipe.instructions.length > 0
            ? scrapedRecipe.instructions
            : ['']
        );

        // Update in Firestore (preserving notes)
        const updates: any = {
          title: scrapedRecipe.title,
          ingredients: scrapedRecipe.ingredients,
          instructions: scrapedRecipe.instructions,
          sourceUrl: existingRecipe.sourceUrl,
        };

        if (scrapedRecipe.imageUrl) {
          updates.imageUrl = scrapedRecipe.imageUrl;
        }
        if (scrapedRecipe.description) {
          updates.description = scrapedRecipe.description;
        }
        if (scrapedRecipe.servings) {
          updates.servings = scrapedRecipe.servings;
        }
        if (scrapedRecipe.prepTime) {
          updates.prepTime = scrapedRecipe.prepTime;
        }
        if (scrapedRecipe.cookTime) {
          updates.cookTime = scrapedRecipe.cookTime;
        }
        if (notes.trim()) {
          updates.notes = notes.trim();
        }

        await updateRecipe(id, updates);
        dispatch(updateRecipeInState({
          ...existingRecipe,
          ...updates,
          id
        }));

        alert('Recipe re-scraped successfully!');
      } else {
        setError(data.error || 'Failed to re-scrape recipe');
      }
    } catch (err) {
      setError('Failed to re-scrape recipe');
      console.error('Re-scrape error:', err);
    } finally {
      setIsRescraping(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { amount: null, unit: null, name: '', originalText: '' }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const addInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    if (hasActualChanges()) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
      );
      if (!confirmed) return;
    }

    // If updating an existing recipe, go back to view mode
    // If creating new recipe, go to recipe list
    if (!isNewRecipe && id) {
      navigate(`/recipe/${id}`);
    } else {
      navigate('/recipe-list');
    }
  };

  // Handle case where recipe ID is provided but recipe doesn't exist
  if (!isNewRecipe && id && !existingRecipe) {
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
        <div className={styles.form}>
          <div className={styles.notFound}>
            EditRecipe not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <IconButton
          onClick={handleCancel}
          icon="fa-angle-left"
          hideTextOnMobile={true}
          className={styles.backButton}
        >
          Done
        </IconButton>
        <h1>Edit recipe</h1>
        <IconButton
          onClick={handleSave}
          disabled={isSaving || !hasActualChanges()}
          icon="fa-floppy-disk"
          hideTextOnMobile={true}
          className={styles.saveButton}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </IconButton>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.form}>
        <div className={styles.field}>
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="EditRecipe title"
          />
        </div>

        {/* Show immutable URL between title and description if it exists */}
        {existingRecipe?.sourceUrl && (
          <div className={styles.field}>
            <label>Source URL</label>
            <div className={styles.sourceUrlContainer}>
              <div className={styles.immutableUrl}>
                <a href={existingRecipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {existingRecipe.sourceUrl}
                </a>
              </div>
              {IS_DEV && (
                <button
                  onClick={handleRescrape}
                  disabled={isRescraping}
                  className={styles.rescrapeButton}
                  title="Re-scrape recipe from source"
                >
                  <i className="fa-solid fa-rotate-right"></i>
                </button>
              )}
            </div>
          </div>
        )}

        <div className={styles.field}>
          <label>Description</label>
          <textarea
            ref={descriptionRef}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            placeholder="Brief description"
          />
        </div>

        <div className={styles.metaFields}>
          <div className={styles.metaField}>
            <label>Servings</label>
            <input
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder=""
            />
          </div>
          <div className={styles.metaField}>
            <label>Prep time (min)</label>
            <input
              type="number"
              min="0"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              placeholder=""
            />
          </div>
          <div className={styles.metaField}>
            <label>Cook time (min)</label>
            <input
              type="number"
              min="0"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              placeholder=""
            />
          </div>
        </div>

        <div className={styles.field}>
          <label>Notes</label>
          <textarea
            ref={notesRef}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
            placeholder="Personal notes, modifications, tips..."
          />
        </div>

        <div className={styles.section}>
          <h3>Ingredients *</h3>
          {ingredients.map((ingredient, index) => (
            <div key={index} className={styles.ingredientRow}>
              <input
                type="text"
                value={ingredient.originalText}
                onChange={(e) => {
                  const value = e.target.value;
                  const updated = [...ingredients];
                  updated[index] = {
                    ...updated[index],
                    originalText: value,
                    name: value // Set name to the same value for manual entry
                  };
                  setIngredients(updated);
                }}
                placeholder="e.g., 2 cups flour"
                className={styles.ingredientInput}
              />
              <button
                onClick={() => removeIngredient(index)}
                className={styles.removeButton}
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={addIngredient} className={styles.addButton}>
            + Add Ingredient
          </button>
        </div>

        <div className={styles.section}>
          <h3>Instructions</h3>
          {instructions.map((instruction, index) => (
            <InstructionRow
              key={index}
              index={index}
              value={instruction}
              onChange={(value) => {
                updateInstruction(index, value);
              }}
              onRemove={() => removeInstruction(index)}
            />
          ))}
          <button onClick={addInstruction} className={styles.addButton}>
            + Add Step
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !hasActualChanges()}
          className={styles.saveButton}
        >
          <i className="fa-solid fa-floppy-disk"></i>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default EditRecipe;
