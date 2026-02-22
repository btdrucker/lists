import type { ReactNode } from 'react';
import styles from './pageScrollWrapper.module.css';

interface PageScrollWrapperProps {
  children: ReactNode;
}

/**
 * On mobile, body has overflow:hidden so list page headers stay anchored during overscroll.
 * This wrapper provides the scroll container for full-page routes (ViewRecipe, EditRecipe, etc.)
 * so they can still scroll when content overflows.
 */
export function PageScrollWrapper({ children }: PageScrollWrapperProps) {
  return <div className={styles.wrapper}>{children}</div>;
}
