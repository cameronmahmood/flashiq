// Bump this when you ship changes
const CACHE = "flashiq-v3";

self.addEventListener("install", (event) => {
  // Take control sooner
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Optional: pre-cache your static files
    await cache.addAll([
      "./",
      "./index.html",
      "./manifest.webmanifest",
      // add icons if you have them:
      // "./icon-192.png", "./icon-512.png",
    ]);
  })());
});

self.addEventListener("activate", (event) => {
  // Clean old caches and take control of all pages
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// Helper: identify HTML navigation requests
function isHTMLRequest(request) {
  return request.mode === "navigate" ||
         (request.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // NETWORK-FIRST for HTML → always try network, fallback to cache
  if (isHTMLRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        // Update cache in background
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        // Final fallback to root
        return caches.match("./index.html");
      }
    })());
    return;
  }

  // CACHE-FIRST for everything else (CSS/JS/images)
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    // Only cache successful GETs
    if (req.method === "GET" && fresh && fresh.status === 200) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  })());
});
