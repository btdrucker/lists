import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch, useAutoHeight } from '../../common/hooks';
import { addRecipe, updateRecipeInState } from '../recipe-list/slice.ts';
import { addRecipe as saveRecipe, updateRecipe, deleteRecipe } from '../../firebase/firestore';
import { getIdToken } from '../../firebase/auth';
import IconButton from '../../common/components/IconButton.tsx';
import { UnitValue } from '../../types';
import type { Ingredient, Recipe } from '../../types';
import {
  ensureRecipeHasAiParsingForSave,
  getIngredientText,
  sanitizeIngredientForSave,
} from '../../common/aiParsing';
import type { RecipeWithAiMetadata } from '../../common/aiParsing';
import styles from './recipe.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const IS_DEV = import.meta.env.DEV;
const UNIT_LABELS: Record<UnitValue, string> = {
  [UnitValue.CUP]: 'cup',
  [UnitValue.TABLESPOON]: 'tablespoon',
  [UnitValue.TEASPOON]: 'teaspoon',
  [UnitValue.FLUID_OUNCE]: 'fluid ounce',
  [UnitValue.QUART]: 'quart',
  [UnitValue.POUND]: 'pound',
  [UnitValue.WEIGHT_OUNCE]: 'ounce',
  [UnitValue.EACH]: 'piece',
  [UnitValue.CLOVE]: 'clove',
  [UnitValue.SLICE]: 'slice',
  [UnitValue.CAN]: 'can',
  [UnitValue.BUNCH]: 'bunch',
  [UnitValue.HEAD]: 'head',
  [UnitValue.STALK]: 'stalk',
  [UnitValue.SPRIG]: 'sprig',
  [UnitValue.LEAF]: 'leaf',
  [UnitValue.PINCH]: 'pinch',
  [UnitValue.DASH]: 'dash',
  [UnitValue.HANDFUL]: 'handful',
  [UnitValue.TO_TASTE]: 'to taste',
};

const UNIT_OPTIONS = Object.values(UnitValue).map((value) => ({
  value,
  label: UNIT_LABELS[value],
}));

const UNIT_VALUE_SET = new Set(Object.values(UnitValue));

const applyAiIngredientDefaults = (items: Ingredient[]) =>
  items.map((ingredient) => {
    const aiAmount = ingredient.aiAmount ?? null;
    const aiUnit = ingredient.aiUnit ?? null;
    const aiName = ingredient.aiName?.trim() || null;
    const hasAnyAi = aiAmount !== null || aiUnit !== null || aiName !== null;

    if (!hasAnyAi) return ingredient;

    return {
      ...ingredient,
      amount: aiAmount,
      unit: aiUnit,
      name: aiName ?? '',
    };
  });

// Instruction row component with auto-height textarea
const InstructionRow = ({
  index,
  value,
  onChange,
  onRemove,
  onKeyDown,
  registerRef
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerRef?: (element: HTMLTextAreaElement | null) => void;
}) => {
  const textareaRef = useAutoHeight<HTMLTextAreaElement>(value);
  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
    if (registerRef) registerRef(element);
  };

  return (
    <div className={styles.instructionRow}>
      <span className={styles.stepNumber}>{index + 1}.</span>
      <textarea
        ref={setTextareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
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
  const existingRecipe = !isNewRecipe && id
    ? (recipes.find((r: Recipe) => r.id === id) as RecipeWithAiMetadata | null)
    : null;

  const [isSaving, setIsSaving] = useState(false);
  const [isRescraping, setIsRescraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EditRecipe form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [category, setCategory] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: null, unit: null, name: '', originalText: '' },
  ]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [focusIngredientIndex, setFocusIngredientIndex] = useState<number | null>(null);
  const [focusInstructionIndex, setFocusInstructionIndex] = useState<number | null>(null);
  const ingredientAmountRefs = useRef<Array<HTMLInputElement | null>>([]);
  const instructionInputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  // Track original state for deep comparison
  const [originalState, setOriginalState] = useState<{
    title: string;
    description: string;
    notes: string;
    imageUrl: string;
    servings: string;
    prepTime: string;
    cookTime: string;
    category: string[];
    cuisine: string[];
    keywords: string[];
    ingredients: Ingredient[];
    instructions: string[];
  } | null>(null);

  // Auto-height refs for text areas
  const descriptionRef = useAutoHeight<HTMLTextAreaElement>(description);
  const notesRef = useAutoHeight<HTMLTextAreaElement>(notes);

  // Deep comparison to detect actual changes
  const hasActualChanges = (): boolean => {
    if (hasChangesExcludingNotes()) return true;
    return notes.trim() !== (originalState?.notes || '');
  };

  const hasChangesExcludingNotes = (): boolean => {
    if (!originalState) return true; // New recipe always has changes

    if (title.trim() !== originalState.title) return true;
    if (description.trim() !== (originalState.description || '')) return true;
    if (imageUrl.trim() !== (originalState.imageUrl || '')) return true;
    if (servings.trim() !== originalState.servings) return true;
    if (prepTime.trim() !== originalState.prepTime) return true;
    if (cookTime.trim() !== originalState.cookTime) return true;

    const currIngredients = ingredients.filter(i => i.name.trim());
    const origIngredients = originalState.ingredients.filter(i => i.name.trim());
    if (currIngredients.length !== origIngredients.length) return true;

    for (let i = 0; i < currIngredients.length; i++) {
      if (currIngredients[i].name.trim() !== origIngredients[i].name.trim()) return true;
      if ((currIngredients[i].amount ?? null) !== (origIngredients[i].amount ?? null)) return true;
      if ((currIngredients[i].amountMax ?? null) !== (origIngredients[i].amountMax ?? null)) return true;
      if ((currIngredients[i].unit || '') !== (origIngredients[i].unit || '')) return true;
      if (currIngredients[i].originalText?.trim() !== origIngredients[i].originalText?.trim()) return true;
    }

    const currInstructions = instructions.filter(i => i.trim());
    const origInstructions = originalState.instructions.filter(i => i.trim());
    if (currInstructions.length !== origInstructions.length) return true;

    for (let i = 0; i < currInstructions.length; i++) {
      if (currInstructions[i].trim() !== origInstructions[i].trim()) return true;
    }

    const currCategory = category.filter(c => c.trim());
    const origCategory = originalState.category.filter(c => c.trim());
    if (currCategory.length !== origCategory.length) return true;
    if (currCategory.some((c, i) => c !== origCategory[i])) return true;

    const currCuisine = cuisine.filter(c => c.trim());
    const origCuisine = originalState.cuisine.filter(c => c.trim());
    if (currCuisine.length !== origCuisine.length) return true;
    if (currCuisine.some((c, i) => c !== origCuisine[i])) return true;

    const currKeywords = keywords.filter(k => k.trim());
    const origKeywords = originalState.keywords.filter(k => k.trim());
    if (currKeywords.length !== origKeywords.length) return true;
    if (currKeywords.some((k, i) => k !== origKeywords[i])) return true;

    return false;
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
        imageUrl: existingRecipe.imageUrl || '',
        servings: existingRecipe.servings?.toString() || '',
        prepTime: existingRecipe.prepTime?.toString() || '',
        cookTime: existingRecipe.cookTime?.toString() || '',
        category: existingRecipe.category || [],
        cuisine: existingRecipe.cuisine || [],
        keywords: existingRecipe.keywords || [],
        ingredients: existingRecipe.ingredients.length > 0
          ? applyAiIngredientDefaults(existingRecipe.ingredients)
          : [{ amount: null, unit: null, name: '', originalText: '' }],
        instructions: existingRecipe.instructions.length > 0
          ? existingRecipe.instructions
          : ['']
      };

      setTitle(initialState.title);
      setDescription(initialState.description);
      setNotes(initialState.notes);
      setImageUrl(initialState.imageUrl);
      setServings(initialState.servings);
      setPrepTime(initialState.prepTime);
      setCookTime(initialState.cookTime);
      setCategory(initialState.category);
      setCuisine(initialState.cuisine);
      setKeywords(initialState.keywords);
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

    if (ingredients.filter((i) => getIngredientText(i)).length === 0) {
      setError('At least one ingredient is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const recipeData: any = {
        title: title.trim(),
        ingredients: ingredients
          .filter((i) => getIngredientText(i))
          .map((ingredient) => sanitizeIngredientForSave(ingredient)),
        instructions: instructions.filter((i) => i.trim()),
      };

      // Ensure AI parsing is done before saving
      const recipeForAnalysis: RecipeWithAiMetadata = {
        ...(existingRecipe || {
          id: 'new',
          userId: user!.uid,
          isPublic: true,
          createdAt: '',
          updatedAt: '',
          title: recipeData.title,
          instructions: recipeData.instructions,
        }),
        title: recipeData.title,
        instructions: recipeData.instructions,
        ingredients: recipeData.ingredients,
        lastAiParsingVersion: existingRecipe?.lastAiParsingVersion ?? null,
      };

      try {
        const aiParsingResult = await ensureRecipeHasAiParsingForSave(recipeForAnalysis);
        
        // Merge AI parsing results into recipe data
        recipeData.ingredients = aiParsingResult.ingredients;
        if (aiParsingResult.aiParsingStatus) {
          recipeData.aiParsingStatus = aiParsingResult.aiParsingStatus;
        }
        if (aiParsingResult.lastAiParsingVersion !== undefined) {
          recipeData.lastAiParsingVersion = aiParsingResult.lastAiParsingVersion;
        }
        
        // Update local state with parsed ingredients
        setIngredients(aiParsingResult.ingredients);
      } catch (aiError) {
        setError(`Failed to parse ingredients: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`);
        return;
      }

      // Only add optional fields if they're not empty
      if (description.trim()) {
        recipeData.description = description.trim();
      }
      if (notes.trim()) {
        recipeData.notes = notes.trim();
      }
      if (imageUrl.trim()) {
        recipeData.imageUrl = imageUrl.trim();
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
      
      // Add metadata arrays (filter out empty strings)
      const filteredCategory = category.filter(c => c.trim());
      if (filteredCategory.length > 0) {
        recipeData.category = filteredCategory;
      }
      const filteredCuisine = cuisine.filter(c => c.trim());
      if (filteredCuisine.length > 0) {
        recipeData.cuisine = filteredCuisine;
      }
      const filteredKeywords = keywords.filter(k => k.trim());
      if (filteredKeywords.length > 0) {
        recipeData.keywords = filteredKeywords;
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

    const confirmMessage = hasChangesExcludingNotes()
      ? 'You have unsaved changes (excluding Notes) that will be lost. This will re-scrape the recipe from the source URL and load fresh data (preserving Notes). Continue?'
      : 'This will re-scrape the recipe from the source URL and load fresh data (preserving Notes). You can review the changes before saving. Continue?';
    const confirmRescrape = window.confirm(confirmMessage);
    if (!confirmRescrape) return;

    setIsRescraping(true);
    setError(null);

    try {
      const token = await getIdToken();

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
        setImageUrl(scrapedRecipe.imageUrl || '');
        setServings(scrapedRecipe.servings?.toString() || '');
        setPrepTime(scrapedRecipe.prepTime?.toString() || '');
        setCookTime(scrapedRecipe.cookTime?.toString() || '');
        setCategory(scrapedRecipe.category || []);
        setCuisine(scrapedRecipe.cuisine || []);
        setKeywords(scrapedRecipe.keywords || []);
        setIngredients(
          scrapedRecipe.ingredients.length > 0
            ? applyAiIngredientDefaults(scrapedRecipe.ingredients)
            : [{ amount: null, unit: null, name: '', originalText: '' }]
        );
        setInstructions(
          scrapedRecipe.instructions.length > 0
            ? scrapedRecipe.instructions
            : ['']
        );

        // Don't save to Firestore yet - let the user review and save manually
        // The form fields are now different from originalState, so save button will be enabled
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
    setIngredients((prev) => {
      const next = [...prev, { amount: null, unit: null, name: '', originalText: '' }];
      setFocusIngredientIndex(prev.length);
      return next;
    });
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (focusIngredientIndex === null) return;
    const input = ingredientAmountRefs.current[focusIngredientIndex];
    if (input) {
      input.focus();
    }
    setFocusIngredientIndex(null);
  }, [focusIngredientIndex, ingredients.length]);

  const updateIngredient = (index: number, updates: Partial<Ingredient>) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], ...updates };
    setIngredients(updated);
  };

  const handleOriginalTextChange = (index: number, value: string) => {
    const updated = [...ingredients];
    const current = updated[index];
    const original = originalState?.ingredients?.[index];
    const originalText = original ? getIngredientText(original) : '';
    const trimmedValue = value.trim();

    if (original && trimmedValue === originalText) {
      updated[index] = {
        ...current,
        originalText: value,
        amount: original.amount ?? null,
        amountMax: original.amountMax ?? null,
        unit: original.unit ?? null,
        name: original.name ?? '',
        aiAmount: original.aiAmount ?? null,
        aiUnit: original.aiUnit ?? null,
        aiName: original.aiName ?? null,
      };
    } else {
      updated[index] = {
        ...current,
        originalText: value,
        amount: null,
        amountMax: null,
        unit: null,
        name: '',
        aiAmount: null,
        aiUnit: null,
        aiName: null,
      };
    }

    setIngredients(updated);
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const addInstruction = () => {
    setInstructions((prev) => {
      const next = [...prev, ''];
      setFocusInstructionIndex(prev.length);
      return next;
    });
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (focusInstructionIndex === null) return;
    const input = instructionInputRefs.current[focusInstructionIndex];
    if (input) {
      input.focus();
    }
    setFocusInstructionIndex(null);
  }, [focusInstructionIndex, instructions.length]);

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
            placeholder="Recipe title"
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

        {/* Metadata fields */}
        <div className={styles.section}>
          <h3>Category</h3>
          <div className={styles.tagsList}>
            {category.map((cat, index) => (
              <div key={index} className={styles.tag}>
                <span>{cat}</span>
                <button
                  onClick={() => setCategory(category.filter((_, i) => i !== index))}
                  className={styles.tagRemove}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className={styles.tagInput}>
            <input
              type="text"
              placeholder="Add category (e.g., Dinner, Dessert, Appetizer)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  if (value && !category.includes(value)) {
                    setCategory([...category, value]);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>
        </div>

        <div className={styles.section}>
          <h3>Cuisine</h3>
          <div className={styles.tagsList}>
            {cuisine.map((cui, index) => (
              <div key={index} className={styles.tag}>
                <span>{cui}</span>
                <button
                  onClick={() => setCuisine(cuisine.filter((_, i) => i !== index))}
                  className={styles.tagRemove}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className={styles.tagInput}>
            <input
              type="text"
              placeholder="Add cuisine (e.g., Italian, Mexican, Chinese)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  if (value && !cuisine.includes(value)) {
                    setCuisine([...cuisine, value]);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>
        </div>

        <div className={styles.section}>
          <h3>Keywords</h3>
          <div className={styles.tagsList}>
            {keywords.map((keyword, index) => (
              <div key={index} className={styles.tag}>
                <span>{keyword}</span>
                <button
                  onClick={() => setKeywords(keywords.filter((_, i) => i !== index))}
                  className={styles.tagRemove}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className={styles.tagInput}>
            <input
              type="text"
              placeholder="Add keyword (e.g., vegetarian, quick, comfort-food)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  if (value && !keywords.includes(value)) {
                    setKeywords([...keywords, value]);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>
        </div>

        <div className={styles.section}>
          <h3>Ingredients *</h3>
          {ingredients.map((ingredient, index) => {
            const unitOptions = ingredient.unit
              && !UNIT_VALUE_SET.has(ingredient.unit as UnitValue)
              ? [{ value: ingredient.unit, label: String(ingredient.unit) }, ...UNIT_OPTIONS]
              : UNIT_OPTIONS;

            return (
              <div key={index} className={styles.ingredientRow}>
                <div className={styles.ingredientGroup}>
                  <input
                    type="text"
                    value={ingredient.originalText || ''}
                    onChange={(e) => handleOriginalTextChange(index, e.target.value)}
                    placeholder="Original text"
                    className={styles.ingredientOriginalInput}
                  />
                  <div className={styles.ingredientGroupRow}>
                    <input
                      type="number"
                      step="any"
                      ref={(el) => {
                        ingredientAmountRefs.current[index] = el;
                      }}
                      value={ingredient.amount ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const parsed = value === '' ? null : parseFloat(value);
                        updateIngredient(index, {
                          amount: parsed !== null && Number.isNaN(parsed) ? null : parsed,
                        });
                      }}
                      placeholder="Amt"
                      className={styles.ingredientAmountInput}
                    />
                  <select
                    value={ingredient.unit || ''}
                    onChange={(e) => updateIngredient(index, { unit: (e.target.value || null) as UnitValue | null })}
                    className={`${styles.ingredientUnitSelect} ${ingredient.unit ? '' : styles.ingredientUnitPlaceholder}`}
                  >
                    <option value="">--</option>
                      {unitOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, { name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && index === ingredients.length - 1) {
                          e.preventDefault();
                          addIngredient();
                        }
                      }}
                      placeholder="Ingredient"
                      className={styles.ingredientNameInput}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeIngredient(index)}
                  className={styles.removeButton}
                  type="button"
                >
                  ×
                </button>
              </div>
            );
          })}
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
              onKeyDown={(event) => {
                if (event.key === 'Enter' && index === instructions.length - 1) {
                  event.preventDefault();
                  addInstruction();
                }
              }}
              registerRef={(element) => {
                instructionInputRefs.current[index] = element;
              }}
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
