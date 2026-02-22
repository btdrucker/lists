import { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import styles from './installBanner.module.css';

const DISMISSAL_KEY = 'pwa_banner_dismissed_timestamp';
const RE_PROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function shouldShowAfterDismissal(): boolean {
  const dismissedTimestamp = localStorage.getItem(DISMISSAL_KEY);
  if (!dismissedTimestamp) return true;
  const dismissedAt = parseInt(dismissedTimestamp, 10);
  return Date.now() - dismissedAt > RE_PROMPT_AFTER_MS;
}

export function InstallBanner() {
  const { isInstallable, isInstalled, isMobile, isIOS, installPrompt } =
    usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const canInstall = isInstallable || isIOS;
    setIsVisible(
      isMobile && canInstall && !isInstalled && shouldShowAfterDismissal()
    );
  }, [isMobile, isInstallable, isIOS, isInstalled]);

  const handleInstall = async () => {
    if (isInstallable) {
      await installPrompt();
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  const showIOSInstructions = isIOS && !isInstallable;

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <i className="fa-solid fa-mobile-screen"></i>
        </div>
        <div className={styles.text}>
          <strong>Install Lists</strong>
          {showIOSInstructions ? (
            <span className={styles.instructions}>
              Tap the <i className="fa-solid fa-share-from-square" aria-hidden /> Share button at the bottom of Safari, then tap &quot;Add to Home Screen&quot;
            </span>
          ) : (
            <span>Get quick access from your home screen</span>
          )}
        </div>
      </div>
      <div className={styles.buttons}>
        <button onClick={handleInstall} className={styles.installButton}>
          {showIOSInstructions ? 'Got it' : 'Install'}
        </button>
        <button onClick={handleDismiss} className={styles.dismissButton}>
          Not Now
        </button>
      </div>
    </div>
  );
}
