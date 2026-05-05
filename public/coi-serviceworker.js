/* This file used to add COOP/COEP headers via a service worker so that
 * SharedArrayBuffer was available for the multi-threaded ffmpeg-core.
 * We've since switched to single-threaded ffmpeg-core which doesn't need
 * SAB, so the service worker is no longer needed and was actively breaking
 * exports for users whose browsers cached an older version of this file.
 *
 * This replacement immediately unregisters itself the first time it
 * activates, then reloads any pages that were previously controlled by it.
 * After one reload cycle the user is SW-free and exports work.
 */
self.addEventListener('install', () => {
  // Activate as soon as installed, even if old SW was still active.
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.registration.unregister();
      } catch {}
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const c of clients) {
          try { c.navigate(c.url); } catch {}
        }
      } catch {}
    })()
  );
});
// No fetch handler — let the browser handle requests directly.
