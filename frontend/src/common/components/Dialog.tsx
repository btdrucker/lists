import type { ReactNode } from 'react';
import { useEffect, useCallback } from 'react';
import styles from './dialog.module.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when backdrop is clicked or Escape is pressed. Falls back to onClose if not provided. */
  onDismiss?: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  toolbar?: ReactNode;
  headerActions?: ReactNode;
}

const Dialog = ({ isOpen, onClose, onDismiss, title, children, maxWidth = 'md', toolbar, headerActions }: DialogProps) => {
  const handleDismiss = onDismiss ?? onClose;

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={handleBackdropClick} />
      <div className={`${styles.dialog} ${styles[`dialog-${maxWidth}`]}`}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.headerActions}>
            {headerActions}
            <button className={styles.closeButton} onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </header>
        {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </>
  );
};

export default Dialog;
