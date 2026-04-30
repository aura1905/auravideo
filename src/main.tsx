import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Register the COOP/COEP service worker so static hosts (GitHub Pages, etc.)
// that can't set those headers still get cross-origin isolation. Skipped in
// dev because the Vite dev server already sets the headers.
if ('serviceWorker' in navigator && !window.crossOriginIsolated) {
  const swUrl = `${import.meta.env.BASE_URL}coi-serviceworker.js`;
  navigator.serviceWorker.register(swUrl).then(
    (reg) => {
      // Reload once so the page is controlled by the SW and becomes isolated.
      const reloadKey = 'coiReloaded';
      if (reg.active && !navigator.serviceWorker.controller && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        location.reload();
      }
    },
    (err) => console.warn('coi-serviceworker register failed:', err)
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
