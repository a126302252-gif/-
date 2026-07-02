const ADMIN_CACHE = "cll-admin-pwa-v2";
const ADMIN_SHELL = [
  "/admin.html",
  "/admin.css?v=20260702-admin-v2",
  "/admin.js?v=20260702-admin-v2",
  "/manifest.webmanifest",
  "/assets/dragon-premium-hero.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ADMIN_CACHE)
      .then((cache) => cache.addAll(ADMIN_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== ADMIN_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.includes("script.google.com")) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(ADMIN_CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
