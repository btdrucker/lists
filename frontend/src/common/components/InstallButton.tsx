import { usePWAInstall } from '../hooks/usePWAInstall';
import IconButton from './IconButton.tsx';

export function InstallButton() {
  const { isInstallable, isInstalled, isMobile, installPrompt } = usePWAInstall();

  // Only show on mobile when installable and not already installed
  if (!isMobile || !isInstallable || isInstalled) {
    return null;
  }

  return (
    <IconButton
      onClick={installPrompt}
      icon="fa-download"
      hideTextOnMobile={true}
    >
      Install App
    </IconButton>
  );
}
