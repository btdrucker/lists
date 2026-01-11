import { useState, useEffect } from 'react';
import styles from './updatePrompt.module.css';

export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handleNeedRefresh = () => {
      setShowUpdate(true);
    };

    window.addEventListener('swNeedRefresh', handleNeedRefresh);

    return () => {
      window.removeEventListener('swNeedRefresh', handleNeedRefresh);
    };
  }, []);

  const handleUpdate = () => {
    const updateSW = (window as any).updateSW;
    if (updateSW) {
      updateSW(true); // This will skip waiting and reload
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className={styles.prompt}>
      <div className={styles.content}>
        <i className="fa-solid fa-arrow-rotate-right"></i>
        <span>New version available!</span>
      </div>
      <div className={styles.buttons}>
        <button onClick={handleUpdate} className={styles.updateButton}>
          Update Now
        </button>
        <button onClick={handleDismiss} className={styles.dismissButton}>
          Later
        </button>
      </div>
    </div>
  );
}
