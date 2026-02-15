import { useSearchParams } from 'react-router-dom';

/**
 * Returns true when ?debug=true is present in the URL.
 * Used to show parsed ingredient fields (amount | unit | name) on Shopping, EditRecipe, and ViewRecipe.
 */
export function useDebugMode(): boolean {
  const [searchParams] = useSearchParams();
  return searchParams.get('debug') === 'true';
}
