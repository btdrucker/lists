import { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import styles from './installBanner.module.css';

const DISMISSAL_KEY = 'pwa_banner_dismissed_timestamp';

export function InstallBanner() {
  const { isInstallable, isInstalled, isMobile, installPrompt } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed
    const dismissedTimestamp = localStorage.getItem(DISMISSAL_KEY);
    
    if (dismissedTimestamp) {
      // Banner was dismissed, don't show it
      setIsVisible(false);
    } else {
      // Show banner if conditions are met
      setIsVisible(isMobile && isInstallable && !isInstalled);
    }
  }, [isMobile, isInstallable, isInstalled]);

  const handleInstall = async () => {
    await installPrompt();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    // Store dismissal timestamp (permanent dismissal)
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <i className="fa-solid fa-mobile-screen"></i>
        </div>
        <div className={styles.text}>
          <strong>Install Lists</strong>
          <span>Get quick access from your home screen</span>
        </div>
      </div>
      <div className={styles.buttons}>
        <button onClick={handleInstall} className={styles.installButton}>
          Install
        </button>
        <button onClick={handleDismiss} className={styles.dismissButton}>
          Not Now
        </button>
      </div>
    </div>
  );
}
