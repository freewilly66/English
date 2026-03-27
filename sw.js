var CACHE='english-habit-v4';
var ASSETS=['./index.html','./manifest.json','./icon.svg'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}));self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}));self.clients.claim();});
self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  var url=e.request.url;
  if(url.includes('allorigins')||url.includes('corsproxy')||url.includes('codetabs')||url.includes('thingproxy')||url.includes('youtube')||url.includes('anthropic')){
    e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));return;
  }
  // index.html: network-first → 배포 즉시 자동 반영
  if(url.endsWith('index.html')||url.endsWith('/')||url.endsWith('/English/')||url.endsWith('/English')){
    e.respondWith(fetch(e.request).then(function(res){
      var clone=res.clone();
      caches.open(CACHE).then(function(c){c.put(e.request,clone);});
      return res;
    }).catch(function(){return caches.match(e.request)||caches.match('./index.html');}));
    return;
  }
  // 나머지 assets: cache-first
  e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request).catch(function(){return caches.match('./index.html');});}));
});
self.addEventListener('message',function(e){if(e.data&&e.data.type==='NAG')try{self.registration.showNotification('📢 영어 듣기',{body:e.data.msg,icon:'./icon.svg',tag:'nag',renotify:true});}catch(err){}});
