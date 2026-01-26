import { ReactNode, useEffect, useCallback } from 'react';
import styles from './dialog.module.css';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  toolbar?: ReactNode;
}

const Dialog = ({ isOpen, onClose, title, children, maxWidth = 'md', toolbar }: DialogProps) => {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={handleBackdropClick} />
      <div className={`${styles.dialog} ${styles[`dialog-${maxWidth}`]}`}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
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
