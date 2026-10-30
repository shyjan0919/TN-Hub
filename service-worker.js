const CACHE_NAME = "tnhub-app-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-64.png"
];

// Install: cache only the static app shell. Do not cache Firebase/API requests.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove older TN HUB app-shell caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("tnhub-app-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin GET requests. Firebase, authentication, and other
  // external requests always go directly to the network for fresh data.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // For page navigations, try the network first and fall back to cached app.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) ||
                 (await caches.match("./index.html")) ||
                 Response.error();
        })
    );
    return;
  }

  // Cache-first for static assets in the app shell only.
  const isAppShellAsset = [
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png",
    "/apple-touch-icon.png",
    "/favicon-64.png"
  ].some((path) => url.pathname.endsWith(path));

  if (isAppShellAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
