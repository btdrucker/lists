import { useState, useEffect, useCallback } from 'react';

interface UseWakeLockReturn {
  isSupported: boolean;
  isActive: boolean;
  toggle: () => Promise<void>;
}

export function useWakeLock(): UseWakeLockReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    // Check if Wake Lock API is supported
    setIsSupported('wakeLock' in navigator);
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        try {
          const newWakeLock = await navigator.wakeLock.request('screen');
          setWakeLock(newWakeLock);
        } catch (err) {
          console.error('Error re-acquiring wake lock:', err);
          setIsActive(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLock]);

  const toggle = useCallback(async () => {
    if (!isSupported) return;

    try {
      if (isActive && wakeLock) {
        // Release wake lock
        await wakeLock.release();
        setWakeLock(null);
        setIsActive(false);
      } else {
        // Request wake lock
        const newWakeLock = await navigator.wakeLock.request('screen');
        setWakeLock(newWakeLock);
        setIsActive(true);

        // Listen for release
        newWakeLock.addEventListener('release', () => {
          setIsActive(false);
          setWakeLock(null);
        });
      }
    } catch (err) {
      console.error('Wake lock error:', err);
      setIsActive(false);
    }
  }, [isSupported, isActive, wakeLock]);

  // Clean up wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLock) {
        wakeLock.release().catch(console.error);
      }
    };
  }, [wakeLock]);

  return { isSupported, isActive, toggle };
}
