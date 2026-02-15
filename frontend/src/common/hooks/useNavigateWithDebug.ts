import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Appends ?debug=true to path when currently in debug mode.
 * Use for building Link `to` props and navigate paths.
 */
export function appendDebugToPath(path: string, isDebug: boolean): string {
  if (!isDebug) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}debug=true`;
}

/**
 * Returns a navigate function that preserves debug=true when the current URL has it.
 * Use instead of useNavigate() so debug mode stays sticky across navigation.
 * To turn off: omit the param or set debug=false in the URL.
 */
export function useNavigateWithDebug() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDebug = searchParams.get('debug') === 'true';

  return useCallback(
    (to: string | { pathname: string; search?: string; state?: unknown }, options?: { replace?: boolean; state?: unknown }) => {
      if (typeof to === 'string') {
        navigate(appendDebugToPath(to, isDebug), options);
      } else {
        const search = isDebug
          ? (to.search ? `${to.search}&debug=true` : 'debug=true')
          : to.search ?? '';
        navigate({ ...to, search: search || undefined }, options);
      }
    },
    [navigate, isDebug]
  );
}
