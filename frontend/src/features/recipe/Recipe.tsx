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
  
  const isEditing = !!id && id !== 'new';
  const existingRecipe = isEditing ? recipes.find((r: any) => r.id === id) : null;

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recipe form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: null, unit: null, name: '', originalText: '' },
  ]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [hasChanges, setHasChanges] = useState(false); // Always start with no changes

  // Auto-height refs for textareas
  const descriptionRef = useAutoHeight<HTMLTextAreaElement>(description);

  // Load initial title from navigation state (for manual create flow)
  useEffect(() => {
    const state = location.state as { initialTitle?: string } | null;
    if (state?.initialTitle && id === 'new') {
      setTitle(state.initialTitle);
      setHasChanges(true); // Mark as changed since we have initial data
    }
  }, [id, location]);

  // Load existing recipe when editing
  useEffect(() => {
    if (existingRecipe) {
      setTitle(existingRecipe.title);
      setDescription(existingRecipe.description || '');
      setIngredients(existingRecipe.ingredients.length > 0 ? existingRecipe.ingredients : [{ amount: null, unit: null, name: '', originalText: '' }]);
      setInstructions(existingRecipe.instructions.length > 0 ? existingRecipe.instructions : ['']);
      setHasChanges(false); // Reset changes flag when loading
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
      
      // Only add description if it's not empty
      if (description.trim()) {
        recipeData.description = description.trim();
      }
      
      // Note: sourceUrl is NOT saved here - it's only set by the backend scrape endpoint
      // If editing a recipe with existing sourceUrl, preserve it
      if (isEditing && existingRecipe?.sourceUrl) {
        recipeData.sourceUrl = existingRecipe.sourceUrl;
      }

      if (isEditing && id) {
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
      setHasChanges(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { amount: null, unit: null, name: '', originalText: '' }]);
    setHasChanges(true);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const addInstruction = () => {
    setInstructions([...instructions, '']);
    setHasChanges(true);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
      );
      if (!confirmed) return;
    }
    navigate('/recipe-list');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <IconButton
          onClick={handleCancel}
          icon="fa-angle-left"
          hideTextOnMobile={true}
          className={styles.backButton}
        >
          All recipes
        </IconButton>
        <h1>Edit recipe</h1>
        <IconButton
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
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
              setHasChanges(true);
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
              setHasChanges(true);
            }}
            placeholder="Brief description"
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
                  setHasChanges(true);
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
                setHasChanges(true);
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
          disabled={isSaving || !hasChanges}
          className={styles.saveButton}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default Recipe;

