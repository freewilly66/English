const CACHE_NAME = 'stock-ai-cache-v4';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/bundle.js',
  './manifest.json',
  './icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Ignore API calls like Google Gemini or Finnhub for the offline cache
  if (event.request.url.includes('googleapis.com') || event.request.url.includes('finnhub.io')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) return response;
        return fetch(event.request);
      })
  );
});
