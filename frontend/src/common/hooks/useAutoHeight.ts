import { useEffect, useRef } from 'react';

/**
 * Hook to automatically adjust textarea height based on content
 * Similar to the auto-height behavior in the groups app Compose component
 * 
 * @param value - The current value of the textarea (triggers resize)
 * @param minLines - Minimum number of lines to display (default: 1)
 */
export function useAutoHeight<T extends HTMLTextAreaElement>(
  value: string,
  minLines: number = 1
): React.RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Set minimum height: minLines * 1em + some space for padding
    //element.style.minHeight = `${minLines + 0.25}em`;

    // Reset height to recalculate
    element.style.height = 'auto';
    
    // Get the natural content height (includes padding)
    const scrollHeight = element.scrollHeight;
    
    // Apply the content height
    element.style.height = `${scrollHeight}px`;
  }, [value, minLines]);

  return ref;
}

