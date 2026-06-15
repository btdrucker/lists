import { useState } from 'react';
import { getIdToken } from '../../firebase/auth';
import { deleteRecipe } from '../../firebase/firestore';
import type { RecipeWithAiMetadata } from '../../common/aiParsing';
import type { ScrapedRecipeData } from './useEditRecipeForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UseEditRecipeRescrapeParams {
  existingRecipe: RecipeWithAiMetadata | null;
  id: string | undefined;
  hasChangesExcludingNotes: boolean;
  applyScrapedRecipe: (scraped: ScrapedRecipeData) => void;
  setError: (error: string | null) => void;
}

export interface UseEditRecipeRescrapeReturn {
  handleRescrape: () => Promise<void>;
  isRescraping: boolean;
}

export function useEditRecipeRescrape({
  existingRecipe,
  id,
  hasChangesExcludingNotes,
  applyScrapedRecipe,
  setError,
}: UseEditRecipeRescrapeParams): UseEditRecipeRescrapeReturn {
  const [isRescraping, setIsRescraping] = useState(false);

  const handleRescrape = async () => {
    if (!existingRecipe?.sourceUrl || !id) return;

    const confirmMessage = hasChangesExcludingNotes
      ? 'You have unsaved changes (excluding Notes) that will be lost. This will re-scrape the recipe from the source URL and load fresh data (preserving Notes). Continue?'
      : 'This will re-scrape the recipe from the source URL and load fresh data (preserving Notes). You can review the changes before saving. Continue?';
    if (!window.confirm(confirmMessage)) return;

    setIsRescraping(true);
    setError(null);

    try {
      const token = await getIdToken();

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
        if (scrapedRecipe.id && scrapedRecipe.id !== id) {
          try {
            await deleteRecipe(scrapedRecipe.id);
          } catch (err) {
            console.error('Failed to delete duplicate recipe:', err);
          }
        }

        // Preserve current notes; update everything else from scraped data
        applyScrapedRecipe(scrapedRecipe);
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

  return { handleRescrape, isRescraping };
}
