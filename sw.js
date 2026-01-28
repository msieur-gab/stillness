const CACHE_NAME = 'stillness-v14';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './yoga_15876064.png',
  './styles/tokens.css',
  './styles/global.css',
  './src/app.js',
  './src/components/stillness-ring.js',
  './src/services/audio-service.js',
  './src/services/haptic-service.js',
  './src/services/timer-service.js',
  './src/services/session-service.js',
  './src/services/storage-service.js',

  './src/utils/constants.js',
  './src/utils/format.js',
  './src/utils/gesture.js',
  './sounds/birds.mp3',
  './sounds/chime.mp3',
  './sounds/cricket.mp3',
  './sounds/fireplace.mp3',
  './sounds/forest.mp3',
  './sounds/rain.mp3',
  './sounds/river.mp3',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(LOCAL_ASSETS))
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
  const url = new URL(event.request.url);

  // CDN requests (Lit): network-first with cache fallback
  if (url.hostname === 'esm.sh') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Local assets: cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request);
    })
  );
});
