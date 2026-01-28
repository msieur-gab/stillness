const CACHE_NAME = 'stillness-v18';

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
  // Sounds - shared
  './sounds/chime.mp3',
  './sounds/rain.mp3',
  './sounds/forest.mp3',
  './sounds/soft-peaceful-piano-melody-309269.mp3',
  './sounds/binaural-beats_delta_440_440-5hz-48565.mp3',
  './sounds/uplifting-pad-texture-113842.mp3',
  './sounds/beach-waves-binaural-72494.mp3',
  // Sounds - Focusing
  './sounds/handpan-dream-olistik-sound-project-patrizio-yoga-137080.mp3',
  // Sounds - Meditating
  './sounds/river.mp3',
  './sounds/sea-wave-34088.mp3',
  './sounds/wind-chimes-no-background-noise-57238.mp3',
  // Sounds - Sleeping
  './sounds/cricket.mp3',
  './sounds/fireplace.mp3',
  './sounds/thunderstorm-108454.mp3',
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
