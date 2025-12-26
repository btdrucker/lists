import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { addRecipe } from '../../common/slices/recipes';
import { addRecipe as saveRecipe } from '../../firebase/firestore';
import { getIdToken } from '../../firebase/auth';
import type { Ingredient } from '../../types/index.ts';
import styles from './add-recipe.module.css';

type Mode = 'manual' | 'url';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AddRecipe = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const [mode, setMode] = useState<Mode>('manual');
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

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success && data.recipe) {
        const recipe = data.recipe;
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setIngredients(recipe.ingredients);
        setInstructions(recipe.instructions);
        
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
      const recipe = await saveRecipe({
        userId: user!.uid,
        title: title.trim(),
        description: description.trim() || undefined,
        ingredients: ingredients.filter((i) => i.name.trim()),
        instructions: instructions.filter((i) => i.trim()),
        isPublic: true,
      });

      // Add to Redux state
      dispatch(addRecipe(recipe));

      // Navigate back to list
      navigate('/');
    } catch (err) {
      setError('Failed to save recipe');
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Add Recipe</h1>
        <button onClick={() => navigate('/')} className={styles.cancelButton}>
          Cancel
        </button>
      </header>

      <div className={styles.modeToggle}>
        <button
          className={mode === 'manual' ? styles.modeActive : styles.modeInactive}
          onClick={() => setMode('manual')}
        >
          Manual Entry
        </button>
        <button
          className={mode === 'url' ? styles.modeActive : styles.modeInactive}
          onClick={() => setMode('url')}
        >
          Scrape from URL
        </button>
      </div>

      {mode === 'url' && (
        <div className={styles.urlSection}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recipe"
            className={styles.urlInput}
          />
          <button
            onClick={handleScrape}
            disabled={loading}
            className={styles.scrapeButton}
          >
            {loading ? 'Scraping...' : 'Scrape Recipe'}
          </button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.form}>
        <div className={styles.field}>
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Recipe title"
          />
        </div>

        <div className={styles.field}>
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
                onChange={(e) => updateIngredient(index, 'originalText', e.target.value)}
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
                onChange={(e) => updateInstruction(index, e.target.value)}
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
          disabled={loading}
          className={styles.saveButton}
        >
          {loading ? 'Saving...' : 'Save Recipe'}
        </button>
      </div>
    </div>
  );
};

export default AddRecipe;

