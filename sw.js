var CACHE = 'english-habit-v2';
var ASSETS = ['./index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Skip non-GET requests and cross-origin
  if (e.request.method !== 'GET') return;
  
  // For API calls (RSS), try network first
  if (e.request.url.includes('rss2json') || e.request.url.includes('podcast')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }
  
  // For app assets, cache first
  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request).catch(function() {
        return caches.match('./index.html');
      });
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(list) {
      if (list.length) return list[0].focus();
      return clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'NAG') {
    try {
      self.registration.showNotification('📢 영어 듣기 알림', {
        body: e.data.msg,
        icon: './icon.svg',
        tag: 'nag',
        renotify: true,
        requireInteraction: false
      });
    } catch(err) {
      // Notification not supported in this context
    }
  }
});
