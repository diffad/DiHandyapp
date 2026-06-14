/* DiHandyApp Service Worker – App-Shell cachen, APIs immer live */
const CACHE = 'dihandy-v1.0.015';
const SHELL = [
  '.',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API-Aufrufe (Open-Meteo, Rainviewer, Nominatim, Tiles) nie cachen
  if (url.origin !== location.origin) {
    // CDN-Assets (Leaflet, Fonts) cache-first
    const cdn = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
    if (cdn.some((h) => url.hostname.endsWith(h))) {
      e.respondWith(
        caches.match(e.request).then((hit) =>
          hit || fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
        )
      );
    }
    return;
  }

  // Eigene Dateien: network-first mit Cache-Fallback (für offline);
  // ignoreSearch, damit z.B. app.js?v=… auf das gecachte app.js fällt
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
