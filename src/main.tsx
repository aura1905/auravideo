import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// We previously registered a service worker (coi-serviceworker) to add
// COOP/COEP headers for SharedArrayBuffer support, needed by the multi-
// threaded ffmpeg-core. We've since switched to single-threaded ffmpeg-core
// which doesn't need SAB, and the SW was actively breaking exports for
// users whose browsers cached older versions of it.
//
// Strategy: forcibly unregister ANY service worker registered for this
// origin on every page load. Combined with the self-unregistering
// coi-serviceworker.js (defensive: in case the browser still tries to
// fetch it), this guarantees a SW-free environment within one reload.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async (regs) => {
    if (regs.length === 0) return;
    for (const reg of regs) {
      try { await reg.unregister(); } catch {}
    }
    // If we were controlled by an old SW, reload to escape its grip
    // so the page runs without any SW interception.
    if (navigator.serviceWorker.controller) {
      const reloadKey = 'swCleanedV2';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        location.reload();
      }
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
