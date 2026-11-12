/*
  Service Worker - Offline-Fähigkeit ohne Build-Manifest.

  Der Vite-Build erzeugt hash-basierte Dateinamen (z.B. index-8f3a2b1c.js),
  die sich bei jedem Build ändern. Statt eine Asset-Liste zu pflegen, die
  sofort veraltet, gilt daher:
  - App-Shell (/) wird beim Install vorgehalten
  - alle statischen Assets landen beim ersten Abruf im Cache
    (stale-while-revalidate)
  - /api/ läuft network-first mit Cache-Fallback, damit eine geladene
    Einheit auch ohne WLAN weiterläuft
  - /media/ (Übungs-GIFs) läuft cache-first, der Dataset-Inhalt ändert
    sich nicht
*/
const CACHE = "fitnessschmiede-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
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
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    // Network-first: aktuelle Daten wenn online, sonst letzter bekannter Stand
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

  if (url.pathname.startsWith("/media/")) {
    // Cache-first: Bilder/GIFs aus dem Dataset sind unveränderlich
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    // Navigation immer frisch versuchen, offline auf das Shell-HTML fallen
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", clone));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Statische Assets (hashed js/css, Icons): stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
