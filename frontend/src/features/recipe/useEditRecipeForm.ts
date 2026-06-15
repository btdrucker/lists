import { useState, useEffect, useRef, useMemo, type Dispatch, type SetStateAction, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { useAutoHeight } from '../../common/hooks';
import { getIngredientText } from '../../common/aiParsing';
import type { RecipeWithAiMetadata } from '../../common/aiParsing';
import type { Ingredient } from '../../types';
import { applyAiIngredientDefaults } from './recipe-utils';

type OriginalState = {
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
} | null;

export interface UseEditRecipeFormReturn {
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  imageUrl: string;
  setImageUrl: Dispatch<SetStateAction<string>>;
  servings: string;
  setServings: Dispatch<SetStateAction<string>>;
  prepTime: string;
  setPrepTime: Dispatch<SetStateAction<string>>;
  cookTime: string;
  setCookTime: Dispatch<SetStateAction<string>>;
  category: string[];
  setCategory: Dispatch<SetStateAction<string[]>>;
  cuisine: string[];
  setCuisine: Dispatch<SetStateAction<string[]>>;
  keywords: string[];
  setKeywords: Dispatch<SetStateAction<string[]>>;
  ingredients: Ingredient[];
  setIngredients: Dispatch<SetStateAction<Ingredient[]>>;
  instructions: string[];

  descriptionRef: RefObject<HTMLTextAreaElement | null>;
  notesRef: RefObject<HTMLTextAreaElement | null>;
  ingredientKeys: number[];
  instructionKeys: number[];

  hasActualChanges: boolean;
  hasChangesExcludingNotes: boolean;

  addIngredient: () => void;
  removeIngredient: (index: number) => void;
  handleOriginalTextChange: (index: number, value: string) => void;
  ingredientKeys: number[];

  addInstruction: () => void;
  removeInstruction: (index: number) => void;
  updateInstruction: (index: number, value: string) => void;
  instructionKeys: number[];

  ingredientInputRefs: RefObject<Array<HTMLInputElement | null>>;
  instructionInputRefs: RefObject<Array<HTMLTextAreaElement | null>>;

  applyScrapedRecipe: (scraped: ScrapedRecipeData) => void;
}

export interface ScrapedRecipeData {
  title?: string;
  description?: string;
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  category?: string[];
  cuisine?: string[];
  keywords?: string[];
  ingredients: Ingredient[];
  instructions: string[];
}

export function useEditRecipeForm(
  existingRecipe: RecipeWithAiMetadata | null,
  isNewRecipe: boolean,
): UseEditRecipeFormReturn {
  const location = useLocation();

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

  const [originalState, setOriginalState] = useState<OriginalState>(null);

  const [focusIngredientIndex, setFocusIngredientIndex] = useState<number | null>(null);
  const [focusInstructionIndex, setFocusInstructionIndex] = useState<number | null>(null);

  const ingredientInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const instructionInputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const keyRef = useRef(0);
  const nextKey = () => ++keyRef.current;
  const [ingredientKeys, setIngredientKeys] = useState<number[]>(() => [nextKey()]);
  const [instructionKeys, setInstructionKeys] = useState<number[]>(() => [nextKey()]);

  const descriptionRef = useAutoHeight<HTMLTextAreaElement>(description);
  const notesRef = useAutoHeight<HTMLTextAreaElement>(notes);

  // Load initial title from navigation state (for manual create flow)
  useEffect(() => {
    const state = location.state as { initialTitle?: string } | null;
    if (state?.initialTitle && isNewRecipe) {
      setTitle(state.initialTitle);
      setOriginalState(null);
    }
  }, [isNewRecipe, location]);

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
          : [''],
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
      setIngredientKeys(initialState.ingredients.map(() => nextKey()));
      setInstructionKeys(initialState.instructions.map(() => nextKey()));
      setOriginalState(initialState);
    }
  }, [existingRecipe]);

  const hasChangesExcludingNotes = useMemo((): boolean => {
    if (!originalState) return true;

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
  }, [title, description, imageUrl, servings, prepTime, cookTime, ingredients, instructions, category, cuisine, keywords, originalState]);

  const hasActualChanges = useMemo((): boolean => {
    if (hasChangesExcludingNotes) return true;
    return notes.trim() !== (originalState?.notes || '');
  }, [hasChangesExcludingNotes, notes, originalState]);

  // Ingredient management
  const addIngredient = () => {
    setIngredients((prev) => {
      setFocusIngredientIndex(prev.length);
      return [...prev, { amount: null, unit: null, name: '', originalText: '' }];
    });
    setIngredientKeys((prev) => [...prev, nextKey()]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
    setIngredientKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOriginalTextChange = (index: number, value: string) => {
    setIngredients((prev) => {
      const updated = [...prev];
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

      return updated;
    });
  };

  useEffect(() => {
    if (focusIngredientIndex === null) return;
    const input = ingredientInputRefs.current[focusIngredientIndex];
    if (input) input.focus();
    setFocusIngredientIndex(null);
  }, [focusIngredientIndex, ingredients.length]);

  // Instruction management
  const addInstruction = () => {
    setInstructions((prev) => {
      setFocusInstructionIndex(prev.length);
      return [...prev, ''];
    });
    setInstructionKeys((prev) => [...prev, nextKey()]);
  };

  const removeInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
    setInstructionKeys((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, value: string) => {
    setInstructions((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  useEffect(() => {
    if (focusInstructionIndex === null) return;
    const input = instructionInputRefs.current[focusInstructionIndex];
    if (input) input.focus();
    setFocusInstructionIndex(null);
  }, [focusInstructionIndex, instructions.length]);

  const applyScrapedRecipe = (scraped: ScrapedRecipeData) => {
    setTitle(scraped.title || '');
    setDescription(scraped.description || '');
    setImageUrl(scraped.imageUrl || '');
    setServings(scraped.servings?.toString() || '');
    setPrepTime(scraped.prepTime?.toString() || '');
    setCookTime(scraped.cookTime?.toString() || '');
    setCategory(scraped.category || []);
    setCuisine(scraped.cuisine || []);
    setKeywords(scraped.keywords || []);
    const newIngredients = scraped.ingredients.length > 0
      ? applyAiIngredientDefaults(scraped.ingredients)
      : [{ amount: null, unit: null, name: '', originalText: '' }];
    const newInstructions = scraped.instructions.length > 0 ? scraped.instructions : [''];
    setIngredients(newIngredients);
    setInstructions(newInstructions);
    setIngredientKeys(newIngredients.map(() => nextKey()));
    setInstructionKeys(newInstructions.map(() => nextKey()));
  };

  return {
    title, setTitle,
    description, setDescription,
    notes, setNotes,
    imageUrl, setImageUrl,
    servings, setServings,
    prepTime, setPrepTime,
    cookTime, setCookTime,
    category, setCategory,
    cuisine, setCuisine,
    keywords, setKeywords,
    ingredients, setIngredients,
    instructions,
    descriptionRef,
    notesRef,
    ingredientInputRefs,
    instructionInputRefs,
    hasActualChanges,
    hasChangesExcludingNotes,
    addIngredient,
    removeIngredient,
    handleOriginalTextChange,
    ingredientKeys,
    addInstruction,
    removeInstruction,
    updateInstruction,
    instructionKeys,
    applyScrapedRecipe,
  };
}
