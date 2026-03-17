var CACHE='english-habit-v3';
var ASSETS=['./index.html','./manifest.json','./icon.svg'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}));self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}));self.clients.claim();});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  if(e.request.url.includes('allorigins')||e.request.url.includes('corsproxy')||e.request.url.includes('youtube')||e.request.url.includes('anthropic')){
    e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));return;
  }
  e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request).catch(function(){return caches.match('./index.html');});}));
});
self.addEventListener('message',function(e){if(e.data&&e.data.type==='NAG')try{self.registration.showNotification('📢 영어 듣기',{body:e.data.msg,icon:'./icon.svg',tag:'nag',renotify:true});}catch(err){}});
