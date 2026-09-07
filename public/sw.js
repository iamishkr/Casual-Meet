// CasualMeet Service Worker for PWA installation & asset caching
const CACHE_NAME = 'casualmeet-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle API requests directly
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Respond with network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
