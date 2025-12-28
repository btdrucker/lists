import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch, useAutoHeight } from '../../common/hooks';
import { addRecipe, updateRecipeInState } from '../../common/slices/recipes';
import { addRecipe as saveRecipe, updateRecipe } from '../../firebase/firestore';
import IconButton from '../../common/IconButton';
import type { Ingredient } from '../../types/index.ts';
import styles from './recipe.module.css';

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

const Recipe = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const user = useAppSelector((state) => state.auth?.user);
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  
  const isNewRecipe = id === 'new';
  const existingRecipe = !isNewRecipe && id ? recipes.find((r: any) => r.id === id) : null;

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recipe form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: null, unit: null, name: '', originalText: '' },
  ]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  
  // Track original state for deep comparison
  const [originalState, setOriginalState] = useState<{
    title: string;
    description: string;
    notes: string;
    ingredients: Ingredient[];
    instructions: string[];
  } | null>(null);

  // Auto-height refs for textareas
  const descriptionRef = useAutoHeight<HTMLTextAreaElement>(description);
  const notesRef = useAutoHeight<HTMLTextAreaElement>(notes);

  // Deep comparison to detect actual changes
  const hasActualChanges = (): boolean => {
    if (!originalState) return true; // New recipe always has changes
    
    // Compare scalar fields (trimmed, since save trims them)
    if (title.trim() !== originalState.title) return true;
    if (description.trim() !== (originalState.description || '')) return true;
    if (notes.trim() !== (originalState.notes || '')) return true;
    
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
  }, [id, location]);

  // Load existing recipe when editing
  useEffect(() => {
    if (existingRecipe) {
      const initialState = {
        title: existingRecipe.title,
        description: existingRecipe.description || '',
        notes: existingRecipe.notes || '',
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
            Recipe not found
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
            placeholder="Recipe title"
          />
        </div>

        {/* Show immutable URL between title and description if it exists */}
        {existingRecipe?.sourceUrl && (
          <div className={styles.field}>
            <label>Source URL</label>
            <div className={styles.immutableUrl}>
              <a href={existingRecipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                {existingRecipe.sourceUrl}
              </a>
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
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default Recipe;

