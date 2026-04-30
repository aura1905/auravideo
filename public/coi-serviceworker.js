/*! coi-serviceworker — adapted from gzuidhof/coi-serviceworker (MIT)
 * Adds Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy headers
 * on responses so SharedArrayBuffer / cross-origin-isolation works on
 * static hosts that can't set custom headers (e.g. GitHub Pages). */
let coepCredentialless = false;
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener('message', (ev) => {
    if (!ev.data) return;
    if (ev.data.type === 'deregister') {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll().then((clients) => clients.forEach((c) => c.navigate(c.url))));
    } else if (ev.data.type === 'coepCredentialless') {
      coepCredentialless = ev.data.value;
    }
  });
  self.addEventListener('fetch', (event) => {
    const r = event.request;
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;
    const request =
      coepCredentialless && r.mode === 'no-cors' ? new Request(r, { credentials: 'omit' }) : r;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) return response;
          const headers = new Headers(response.headers);
          headers.set(
            'Cross-Origin-Embedder-Policy',
            coepCredentialless ? 'credentialless' : 'require-corp'
          );
          if (!coepCredentialless) headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem('coiReloadedBySelf');
    window.sessionStorage.removeItem('coiReloadedBySelf');
    const coi = {
      shouldRegister: () => !reloadedBySelf,
      shouldDeregister: () => false,
      coepCredentialless: () => true,
      coepDegrade: () => true,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi,
    };
    const n = navigator;
    if (n.serviceWorker && n.serviceWorker.controller) {
      n.serviceWorker.controller.postMessage({
        type: 'coepCredentialless',
        value: !window.crossOriginIsolated ? false : coi.coepCredentialless(),
      });
      if (coi.shouldDeregister()) n.serviceWorker.controller.postMessage({ type: 'deregister' });
    }
    if (!window.crossOriginIsolated && !window.sessionStorage.getItem('coiReloadedBySelf') && coi.shouldRegister()) {
      if (n.serviceWorker) {
        const scriptSrc = window.document.currentScript?.src || './coi-serviceworker.js';
        n.serviceWorker.register(scriptSrc).then(
          (registration) => {
            registration.addEventListener('updatefound', () => {
              window.sessionStorage.setItem('coiReloadedBySelf', 'updatedSW');
              coi.doReload();
            });
            if (registration.active && !n.serviceWorker.controller) {
              window.sessionStorage.setItem('coiReloadedBySelf', 'notControlling');
              coi.doReload();
            }
          },
          (err) => {
            if (!coi.quiet) console.error('COOP/COEP Service Worker failed to register:', err);
          }
        );
      }
    }
  })();
}
