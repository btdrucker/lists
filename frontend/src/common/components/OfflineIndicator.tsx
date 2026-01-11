import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './offlineIndicator.module.css';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className={styles.indicator}>
      <i className="fa-solid fa-wifi-slash"></i>
      <span>You're offline - some features may be unavailable</span>
    </div>
  );
}
