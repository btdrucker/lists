import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Will be handled by UpdatePrompt component
    window.dispatchEvent(new CustomEvent('swNeedRefresh'));
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

// Make updateSW available globally for UpdatePrompt component
(window as any).updateSW = updateSW;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
