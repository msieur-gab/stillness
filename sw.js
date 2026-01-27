const CACHE_NAME = 'stillness-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './yoga_15876064.png',
  './sounds/birds.mp3',
  './sounds/chime.mp3',
  './sounds/cricket.mp3',
  './sounds/fireplace.mp3',
  './sounds/forest.mp3',
  './sounds/rain.mp3',
  './sounds/river.mp3'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
