const ADMIN_CACHE = "cll-admin-pwa-v12";
const ADMIN_SHELL = [
  "/admin.html",
  "/admin.css?v=20260703-admin-v4",
  "/admin.js?v=20260703-admin-speed-1",
  "/manifest.webmanifest",
  "/assets/admin-icon-512.png"
];

function isAdminAsset(url) {
  return url.pathname === "/admin.html"
    || url.pathname === "/admin.css"
    || url.pathname === "/admin.js"
    || url.pathname === "/manifest.webmanifest"
    || url.pathname === "/assets/admin-icon-512.png";
}

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

  if (!isAdminAsset(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && response.type !== "opaque") {
        const copy = response.clone();
        caches.open(ADMIN_CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
