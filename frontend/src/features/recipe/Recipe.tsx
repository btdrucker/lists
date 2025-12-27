import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { addRecipe, updateRecipeInState } from '../../common/slices/recipes';
import { addRecipe as saveRecipe, updateRecipe } from '../../firebase/firestore';
import { getIdToken } from '../../firebase/auth';
import type { Ingredient } from '../../types/index.ts';
import styles from './recipe.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const Recipe = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const user = useAppSelector((state) => state.auth?.user);
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  
  const isEditing = !!id;
  const existingRecipe = isEditing ? recipes.find((r: any) => r.id === id) : null;

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recipe form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: null, unit: null, name: '', originalText: '' },
  ]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [hasChanges, setHasChanges] = useState(false); // Always start with no changes

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

  // Check if form has any data
  const hasFormData = () => {
    return title.trim() !== '' || 
           description.trim() !== '' || 
           ingredients.some(i => i.name.trim() !== '' || i.originalText.trim() !== '') ||
           instructions.some(i => i.trim() !== '');
  };

  // Validate URL
  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleScrape = async () => {
    if (!url.trim() || !isValidUrl(url.trim())) {
      setError('Please enter a valid URL');
      return;
    }

    // Confirm if form has data
    if (hasFormData()) {
      const confirmed = window.confirm(
        'Scraping a recipe will overwrite the current form data. Continue?'
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Getting auth token...');
      const token = await getIdToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      console.log('Sending scrape request to:', `${API_URL}/scrape`);
      console.log('URL to scrape:', url);
      
      const response = await fetch(`${API_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (data.success && data.recipe) {
        const recipe = data.recipe;
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setIngredients(recipe.ingredients);
        setInstructions(recipe.instructions);
        setHasChanges(true); // Mark as changed after scraping
        
        // Add to Redux state immediately
        dispatch(addRecipe(recipe));
        
        // Navigate back to list
        navigate('/');
      } else {
        setError(data.error || 'Failed to scrape recipe');
      }
    } catch (err) {
      setError('Failed to scrape recipe. Please try manual entry.');
      console.error('Scrape error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (ingredients.filter((i) => i.name.trim()).length === 0) {
      setError('At least one ingredient is required');
      return;
    }

    setLoading(true);
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

      if (isEditing && id) {
        // Update existing recipe
        await updateRecipe(id, recipeData);
        dispatch(updateRecipeInState({ 
          ...existingRecipe, 
          ...recipeData,
          id 
        }));
      } else {
        // Create new recipe
        recipeData.userId = user!.uid;
        recipeData.isPublic = true;
        const recipe = await saveRecipe(recipeData);
        dispatch(addRecipe(recipe));
      }

      // Navigate back to list
      navigate('/');
    } catch (err) {
      setError(`Failed to save recipe`);
      console.error('Save error:', err);
    } finally {
      setLoading(false);
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Recipe</h1>
        <button onClick={() => navigate('/')} className={styles.cancelButton}>
          Cancel
        </button>
      </header>

      <div className={styles.urlSection}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/recipe (optional)"
          className={styles.urlInput}
        />
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim() || !isValidUrl(url.trim())}
          className={styles.scrapeButton}
        >
          {loading ? 'Scraping...' : 'Scrape Recipe'}
        </button>
      </div>

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

        <div className={styles.field}>
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Brief description"
            rows={3}
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
            <div key={index} className={styles.instructionRow}>
              <span className={styles.stepNumber}>{index + 1}.</span>
              <textarea
                value={instruction}
                onChange={(e) => {
                  updateInstruction(index, e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Describe this step"
                rows={2}
                className={styles.instructionInput}
              />
              <button
                onClick={() => removeInstruction(index)}
                className={styles.removeButton}
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={addInstruction} className={styles.addButton}>
            + Add Step
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !hasChanges}
          className={styles.saveButton}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default Recipe;

