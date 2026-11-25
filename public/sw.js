const CACHE_NAME = 'atlas-shell-v11';
const APP_BASE = new URL('./', self.registration.scope);
const APP_FILES = [
  APP_BASE.href,
  new URL('index.html', APP_BASE).href,
  new URL('manifest.webmanifest', APP_BASE).href,
  new URL('images/%D0%91%D1%80%D0%BE%D0%BD%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D1%81%20%D0%BD%D0%B0%20%D0%B7%D0%B0%D0%BA%D0%B0%D1%82%D0%B5%20%D1%83%20%D0%BE%D0%B7%D0%B5%D1%80%D0%B0.png', APP_BASE).href,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('atlas-shell-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin || !requestUrl.href.startsWith(APP_BASE.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type !== 'opaque') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const appShell = await cache.match(new URL('index.html', APP_BASE).href)
          || await cache.match(APP_BASE.href);
        if (appShell) return appShell;
      }
      return new Response('Нет подключения к интернету. Эта часть приложения ещё не сохранена на устройстве.', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
