const CACHE_NAME = 'neko-shell-v31';
const APP_SHELL = [
  './', './index.html', './favicon.svg', './loading-logo.svg', './site.webmanifest',
  './assets/app.css?v=1.4.13', './assets/app.js?v=1.4.13',
  './miko/memory.js?v=1.3.3', './miko/catalog.js?v=1.3.3',
  './miko/catalog-extra.js?v=1.4.11',
  './miko/assistant.js?v=1.3.3', './classroom/room.js?v=1.4.4'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => (key.startsWith('netquest-shell-')||key.startsWith('neko-shell-')) && key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/realtime') return;

  event.respondWith((async()=>{
    try{
      const response=await fetch(request);
      if(response.ok){const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone())}
      return response;
    }catch(error){
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate')return caches.match('./index.html');
      throw error;
    }
  })());
});