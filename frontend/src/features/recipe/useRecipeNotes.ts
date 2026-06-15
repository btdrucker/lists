import { useState, useEffect } from 'react';
import { useAppDispatch } from '../../common/hooks';
import { updateRecipeInState } from '../recipe-list/slice';
import { updateRecipe } from '../../firebase/firestore';
import type { Recipe } from '../../types';

interface UseRecipeNotesReturn {
  notes: string;
  setNotes: (notes: string) => void;
  isSavingNotes: boolean;
  saveNotes: () => Promise<void>;
}

export function useRecipeNotes(recipe: Recipe | null, id: string | undefined): UseRecipeNotesReturn {
  const dispatch = useAppDispatch();
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (recipe) {
      setNotes(recipe.notes ?? '');
    }
  }, [recipe]);

  const buildUpdates = (notesValue: string): { notes: string } => ({
    notes: notesValue.trim(),
  });

  const hasChanged = (currentNotes: string): boolean =>
    currentNotes !== (recipe?.notes ?? '');

  const saveNotes = async (): Promise<void> => {
    if (!recipe || !id || !hasChanged(notes)) return;

    setIsSavingNotes(true);
    try {
      const updates = buildUpdates(notes);
      await updateRecipe(id, updates);
      dispatch(updateRecipeInState({ ...recipe, ...updates, id }));
    } catch (error) {
      console.error('Error saving notes:', error);
      setNotes(recipe.notes ?? '');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Save on unmount (browser back, navigation)
  useEffect(() => {
    return () => {
      if (recipe && id && hasChanged(notes)) {
        updateRecipe(id, buildUpdates(notes)).catch((err) =>
          console.error('Error saving notes on unmount:', err),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, notes, id]);

  // Best-effort save on tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (recipe && id && hasChanged(notes)) {
        updateRecipe(id, buildUpdates(notes)).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [recipe, notes, id]);

  return { notes, setNotes, isSavingNotes, saveNotes };
}
