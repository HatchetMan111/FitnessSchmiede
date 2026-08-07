const CACHE = "fitnessschmiede-v1";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/css/tokens.css",
  "/css/app.css",
  "/js/app.js",
  "/js/api.js",
  "/js/dashboard.js",
  "/js/session.js",
  "/icons/icon.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const isApi = request.url.includes("/api/");

  if (isApi) {
    // Network-first: aktuelle Daten wenn online, sonst letzter bekannter
    // Stand - damit eine bereits geladene Einheit auch ohne WLAN weiterläuft.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App-Shell und Medien: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
